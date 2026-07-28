<#
.SYNOPSIS
  Migrace Supabase projektu Paříž → Frankfurt (dump/restore + checklist).

.DESCRIPTION
  1) Vytvoří nový projekt ve Frankfurtu (pokud NEW_PROJECT_REF není nastaven)
  2) Dump roles/schema/data ze starého projektu
  3) Restore do nového projektu
  4) Vypíše další manuální kroky (Realtime, Auth, Webhooks, Storage, Functions)

.NOTES
  Vyžaduje: supabase CLI, Docker, přístupový token.
  Nepoužívej migrate-from-old-supabase.mjs — ten je na změnu schématu, ne regionu.

  Příprava (.env.migration v kořeni repo, NECOMMITOVAT):
    SUPABASE_ACCESS_TOKEN=sbp_...
    OLD_DB_PASSWORD=...
    NEW_DB_PASSWORD=...          # heslo nového projektu (nebo nech vygenerovat)
    ORG_ID=sdjsrtvuqhsjlsznmdop  # volitelné
    OLD_PROJECT_REF=sdzyhihtqrgsntbxlugp
    NEW_PROJECT_NAME=calendarWithFriends-fra
    # Po vytvoření / pokud už existuje:
    # NEW_PROJECT_REF=xxxx
#>

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$DumpDir = Join-Path $RepoRoot 'supabase\migration-dump'
$EnvFile = Join-Path $RepoRoot '.env.migration'
$EnvFileAlt = Join-Path $PSScriptRoot '.env.migration'

function Load-EnvFile([string]$path) {
  if (-not (Test-Path $path)) { return }
  Get-Content $path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $i = $line.IndexOf('=')
    if ($i -lt 1) { return }
    $key = $line.Substring(0, $i).Trim()
    $val = $line.Substring($i + 1).Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:$key" -Value $val
  }
}

Load-EnvFile $EnvFile
Load-EnvFile $EnvFileAlt
if (-not (Test-Path $EnvFile) -and (Test-Path $EnvFileAlt)) {
  $EnvFile = $EnvFileAlt
}

$OldRef = if ($env:OLD_PROJECT_REF) { $env:OLD_PROJECT_REF } else { 'sdzyhihtqrgsntbxlugp' }
$OrgId = if ($env:ORG_ID) { $env:ORG_ID } else { 'sdjsrtvuqhsjlsznmdop' }
$NewName = if ($env:NEW_PROJECT_NAME) { $env:NEW_PROJECT_NAME } else { 'calendarWithFriends-fra' }
$Region = 'eu-central-1'
$Token = $env:SUPABASE_ACCESS_TOKEN
$OldDbPassword = $env:OLD_DB_PASSWORD
$NewDbPassword = $env:NEW_DB_PASSWORD

if (-not $Token) {
  Write-Error @"
Chybí SUPABASE_ACCESS_TOKEN.

1) Vytvoř token: https://supabase.com/dashboard/account/tokens
2) Ulož do .env.migration:
   SUPABASE_ACCESS_TOKEN=sbp_...
   OLD_DB_PASSWORD=heslo_paris_projektu
   NEW_DB_PASSWORD=heslo_pro_frankfurt  (nebo nech prázdné a nastav po vytvoření)
"@
}

if (-not $OldDbPassword) {
  Write-Error 'Chybí OLD_DB_PASSWORD (Database Settings starého projektu, případně reset hesla).'
}

$env:SUPABASE_ACCESS_TOKEN = $Token

Write-Host "==> Kontrola supabase CLI + Docker"
supabase --version | Out-Host
docker version --format '{{.Server.Version}}' | Out-Host

# --- Create Frankfurt project if needed ---
$NewRef = $env:NEW_PROJECT_REF
if (-not $NewRef) {
  Write-Host "==> Vytvářím projekt '$NewName' v regionu $Region ..."
  if (-not $NewDbPassword) {
    $NewDbPassword = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
    Write-Host "Vygenerované NEW_DB_PASSWORD ulož si bezpečně (nebude znovu zobrazeno v logu)."
    Add-Content -Path $EnvFile -Value "NEW_DB_PASSWORD=$NewDbPassword"
  }

  $createOut = supabase projects create $NewName `
    --org-id $OrgId `
    --db-password $NewDbPassword `
    --region $Region `
    --output json 2>&1

  if ($LASTEXITCODE -ne 0) {
    Write-Error "Vytvoření projektu selhalo:`n$createOut"
  }

  try {
    $created = $createOut | ConvertFrom-Json
    $NewRef = $created.id
    if (-not $NewRef) { $NewRef = $created.ref }
  } catch {
    # Fallback: parse from text
    if ("$createOut" -match '([a-z]{20})') { $NewRef = $Matches[1] }
  }

  if (-not $NewRef) {
    Write-Error "Projekt možná vznikl, ale nepodařilo se přečíst ref. Výstup:`n$createOut`nNastav NEW_PROJECT_REF v .env.migration a spusť znovu."
  }

  Add-Content -Path $EnvFile -Value "NEW_PROJECT_REF=$NewRef"
  Write-Host "Nový projekt: $NewRef (https://$NewRef.supabase.co)"
  Write-Host "Čekám 45s na provisioningu DB..."
  Start-Sleep -Seconds 45
} else {
  Write-Host "==> Používám existující NEW_PROJECT_REF=$NewRef"
  if (-not $NewDbPassword) {
    Write-Error 'NEW_PROJECT_REF je nastaven, ale chybí NEW_DB_PASSWORD.'
  }
}

# Prefer Session pooler (Direct db.* often fails on IPv6 / auth user format)
function Build-DbUrl([string]$ref, [string]$password, [string]$poolerHost) {
  $enc = [uri]::EscapeDataString($password)
  return "postgresql://postgres.${ref}:${enc}@${poolerHost}:5432/postgres"
}

$OldDbUrl = if ($env:OLD_DB_URL) { $env:OLD_DB_URL } else { Build-DbUrl $OldRef $OldDbPassword 'aws-0-eu-west-3.pooler.supabase.com' }
$NewDbUrl = if ($env:NEW_DB_URL) { $env:NEW_DB_URL } else { Build-DbUrl $NewRef $NewDbPassword 'aws-0-eu-central-1.pooler.supabase.com' }

New-Item -ItemType Directory -Force -Path $DumpDir | Out-Null
Push-Location $DumpDir
try {
  Write-Host "==> Dump roles/schema/data z $OldRef"
  supabase db dump --db-url $OldDbUrl -f roles.sql --role-only
  if ($LASTEXITCODE -ne 0) { throw 'Dump roles selhal' }

  supabase db dump --db-url $OldDbUrl -f schema.sql
  if ($LASTEXITCODE -ne 0) { throw 'Dump schema selhal' }

  supabase db dump --db-url $OldDbUrl -f data.sql --use-copy --data-only `
    -x 'storage.buckets_vectors' -x 'storage.vector_indexes'
  if ($LASTEXITCODE -ne 0) { throw 'Dump data selhal' }

  Write-Host "==> Dump supabase_migrations (historie)"
  supabase db dump --db-url $OldDbUrl -f history_schema.sql --schema supabase_migrations
  supabase db dump --db-url $OldDbUrl -f history_data.sql --use-copy --data-only --schema supabase_migrations

  Write-Host "==> Restore do $NewRef (Docker psql)"
  $vol = ($DumpDir -replace '\\', '/')
  # Git Bash style path for Docker Desktop on Windows
  if ($vol -match '^([A-Za-z]):') {
    $drive = $Matches[1].ToLower()
    $vol = "/$drive" + ($DumpDir.Substring(2) -replace '\\', '/')
  }

  docker run --rm `
    -v "${vol}:/dump" `
    -e "PGPASSWORD=$NewDbPassword" `
    postgres:17 `
    bash -lc @"
psql --single-transaction --variable ON_ERROR_STOP=1 \
  -h db.$NewRef.supabase.co -p 5432 -U postgres -d postgres \
  -f /dump/roles.sql \
  -f /dump/schema.sql \
  -c 'SET session_replication_role = replica' \
  -f /dump/data.sql
"@
  if ($LASTEXITCODE -ne 0) { throw 'Restore selhal — zkus Session pooler URL (NEW_DB_URL) pokud Direct/IPv6 nefunguje.' }

  if (Test-Path (Join-Path $DumpDir 'history_schema.sql')) {
    Write-Host "==> Restore migration history"
    docker run --rm `
      -v "${vol}:/dump" `
      -e "PGPASSWORD=$NewDbPassword" `
      postgres:17 `
      bash -lc @"
psql --variable ON_ERROR_STOP=1 \
  -h db.$NewRef.supabase.co -p 5432 -U postgres -d postgres \
  -f /dump/history_schema.sql \
  -f /dump/history_data.sql || true
"@
  }
}
finally {
  Pop-Location
}

Write-Host @"

========================================
DUMP + RESTORE hotovo: $NewRef
========================================

DALŠÍ KROKY (Dashboard / CLI):

1) API klíče → zapiš do .env:
   EXPO_PUBLIC_SUPABASE_URL=https://$NewRef.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=...

2) Database → Publications: zapni Realtime na
   event_series, event_users, series_exceptions, friendships,
   users, colors, user_notifications, event_messages

3) Database → Webhooks: zapni + webhooky na
   https://$NewRef.supabase.co/functions/v1/send-notification

4) Auth: Site URL + Redirect URLs (+ OAuth secrets)

5) Storage: zkopíruj objekty league-covers
   node supabase/scripts/copy-storage-bucket.mjs

6) Edge Functions:
   supabase link --project-ref $NewRef
   supabase secrets set --env-file ... (FIREBASE_SERVICE_ACCOUNT)
   supabase functions deploy send-notification
   supabase functions deploy check-webhooks

7) Smoke test + starý projekt nechat pár dní jako fallback.

Dump soubory: $DumpDir
"@
