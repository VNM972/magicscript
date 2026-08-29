import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export interface AmenMailConfig {
  username: string;
  password: string;
  fromEmail: string;
  replyToEmail?: string;
  smtpHost?: string;
  smtpPort?: number;
  imapHost?: string;
  imapPort?: number;
}

export interface AmenSendInput {
  to: string;
  subject: string;
  text: string;
}

export interface AmenSendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export interface AmenInboundMessage {
  uid: number;
  messageId?: string;
  inReplyTo?: string;
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
  const info = await transport.sendMail({
    from: config.fromEmail,
    replyTo: config.replyToEmail ?? config.fromEmail,
    to: input.to,
    subject: input.subject,
    text: input.text,
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

      if (!sequence.length) {
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

        messages.push({
          uid: message.uid,
          messageId: parsed.messageId ?? undefined,
          inReplyTo: inReplyTo ?? undefined,
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
