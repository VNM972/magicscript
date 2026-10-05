param(
    [switch]$SkipInstall,
    [switch]$SkipChecks,
    [switch]$Full,
    [switch]$SkipSmoke,
    [switch]$SkipControlCenter
)

if ($env:MAGICSCRIPT_LIFECYCLE_INTERNAL -ne 'true') {
    & (Join-Path $PSScriptRoot 'magic-script.ps1') start @PSBoundParameters
    exit $LASTEXITCODE
}

$ErrorActionPreference = 'Stop'

function Require-Command {
    param([string]$Name, [string]$Help)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $Help"
    }
}

function Get-ProcessStartedAtUtc {
    param([object]$Process)
    try {
        return $Process.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ')
    } catch {
        return $null
    }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Require-Command 'node' 'Install Node.js first.'
Require-Command 'npm' 'Install Node.js/npm first.'
$AiderExecutable = if ($env:AIDER_EXECUTABLE) { $env:AIDER_EXECUTABLE } else { 'D:\AiderTools\aider-chat-v2\Scripts\aider.exe' }
$env:AIDER_EXECUTABLE = $AiderExecutable
$env:PATH = "D:\AiderBin;$env:PATH"
if (-not (Test-Path $AiderExecutable) -and -not (Get-Command $AiderExecutable -ErrorAction SilentlyContinue)) {
    throw "Aider is required for local prototype builds. Expected $AiderExecutable"
}

$RuntimeDir = Join-Path $RepoRoot '.magicscript'
$LogsDir = Join-Path $RuntimeDir 'logs'
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
$env:XDG_CONFIG_HOME = Join-Path $RuntimeDir 'xdg-config'
New-Item -ItemType Directory -Force -Path $env:XDG_CONFIG_HOME | Out-Null
$env:WRANGLER_LOG_PATH = Join-Path $RuntimeDir 'wrangler-logs'
New-Item -ItemType Directory -Force -Path $env:WRANGLER_LOG_PATH | Out-Null
$env:NPM_CONFIG_CACHE = Join-Path $RuntimeDir 'npm-cache'
New-Item -ItemType Directory -Force -Path $env:NPM_CONFIG_CACHE | Out-Null

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
$env:MAGICSCRIPT_STACK_ID = if ($env:MAGICSCRIPT_STACK_ID) { $env:MAGICSCRIPT_STACK_ID } else { [guid]::NewGuid().Guid }
$env:MAGICSCRIPT_RUNNER_WORK_DIR = Join-Path $RuntimeDir 'runner'
# A full local funnel is allowed to exercise the outbound state machine, but
# only through the deterministic in-process dry-run provider. Normal local
# starts remain fail-closed for sending and prototype deployment.
$fullDryRun = [bool]$Full
$env:MAGICSCRIPT_SENDING_ENABLED = if ($fullDryRun) { 'true' } else { 'false' }
$env:MAGICSCRIPT_EMAIL_PROVIDER = if ($fullDryRun) { 'dry-run' } else { 'disabled' }
$env:MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED = 'false'
$env:MAGICSCRIPT_AGENT_PROVIDER = if ($env:MAGICSCRIPT_AGENT_PROVIDER) { $env:MAGICSCRIPT_AGENT_PROVIDER } else { 'ollama-aider' }
$env:OLLAMA_API_BASE = if ($env:OLLAMA_API_BASE) { $env:OLLAMA_API_BASE } else { 'http://127.0.0.1:11434' }
$env:OLLAMA_MODEL = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { 'qwen2.5-coder:3b' }
$env:AIDER_OLLAMA_CONTEXT_TOKENS = if ($env:AIDER_OLLAMA_CONTEXT_TOKENS) { $env:AIDER_OLLAMA_CONTEXT_TOKENS } else { '6144' }
$env:AIDER_MAP_TOKENS = if ($env:AIDER_MAP_TOKENS) { $env:AIDER_MAP_TOKENS } else { '0' }
$env:AIDER_OUTPUT_TOKENS = if ($env:AIDER_OUTPUT_TOKENS) { $env:AIDER_OUTPUT_TOKENS } else { '1024' }
$env:MAGICSCRIPT_AIDER_TIMEOUT_MS = if ($env:MAGICSCRIPT_AIDER_TIMEOUT_MS) { $env:MAGICSCRIPT_AIDER_TIMEOUT_MS } else { '120000' }
$env:MAGICSCRIPT_AGENT_TIMEOUT_MS = if ($env:MAGICSCRIPT_AGENT_TIMEOUT_MS) { $env:MAGICSCRIPT_AGENT_TIMEOUT_MS } else { '420000' }
$env:MAGICSCRIPT_LOCAL_FALLBACK = if ($env:MAGICSCRIPT_LOCAL_FALLBACK) { $env:MAGICSCRIPT_LOCAL_FALLBACK } else { 'true' }
if (-not $env:KIMI_MODEL_MAX_COMPLETION_TOKENS) {
    $env:KIMI_MODEL_MAX_COMPLETION_TOKENS = '32768'
}
# Supported local lifecycle must not inherit real deployment capability.
$env:MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE = 'mock'

Write-Host '[4/6] Starting local API Worker...'
$ApiOut = Join-Path $LogsDir 'api.out.log'
$ApiErr = Join-Path $LogsDir 'api.err.log'
$ApiArgs = @(
    'dev', '--config', 'wrangler.local.jsonc', '--port', '8787',
    '--var', "MAGICSCRIPT_STACK_ID:$env:MAGICSCRIPT_STACK_ID",
    '--var', "MAGICSCRIPT_SENDING_ENABLED:$env:MAGICSCRIPT_SENDING_ENABLED",
    '--var', "MAGICSCRIPT_EMAIL_PROVIDER:$env:MAGICSCRIPT_EMAIL_PROVIDER",
    '--var', "MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED:$env:MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED"
)
if ($env:MAGICSCRIPT_RUNNER_PROSPECT_ID) {
    $ApiArgs += @('--var', "MAGICSCRIPT_RUNNER_PROSPECT_ID:$env:MAGICSCRIPT_RUNNER_PROSPECT_ID")
}
if ($env:MAGICSCRIPT_PUBLIC_BASE_URL) {
    $ApiArgs += @('--var', "MAGICSCRIPT_PUBLIC_BASE_URL:$env:MAGICSCRIPT_PUBLIC_BASE_URL")
}
$portInUse = $false
$portProbe = New-Object System.Net.Sockets.TcpClient
try {
    $portProbe.Connect('127.0.0.1', 8787)
    $portInUse = $true
} catch { }
finally { $portProbe.Dispose() }
if ($portInUse) {
    throw 'API port 8787 is already in use; refusing to attach this stack to another or stale local server. Stop the existing Magic Script stack and retry.'
}
$ApiWrapper = Join-Path $RepoRoot 'scripts\run-local-api-with-restart.cjs'
$ApiProcess = Start-Process -FilePath 'node.exe' -ArgumentList (@($ApiWrapper) + $ApiArgs) -WorkingDirectory $RepoRoot -RedirectStandardOutput $ApiOut -RedirectStandardError $ApiErr -WindowStyle Hidden -PassThru

$ApiReady = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $Health = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -Method Get -TimeoutSec 2
        if ($Health.ok -and [string]$Health.stackId -eq [string]$env:MAGICSCRIPT_STACK_ID) { $ApiReady = $true; break }
    } catch { }
}

if (-not $ApiReady) {
    try { & taskkill.exe /PID $ApiProcess.Id /T /F 2>$null | Out-Null } catch { }
    throw "API Worker did not become healthy with the expected stack generation. See $ApiErr"
}

Write-Host '[5/6] Starting local Ollama/Aider runner...'
$RunnerOut = Join-Path $LogsDir 'runner.out.log'
$RunnerErr = Join-Path $LogsDir 'runner.err.log'
$RunnerProcess = Start-Process -FilePath 'node.exe' -ArgumentList '..\..\scripts\run-tsx-with-preload.cjs','src\index.ts' -WorkingDirectory (Join-Path $RepoRoot 'apps\agent-runner') -RedirectStandardOutput $RunnerOut -RedirectStandardError $RunnerErr -WindowStyle Hidden -PassThru

$ControlProcess = $null
if ($SkipControlCenter) {
    Write-Host '[6/6] Control Center skipped for low-noise E2E.'
} else {
    Write-Host '[6/6] Starting Control Center...'
    $ControlOut = Join-Path $LogsDir 'control-center.out.log'
    $ControlErr = Join-Path $LogsDir 'control-center.err.log'
    $ControlProcess = Start-Process -FilePath 'node.exe' -ArgumentList (Join-Path $RepoRoot 'node_modules\next\dist\bin\next'),'dev','-H','127.0.0.1' -WorkingDirectory (Join-Path $RepoRoot 'apps\control-center') -RedirectStandardOutput $ControlOut -RedirectStandardError $ControlErr -WindowStyle Hidden -PassThru
}

Start-Sleep -Seconds 2

Write-Host ''
Write-Host 'Magic Script V2 local stack started.'
Write-Host "API Worker      PID $($ApiProcess.Id)  http://127.0.0.1:8787"
Write-Host "Local runner    PID $($RunnerProcess.Id)"
if ($ControlProcess) {
    Write-Host "Control Center  PID $($ControlProcess.Id)  http://127.0.0.1:3000"
} else {
    Write-Host 'Control Center  skipped'
}

$PidFile = Join-Path $RuntimeDir 'pids.json'
@{
    api = $ApiProcess.Id
    apiStartedAt = Get-ProcessStartedAtUtc $ApiProcess
    runner = $RunnerProcess.Id
    runnerStartedAt = Get-ProcessStartedAtUtc $RunnerProcess
    controlCenter = if ($ControlProcess) { $ControlProcess.Id } else { 0 }
    controlCenterStartedAt = if ($ControlProcess) { Get-ProcessStartedAtUtc $ControlProcess } else { $null }
} | ConvertTo-Json | Set-Content -Path $PidFile -Encoding UTF8

if ($fullDryRun) {
    Write-Host 'Safety: real email sending is DISABLED; full mode uses internal dry-run only.'
} else {
    Write-Host 'Safety: real email sending is DISABLED.'
}
Write-Host "Logs: $LogsDir"
Write-Host ''

if ($SkipSmoke) {
    Write-Host 'Smoke test skipped by explicit operator request.'
    exit 0
}

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
Write-Host "To stop: npm run ms:stop"
