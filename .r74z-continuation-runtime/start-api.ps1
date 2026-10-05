$ErrorActionPreference='Stop'
$r74zRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $r74zRoot
$r74zProbe=New-Object System.Net.Sockets.TcpClient
try { $r74zProbe.Connect('127.0.0.1',8787); throw 'Port 8787 already in use' } catch [System.Net.Sockets.SocketException] {} finally { $r74zProbe.Dispose() }
# The canonical local lifecycle allocates a new GUID and supplies that exact
# generation to API vars and runner environment. No D1 initialization or loop.
$env:MAGICSCRIPT_STACK_ID=[guid]::NewGuid().Guid
$env:MAGICSCRIPT_RUNNER_PROSPECT_ID='v2-87988492200011'
$env:MAGICSCRIPT_SENDING_ENABLED='false'
$env:MAGICSCRIPT_EMAIL_PROVIDER='disabled'
$env:MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED='false'
$env:MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE='mock'
$env:XDG_CONFIG_HOME=Join-Path $r74zRoot '.magicscript/xdg-config'
$env:WRANGLER_LOG_PATH=Join-Path $PSScriptRoot 'wrangler-logs'
$env:WRANGLER_SEND_METRICS='false'
$r74zArguments=@('scripts/run-local-api-with-restart.cjs','dev','--config','wrangler.local.jsonc','--port','8787','--var',"MAGICSCRIPT_STACK_ID:$env:MAGICSCRIPT_STACK_ID",'--var',"MAGICSCRIPT_RUNNER_PROSPECT_ID:$env:MAGICSCRIPT_RUNNER_PROSPECT_ID",'--var','MAGICSCRIPT_SENDING_ENABLED:false','--var','MAGICSCRIPT_EMAIL_PROVIDER:disabled','--var','MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED:false')
$r74zApi=Start-Process -FilePath 'node.exe' -ArgumentList $r74zArguments -WorkingDirectory $r74zRoot -RedirectStandardOutput (Join-Path $PSScriptRoot 'api.out.log') -RedirectStandardError (Join-Path $PSScriptRoot 'api.err.log') -WindowStyle Hidden -PassThru
$r74zStack=@{stackId=$env:MAGICSCRIPT_STACK_ID;apiPid=$r74zApi.Id;apiStartedAt=$r74zApi.StartTime.ToUniversalTime().ToString('o');apiUrl='http://127.0.0.1:8787';mechanism='scripts/magic-script.ps1::Acquire-Lock GUID generation; scripts/start-local-swarm.ps1 shared MAGICSCRIPT_STACK_ID; scripts/run-local-api-with-restart.cjs Wrangler --var; bounded runOne'}
$r74zStack | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'stack.json') -Encoding UTF8
$r74zReady=$false
for ($r74zCheck=0;$r74zCheck -lt 60;$r74zCheck++) {
  Start-Sleep -Milliseconds 500
  try {
    $r74zHealth=Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 2
    if ($r74zHealth.ok -and $r74zHealth.stackId -eq $env:MAGICSCRIPT_STACK_ID) {
      if ($r74zHealth.sendingEnabled -or $r74zHealth.prototypeDeployEnabled -or $r74zHealth.effectiveOutboundMode -ne 'disabled') { throw 'Local safety configuration mismatch' }
      $r74zHealth | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'api-health.json') -Encoding UTF8
      $r74zReady=$true; break
    }
  } catch { if ($_.Exception.Message -eq 'Local safety configuration mismatch') {throw} }
}
if (-not $r74zReady) {throw 'Canonical local API did not become ready; no runner claim issued'}
Write-Output "STACK_GENERATION_READY=YES; STACK_ID=$env:MAGICSCRIPT_STACK_ID; API_PID=$($r74zApi.Id)"
