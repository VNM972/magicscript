param(
    [switch]$SkipInstall,
    [switch]$SkipChecks,
    [switch]$Full
)

$ErrorActionPreference = 'Stop'

function Require-Command {
    param([string]$Name, [string]$Help)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $Help"
    }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Require-Command 'node' 'Install Node.js first.'
Require-Command 'npm' 'Install Node.js/npm first.'
$KimiExecutable = if ($env:KIMI_EXECUTABLE) { $env:KIMI_EXECUTABLE } else { 'kimi' }
Require-Command $KimiExecutable 'Install and authenticate Kimi Code before starting the swarm runner.'
$env:KIMI_EXECUTABLE = $KimiExecutable

$RuntimeDir = Join-Path $RepoRoot '.magicscript'
$LogsDir = Join-Path $RuntimeDir 'logs'
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

if (-not $SkipInstall) {
    Write-Host '[1/6] Installing workspace dependencies...'
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
}

if (-not $SkipChecks) {
    Write-Host '[2/6] Running repository checks...'
    npm run check
    if ($LASTEXITCODE -ne 0) { throw 'Repository checks failed' }
} else {
    Write-Host '[2/6] Repository checks skipped.'
}

Write-Host '[3/6] Initializing local Cloudflare D1...'
npm run d1:local:init
if ($LASTEXITCODE -ne 0) { throw 'Local D1 initialization failed' }

$env:MAGICSCRIPT_API_BASE_URL = 'http://127.0.0.1:8787'
$env:MAGICSCRIPT_API_TOKEN = 'dev-api-token'
$env:MAGICSCRIPT_RUNNER_TOKEN = 'dev-runner-token'
$env:MAGICSCRIPT_RUNNER_WORK_DIR = Join-Path $RuntimeDir 'runner'
$env:MAGICSCRIPT_SENDING_ENABLED = 'false'
$env:MAGICSCRIPT_EMAIL_PROVIDER = 'disabled'
$env:MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED = 'false'

Write-Host '[4/6] Starting local API Worker...'
$ApiOut = Join-Path $LogsDir 'api.out.log'
$ApiErr = Join-Path $LogsDir 'api.err.log'
$ApiProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev:api:local' -WorkingDirectory $RepoRoot -RedirectStandardOutput $ApiOut -RedirectStandardError $ApiErr -PassThru

$ApiReady = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $Health = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -Method Get -TimeoutSec 2
        if ($Health.ok) { $ApiReady = $true; break }
    } catch { }
}

if (-not $ApiReady) {
    Stop-Process -Id $ApiProcess.Id -Force -ErrorAction SilentlyContinue
    throw "API Worker did not become healthy. See $ApiErr"
}

Write-Host '[5/6] Starting Kimi Swarm runner...'
$RunnerOut = Join-Path $LogsDir 'runner.out.log'
$RunnerErr = Join-Path $LogsDir 'runner.err.log'
$RunnerProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev:runner' -WorkingDirectory $RepoRoot -RedirectStandardOutput $RunnerOut -RedirectStandardError $RunnerErr -PassThru

Write-Host '[6/6] Starting Control Center...'
$ControlOut = Join-Path $LogsDir 'control-center.out.log'
$ControlErr = Join-Path $LogsDir 'control-center.err.log'
$ControlProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList '--workspace','magic-script-control-center','run','dev','--','-H','127.0.0.1' -WorkingDirectory $RepoRoot -RedirectStandardOutput $ControlOut -RedirectStandardError $ControlErr -PassThru

Start-Sleep -Seconds 2

Write-Host ''
Write-Host 'Magic Script V2 local stack started.'
Write-Host "API Worker      PID $($ApiProcess.Id)  http://127.0.0.1:8787"
Write-Host "Kimi runner     PID $($RunnerProcess.Id)"
Write-Host "Control Center  PID $($ControlProcess.Id)  http://127.0.0.1:3000"

$PidFile = Join-Path $RuntimeDir 'pids.json'
@{
    api = $ApiProcess.Id
    runner = $RunnerProcess.Id
    controlCenter = $ControlProcess.Id
} | ConvertTo-Json | Set-Content -Path $PidFile -Encoding UTF8

Write-Host 'Safety: real email sending is DISABLED.'
Write-Host "Logs: $LogsDir"
Write-Host ''
Write-Host 'Launching first autonomous discovery smoke test...'

npm run smoke:swarm
$SmokeExit = $LASTEXITCODE

if ($SmokeExit -ne 0) {
    Write-Warning 'Smoke test failed. The stack remains running for inspection.'
    Write-Host "API log: $ApiErr"
    Write-Host "Runner log: $RunnerErr"
    exit $SmokeExit
}

if ($Full) {
    Write-Host ''
    Write-Host 'Launching full safe funnel smoke test...'
    npm run smoke:full
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'Full funnel smoke failed. The stack remains running for inspection.'
        exit $LASTEXITCODE
    }
}

Write-Host ''
Write-Host 'Swarm smoke test passed. Leave these processes running while testing.'
Write-Host "To stop: Stop-Process -Id $($ApiProcess.Id),$($RunnerProcess.Id),$($ControlProcess.Id)"
