#!/usr/bin/env node
/**
 * Migrace dat: STARÝ Supabase projekt → NOVÝ Supabase projekt
 *
 * Použití:
 *   1. V novém projektu spusť schema.sql
 *   2. Nastav proměnné prostředí (viz .env.example níže)
 *   3. node supabase/scripts/migrate-from-old-supabase.mjs
 *
 * .env (nebo export v terminálu):
 *   OLD_SUPABASE_URL=https://sdzyhihtqrgsntbxlugp.supabase.co
 *   OLD_SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   NEW_SUPABASE_URL=https://NOVY-PROJECT.supabase.co
 *   NEW_SUPABASE_SERVICE_ROLE_KEY=eyJ...
 */

import { createClient } from '@supabase/supabase-js';

const OLD_URL = process.env.OLD_SUPABASE_URL ?? 'https://sdzyhihtqrgsntbxlugp.supabase.co';
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error(`
Chybí proměnné prostředí:

  OLD_SUPABASE_SERVICE_ROLE_KEY  – service role klíč STARÉHO projektu
  NEW_SUPABASE_URL               – URL nového projektu
  NEW_SUPABASE_SERVICE_ROLE_KEY  – service role klíč NOVÉHO projektu

Volitelně:
  OLD_SUPABASE_URL (výchozí: ${OLD_URL})

Service role klíč: Supabase Dashboard → Project Settings → API → service_role
`);
  process.exit(1);
}

const oldDb = createClient(OLD_URL, OLD_KEY);
const newDb = createClient(NEW_URL, NEW_KEY);

/** weekly_events.id → event_series.id */
const weeklyIdMap = new Map();

async function fetchAll(client, table, select = '*') {
  const { data, error } = await client.from(table).select(select);
  if (error) {
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      console.warn(`  ⚠ Tabulka ${table} ve zdroji neexistuje – přeskočeno`);
      return [];
    }
    throw new Error(`${table}: ${error.message}`);
  }
  return data ?? [];
}

async function insertBatch(client, table, rows, batchSize = 100) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await client.from(table).insert(chunk);
    if (error) throw new Error(`${table} insert: ${error.message}`);
  }
}

function toTime(v) {
  if (!v) return '00:00:00';
  const s = String(v);
  return s.length === 5 ? `${s}:00` : s;
}

function toDate(v) {
  if (!v) return null;
  return String(v).slice(0, 10);
}

async function migrateUsers() {
  console.log('→ users');
  const rows = await fetchAll(oldDb, 'users');
  await insertBatch(newDb, 'users', rows.map((u) => ({
    id: u.id,
    username: u.username,
    heslo: u.heslo,
    email: u.email,
    jmeno: u.jmeno,
    prijmeni: u.prijmeni,
    datum_narozeni: u.datum_narozeni,
  })));
  console.log(`  ✓ ${rows.length} uživatelů`);
}

async function migrateColors() {
  console.log('→ colors');
  const rows = await fetchAll(oldDb, 'colors');
  await insertBatch(newDb, 'colors', rows);
  console.log(`  ✓ ${rows.length} barev`);
}

async function migratePasswordResets() {
  console.log('→ password_resets');
  const rows = await fetchAll(oldDb, 'password_resets');
  await insertBatch(newDb, 'password_resets', rows);
  console.log(`  ✓ ${rows.length} resetů`);
}

async function migrateEventsToSeries() {
  console.log('→ event_series (z events – jednorázové / skupinové)');
  const events = await fetchAll(oldDb, 'events');
  const onceEvents = events.filter((e) => !e.pravidelnost);

  const seriesRows = onceEvents.map((e) => ({
    id: e.id,
    nazev: e.nazev,
    zakladatel_id: e.zakladatel_id,
    pocet_lidi: e.pocet_lidi ?? 1,
    is_group: !!e.is_group,
    cas_od: toTime(e.cas_od),
    cas_do: toTime(e.cas_do),
    recurrence_rule: {
      type: 'once',
      start_date: toDate(e.den_od),
      end_date: toDate(e.den_do ?? e.den_od),
    },
    valid_from: toDate(e.den_od),
    valid_until: toDate(e.den_do ?? e.den_od),
  }));

  await insertBatch(newDb, 'event_series', seriesRows);
  console.log(`  ✓ ${seriesRows.length} sérií z events`);
}

async function migrateWeeklyToSeries() {
  console.log('→ event_series (z weekly_events)');
  const weekly = await fetchAll(oldDb, 'weekly_events');

  for (const w of weekly) {
    const { data, error } = await newDb.from('event_series').insert({
      nazev: w.nazev,
      zakladatel_id: w.zakladatel_id,
      pocet_lidi: 1,
      is_group: false,
      cas_od: toTime(w.cas_od),
      cas_do: toTime(w.cas_do),
      recurrence_rule: {
        type: 'weekly',
        days: [String(w.den).trim()],
        interval: 1,
        _legacy_weekly_id: w.id,
      },
      valid_from: new Date().toISOString().slice(0, 10),
    }).select('id').single();

    if (error) throw new Error(`weekly ${w.id}: ${error.message}`);
    weeklyIdMap.set(w.id, data.id);
  }

  console.log(`  ✓ ${weekly.length} weekly → event_series`);
}

function resolveSeriesId(oldEventId) {
  if (weeklyIdMap.has(oldEventId)) return weeklyIdMap.get(oldEventId);
  return oldEventId;
}

async function migrateExceptions() {
  console.log('→ series_exceptions');
  const rows = await fetchAll(oldDb, 'event_exceptions');
  const mapped = rows
    .map((ex) => {
      const seriesId = resolveSeriesId(ex.event_id);
      if (!seriesId) return null;
      return {
        series_id: seriesId,
        typ: ex.typ,
        puvodni_den: toDate(ex.puvodni_den),
        puvodni_cas_od: ex.puvodni_cas_od ? toTime(ex.puvodni_cas_od) : null,
        puvodni_cas_do: ex.puvodni_cas_do ? toTime(ex.puvodni_cas_do) : null,
        den_od: ex.den_od ? toDate(ex.den_od) : null,
        den_do: ex.den_do ? toDate(ex.den_do) : null,
        cas_od: ex.cas_od ? toTime(ex.cas_od) : null,
        cas_do: ex.cas_do ? toTime(ex.cas_do) : null,
      };
    })
    .filter(Boolean);

  await insertBatch(newDb, 'series_exceptions', mapped);
  console.log(`  ✓ ${mapped.length} výjimek`);
}

async function migrateEventUsers() {
  console.log('→ event_users');
  const rows = await fetchAll(oldDb, 'event_users');
  const mapped = rows
    .map((r) => {
      const seriesId = resolveSeriesId(r.event_id ?? r.series_id);
      if (!seriesId) return null;
      return { series_id: seriesId, user_id: r.user_id };
    })
    .filter(Boolean);

  await insertBatch(newDb, 'event_users', mapped);
  console.log(`  ✓ ${mapped.length} účastí`);
}

async function migrateEventMessages() {
  console.log('→ event_messages');
  const rows = await fetchAll(oldDb, 'event_messages');
  const mapped = rows
    .map((m) => {
      const oldRef = m.series_id ?? m.event_id;
      const seriesId = resolveSeriesId(oldRef);
      if (!seriesId) return null;
      return {
        series_id: seriesId,
        user_id: m.user_id,
        message: m.message,
        created_at: m.created_at,
      };
    })
    .filter(Boolean);

  await insertBatch(newDb, 'event_messages', mapped);
  console.log(`  ✓ ${mapped.length} zpráv`);
}

async function migrateDevices() {
  console.log('→ user_devices');
  const rows = await fetchAll(oldDb, 'user_devices');
  await insertBatch(newDb, 'user_devices', rows.map((r) => ({
    user_id: r.user_id,
    fcm_token: r.fcm_token,
    created_at: r.created_at,
  })));
  console.log(`  ✓ ${rows.length} FCM tokenů`);
}

async function migrateWebPush() {
  console.log('→ web_push_subscriptions');
  const rows = await fetchAll(oldDb, 'web_push_subscriptions');
  await insertBatch(newDb, 'web_push_subscriptions', rows);
  console.log(`  ✓ ${rows.length} web push odběrů`);
}

async function resetSequences() {
  console.log('→ reset sekvencí');
  const tables = ['users', 'colors', 'event_series', 'series_exceptions', 'event_users', 'event_messages'];
  for (const table of tables) {
    const { data } = await newDb.from(table).select('id').order('id', { ascending: false }).limit(1);
    if (data?.[0]?.id) {
      console.log(`  ${table}: max id = ${data[0].id} (nastav sekvenci v SQL Editoru pokud potřeba)`);
    }
  }
}

async function main() {
  console.log('Migrace ze starého Supabase projektu\n');
  console.log(`  Zdroj: ${OLD_URL}`);
  console.log(`  Cíl:   ${NEW_URL}\n`);

  const { count } = await newDb.from('users').select('*', { count: 'exact', head: true });
  if (count > 0) {
    console.error('❌ Nová databáze už obsahuje uživatele. Spusť migraci jen do prázdné DB (po schema.sql).');
    process.exit(1);
  }

  await migrateUsers();
  await migrateColors();
  await migratePasswordResets();
  await migrateEventsToSeries();
  await migrateWeeklyToSeries();
  await migrateExceptions();
  await migrateEventUsers();
  await migrateEventMessages();
  await migrateDevices();
  await migrateWebPush();
  await resetSequences();

  console.log('\n✅ Migrace dokončena.');
  console.log('\nDalší kroky:');
  console.log('  1. V SQL Editoru nového projektu spusť supabase/migration-post.sql (sekvence)');
  console.log('  2. Nahraj Edge Functions a aktualizuj URL/klíče v aplikaci');
  console.log('  3. Nastav Database Webhooks na novém projektu');
}

main().catch((err) => {
  console.error('\n❌ Chyba:', err.message);
  process.exit(1);
});
