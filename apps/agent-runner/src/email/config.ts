import type { AmenMailConfig } from './amen';

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
  return {
    username: required('MAGICSCRIPT_EMAIL_USERNAME'),
    password: required('MAGICSCRIPT_EMAIL_PASSWORD'),
    fromEmail: required('MAGICSCRIPT_FROM_EMAIL'),
    replyToEmail:
      process.env.MAGICSCRIPT_REPLY_TO_EMAIL?.trim() || undefined,
    smtpHost:
      process.env.AMEN_SMTP_HOST?.trim() || 'smtp-fr.securemail.pro',
    smtpPort: port('AMEN_SMTP_PORT', 465),
    imapHost:
      process.env.AMEN_IMAP_HOST?.trim() || 'mail-fr.securemail.pro',
    imapPort: port('AMEN_IMAP_PORT', 993),
  };
}
