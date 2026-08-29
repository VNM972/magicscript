export interface MagicScriptConfig {
  autopilotEnabled: boolean;
  sendingEnabled: boolean;
  prototypeDeployEnabled: boolean;
  dailySendLimit: number;
  maxFollowups: number;
  minContactConfidence: number;
  minOutreachConfidence: number;
  autoPrototypeScore: number;
  databaseProvider: 'memory' | 'sqlite' | 'd1';
  emailProvider: 'disabled' | 'dry-run' | 'amen-smtp' | 'smtp' | 'resend' | 'other';
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value == null || value === '') return fallback;
  return value.toLowerCase() === 'true';
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(
  env: Record<string, string | undefined> = {},
): MagicScriptConfig {
  const databaseProvider = env.MAGICSCRIPT_DATABASE_PROVIDER ?? 'memory';
  const emailProvider = env.MAGICSCRIPT_EMAIL_PROVIDER ?? 'disabled';

  if (!['memory', 'sqlite', 'd1'].includes(databaseProvider)) {
    throw new Error(`Unsupported database provider: ${databaseProvider}`);
  }

  if (!['disabled', 'dry-run', 'amen-smtp', 'smtp', 'resend', 'other'].includes(emailProvider)) {
    throw new Error(`Unsupported email provider: ${emailProvider}`);
  }

  return {
    autopilotEnabled: bool(env.MAGICSCRIPT_AUTOPILOT_ENABLED),
    sendingEnabled: bool(env.MAGICSCRIPT_SENDING_ENABLED),
    prototypeDeployEnabled: bool(env.MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED),
    dailySendLimit: int(env.MAGICSCRIPT_DAILY_SEND_LIMIT, 10),
    maxFollowups: int(env.MAGICSCRIPT_MAX_FOLLOWUPS, 2),
    minContactConfidence: int(env.MAGICSCRIPT_MIN_CONTACT_CONFIDENCE, 80),
    minOutreachConfidence: int(env.MAGICSCRIPT_MIN_OUTREACH_CONFIDENCE, 85),
    autoPrototypeScore: int(env.MAGICSCRIPT_AUTO_PROTOTYPE_SCORE, 85),
    databaseProvider: databaseProvider as MagicScriptConfig['databaseProvider'],
    emailProvider: emailProvider as MagicScriptConfig['emailProvider'],
  };
}
