param(
    [string]$ProspectId = '2609319c-5578-4a37-99bb-1b0923a2f81f'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

# Keep this Windows PowerShell script ASCII-only. PowerShell 5.1 otherwise
# reads a UTF-8 file without BOM as the active ANSI code page.
$eAcute = [char]0x00e9
$eGrave = [char]0x00e8
$eCirc = [char]0x00ea
$eAcuteUpper = [char]0x00c9
$eGraveUpper = [char]0x00c8
$aGrave = [char]0x00e0

$now = [DateTime]::UtcNow.ToString('o')
$sql = "INSERT OR IGNORE INTO prospects (id, company_name, activity, location, website_url, opportunity, state, score, primary_friction, primary_asset, primary_cta, created_at, updated_at) VALUES ('$ProspectId', 'SNEMM', 'Association nationale entraide et memoire', 'France', 'https://www.snemm.fr', 'A', 'PROTOTYPE_REQUIRED', 90, 'Rendre plus lisibles les missions, les parcours et les actions pour les visiteurs', 'Mission entraide memoire et accompagnement des membres de la SNEMM', 'Decouvrir les actions de la SNEMM', '$now', '$now');"

Write-Host "Ensuring synthetic prospect exists: $ProspectId"
npx.cmd wrangler d1 execute magicscript-dev --local --config .\apps\api-worker\wrangler.local.jsonc --command $sql --yes
if ($LASTEXITCODE -ne 0) {
    throw 'Synthetic prospect ensure failed.'
}

# Keep the synthetic E2E self-contained: the strategy agent must receive the
# source navigation observed on the official site even when this fixture skips
# a live research job. This is research context only; it never creates a
# contact and never enables email delivery.
$researchJobId = '2609319c-5578-4a37-99bb-1b0923a2f820'
$sourceNavigationBlocks = @(
    @{ label = '- ACCUEIL -'; kind = 'navigation' }
    @{ label = "Agenda du si${eGrave}ge"; kind = 'navigation' }
    @{ label = "- LA M${eAcuteUpper}DAILLE MILITAIRE -"; kind = 'navigation' }
    @{ label = '- LA SNEMM -'; kind = 'navigation' }
    @{ label = '- CONTACTS UD et SECTIONS -'; kind = 'navigation' }
    @{ label = "L'Entraide"; kind = 'navigation' }
    @{ label = 'Conditions obtention LH - MM - ONM'; kind = 'navigation' }
    @{ label = "- NOTRE R${eAcuteUpper}SIDENCE -"; kind = 'navigation' }
    @{ label = "Pr${eAcute}sentation"; kind = 'navigation' }
    @{ label = 'Les projets et les tarifs'; kind = 'navigation' }
    @{ label = 'Contact'; kind = 'navigation' }
    @{ label = '- LA VIE des STRUCTURES -'; kind = 'navigation' }
    @{ label = 'La vie des structures'; kind = 'navigation' }
    @{ label = 'IN MEMORIAM'; kind = 'navigation' }
    @{ label = 'Galerie photos'; kind = 'navigation' }
    @{ label = 'VIDEOS'; kind = 'navigation' }
    @{ label = '- LA BOUTIQUE -'; kind = 'navigation' }
    @{ label = '- CNIL - RGPD -'; kind = 'navigation' }
    @{ label = "J'adh${eGrave}re"; kind = 'conversion_cta' }
    @{ label = 'JE FAIS UN DON'; kind = 'conversion_cta' }
    @{ label = 'Se connecter'; kind = 'navigation' }
    @{ label = 'Administration'; kind = 'content_block' }
    @{ label = 'Historique'; kind = 'content_block' }
    @{ label = 'Annuaires'; kind = 'content_block' }
    @{ label = 'Informations'; kind = 'content_block' }
    @{ label = "L'embl${eGrave}me et le fanion"; kind = 'content_block' }
    @{ label = 'La boutique'; kind = 'content_block' }
    @{ label = 'Liens media SNEMM'; kind = 'content_block' }
    @{ label = "Autres m${eAcute}dias"; kind = 'content_block' }
    @{ label = 'ARTICLES'; kind = 'content_block' }
    @{ label = 'LA VIE DES STRUCTURES'; kind = 'content_block' }
    @{ label = 'IN MEMORIAM'; kind = 'content_block' }
    @{ label = 'LA RESIDENCE MARC RICHE'; kind = 'content_block' }
    @{ label = "Troph${eAcute}es Sports 82"; kind = 'content_block' }
    @{ label = 'Commande de plaques'; kind = 'content_block' }
    @{ label = "Nos m${eAcute}c${eGrave}nes - Nos partenaires"; kind = 'content_block' }
    @{ label = "Nos annonceurs en publicit${eAcute}"; kind = 'content_block' }
    @{ label = "Je m'abonne ${aGrave} la newsletter"; kind = 'conversion_cta' }
    @{ label = 'Plan du site'; kind = 'content_block' }
    @{ label = "Mentions l${eAcute}gales"; kind = 'content_block' }
)
$research = @{
    activity = "Association nationale d'entraide et de m${eAcute}moire"
    location = 'France'
    websiteUrl = 'https://www.snemm.fr/'
    primaryAsset = "Mission d'entraide, de m${eAcute}moire et d'accompagnement des membres de la SNEMM."
    primaryFriction = 'Rendre plus lisibles les missions, les parcours et les actions pour les visiteurs.'
    primaryCta = "D${eAcute}couvrir les actions de la SNEMM."
    sourceNavigationBlocks = $sourceNavigationBlocks
    sourceNavigationNote = "Navigation et blocs visibles relev${eAcute}s sur https://www.snemm.fr/ ; ${aGrave} reprendre structurellement dans le prototype avec des liens de d${eAcute}monstration non connect${eAcute}s."
    sources = @(@{ url = 'https://www.snemm.fr/'; note = 'Site officiel, navigation et blocs visibles.' })
    scoreInputs = @{
        digitalGap = 80
        commercialStrength = 80
        contactability = 50
        localFit = 50
        prototypeLeverage = 95
        confidence = 90
    }
} | ConvertTo-Json -Compress -Depth 10
$researchPayload = '{"synthetic":true,"source":"https://www.snemm.fr/"}'
$escapedResearch = $research.Replace("'", "''")
$escapedPayload = $researchPayload.Replace("'", "''")
$researchSql = "INSERT INTO jobs (id, kind, prospect_id, payload_json, status, attempts, max_attempts, run_after, created_at, updated_at) VALUES ('$researchJobId', 'RUN_RESEARCH_SWARM', '$ProspectId', '$escapedPayload', 'SUCCEEDED', 1, 3, '$now', '$now', '$now') ON CONFLICT(id) DO UPDATE SET prospect_id=excluded.prospect_id, payload_json=excluded.payload_json, status=excluded.status, attempts=excluded.attempts, max_attempts=excluded.max_attempts, run_after=excluded.run_after, last_error=NULL, claimed_by=NULL, claimed_at=NULL, updated_at=excluded.updated_at; DELETE FROM job_results WHERE job_id = '$researchJobId'; INSERT INTO job_results (job_id, output_json, created_at) VALUES ('$researchJobId', '$escapedResearch', '$now');"
Write-Host "Ensuring synthetic source navigation context: $researchJobId"
# Use a temporary SQL file: passing minified JSON as a Windows command-line
# argument is not reliable because embedded quotes are split by npx.cmd.
$researchSqlPath = Join-Path $repoRoot '.magicscript\synthetic-source-context.sql'
try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText(
        $researchSqlPath,
        $researchSql,
        $utf8NoBom
    )
    npx.cmd wrangler d1 execute magicscript-dev --local --config .\apps\api-worker\wrangler.local.jsonc --file $researchSqlPath --yes
    if ($LASTEXITCODE -ne 0) {
        throw 'Synthetic source navigation context ensure failed.'
    }
}
finally {
    if (Test-Path -LiteralPath $researchSqlPath) {
        Remove-Item -LiteralPath $researchSqlPath -Force -ErrorAction SilentlyContinue
    }
}
