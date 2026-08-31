import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export interface AmenMailConfig {
  username: string;
  password: string;
  fromEmail: string;
  replyToEmail?: string;
  signature?: string;
  smtpHost?: string;
  smtpPort?: number;
  imapHost?: string;
  imapPort?: number;
}

const SIGNATURE_LOGO_CID = 'magic-script-logo@magicscript.fr';
const SIGNATURE_LOGO_PATH = fileURLToPath(
  new URL('./assets/magic-script-logo-email.png', import.meta.url),
);

export interface AmenSendInput {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string[];
}

export interface AmenSendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function signatureMarkup(signature: string, includeLogo: boolean): string {
  const lines = signature
    .split(/\r?\n/)
    .map((line) => escapeHtml(line))
    .join('<br>');
  const logo = includeLogo
    ? `<img src="cid:${SIGNATURE_LOGO_CID}" alt="Magic Script" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0">`
    : '';
  const logoCell = includeLogo
    ? `<td valign="middle" style="padding-left:16px">${logo}</td>`
    : '';

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px"><tr><td valign="middle" style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#202938">${lines}</td>${logoCell}</tr></table>`;
}

export interface AmenInboundMessage {
  uid: number;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  fromEmail?: string;
  subject?: string;
  text: string;
  date?: string;
}

const DEFAULT_SMTP_HOST = 'smtp-fr.securemail.pro';
const DEFAULT_SMTP_PORT = 465;
const DEFAULT_IMAP_HOST = 'mail-fr.securemail.pro';
const DEFAULT_IMAP_PORT = 993;

export function createAmenSmtpTransport(config: AmenMailConfig) {
  return nodemailer.createTransport({
    host: config.smtpHost ?? DEFAULT_SMTP_HOST,
    port: config.smtpPort ?? DEFAULT_SMTP_PORT,
    secure: true,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });
}

export async function verifyAmenSmtp(config: AmenMailConfig): Promise<void> {
  const transport = createAmenSmtpTransport(config);
  await transport.verify();
  transport.close();
}

export async function sendAmenEmail(
  config: AmenMailConfig,
  input: AmenSendInput,
): Promise<AmenSendResult> {
  const transport = createAmenSmtpTransport(config);
  const text = [input.text.trim(), config.signature?.trim()]
    .filter(Boolean)
    .join('\n\n');
  const includeLogo = existsSync(SIGNATURE_LOGO_PATH);
  const html = config.signature?.trim()
    ? `${escapeHtml(input.text).replace(/\r?\n/g, '<br>')}<br><br>${signatureMarkup(config.signature.trim(), includeLogo)}`
    : undefined;
  const info = await transport.sendMail({
    from: config.fromEmail,
    replyTo: config.replyToEmail ?? config.fromEmail,
    to: input.to,
    subject: input.subject,
    text,
    ...(html ? { html } : {}),
    ...(includeLogo
      ? {
          attachments: [
            {
              filename: 'magic-script-logo-email.png',
              path: SIGNATURE_LOGO_PATH,
              cid: SIGNATURE_LOGO_CID,
              contentDisposition: 'inline',
            },
          ],
        }
      : {}),
    inReplyTo: input.inReplyTo,
    references: input.references,
  });

  transport.close();

  return {
    messageId: info.messageId,
    accepted: info.accepted.map(String),
    rejected: info.rejected.map(String),
  };
}

export async function verifyAmenImap(config: AmenMailConfig): Promise<void> {
  const client = new ImapFlow({
    host: config.imapHost ?? DEFAULT_IMAP_HOST,
    port: config.imapPort ?? DEFAULT_IMAP_PORT,
    secure: true,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false,
  });

  try {
    await client.connect();
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function fetchAmenInboxSince(
  config: AmenMailConfig,
  since: Date,
): Promise<AmenInboundMessage[]> {
  const client = new ImapFlow({
    host: config.imapHost ?? DEFAULT_IMAP_HOST,
    port: config.imapPort ?? DEFAULT_IMAP_PORT,
    secure: true,
    auth: {
      user: config.username,
      pass: config.password,
    },
    logger: false,
  });

  const messages: AmenInboundMessage[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const sequence = await client.search({ since });

      if (!sequence || sequence.length === 0) {
        return messages;
      }

      for await (const message of client.fetch(sequence, {
        uid: true,
        envelope: true,
        source: true,
      })) {
        if (!message.source) continue;

        const parsed = await simpleParser(message.source);
        if (parsed.date && parsed.date < since) {
          continue;
        }

        const fromAddress =
          parsed.from?.value?.[0]?.address ??
          message.envelope?.from?.[0]?.address;

        const inReplyTo = Array.isArray(parsed.inReplyTo)
          ? parsed.inReplyTo[0]
          : parsed.inReplyTo;
        const references = Array.isArray(parsed.references)
          ? parsed.references
          : parsed.references
            ? [parsed.references]
            : [];

        messages.push({
          uid: message.uid,
          messageId: parsed.messageId ?? undefined,
          inReplyTo: inReplyTo ?? undefined,
          references,
          fromEmail: fromAddress ?? undefined,
          subject: parsed.subject ?? message.envelope?.subject ?? undefined,
          text:
            parsed.text?.trim() ||
            (typeof parsed.html === 'string' ? parsed.html : '') ||
            '',
          date:
            parsed.date?.toISOString() ??
            message.envelope?.date?.toISOString(),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return messages;
}
