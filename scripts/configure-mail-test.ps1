param(
    [string]$Mailbox = 'commercial@magicscript.fr',
    [string]$ReplyTo = 'commercial@magicscript.fr',
    [string]$TestRecipient,
    [switch]$SendTest
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not $TestRecipient) {
    $TestRecipient = Read-Host 'Controlled test recipient'
}

if (-not $TestRecipient) {
    throw 'A controlled test recipient is required.'
}

Write-Host ''
Write-Host "Amen mailbox: $Mailbox"
Write-Host "Reply-To:      $ReplyTo"
Write-Host "Test sink:     $TestRecipient"
Write-Host ''
Write-Host 'Enter the Amen mailbox password. It will stay only in this PowerShell process.'

$SecurePassword = Read-Host 'Amen password' -AsSecureString
$Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)

try {
    $PlainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)

    $env:MAGICSCRIPT_EMAIL_USERNAME = $Mailbox
    $env:MAGICSCRIPT_EMAIL_PASSWORD = $PlainPassword
    $env:MAGICSCRIPT_FROM_EMAIL = $Mailbox
    $env:MAGICSCRIPT_REPLY_TO_EMAIL = $ReplyTo
    $env:MAGICSCRIPT_EMAIL_PROVIDER = 'amen-smtp'
    $env:MAGICSCRIPT_SENDING_ENABLED = 'true'
    $env:MAGICSCRIPT_TEST_EMAIL_MODE = 'true'
    $env:MAGICSCRIPT_TEST_RECIPIENT = $TestRecipient

    $env:AMEN_SMTP_HOST = 'smtp-fr.securemail.pro'
    $env:AMEN_SMTP_PORT = '465'
    $env:AMEN_IMAP_HOST = 'mail-fr.securemail.pro'
    $env:AMEN_IMAP_PORT = '993'

    Write-Host ''
    Write-Host '[1/2] Checking Amen SMTP + IMAP authentication without sending...'
    npm --workspace magic-script-agent-runner run email:check
    if ($LASTEXITCODE -ne 0) {
        throw 'Amen mailbox connectivity check failed.'
    }

    if ($SendTest) {
        Write-Host ''
        Write-Host '[2/2] Sending one controlled SMTP test to the test sink...'
        npm --workspace magic-script-agent-runner run email:test-send
        if ($LASTEXITCODE -ne 0) {
            throw 'Controlled SMTP test send failed.'
        }
        Write-Host ''
        Write-Host 'Controlled SMTP test completed. No prospect address was contacted.'
    } else {
        Write-Host ''
        Write-Host '[2/2] Send skipped.'
        Write-Host 'Re-run with -SendTest to send exactly one controlled test email.'
    }
}
finally {
    if ($Bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
    }

    Remove-Item Env:MAGICSCRIPT_EMAIL_PASSWORD -ErrorAction SilentlyContinue
    $PlainPassword = $null
    $SecurePassword = $null
}
