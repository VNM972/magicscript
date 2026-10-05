[CmdletBinding()]
param(
    [string]$AccountId,
    [string]$PagesProject
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $RepoRoot '.magicscript'
$ConfigPath = Join-Path $RuntimeDir 'cloudflare.local.json'

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

$existing = $null
if (Test-Path -LiteralPath $ConfigPath -PathType Leaf) {
    try {
        $existing = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    } catch {
        throw "Configuration Cloudflare locale invalide : $ConfigPath"
    }
}

$resolvedAccountId = if ($AccountId.Trim()) {
    $AccountId.Trim()
} elseif ($existing.accountId) {
    [string]$existing.accountId
} else {
    ''
}

$resolvedPagesProject = if ($PagesProject.Trim()) {
    $PagesProject.Trim()
} elseif ($existing.pagesProject) {
    [string]$existing.pagesProject
} else {
    ''
}

if ($resolvedAccountId -notmatch '^[a-fA-F0-9]{32}$') {
    throw 'AccountId Cloudflare absent ou invalide. Fournis l’ID de 32 caractères hexadécimaux.'
}
if ($resolvedPagesProject -notmatch '^[a-z0-9][a-z0-9-]{1,62}$') {
    throw 'PagesProject absent ou invalide.'
}

[ordered]@{
    accountId = $resolvedAccountId.ToLowerInvariant()
    pagesProject = $resolvedPagesProject
} | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath -Encoding UTF8

Write-Host 'Configuration Cloudflare locale enregistrée sur D:.'
Write-Host "Compte configuré : True ($resolvedAccountId)"
Write-Host "Projet Pages configuré : True ($resolvedPagesProject)"
Write-Host 'Clé API : non enregistrée ; Wrangler OAuth ou la variable de session sera utilisée.'
