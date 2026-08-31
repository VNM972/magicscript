import type { AmenMailConfig } from './amen';

export const CONTROLLED_TEST_RECIPIENTS = new Set([
  'stephanemire@yahoo.fr',
  'stephanemire75@gmail.com',
]);

function defaultEmailSignature(fromEmail: string): string {
  return [
    'Stéphane MIRE',
    'Magic Script',
    fromEmail,
    'Tél. : 06 58 69 50 73',
  ].join('\n');
}

export function isControlledTestRecipient(value: string): boolean {
  return CONTROLLED_TEST_RECIPIENTS.has(value.trim().toLowerCase());
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for Amen email integration`);
  }
  return value;
}

function port(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

export function loadAmenMailConfig(): AmenMailConfig {
  const fromEmail = required('MAGICSCRIPT_FROM_EMAIL');

  return {
    username: required('MAGICSCRIPT_EMAIL_USERNAME'),
    password: required('MAGICSCRIPT_EMAIL_PASSWORD'),
    fromEmail,
    replyToEmail:
      process.env.MAGICSCRIPT_REPLY_TO_EMAIL?.trim() || undefined,
    signature:
      process.env.MAGICSCRIPT_EMAIL_SIGNATURE?.trim() ||
      defaultEmailSignature(fromEmail),
    smtpHost:
      process.env.AMEN_SMTP_HOST?.trim() || 'smtp-fr.securemail.pro',
    smtpPort: port('AMEN_SMTP_PORT', 465),
    imapHost:
      process.env.AMEN_IMAP_HOST?.trim() || 'mail-fr.securemail.pro',
    imapPort: port('AMEN_IMAP_PORT', 993),
  };
}
