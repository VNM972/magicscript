# Magic Script V2 — Email Roles

## V1 mailbox roles

### commercial@magicscript.fr

Primary mailbox for outbound B2B prospecting.

For the first commercial V1 it should also receive replies to outreach messages, because the runner currently monitors one Amen IMAP mailbox per process. Keeping `From` and `Reply-To` on the same monitored mailbox guarantees that reply classification, bounce handling and thread correlation work end to end.

Recommended V1 runtime values:

```text
MAGICSCRIPT_FROM_EMAIL=commercial@magicscript.fr
MAGICSCRIPT_REPLY_TO_EMAIL=commercial@magicscript.fr
MAGICSCRIPT_EMAIL_USERNAME=commercial@magicscript.fr
MAGICSCRIPT_EMAIL_SIGNATURE="Stéphane MIRE\nMagic Script\ncommercial@magicscript.fr\nTél. : 06 58 69 50 73"
```

The transport appends the configured signature in both plain-text and HTML form and embeds the Magic Script logo inline when the logo asset is available. If `MAGICSCRIPT_EMAIL_SIGNATURE` is unset, the default signature uses `MAGICSCRIPT_FROM_EMAIL`, so the same configuration works for either the commercial or contact mailbox.

### contact@magicscript.fr

General contact address for the Magic Script website and non-prospecting communication.

It is intentionally not the default Reply-To for automated outreach in V1, because replies sent there would bypass the commercial mailbox IMAP poller unless a second inbox watcher is configured.

## Controlled test procedure

The test harness never stores the Amen password in Git.

Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-mail-test.ps1 -TestRecipient <controlled-inbox>
```

This verifies SMTP and IMAP authentication without sending.

To send exactly one controlled SMTP test after authentication succeeds:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-mail-test.ps1 -TestRecipient <controlled-inbox> -SendTest
```

The password is requested through a PowerShell secure prompt and removed from the process environment when the script ends.

## Safety

A commercial prospect must never be used as the controlled test recipient.

For full-funnel testing, `MAGICSCRIPT_TEST_EMAIL_MODE=true` reroutes all SMTP deliveries to the configured controlled inbox and records them as `TEST_SENT`.
