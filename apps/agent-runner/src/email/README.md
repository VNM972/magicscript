# Amen email adapter

Magic Script can use the mailbox already hosted by Amen without adding a paid email API.

Official Amen settings used by the adapter:

- SMTP host: `smtp-fr.securemail.pro`
- SMTP port: `465`
- IMAP host: `mail-fr.securemail.pro`
- IMAP port: `993`
- authentication: mailbox address + mailbox password
- TLS/SSL enabled

## Safety

The adapter does not send anything unless:

- `MAGICSCRIPT_SENDING_ENABLED=true`
- `MAGICSCRIPT_EMAIL_PROVIDER=amen-smtp`

The mailbox password must only exist in local/runtime secrets and must never be committed.

## Responsibilities

SMTP:
- verify credentials
- send an already fact-checked Magic Script email
- return the real Message-ID

IMAP:
- poll INBOX
- extract Message-ID / In-Reply-To
- forward replies to the Magic Script control plane
- let the Response Classifier determine the next state
