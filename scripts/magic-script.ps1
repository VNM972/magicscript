[CmdletBinding()]
param(
    [ValidateSet('start', 'stop', 'restart', 'status', 'doctor')]
    [string]$Action = 'status',
    [switch]$SkipInstall,
    [switch]$SkipChecks,
    [switch]$Full,
    [switch]$SkipSmoke,
    [switch]$SkipControlCenter,
    [string]$ExpectedStackId
)

$ErrorActionPreference = 'Stop'
trap {
    Write-Error $_
    exit 1
}
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
    try { $startTime = $process.StartTime.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ') } catch { }
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
        [string]$Role,
        [string]$ExpectedStartedAt
    )
    if (-not $Info) { return $false }
    $command = [string]$Info.CommandLine
    $name = [string]$Info.Name
    if ($Role -eq 'lifecycle') { return $command -match 'magic-script\.ps1.*\b(start|restart)\b' }

    # Win32_Process.CommandLine can be inaccessible on Windows even for the
    # current user. For npm.cmd/cmd.exe wrappers, confirm identity by the
    # recorded stack start time instead of classifying the process as reused.
    if (
        $ExpectedStartedAt -and
        $name -match '^(cmd|npm|npx|node)$' -and
        $Info.StartTime
    ) {
        try {
            $expected = [DateTimeOffset]::Parse($ExpectedStartedAt)
            $actual = [DateTimeOffset]::Parse([string]$Info.StartTime)
            $delta = [math]::Abs(($actual - $expected).TotalSeconds)
            if ($delta -le 45) { return $true }
        } catch { }
    }

    if (-not $command) { return $false }
    switch ($Role) {
        'api' { return $command -match 'run-local-api-with-restart\.cjs|dev:api:local|api-worker|wrangler.*dev' }
        'runner' { return $command -match 'dev:runner|src[\\/]index\.ts|tsx.*index' }
        'control' { return $command -match 'magic-script-control-center|control-center|workspace.*dev' }
    }
    return $false
}

function Get-LockState {
    param([object]$Lock)
    if (-not $Lock) { return 'absent' }
    $entries = @(
        [pscustomobject]@{ Role = 'lifecycle'; Id = [int]$Lock.managerPid; StartedAt = $null },
        [pscustomobject]@{ Role = 'api'; Id = [int]$Lock.apiPid; StartedAt = $Lock.apiStartedAt },
        [pscustomobject]@{ Role = 'runner'; Id = [int]$Lock.runnerPid; StartedAt = $Lock.runnerStartedAt },
        [pscustomobject]@{ Role = 'control'; Id = [int]$Lock.controlCenterPid; StartedAt = $Lock.controlCenterStartedAt }
    ) | Where-Object { $_.Id -gt 0 }
    $live = @()
    $unknown = @()
    foreach ($entry in $entries) {
        $info = Get-ProcessInfo $entry.Id
        if (-not $info) { continue }
        $expectedStartedAt = if ($entry.StartedAt) { [string]$entry.StartedAt } else { [string]$Lock.startedAt }
        if (Test-ExpectedProcess $info $entry.Role $expectedStartedAt) { $live += $entry } else { $unknown += $entry }
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
            [pscustomobject]@{ Role = 'api'; Id = [int]$orphanPids.api; StartedAt = $orphanPids.apiStartedAt },
            [pscustomobject]@{ Role = 'runner'; Id = [int]$orphanPids.runner; StartedAt = $orphanPids.runnerStartedAt },
            [pscustomobject]@{ Role = 'control'; Id = [int]$orphanPids.controlCenter; StartedAt = $orphanPids.controlCenterStartedAt }
        ) | Where-Object { $_.Id -gt 0 }
        foreach ($target in $orphanTargets) {
            $orphanInfo = Get-ProcessInfo $target.Id
            if ($orphanInfo -and (Test-ExpectedProcess $orphanInfo $target.Role $target.StartedAt)) {
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
        stackId = [guid]::NewGuid().Guid
        repoRoot = $RepoRoot
        startedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    Write-Lock $lock
    return $lock
}

function Get-DescendantIds {
    param([int]$RootId)
    $all = @()
    try { $all = @(Get-CimInstance Win32_Process -ErrorAction Stop) } catch { return $null }
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
        [string]$Role,
        [string]$ExpectedStartedAt
    )
    $info = Get-ProcessInfo $Id
    if (-not $info) { return $true }
    if (-not (Test-ExpectedProcess $info $Role $ExpectedStartedAt)) {
        Write-Warning "Leaving PID $Id untouched: it no longer matches the recorded $Role process."
        return $false
    }
    # Stop the verified root and its complete process tree. taskkill /T is a
    # Windows-native fallback when CIM cannot enumerate descendants.
    $descendantIds = Get-DescendantIds $Id
    $treeEnumerationFailed = $null -eq $descendantIds
    $taskkill = Get-Command 'taskkill.exe' -ErrorAction SilentlyContinue
    $taskkillExitCode = 1
    if ($taskkill) {
        try {
            & $taskkill.Source /PID $Id /T /F 2>$null | Out-Null
            $taskkillExitCode = $LASTEXITCODE
        } catch {
            # Some locked-down PowerShell hosts deny taskkill even for a
            # process owned by the current user; keep the PowerShell fallback.
        }
    }
    if ($treeEnumerationFailed -and $taskkillExitCode -ne 0) {
        Write-Warning "Cannot verify or stop the complete process tree for PID $Id; runtime metadata was preserved."
        return $false
    }
    foreach ($childId in @($descendantIds)) {
        Stop-Process -Id $childId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 100
    if (Get-Process -Id $Id -ErrorAction SilentlyContinue) { return $false }
    if (-not $treeEnumerationFailed) {
        foreach ($childId in @($descendantIds | Where-Object { $_ -ne $Id })) {
            if (Get-Process -Id $childId -ErrorAction SilentlyContinue) { return $false }
        }
    }
    return $true
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
        if ($SkipControlCenter) { $startArgs += '-SkipControlCenter' }
        $startOut = Join-Path $LogsDir 'lifecycle-start.out.log'
        $startErr = Join-Path $LogsDir 'lifecycle-start.err.log'
        $child = Start-Process -FilePath 'powershell.exe' -ArgumentList (@('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'start-local-swarm.ps1')) + $startArgs) -WorkingDirectory $RepoRoot -RedirectStandardOutput $startOut -RedirectStandardError $startErr -WindowStyle Hidden -PassThru
        # A full local smoke deliberately exercises the complete funnel and
        # may spend several minutes in deterministic prototype QA. Keep the
        # normal startup guard short, but do not kill a healthy full run at
        # the five-minute mark.
        $startupTimeoutMinutes = if ($Full) { 30 } else { 5 }
        $deadline = (Get-Date).AddMinutes($startupTimeoutMinutes)
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
        $env:MAGICSCRIPT_STACK_ID = [string]$lock.stackId
        # Keep Wrangler's local diagnostics/configuration on D: with the
        # Magic Script runtime instead of the user's C: profile.
        $env:XDG_CONFIG_HOME = Join-Path $RuntimeDir 'xdg-config'
        New-Item -ItemType Directory -Force -Path $env:XDG_CONFIG_HOME | Out-Null
        $exitCode = Invoke-InternalStart
        if ($exitCode -ne 0) { throw "Magic Script startup failed with exit code $exitCode." }
        $pids = Read-JsonFile $PidFile
        if (-not $pids.runner) { throw 'Startup completed without a recorded runner PID.' }
        $lock.phase = 'running'
        $lock.managerPid = 0
        $lock.apiPid = [int]$pids.api
        $lock.runnerPid = [int]$pids.runner
        $lock.controlCenterPid = [int]$pids.controlCenter
        $lock.apiStartedAt = $pids.apiStartedAt
        $lock.runnerStartedAt = $pids.runnerStartedAt
        $lock.controlCenterStartedAt = $pids.controlCenterStartedAt
        Write-Lock $lock
        Write-Host "Magic Script stack started with one tracked runner (PID $($lock.runnerPid)); stack=$($lock.stackId)."
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
    if ($ExpectedStackId) {
        $actualStackId = if ($lock -and $lock.stackId) { [string]$lock.stackId } else { '' }
        if ($actualStackId -ne $ExpectedStackId) {
            throw "Magic Script stop refused: expected stack $ExpectedStackId but active stack is $actualStackId."
        }
    }
    $runnerId = if ($lock -and $lock.runnerId) { [string]$lock.runnerId } else { $RunnerId }
    $runnerPid = Get-RecordedPid $lock.runnerPid $pids.runner
    $apiPid = Get-RecordedPid $lock.apiPid $pids.api
    $apiInfo = Get-ProcessInfo $apiPid
    $apiStartedAt = if ($pids.apiStartedAt) { [string]$pids.apiStartedAt } elseif ($lock.apiStartedAt) { [string]$lock.apiStartedAt } elseif ($lock.startedAt) { [string]$lock.startedAt } else { $null }
    $apiMatches = $apiInfo -and (Test-ExpectedProcess $apiInfo 'api' $apiStartedAt)
    if ($runnerPid -gt 0 -and (Test-Port 8787) -and $apiMatches) {
        try {
            $runnerToken = if ($env:MAGICSCRIPT_RUNNER_TOKEN) { $env:MAGICSCRIPT_RUNNER_TOKEN } else { 'dev-runner-token' }
            $shutdownHeaders = @{
                Authorization = "Bearer $runnerToken"
                'x-magicscript-runner-id' = $runnerId
            }
            if ($lock -and $lock.stackId) {
                $shutdownHeaders['x-magicscript-stack-id'] = [string]$lock.stackId
            }
            Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/runner/shutdown' -Method Post -Headers $shutdownHeaders -TimeoutSec 3 | Out-Null
        } catch {
            Write-Warning "Runner graceful shutdown notification failed; lease recovery remains available. $($_.Exception.Message)"
        }
    }

    $targets = @(
        [pscustomobject]@{
            Role = 'runner'
            Id = $runnerPid
            StartedAt = if ($pids.runnerStartedAt) { $pids.runnerStartedAt } elseif ($lock.runnerStartedAt) { $lock.runnerStartedAt } elseif ($lock.startedAt) { $lock.startedAt } else { $null }
        },
        [pscustomobject]@{
            Role = 'api'
            Id = $apiPid
            StartedAt = $apiStartedAt
        },
        [pscustomobject]@{
            Role = 'control'
            Id = Get-RecordedPid $lock.controlCenterPid $pids.controlCenter
            StartedAt = if ($pids.controlCenterStartedAt) { $pids.controlCenterStartedAt } elseif ($lock.controlCenterStartedAt) { $lock.controlCenterStartedAt } elseif ($lock.startedAt) { $lock.startedAt } else { $null }
        }
    ) | Where-Object { $_.Id -gt 0 }
    $remaining = @()
    foreach ($target in $targets) {
        if (-not (Stop-TrackedProcess $target.Id $target.Role $target.StartedAt)) { $remaining += $target }
    }
    if ($remaining.Count -gt 0) {
        Start-Sleep -Milliseconds 750
        $retry = @()
        foreach ($target in $remaining) {
            if (-not (Stop-TrackedProcess $target.Id $target.Role $target.StartedAt)) { $retry += $target }
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
        [pscustomobject]@{ Label = 'API'; Role = 'api'; Id = Get-RecordedPid $lock.apiPid $pids.api; StartedAt = if ($pids.apiStartedAt) { $pids.apiStartedAt } elseif ($lock.apiStartedAt) { $lock.apiStartedAt } elseif ($lock.startedAt) { $lock.startedAt } else { $null }; Port = 8787 },
        [pscustomobject]@{ Label = 'Runner'; Role = 'runner'; Id = Get-RecordedPid $lock.runnerPid $pids.runner; StartedAt = if ($pids.runnerStartedAt) { $pids.runnerStartedAt } elseif ($lock.runnerStartedAt) { $lock.runnerStartedAt } elseif ($lock.startedAt) { $lock.startedAt } else { $null }; Port = $null },
        [pscustomobject]@{ Label = 'Control Center'; Role = 'control'; Id = Get-RecordedPid $lock.controlCenterPid $pids.controlCenter; StartedAt = if ($pids.controlCenterStartedAt) { $pids.controlCenterStartedAt } elseif ($lock.controlCenterStartedAt) { $lock.controlCenterStartedAt } elseif ($lock.startedAt) { $lock.startedAt } else { $null }; Port = 3000 }
    )) {
        $info = Get-ProcessInfo $item.Id
        $health = if ($info -and (Test-ExpectedProcess $info $item.Role $item.StartedAt)) { 'tracked' } elseif ($info) { 'PID REUSE/UNKNOWN' } else { 'stopped' }
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
    $localCloudflareConfig = Join-Path $RuntimeDir 'cloudflare.local.json'
    Write-Host "Cloudflare token configured in session: $([bool]$env:CLOUDFLARE_API_TOKEN)"
    Write-Host "Cloudflare account configured: $([bool]$env:CLOUDFLARE_ACCOUNT_ID -or (Test-Path -LiteralPath $localCloudflareConfig -PathType Leaf))"
    Write-Host "Cloudflare local defaults: $(if (Test-Path -LiteralPath $localCloudflareConfig -PathType Leaf) { 'present on D:' } else { 'not configured' })"
    Write-Host 'Real email sending: DISABLED for local lifecycle'
}

switch ($Action) {
    'start' { Start-Stack }
    'stop' { Stop-Stack }
    'restart' { Stop-Stack -Quiet; Start-Stack }
    'status' { Show-Status }
    'doctor' { Show-Doctor }
}
