[CmdletBinding()]
param(
    [ValidateSet('start', 'stop', 'restart', 'status', 'doctor')]
    [string]$Action = 'status',
    [switch]$SkipInstall,
    [switch]$SkipChecks,
    [switch]$Full,
    [switch]$SkipSmoke
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $RepoRoot '.magicscript'
$LogsDir = Join-Path $RuntimeDir 'logs'
$PidFile = Join-Path $RuntimeDir 'pids.json'
$LockFile = Join-Path $RuntimeDir 'runner.lock.json'
$RunnerId = if ($env:MAGICSCRIPT_RUNNER_ID) { $env:MAGICSCRIPT_RUNNER_ID } else { "magicscript-$env:COMPUTERNAME" }

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    try {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    } catch {
        throw "Invalid Magic Script runtime metadata: $Path"
    }
}

function Get-ProcessInfo {
    param([int]$Id)
    if ($Id -le 0) { return $null }
    $process = Get-Process -Id $Id -ErrorAction SilentlyContinue
    if (-not $process) { return $null }

    $commandLine = $null
    try {
        $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $Id" -ErrorAction Stop).CommandLine
    } catch { }

    $startTime = $null
    try { $startTime = $process.StartTime.ToString('o') } catch { }
    $path = $null
    try { $path = $process.Path } catch { }

    [pscustomobject]@{
        Id = $Id
        Name = $process.ProcessName
        Path = $path
        StartTime = $startTime
        CommandLine = $commandLine
    }
}

function Test-ExpectedProcess {
    param(
        [object]$Info,
        [ValidateSet('lifecycle', 'api', 'runner', 'control')]
        [string]$Role
    )
    if (-not $Info) { return $false }
    $command = [string]$Info.CommandLine
    $name = [string]$Info.Name
    if ($Role -eq 'lifecycle') { return $command -match 'magic-script\.ps1.*\b(start|restart)\b' }
    if (-not $command) { return $false }
    switch ($Role) {
        'api' { return $command -match 'dev:api:local|api-worker|wrangler.*dev' }
        'runner' { return $command -match 'dev:runner|src[\\/]index\.ts|tsx.*index' }
        'control' { return $command -match 'magic-script-control-center|control-center|workspace.*dev' }
    }
    return $false
}

function Get-LockState {
    param([object]$Lock)
    if (-not $Lock) { return 'absent' }
    $entries = @(
        [pscustomobject]@{ Role = 'lifecycle'; Id = [int]$Lock.managerPid },
        [pscustomobject]@{ Role = 'api'; Id = [int]$Lock.apiPid },
        [pscustomobject]@{ Role = 'runner'; Id = [int]$Lock.runnerPid },
        [pscustomobject]@{ Role = 'control'; Id = [int]$Lock.controlCenterPid }
    ) | Where-Object { $_.Id -gt 0 }
    $live = @()
    $unknown = @()
    foreach ($entry in $entries) {
        $info = Get-ProcessInfo $entry.Id
        if (-not $info) { continue }
        if (Test-ExpectedProcess $info $entry.Role) { $live += $entry } else { $unknown += $entry }
    }
    if ($unknown.Count -gt 0) { return 'conflict' }
    if ($live.Count -gt 0) { return 'active' }
    return 'stale'
}

function Write-Lock {
    param([hashtable]$Lock)
    $Lock | ConvertTo-Json | Set-Content -LiteralPath $LockFile -Encoding UTF8
}

function Acquire-Lock {
    New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
    if (Test-Path -LiteralPath $LockFile -PathType Leaf) {
        $existing = Read-JsonFile $LockFile
        $state = Get-LockState $existing
        if ($state -eq 'active') { throw "Magic Script is already running (runner PID $($existing.runnerPid))." }
        if ($state -eq 'conflict') { throw 'Magic Script lock references a live process with an unexpected identity; review required.' }
        Remove-Item -LiteralPath $LockFile -Force
    }
    if (Test-Path -LiteralPath $PidFile -PathType Leaf) {
        $orphanPids = Read-JsonFile $PidFile
        $orphanTargets = @(
            [pscustomobject]@{ Role = 'api'; Id = [int]$orphanPids.api },
            [pscustomobject]@{ Role = 'runner'; Id = [int]$orphanPids.runner },
            [pscustomobject]@{ Role = 'control'; Id = [int]$orphanPids.controlCenter }
        ) | Where-Object { $_.Id -gt 0 }
        foreach ($target in $orphanTargets) {
            if (Get-ProcessInfo $target.Id) {
                throw "Runtime metadata references a live $($target.Role) PID $($target.Id); run status/stop before starting again."
            }
        }
        Remove-Item -LiteralPath $PidFile -Force
    }

    try {
        $stream = [System.IO.File]::Open($LockFile, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
        $stream.Dispose()
    } catch {
        throw 'Could not acquire the Magic Script runner lock; another start may be in progress.'
    }

    $lock = @{
        schema = 1
        phase = 'starting'
        managerPid = $PID
        apiPid = 0
        runnerPid = 0
        controlCenterPid = 0
        runnerId = $RunnerId
        repoRoot = $RepoRoot
        startedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    Write-Lock $lock
    return $lock
}

function Get-DescendantIds {
    param([int]$RootId)
    $all = @()
    try { $all = @(Get-CimInstance Win32_Process -ErrorAction Stop) } catch { return @($RootId) }
    $result = New-Object System.Collections.Generic.List[int]
    $result.Add($RootId)
    $changed = $true
    while ($changed) {
        $changed = $false
        foreach ($process in $all) {
            if ($result.Contains([int]$process.ParentProcessId) -and -not $result.Contains([int]$process.ProcessId)) {
                $result.Add([int]$process.ProcessId)
                $changed = $true
            }
        }
    }
    return @($result | Sort-Object -Descending)
}

function Stop-TrackedProcess {
    param(
        [int]$Id,
        [ValidateSet('api', 'runner', 'control')]
        [string]$Role
    )
    $info = Get-ProcessInfo $Id
    if (-not $info) { return $true }
    if (-not (Test-ExpectedProcess $info $Role)) {
        Write-Warning "Leaving PID $Id untouched: it no longer matches the recorded $Role process."
        return $false
    }
    foreach ($childId in (Get-DescendantIds $Id)) {
        Stop-Process -Id $childId -Force -ErrorAction SilentlyContinue
    }
    return -not (Get-Process -Id $Id -ErrorAction SilentlyContinue)
}

function Invoke-InternalStart {
    $old = $env:MAGICSCRIPT_LIFECYCLE_INTERNAL
    try {
        $env:MAGICSCRIPT_LIFECYCLE_INTERNAL = 'true'
        $startArgs = @()
        if ($SkipInstall) { $startArgs += '-SkipInstall' }
        if ($SkipChecks) { $startArgs += '-SkipChecks' }
        if ($Full) { $startArgs += '-Full' }
        if ($SkipSmoke) { $startArgs += '-SkipSmoke' }
        $startOut = Join-Path $LogsDir 'lifecycle-start.out.log'
        $startErr = Join-Path $LogsDir 'lifecycle-start.err.log'
        $child = Start-Process -FilePath 'powershell.exe' -ArgumentList (@('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'start-local-swarm.ps1')) + $startArgs) -WorkingDirectory $RepoRoot -RedirectStandardOutput $startOut -RedirectStandardError $startErr -WindowStyle Hidden -PassThru
        $deadline = (Get-Date).AddMinutes(5)
        while (-not $child.HasExited) {
            if ((Get-Date) -gt $deadline) {
                Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue
                throw 'Magic Script startup controller timed out.'
            }
            Start-Sleep -Milliseconds 200
        }
        $child.Refresh()
        if (Test-Path -LiteralPath $startOut) { Get-Content -LiteralPath $startOut | Write-Host }
        if (Test-Path -LiteralPath $startErr) { Get-Content -LiteralPath $startErr | Write-Warning }
        $exitCode = 0
        if ($null -ne $child.ExitCode) { $exitCode = [int]$child.ExitCode }
        return $exitCode
    } finally {
        if ($null -eq $old) { Remove-Item Env:MAGICSCRIPT_LIFECYCLE_INTERNAL -ErrorAction SilentlyContinue }
        else { $env:MAGICSCRIPT_LIFECYCLE_INTERNAL = $old }
    }
}

function Start-Stack {
    $lock = Acquire-Lock
    try {
        $exitCode = Invoke-InternalStart
        if ($exitCode -ne 0) { throw "Magic Script startup failed with exit code $exitCode." }
        $pids = Read-JsonFile $PidFile
        if (-not $pids.runner) { throw 'Startup completed without a recorded runner PID.' }
        $lock.phase = 'running'
        $lock.managerPid = 0
        $lock.apiPid = [int]$pids.api
        $lock.runnerPid = [int]$pids.runner
        $lock.controlCenterPid = [int]$pids.controlCenter
        Write-Lock $lock
        Write-Host "Magic Script stack started with one tracked runner (PID $($lock.runnerPid))."
    } catch {
        if (Test-Path -LiteralPath $PidFile -PathType Leaf) {
            try { Stop-Stack -Quiet } catch { Write-Warning $_.Exception.Message }
        } else {
            Remove-Item -LiteralPath $LockFile -Force -ErrorAction SilentlyContinue
        }
        throw
    }
}

function Get-RecordedPid {
    param([object]$Primary, [object]$Fallback)
    if ($null -ne $Primary -and [int]$Primary -gt 0) { return [int]$Primary }
    if ($null -ne $Fallback -and [int]$Fallback -gt 0) { return [int]$Fallback }
    return 0
}

function Stop-Stack {
    param([switch]$Quiet)
    $lock = Read-JsonFile $LockFile
    $pids = Read-JsonFile $PidFile
    if (-not $lock -and -not $pids) {
        if (-not $Quiet) { Write-Host 'Magic Script is stopped; no runtime metadata found.' }
        return
    }
    $targets = @(
        [pscustomobject]@{ Role = 'api'; Id = Get-RecordedPid $lock.apiPid $pids.api },
        [pscustomobject]@{ Role = 'runner'; Id = Get-RecordedPid $lock.runnerPid $pids.runner },
        [pscustomobject]@{ Role = 'control'; Id = Get-RecordedPid $lock.controlCenterPid $pids.controlCenter }
    ) | Where-Object { $_.Id -gt 0 }
    $remaining = @()
    foreach ($target in $targets) {
        if (-not (Stop-TrackedProcess $target.Id $target.Role)) { $remaining += $target }
    }
    if ($remaining.Count -gt 0) {
        Start-Sleep -Milliseconds 750
        $retry = @()
        foreach ($target in $remaining) {
            if (-not (Stop-TrackedProcess $target.Id $target.Role)) { $retry += $target }
        }
        $remaining = $retry
    }
    if ($remaining.Count -eq 0) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $LockFile -Force -ErrorAction SilentlyContinue
        if (-not $Quiet) { Write-Host 'Magic Script local stack stopped; tracked process trees are gone.' }
    } else {
        throw 'Magic Script stop is incomplete; runtime metadata was preserved for review.'
    }
}

function Test-Port {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try { $client.Connect('127.0.0.1', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}

function Show-Status {
    $lock = Read-JsonFile $LockFile
    $pids = Read-JsonFile $PidFile
    Write-Host "Repo: $RepoRoot"
    Write-Host "Branch: $((& git -c 'safe.directory=D:/MagicScript/repository' -C $RepoRoot branch --show-current) -join '')"
    if (-not $lock -and -not $pids) { Write-Host 'Stack: STOPPED'; return }
    Write-Host "Stack: RUNNING OR REVIEW REQUIRED"
    foreach ($item in @(
        [pscustomobject]@{ Label = 'API'; Role = 'api'; Id = Get-RecordedPid $lock.apiPid $pids.api; Port = 8787 },
        [pscustomobject]@{ Label = 'Runner'; Role = 'runner'; Id = Get-RecordedPid $lock.runnerPid $pids.runner; Port = $null },
        [pscustomobject]@{ Label = 'Control Center'; Role = 'control'; Id = Get-RecordedPid $lock.controlCenterPid $pids.controlCenter; Port = 3000 }
    )) {
        $info = Get-ProcessInfo $item.Id
        $health = if ($info -and (Test-ExpectedProcess $info $item.Role)) { 'tracked' } elseif ($info) { 'PID REUSE/UNKNOWN' } else { 'stopped' }
        $portText = if ($item.Port) { "; port $($item.Port)=" + $(if (Test-Port $item.Port) { 'LISTENING' } else { 'closed' }) } else { '' }
        Write-Host "$($item.Label): PID $($item.Id); $health$portText"
    }
    $apiPid = Get-RecordedPid $lock.apiPid $pids.api
    if (Test-Port 8787) {
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -Method Get -TimeoutSec 2
            Write-Host "API health: ok=$($health.ok); database=$($health.databaseConfigured); emailProvider=$($health.emailProvider); sendingEnabled=$($health.sendingEnabled)"
        } catch {
            Write-Host 'API health: LISTENING but health request failed'
        }
    }
    if ($lock) { Write-Host "Email safety: runner lock $($lock.phase); real sending must remain disabled for local stack." }
}

function Show-Doctor {
    Write-Host "Node: $((& node --version) -join '')"
    Write-Host "npm: $((& npm --version) -join '')"
    Write-Host "Repo: $RepoRoot"
    Write-Host "Branch: $((& git -c 'safe.directory=D:/MagicScript/repository' -C $RepoRoot branch --show-current) -join '')"
    Show-Status
    Write-Host "D1 local state: $((Test-Path -LiteralPath (Join-Path $RepoRoot '.wrangler')) -or (Test-Path -LiteralPath (Join-Path $RepoRoot '.magicscript')))"
    Write-Host "Cloudflare token configured: $([bool]$env:CLOUDFLARE_API_TOKEN)"
    Write-Host "Cloudflare account configured: $([bool]$env:CLOUDFLARE_ACCOUNT_ID)"
    Write-Host 'Real email sending: DISABLED for local lifecycle'
}

switch ($Action) {
    'start' { Start-Stack }
    'stop' { Stop-Stack }
    'restart' { Stop-Stack -Quiet; Start-Stack }
    'status' { Show-Status }
    'doctor' { Show-Doctor }
}
