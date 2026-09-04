import type { MagicScriptEvent } from '../types/events';

export const ENGAGEMENT_WEIGHTS = {
  PROTOTYPE_VIEWED: 5,
  SALES_ROOM_VIEWED: 8,
  RETURN_VISIT: 6,
  DEMO_OPENED: 10,
  SHARE_CLICKED: 8,
  CONTACT_CLICKED: 12,
  MESSAGE_SENT: 35,
  MEETING_REQUESTED: 45,
  MEETING_BOOKED: 60,
} as const;

export const ENGAGEMENT_ACTIVITY_LIMITS = {
  PROTOTYPE_VIEWED: { max: 2, window: '24h' },
  SALES_ROOM_VIEWED: { max: 2, window: '24h' },
  RETURN_VISIT: { max: 2, window: 'day' },
  DEMO_OPENED: { max: 2, window: 'day' },
  SHARE_CLICKED: { max: 2, window: 'day' },
  CONTACT_CLICKED: { max: 1, window: 'day' },
} as const;

export type EngagementSignal = keyof typeof ENGAGEMENT_WEIGHTS;
export type EngagementTrend = 'RISING' | 'STABLE' | 'COOLING';

export const ACTIVITY_SIGNALS = [
  'PROTOTYPE_VIEWED',
  'SALES_ROOM_VIEWED',
  'RETURN_VISIT',
  'DEMO_OPENED',
  'SHARE_CLICKED',
  'CONTACT_CLICKED',
] as const satisfies readonly EngagementSignal[];

export const INTENT_SIGNALS = [
  'MESSAGE_SENT',
  'MEETING_REQUESTED',
  'MEETING_BOOKED',
] as const satisfies readonly EngagementSignal[];

export interface EngagementEvent {
  signal: EngagementSignal;
  occurredAt: string;
  id?: string;
  dedupeKey?: string;
  sourceType?: string;
  sourceId?: string;
}

export interface EngagementContributor {
  signal: EngagementSignal;
  contribution: number;
  baseWeight: number;
  decay: number;
  occurredAt: string;
  sourceType?: string;
  sourceId?: string;
  reason: string;
}

export interface EngagementScoreResult {
  score_total: number;
  activity_score: number;
  intent_score: number;
  trend: EngagementTrend;
  top_contributors: EngagementContributor[];
  last_meaningful_event: EngagementSignal | null;
  computed_at: string;
}

type WindowKind = (typeof ENGAGEMENT_ACTIVITY_LIMITS)[keyof typeof ENGAGEMENT_ACTIVITY_LIMITS]['window'];

const KNOWN_SIGNALS = new Set<EngagementSignal>(Object.keys(ENGAGEMENT_WEIGHTS) as EngagementSignal[]);
const ACTIVITY_SET = new Set<EngagementSignal>(ACTIVITY_SIGNALS);
const INTENT_SET = new Set<EngagementSignal>(INTENT_SIGNALS);
const DAY_MS = 24 * 60 * 60 * 1000;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseTimestamp(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function decayMultiplier(ageDays: number): number {
  if (ageDays <= 3) return 1;
  if (ageDays <= 7) return 0.8;
  if (ageDays <= 14) return 0.6;
  if (ageDays <= 30) return 0.4;
  return 0.2;
}

function ageInDays(eventTimestamp: number, nowTimestamp: number): number {
  return Math.max(0, nowTimestamp - eventTimestamp) / DAY_MS;
}

function dateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function withinLimit(
  event: EngagementEvent,
  eventTimestamp: number,
  accepted: readonly { event: EngagementEvent; timestamp: number }[],
): boolean {
  const limit = event.signal in ENGAGEMENT_ACTIVITY_LIMITS
    ? ENGAGEMENT_ACTIVITY_LIMITS[event.signal as keyof typeof ENGAGEMENT_ACTIVITY_LIMITS]
    : null;
  if (!limit) return true;

  const previous = accepted.filter((candidate) => candidate.event.signal === event.signal);
  if (limit.window === 'day') {
    return previous.filter((candidate) => dateKey(candidate.timestamp) === dateKey(eventTimestamp)).length < limit.max;
  }

  return previous.filter((candidate) => Math.abs(candidate.timestamp - eventTimestamp) < DAY_MS).length < limit.max;
}

function stableEventKey(event: EngagementEvent): string {
  return event.dedupeKey
    ? `${event.signal}:${event.dedupeKey}`
    : event.id
      ? `${event.signal}:id:${event.id}`
      : `${event.signal}:${event.occurredAt}:${event.sourceId ?? ''}`;
}

function deduplicate(events: readonly EngagementEvent[]): EngagementEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (!KNOWN_SIGNALS.has(event.signal) || parseTimestamp(event.occurredAt) === null) return false;
    const key = stableEventKey(event);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function trendFor(contributors: readonly EngagementContributor[], timestamps: readonly number[], nowTimestamp: number): EngagementTrend {
  if (contributors.length === 0) return 'STABLE';

  const recent = contributors.reduce((total, contributor, index) => {
    return ageInDays(timestamps[index], nowTimestamp) <= 7 ? total + contributor.contribution : total;
  }, 0);
  const previous = contributors.reduce((total, contributor, index) => {
    return ageInDays(timestamps[index], nowTimestamp) > 7 ? total + contributor.contribution : total;
  }, 0);

  if (recent > 0 && (previous === 0 || recent >= previous * 1.5)) return 'RISING';
  if (previous > 0 && (recent === 0 || recent < previous * 0.5)) return 'COOLING';
  return 'STABLE';
}

export function scoreEngagement(
  inputEvents: readonly EngagementEvent[],
  now: string | Date,
): EngagementScoreResult {
  const computedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const nowTimestamp = parseTimestamp(computedAt);
  if (nowTimestamp === null) throw new Error('now must be a valid timestamp');

  const sorted = deduplicate(inputEvents)
    .map((event) => ({ event, timestamp: parseTimestamp(event.occurredAt) as number }))
    .sort((a, b) => b.timestamp - a.timestamp);
  const accepted: { event: EngagementEvent; timestamp: number }[] = [];

  for (const candidate of sorted) {
    if (ACTIVITY_SET.has(candidate.event.signal) && !withinLimit(candidate.event, candidate.timestamp, accepted)) {
      continue;
    }
    accepted.push(candidate);
  }

  const contributorsWithTimestamps = accepted.map(({ event, timestamp }) => {
    const decay = decayMultiplier(ageInDays(timestamp, nowTimestamp));
    const contribution = round(ENGAGEMENT_WEIGHTS[event.signal] * decay);
    return {
      contributor: {
        signal: event.signal,
        contribution,
        baseWeight: ENGAGEMENT_WEIGHTS[event.signal],
        decay,
        occurredAt: event.occurredAt,
        ...(event.sourceType ? { sourceType: event.sourceType } : {}),
        ...(event.sourceId ? { sourceId: event.sourceId } : {}),
        reason: `${event.signal} · poids ${ENGAGEMENT_WEIGHTS[event.signal]} · decay ${decay}`,
      } satisfies EngagementContributor,
      timestamp,
    };
  });

  const activityRaw = contributorsWithTimestamps.reduce(
    (total, item) => ACTIVITY_SET.has(item.contributor.signal) ? total + item.contributor.contribution : total,
    0,
  );
  const intentScore = contributorsWithTimestamps.reduce(
    (total, item) => INTENT_SET.has(item.contributor.signal) ? total + item.contributor.contribution : total,
    0,
  );
  const activityScore = Math.min(40, round(activityRaw));
  const scoreTotal = Math.min(100, Math.round(activityScore + intentScore));
  const contributors = contributorsWithTimestamps
    .map((item) => item.contributor)
    .sort((a, b) => b.contribution - a.contribution || Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const latest = accepted[0]?.event.signal ?? null;

  return {
    score_total: scoreTotal,
    activity_score: activityScore,
    intent_score: Math.min(100, round(intentScore)),
    trend: trendFor(
      contributorsWithTimestamps.map((item) => item.contributor),
      contributorsWithTimestamps.map((item) => item.timestamp),
      nowTimestamp,
    ),
    top_contributors: contributors.slice(0, 5),
    last_meaningful_event: latest,
    computed_at: computedAt,
  };
}

const DIRECT_SIGNAL_TYPES = new Set<string>(Object.keys(ENGAGEMENT_WEIGHTS));

function directSignal(value: string): EngagementSignal | null {
  return DIRECT_SIGNAL_TYPES.has(value) ? value as EngagementSignal : null;
}

export function engagementEventFromMagicScriptEvent(
  event: MagicScriptEvent,
): EngagementEvent | null {
  const sourceType = event.type;
  const mapped =
    directSignal(sourceType) ??
    ({
      'sales_room.accessed': 'SALES_ROOM_VIEWED',
      'sales_room.share_clicked': 'SHARE_CLICKED',
      'sales_room.message_received': 'MESSAGE_SENT',
      'commercial.meeting_requested': 'MEETING_REQUESTED',
      'commercial.meeting_booked': 'MEETING_BOOKED',
      'prototype.viewed': 'PROTOTYPE_VIEWED',
      'demo.opened': 'DEMO_OPENED',
      'contact.clicked': 'CONTACT_CLICKED',
      'sales_room.return_visit': 'RETURN_VISIT',
    } as Record<string, EngagementSignal>)[sourceType] ?? null;

  if (!mapped) return null;
  const payload = event.payload as Record<string, unknown>;
  const idempotencyKey = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : undefined;
  return {
    signal: mapped,
    occurredAt: event.createdAt,
    id: event.id,
    ...(idempotencyKey ? { dedupeKey: `${sourceType}:${idempotencyKey}` } : {}),
    sourceType,
    sourceId: event.id,
  };
}

export function scoreEngagementFromMagicScriptEvents(
  events: readonly MagicScriptEvent[],
  now: string | Date,
): EngagementScoreResult {
  return scoreEngagement(
    events.map(engagementEventFromMagicScriptEvent).filter((event): event is EngagementEvent => Boolean(event)),
    now,
  );
}

export function activityLimitFor(signal: EngagementSignal): { max: number; window: WindowKind } | null {
  return signal in ENGAGEMENT_ACTIVITY_LIMITS
    ? ENGAGEMENT_ACTIVITY_LIMITS[signal as keyof typeof ENGAGEMENT_ACTIVITY_LIMITS]
    : null;
}
