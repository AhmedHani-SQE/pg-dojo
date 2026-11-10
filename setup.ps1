<#
  PG Dojo setup for Windows.
  Installs a portable PostgreSQL 18 (no admin rights needed), loads the Pagila sample
  database, creates the restricted "learner" user and installs Node dependencies.
  Safe to run again: every step is skipped if it's already done.

  Usage (from the pg-dojo folder):
    powershell -ExecutionPolicy Bypass -File .\setup.ps1

  Already have PostgreSQL installed (e.g. via the EDB installer)? Point at it instead:
    powershell -ExecutionPolicy Bypass -File .\setup.ps1 -ExistingPgBin "C:\Program Files\PostgreSQL\17\bin" -AdminPassword "your-postgres-password"
#>
param(
  [string]$PgRoot = "C:\pgdojo-postgres",   # where the portable PostgreSQL goes
  [int]$Port = 5432,
  [string]$AdminPassword = "postgres",      # password for the "postgres" superuser
  [string]$ExistingPgBin = ""               # use an already-installed PostgreSQL instead
)

# 'Continue' on purpose: in Windows PowerShell 5.1, 'Stop' turns any stderr line from psql/curl into a crash.
# Failures are detected through $LASTEXITCODE and `throw` below instead.
$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$PgZipUrl = 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260609'   # PostgreSQL 18.6, Windows x64 binaries
$PagilaCommit = '6ea53f812254c91a602f61c0ef62beca3fa676b1'
$PagilaBase = "https://raw.githubusercontent.com/devrimgunduz/pagila/$PagilaCommit"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }

# ---------------------------------------------------------------- Node.js
Step 'Checking Node.js'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is not installed. Install the LTS version from https://nodejs.org and run this script again.'
}
Ok ("Node " + (node -v))

# ---------------------------------------------------------------- PostgreSQL binaries
if ($ExistingPgBin) {
  $bin = $ExistingPgBin
  if (-not (Test-Path (Join-Path $bin 'psql.exe'))) { throw "psql.exe not found in $bin" }
  Step "Using existing PostgreSQL in $bin"
  $PgRoot = ''
} else {
  $bin = Join-Path $PgRoot 'pgsql\bin'
  Step "PostgreSQL 18 (portable) in $PgRoot"
  if (Test-Path (Join-Path $bin 'pg_ctl.exe')) {
    Ok 'Already installed'
  } else {
    New-Item -ItemType Directory -Force $PgRoot | Out-Null
    $zip = Join-Path $PgRoot 'pg.zip'
    Write-Host '    Downloading (~380 MB, takes a few minutes)...'
    curl.exe -L --fail --progress-bar -o $zip $PgZipUrl
    if ($LASTEXITCODE -ne 0) { throw 'Download failed' }
    Write-Host '    Extracting...'
    tar -xf $zip -C $PgRoot --exclude 'pgsql/pgAdmin 4' --exclude 'pgsql/doc' --exclude 'pgsql/StackBuilder' --exclude 'pgsql/symbols'
    if ($LASTEXITCODE -ne 0) { throw 'Extracting failed' }
    Remove-Item $zip
    Ok (& (Join-Path $bin 'postgres.exe') --version)
  }

  # ---------------------------------------------------------------- data directory
  $data = Join-Path $PgRoot 'data'
  Step 'Database cluster'
  if (Test-Path (Join-Path $data 'PG_VERSION')) {
    Ok 'Already initialized'
  } else {
    $pw = Join-Path $PgRoot 'pw.tmp'
    [IO.File]::WriteAllText($pw, $AdminPassword)
    & (Join-Path $bin 'initdb.exe') -D $data -U postgres --pwfile=$pw -A scram-sha-256 -E UTF8 --locale=C | Out-Null
    $code = $LASTEXITCODE
    Remove-Item $pw
    if ($code -ne 0) { throw 'initdb failed' }
    Ok "Created (superuser: postgres / $AdminPassword)"
  }

  # ---------------------------------------------------------------- start server
  Step 'Starting PostgreSQL'
  & (Join-Path $bin 'pg_ctl.exe') -D $data status *> $null
  if ($LASTEXITCODE -eq 0) {
    Ok 'Already running'
  } else {
    # Launched via ShellExecute so the postgres server doesn't inherit this script's output
    # handles (otherwise PowerShell waits forever for them to close).
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = Join-Path $bin 'pg_ctl.exe'
    $psi.Arguments = "-D `"$data`" -l `"$(Join-Path $PgRoot 'pg.log')`" -o `"-p $Port`" -w start"
    $psi.UseShellExecute = $true
    $psi.WindowStyle = 'Hidden'
    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.WaitForExit()
    if ($proc.ExitCode -ne 0) { throw "PostgreSQL did not start - see $PgRoot\pg.log (is something else using port $Port?)" }
    Ok "Running on port $Port"
  }
}

$psql = Join-Path $bin 'psql.exe'
$env:PGPASSWORD = $AdminPassword
$env:PGOPTIONS = '-c client_min_messages=warning'   # hide harmless "already exists, skipping" notices
function Psql([string[]]$a) { & $psql -U postgres -h localhost -p $Port -v ON_ERROR_STOP=0 @a }

# ---------------------------------------------------------------- Pagila
Step 'Pagila sample database'
$exists = (Psql @('-d', 'postgres', '-tAc', "SELECT 1 FROM pg_database WHERE datname = 'pagila'")) -join ''
if ($LASTEXITCODE -ne 0) { throw "Can't log in to PostgreSQL as postgres on port $Port. Wrong -AdminPassword?" }
if ($exists.Trim() -eq '1') {
  Ok 'Already loaded'
} else {
  $tmp = Join-Path ([IO.Path]::GetTempPath()) 'pgdojo-pagila'
  New-Item -ItemType Directory -Force $tmp | Out-Null
  Write-Host '    Downloading...'
  curl.exe -L --fail -s -o (Join-Path $tmp 'schema.sql') "$PagilaBase/pagila-schema.sql"
  curl.exe -L --fail -s -o (Join-Path $tmp 'data.sql') "$PagilaBase/pagila-data.sql"
  if ($LASTEXITCODE -ne 0) { throw 'Pagila download failed' }
  Psql @('-d', 'postgres', '-q', '-c', 'CREATE DATABASE pagila') | Out-Null
  Write-Host '    Loading (about a minute)...'
  # The optional film_embedding table needs the pgvector extension; its errors are harmless.
  Psql @('-d', 'pagila', '-q', '-f', (Join-Path $tmp 'schema.sql')) 2>&1 | Where-Object { "$_" -match 'ERROR' -and "$_" -notmatch 'vector|film_embedding' } | ForEach-Object { Write-Warning "$_" }
  Psql @('-d', 'pagila', '-q', '-f', (Join-Path $tmp 'data.sql'))   2>&1 | Where-Object { "$_" -match 'ERROR' -and "$_" -notmatch 'vector|film_embedding' } | ForEach-Object { Write-Warning "$_" }
  Remove-Item -Recurse -Force $tmp
  $films = (Psql @('-d', 'pagila', '-tAc', 'SELECT count(*) FROM film')) -join ''
  Ok "Loaded ($($films.Trim()) films)"
}

# ---------------------------------------------------------------- learner user
Step 'Restricted "learner" user + playground schema'
Psql @('-d', 'pagila', '-q', '-f', (Join-Path $here 'db\learner.sql')) | Out-Null
Ok 'Done'

# ---------------------------------------------------------------- config.json (keeps an existing Groq key)
Step 'Writing config.json'
$cfgPath = Join-Path $here 'config.json'
$cfg = @{}
if (Test-Path $cfgPath) {
  $old = Get-Content $cfgPath -Raw | ConvertFrom-Json
  $old.PSObject.Properties | ForEach-Object { $cfg[$_.Name] = $_.Value }
}
$cfg['pg'] = @{ host = 'localhost'; port = $Port; adminUser = 'postgres'; adminPassword = $AdminPassword; root = $PgRoot }
[IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding $false))
Ok 'Saved'

# ---------------------------------------------------------------- npm
Step 'Installing Node dependencies'
Push-Location $here
npm install --silent
Pop-Location
Ok 'Done'

Write-Host "`nAll set! Double-click start.bat (or run: node server.js --open) and add your Groq key under 'AI settings'.`n" -ForegroundColor Green
