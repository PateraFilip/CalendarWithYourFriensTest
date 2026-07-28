# Supabase – nový model událostí

Tento adresář obsahuje **cílové schéma DB**, migraci a **upravené Edge Functions** pro model `event_series` + `recurrence_rule` (JSON).

## Migrace regionu Paříž → Frankfurt

**Aktuální produkční projekt (Frankfurt):** `pnbcylzrudowpeiikult`  
`https://pnbcylzrudowpeiikult.supabase.co`

Starý Paříž projekt `sdzyhihtqrgsntbxlugp` nech jako fallback pár dní, pak pause/delete.

Region u existujícího projektu **nejde změnit**. Postup: nový projekt ve Frankfurtu (`eu-central-1`) + dump/restore.

1. Vytvoř [Personal Access Token](https://supabase.com/dashboard/account/tokens).
2. Zjisti **Database password** starého projektu (Settings → Database; případně reset).
3. Zkopíruj [`scripts/.env.migration.example`](scripts/.env.migration.example) do **kořene repo** jako `.env.migration` a doplň:
   - `SUPABASE_ACCESS_TOKEN`
   - `OLD_DB_PASSWORD`
   - `NEW_DB_PASSWORD` (heslo pro nový projekt)
4. Spusť:

```powershell
powershell -ExecutionPolicy Bypass -File supabase/scripts/migrate-paris-to-frankfurt.ps1
```

Skript vytvoří projekt ve Frankfurtu (pokud není `NEW_PROJECT_REF`), udělá dump a restore.

5. Po skriptu:
   - Realtime publications (tabulky z AppData)
   - Database Webhooks → `send-notification`
   - Auth URLs / OAuth
   - `node supabase/scripts/copy-storage-bucket.mjs` (bucket `league-covers`)
   - `supabase link --project-ref <NEW_REF>` + deploy functions + secrets
   - **Znovu nastav Edge secret `FIREBASE_SERVICE_ACCOUNT`** (nejde zkopírovat přes CLI — jen digest)
   - Přepni `.env` appky na novou URL + anon key

**Nepoužívej** `migrate-from-old-supabase.mjs` pro změnu regionu — ten je jen na legacy schema migraci.

Oficiální docs: [Migrating within Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

---

## Postup nasazení (nový projekt + migrace dat / legacy schema)

1. V **novém** Supabase projektu spusť `schema.sql`
2. Migruj data ze **starého** projektu (`sdzyhihtqrgsntbxlugp`):

```powershell
$env:OLD_SUPABASE_SERVICE_ROLE_KEY="service_role_klíč_STARÉHO_projektu"
$env:NEW_SUPABASE_URL="https://TVUJ-NOVY-REF.supabase.co"
$env:NEW_SUPABASE_SERVICE_ROLE_KEY="service_role_klíč_NOVÉHO_projektu"
node supabase/scripts/migrate-from-old-supabase.mjs
```

3. V novém projektu spusť `migration-post.sql`
4. Nahraj Edge Functions z `supabase/functions/`
5. **Database Webhooks** → Edge Function `send-notification` (viz sekce níže)

Alternativa bez skriptu: v `migration.sql` odkomentuj blok **METODA A** (postgres_fdw + heslo ke staré DB).

---

| Tabulka | Účel |
|---------|------|
| `users` | Uživatelé, přihlášení |
| `colors` | Barvy kalendáře |
| `password_resets` | Reset hesla |
| **`event_series`** | **Šablona události + `recurrence_rule` JSON** |
| **`series_exceptions`** | Zrušení / úprava konkrétní instance |
| `event_users` | Účast na skupinové sérii (`series_id`) |
| `event_messages` | Chat (`series_id`) |
| `user_notification_settings` | Preference upozornění (sync z app) |
| `user_devices` | FCM tokeny (mobil) |
| `web_push_subscriptions` | Web Push odběry |

### Legacy (po migraci smazat)

- `events`, `weekly_events`, `event_exceptions`

---

## `recurrence_rule` – příklady JSON

### Jednorázová
```json
{ "type": "once", "start_date": "2026-06-15", "end_date": "2026-06-15" }
```

### Každý týden (Po, St)
```json
{ "type": "weekly", "days": ["Po", "St"], "interval": 1 }
```

### Týdně kromě léta
```json
{
  "type": "seasonal",
  "base": { "type": "weekly", "days": ["Po"], "interval": 1 },
  "exclude_ranges": [{ "from": "2026-07-01", "to": "2026-08-31" }]
}
```

### Krátký / dlouhý týden
```json
{
  "type": "alternating_weeks",
  "anchor_date": "2026-01-05",
  "week_a": { "days": ["Po", "Út", "St", "Čt", "Pá"] },
  "week_b": { "days": ["Po", "Út", "St"] }
}
```

### 2 dny práce, 1 den volno (cyklus)
```json
{
  "type": "pattern",
  "anchor_date": "2026-01-01",
  "cycle_days": 3,
  "pattern": [
    { "work": true, "start": "06:00", "end": "18:00" },
    { "work": true, "start": "06:00", "end": "18:00" },
    { "work": false }
  ]
}
```

---

## Edge Functions – mapování

| Funkce | Změna |
|--------|--------|
| `clever-service` | Vytváří záznam v `event_series` |
| `add_weekly_event` | Totéž s `recurrence_rule.type = weekly` |
| `get_all_events` | Expanduje série do instancí (zpětně kompatibilní formát) |
| `get-weekly-events` | Vrací weekly řádky ze `event_series` |
| `get-event-exception` | Čte `series_exceptions` |
| `add-weekly-exception` | Zapisuje do `series_exceptions` |
| `update-event` / `update-weekly-events` | Aktualizují `event_series` |
| `delete-event` / `delete-weekly-event` | Mažou `event_series` |
| `join-event` / `cancel-event` | `series_id` (+ fallback `event_id`) |
| `get-user-events` | Vrací `series_id` jako `event_id` |
| `notifications` / `web-notifications` | Webhook na `event_series` |
| `event-user-*` | `series_id` místo `event_id` |

**Beze změny:** `smart-processor`, `register`, `reset-password`, `forgot-password`, `update-color`, `get-users`, `get-colors`

---

## Nová funkce (volitelně)

`get-event-series` – surový seznam sérií bez expandování (pro admin / import PDF):

```bash
supabase functions deploy get-event-series
```

---

## Webhooky v Supabase (push mimo appku)

Když je aplikace **zavřená**, lokální Realtime notifikace nefungují. Push jde jen přes FCM:

`INSERT` → Database Webhook → Edge Function **`send-notification`** → FCM → zařízení.

| Tabulka | Události | Edge Function |
|---------|----------|---------------|
| `user_notifications` | INSERT | `send-notification` |
| `event_messages` | INSERT | `send-notification` |
| `friendships` | INSERT (žádost), UPDATE (přijetí) | `send-notification` |

Narozeniny: `pg_cron` job `check-birthdays` (`0 8 * * *` UTC) volá `check_and_insert_birthdays()` → INSERT do `user_notifications` → webhook.

URL: `https://<PROJECT_REF>.supabase.co/functions/v1/send-notification`

Secret Edge Function: `FIREBASE_SERVICE_ACCOUNT` = celý JSON service accountu Firebase.

Ověření: po přihlášení musí v `user_devices` být FCM token; v logu Edge Function nesmí být `Missing FIREBASE_SERVICE_ACCOUNT` / 401.

---

## Kompatibilita s aplikací

Funkce vrací **starý formát** (`id`, `den_od`, `cas_od`, …) + nová pole:

- `series_id` – ID šablony
- `instance_date` – konkrétní den instance
- `recurrence_rule` – u create/update

Klient může postupně přejít na expandované instance; během migrace fungují obě tabulky (fallback na legacy).
