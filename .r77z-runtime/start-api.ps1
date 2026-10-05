$ErrorActionPreference='Stop'
$r77zRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $r77zRoot
$r77zProbe=New-Object System.Net.Sockets.TcpClient
try { $r77zProbe.Connect('127.0.0.1',8787); throw 'Port 8787 already in use' } catch [System.Net.Sockets.SocketException] {} finally { $r77zProbe.Dispose() }
$env:MAGICSCRIPT_STACK_ID=[guid]::NewGuid().Guid
$env:MAGICSCRIPT_RUNNER_PROSPECT_ID='v2-51972816600033'
$env:MAGICSCRIPT_SENDING_ENABLED='false'
$env:MAGICSCRIPT_EMAIL_PROVIDER='disabled'
$env:MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED='false'
$env:MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE='mock'
$env:XDG_CONFIG_HOME=Join-Path $r77zRoot '.magicscript/xdg-config'
$env:WRANGLER_LOG_PATH=Join-Path $PSScriptRoot 'wrangler-logs'
$env:WRANGLER_SEND_METRICS='false'
$r77zArguments=@('scripts/run-local-api-with-restart.cjs','dev','--config','wrangler.local.jsonc','--port','8787','--var',"MAGICSCRIPT_STACK_ID:$env:MAGICSCRIPT_STACK_ID",'--var',"MAGICSCRIPT_RUNNER_PROSPECT_ID:$env:MAGICSCRIPT_RUNNER_PROSPECT_ID",'--var','MAGICSCRIPT_SENDING_ENABLED:false','--var','MAGICSCRIPT_EMAIL_PROVIDER:disabled','--var','MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED:false')
$r77zApi=Start-Process -FilePath 'node.exe' -ArgumentList $r77zArguments -WorkingDirectory $r77zRoot -RedirectStandardOutput (Join-Path $PSScriptRoot 'api.out.log') -RedirectStandardError (Join-Path $PSScriptRoot 'api.err.log') -WindowStyle Hidden -PassThru
@{stackId=$env:MAGICSCRIPT_STACK_ID;apiPid=$r77zApi.Id;apiStartedAt=$r77zApi.StartTime.ToUniversalTime().ToString('o');apiUrl='http://127.0.0.1:8787';mechanism='Existing GUID stack generation + run-local-api-with-restart Wrangler vars; bounded runOne'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'stack.json') -Encoding UTF8
$r77zReady=$false
for ($r77zCheck=0;$r77zCheck -lt 60;$r77zCheck++) {
 Start-Sleep -Milliseconds 500
 try {
  $r77zHealth=Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 2
  if ($r77zHealth.ok -and $r77zHealth.stackId -eq $env:MAGICSCRIPT_STACK_ID) {
   if ($r77zHealth.sendingEnabled -or $r77zHealth.prototypeDeployEnabled -or $r77zHealth.effectiveOutboundMode -ne 'disabled') { throw 'Local safety configuration mismatch' }
   $r77zHealth | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'api-health.json') -Encoding UTF8
   $r77zReady=$true;break
  }
 } catch { if ($_.Exception.Message -eq 'Local safety configuration mismatch') {throw} }
}
if(-not $r77zReady){throw 'Canonical local API not ready; no admission or runner issued'}
Write-Output 'STACK_GENERATION_READY=YES'
