export const MARTINIQUE_TIMEZONE = 'America/Martinique' as const;
export const PARIS_TIMEZONE = 'Europe/Paris' as const;

export type CommunicationMode = 'email' | 'phone';
export type MeetingStatus = 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED';

export interface AvailabilityConfig {
  timeZone: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
  durationMinutes: number;
  horizonDays: number;
}

export const DEFAULT_AVAILABILITY: AvailabilityConfig = {
  timeZone: MARTINIQUE_TIMEZONE,
  weekdays: [1, 2, 3, 4, 5],
  startTime: '07:00',
  endTime: '14:00',
  durationMinutes: 30,
  horizonDays: 14,
};

export interface AvailabilitySlot {
  startAtUtc: string;
  endAtUtc: string;
  prospectTimeZone: string;
  prospectLabel: string;
  parisLabel: string;
  durationMinutes: number;
}

export interface MeetingConfirmationEmail {
  subject: string;
  body: string;
}

export interface MeetingReminderPlan {
  channel: 'EMAIL';
  requestedChannel: 'SMS';
  fallbackReason: 'SMS_PROVIDER_NOT_CONFIGURED';
  dueAt: string;
  subject: string;
  body: string;
}

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function numberPart(parts: Intl.DateTimeFormatPart[], type: string): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`Missing time zone part: ${type}`);
  return Number(value);
}

function dateParts(instant: Date, timeZone: string): DateParts {
  assertTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  return {
    year: numberPart(parts, 'year'),
    month: numberPart(parts, 'month'),
    day: numberPart(parts, 'day'),
    hour: numberPart(parts, 'hour'),
    minute: numberPart(parts, 'minute'),
    second: numberPart(parts, 'second'),
  };
}

export function assertTimeZone(timeZone: string): void {
  if (typeof timeZone !== 'string' || !timeZone.trim()) {
    throw new Error('timezone is required');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
  } catch {
    throw new Error(`Unsupported IANA timezone: ${timeZone}`);
  }
}

function parseDateKey(date: string): { year: number; month: number; day: number } {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new Error('date must use YYYY-MM-DD');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error('date is invalid');
  }
  return { year, month, day };
}

function parseTime(time: string): { hour: number; minute: number } {
  const match = TIME_PATTERN.exec(time);
  if (!match) throw new Error('time must use HH:MM');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('time is invalid');
  return { hour, minute };
}

function localDateTimeToWallMs(date: string, time: string): number {
  const dateValue = parseDateKey(date);
  const timeValue = parseTime(time);
  return Date.UTC(
    dateValue.year,
    dateValue.month - 1,
    dateValue.day,
    timeValue.hour,
    timeValue.minute,
    0,
    0,
  );
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = dateParts(instant, timeZone);
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ) - instant.getTime();
}

export function zonedLocalToUtc(date: string, time: string, timeZone: string): string {
  assertTimeZone(timeZone);
  const wallMs = localDateTimeToWallMs(date, time);
  let utcMs = wallMs;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const next = wallMs - timeZoneOffsetMs(new Date(utcMs), timeZone);
    if (next === utcMs) break;
    utcMs = next;
  }

  const actual = dateParts(new Date(utcMs), timeZone);
  const expected = { ...parseDateKey(date), ...parseTime(time) };
  if (
    actual.year !== expected.year ||
    actual.month !== expected.month ||
    actual.day !== expected.day ||
    actual.hour !== expected.hour ||
    actual.minute !== expected.minute
  ) {
    throw new Error('local time does not exist in the requested timezone');
  }
  return new Date(utcMs).toISOString();
}

export function dateKeyInTimeZone(instant: string | Date, timeZone: string): string {
  const date = typeof instant === 'string' ? new Date(instant) : instant;
  if (!Number.isFinite(date.getTime())) throw new Error('instant is invalid');
  const parts = dateParts(date, timeZone);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function addCalendarDays(date: string, days: number): string {
  const value = parseDateKey(date);
  const result = new Date(Date.UTC(value.year, value.month - 1, value.day + days));
  return result.toISOString().slice(0, 10);
}

export function formatInTimeZone(
  instant: string,
  timeZone: string,
  locale = 'fr-FR',
): string {
  assertTimeZone(timeZone);
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('instant is invalid');
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);
}

function weekday(date: string): number {
  const value = parseDateKey(date);
  return new Date(Date.UTC(value.year, value.month - 1, value.day)).getUTCDay();
}

function addMinutes(time: string, minutes: number): string {
  const parsed = parseTime(time);
  const total = parsed.hour * 60 + parsed.minute + minutes;
  if (total >= 24 * 60) throw new Error('availability slot crosses midnight');
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function validateAvailability(config: AvailabilityConfig): void {
  assertTimeZone(config.timeZone);
  const start = parseTime(config.startTime);
  const end = parseTime(config.endTime);
  if (start.hour * 60 + start.minute >= end.hour * 60 + end.minute) {
    throw new Error('availability start must be before end');
  }
  if (!Number.isInteger(config.durationMinutes) || config.durationMinutes <= 0) {
    throw new Error('durationMinutes must be a positive integer');
  }
  if (!Number.isInteger(config.horizonDays) || config.horizonDays <= 0 || config.horizonDays > 31) {
    throw new Error('horizonDays must be between 1 and 31');
  }
  if (!config.weekdays.length || config.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 5)) {
    throw new Error('weekdays must contain Monday-Friday values');
  }
}

export function generateAvailability(input: {
  fromDate: string;
  nowUtc: string;
  config?: AvailabilityConfig;
  occupiedStarts?: Iterable<string>;
  days?: number;
  prospectTimeZone?: string;
}): AvailabilitySlot[] {
  const config = input.config ?? DEFAULT_AVAILABILITY;
  validateAvailability(config);
  const now = new Date(input.nowUtc);
  if (!Number.isFinite(now.getTime())) throw new Error('nowUtc is invalid');
  const days = input.days ?? config.horizonDays;
  if (!Number.isInteger(days) || days <= 0 || days > 31) throw new Error('days is invalid');
  const prospectTimeZone = input.prospectTimeZone ?? config.timeZone;
  assertTimeZone(prospectTimeZone);
  const occupied = new Set(input.occupiedStarts ?? []);
  const slots: AvailabilitySlot[] = [];
  const start = parseTime(config.startTime);
  const end = parseTime(config.endTime);
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;

  for (let offset = 0; offset < days; offset += 1) {
    const date = addCalendarDays(input.fromDate, offset);
    if (!config.weekdays.includes(weekday(date))) continue;
    for (
      let minute = startMinutes;
      minute + config.durationMinutes <= endMinutes;
      minute += config.durationMinutes
    ) {
      const localStart = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      const localEnd = addMinutes(localStart, config.durationMinutes);
      const startAtUtc = zonedLocalToUtc(date, localStart, config.timeZone);
      const endAtUtc = zonedLocalToUtc(date, localEnd, config.timeZone);
      if (new Date(startAtUtc) <= now || occupied.has(startAtUtc)) continue;
      slots.push({
        startAtUtc,
        endAtUtc,
        prospectTimeZone,
        prospectLabel: formatInTimeZone(startAtUtc, prospectTimeZone),
        parisLabel: formatInTimeZone(startAtUtc, PARIS_TIMEZONE),
        durationMinutes: config.durationMinutes,
      });
    }
  }
  return slots;
}

export function slotForStart(input: {
  startAtUtc: string;
  nowUtc: string;
  config?: AvailabilityConfig;
  prospectTimeZone?: string;
}): AvailabilitySlot | null {
  const config = input.config ?? DEFAULT_AVAILABILITY;
  validateAvailability(config);
  const startAt = new Date(input.startAtUtc);
  const now = new Date(input.nowUtc);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(now.getTime()) || startAt <= now) return null;
  const local = dateParts(startAt, config.timeZone);
  const date = `${String(local.year).padStart(4, '0')}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
  const localStart = `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`;
  const slots = generateAvailability({
    fromDate: date,
    nowUtc: '1970-01-01T00:00:00.000Z',
    config,
    days: 1,
    prospectTimeZone: input.prospectTimeZone,
  });
  return slots.find((slot) => slot.startAtUtc === startAt.toISOString()) ?? null;
}

export function getWeekRangeUtc(
  nowUtc: string,
  timeZone = PARIS_TIMEZONE,
): { startAtUtc: string; endAtUtc: string } {
  const local = dateParts(new Date(nowUtc), timeZone);
  const date = `${String(local.year).padStart(4, '0')}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
  const currentWeekday = weekday(date);
  const monday = addCalendarDays(date, currentWeekday === 0 ? -6 : 1 - currentWeekday);
  return {
    startAtUtc: zonedLocalToUtc(monday, '00:00', timeZone),
    endAtUtc: zonedLocalToUtc(addCalendarDays(monday, 7), '00:00', timeZone),
  };
}

export function buildMeetingConfirmationEmail(input: {
  company: string;
  contactName?: string;
  startAtUtc: string;
  endAtUtc: string;
  prospectTimeZone: string;
  phone: string;
}): MeetingConfirmationEmail {
  const prospectTime = formatInTimeZone(input.startAtUtc, input.prospectTimeZone);
  const parisTime = formatInTimeZone(input.startAtUtc, PARIS_TIMEZONE);
  return {
    subject: `Rendez-vous confirmé avec Magic Script — ${input.company}`,
    body: [
      `Bonjour${input.contactName ? ` ${input.contactName}` : ''},`,
      '',
      `Votre échange téléphonique avec Magic Script est confirmé pour ${prospectTime}.`,
      `Pour Stéphane, ce rendez-vous correspond à ${parisTime}.`,
      'Durée : 30 minutes.',
      `Téléphone indiqué : ${input.phone}.`,
      'Pour annuler ou déplacer le rendez-vous, utilisez le lien de gestion fourni dans votre espace.',
      '',
      'Cet email est préparé automatiquement et reste soumis à la validation de la politique d’envoi.',
    ].join('\n'),
  };
}

export function buildH24ReminderPlan(input: {
  company: string;
  startAtUtc: string;
  endAtUtc: string;
  prospectTimeZone: string;
  communicationMode: CommunicationMode;
  status: MeetingStatus;
  nowUtc: string;
  alreadyPrepared: boolean;
}): MeetingReminderPlan | null {
  if (
    input.communicationMode !== 'phone' ||
    input.status !== 'CONFIRMED' ||
    input.alreadyPrepared
  ) return null;
  const start = new Date(input.startAtUtc);
  const now = new Date(input.nowUtc);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(now.getTime())) throw new Error('meeting time is invalid');
  const dueAt = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  if (now < dueAt || now >= start) return null;
  const prospectTime = formatInTimeZone(input.startAtUtc, input.prospectTimeZone);
  return {
    channel: 'EMAIL',
    requestedChannel: 'SMS',
    fallbackReason: 'SMS_PROVIDER_NOT_CONFIGURED',
    dueAt: dueAt.toISOString(),
    subject: `Rappel — rendez-vous Magic Script avec ${input.company}`,
    body: `Rappel : votre échange téléphonique avec Magic Script est prévu ${prospectTime}. Durée : 30 minutes. Aucun SMS n’est envoyé ; ce rappel est préparé en brouillon email.`,
  };
}
