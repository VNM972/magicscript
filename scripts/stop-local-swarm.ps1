$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PidFile = Join-Path $RepoRoot '.magicscript\pids.json'

if (-not (Test-Path $PidFile)) {
    Write-Host 'No Magic Script local PID file found.'
    exit 0
}

$Pids = Get-Content $PidFile -Raw | ConvertFrom-Json
$Targets = @($Pids.api, $Pids.runner, $Pids.controlCenter) | Where-Object { $_ }

foreach ($Id in $Targets) {
    $Process = Get-Process -Id $Id -ErrorAction SilentlyContinue
    if ($Process) {
        Write-Host "Stopping PID $Id ($($Process.ProcessName))..."
        Stop-Process -Id $Id -Force -ErrorAction SilentlyContinue
    }
}

Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
Write-Host 'Magic Script local stack stopped.'
