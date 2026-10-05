param(
    [string]$ProspectId = '00000000-0000-4000-8000-000000000001'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot
$runtimeDir = Join-Path $repoRoot '.magicscript'
$env:XDG_CONFIG_HOME = Join-Path $runtimeDir 'xdg-config'
New-Item -ItemType Directory -Force -Path $env:XDG_CONFIG_HOME | Out-Null

$now = [DateTime]::UtcNow.ToString('o')
$contactId = '00000000-0000-4000-8000-000000000002'
$messageId = '00000000-0000-4000-8000-000000000003'
$prototypeId = '00000000-0000-4000-8000-000000000004'
$safeEmail = 'full-smoke@invalid.example'
$safeUrl = 'https://example.com/magic-script-e2e-safe'

$sql = @"
INSERT OR IGNORE INTO prospects (id, company_name, activity, location, website_url, opportunity, state, score, primary_friction, primary_asset, primary_cta, created_at, updated_at)
VALUES ('$ProspectId', 'Magic Script Full Smoke Fixture', 'Synthetic internal E2E fixture', 'Local only', 'https://example.com', 'A', 'OUTREACH_VERIFIED', 100, 'Internal test only', 'Internal safe dry-run path', 'No external action', '$now', '$now');
UPDATE prospects SET state='OUTREACH_VERIFIED', score=100, updated_at='$now' WHERE id='$ProspectId';
INSERT OR IGNORE INTO prototypes (id, prospect_id, status, qa_status, deployment_url, runner_id, created_at, updated_at)
VALUES ('$prototypeId', '$ProspectId', 'DEPLOYED', 'PASS', '$safeUrl', 'fixture', '$now', '$now');
INSERT OR IGNORE INTO contacts (id, prospect_id, email, source_url, source_type, confidence, is_validated, is_suppressed, created_at, updated_at)
VALUES ('$contactId', '$ProspectId', '$safeEmail', 'https://example.com', 'other_public_source', 100, 1, 0, '$now', '$now');
INSERT OR IGNORE INTO outreach_messages (id, prospect_id, contact_id, kind, subject, body_text, facts_json, source_refs_json, confidence, status, provider_message_id, sent_at, created_at, updated_at)
VALUES ('$messageId', '$ProspectId', '$contactId', 'INITIAL', 'Internal Magic Script dry-run', 'This is an internal synthetic dry-run message.', '[]', '[]', 100, 'VERIFIED', NULL, NULL, '$now', '$now');
UPDATE outreach_messages SET status='VERIFIED', provider_message_id=NULL, sent_at=NULL, updated_at='$now' WHERE id='$messageId';
"@

$sqlPath = Join-Path $repoRoot '.magicscript\full-smoke-fixture.sql'
try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($sqlPath, $sql, $utf8NoBom)
    npx.cmd wrangler d1 execute magicscript-dev --local --config .\apps\api-worker\wrangler.local.jsonc --file $sqlPath --yes
    if ($LASTEXITCODE -ne 0) { throw 'Full smoke fixture ensure failed.' }
    Write-Host "Full smoke fixture ready: $ProspectId"
}
finally {
    if (Test-Path -LiteralPath $sqlPath) {
        Remove-Item -LiteralPath $sqlPath -Force -ErrorAction SilentlyContinue
    }
}
