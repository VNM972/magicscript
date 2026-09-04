export type SalesRoomStatus = 'ACTIVE' | 'DISABLED';

export type SalesRoomEventType =
  | 'sales_room.created'
  | 'sales_room.accessed'
  | 'sales_room.share_clicked'
  | 'sales_room.disabled'
  | 'sales_room.enabled'
  | 'sales_room.message_received'
  | 'sales_room.resolution_failed';

export interface SalesRoomEventRecord {
  type: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export interface SalesRoomState {
  status: SalesRoomStatus;
  createdAt: string;
  lastActivityAt: string;
  reviewDueAt: string | null;
  reviewDue: boolean;
  shareClicks: number;
  lastResolutionError: string | null;
}

export const DEFAULT_SALES_ROOM_REVIEW_DAYS = 30;

function stableShortId(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, '0').slice(0, 7);
}

export function normalizeCompanySlug(companyName: string): string {
  const normalized = companyName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' et ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return normalized || 'prospect';
}

export function buildSalesRoomSlug(
  companyName: string,
  prospectId: string,
  allCompanyNames: readonly string[] = [],
): string {
  const base = normalizeCompanySlug(companyName);
  const collisions = allCompanyNames.filter(
    (candidate) => normalizeCompanySlug(candidate) === base,
  ).length;

  return collisions > 1 ? `${base}-${stableShortId(prospectId)}` : base;
}

export function buildSalesRoomEventPayload(input: {
  slug: string;
  channel?: string;
  sessionId?: string;
  reason?: string;
}): Record<string, unknown> {
  return {
    surface: 'PROSPECT_SALES_ROOM',
    slug: normalizeCompanySlug(input.slug),
    ...(input.channel?.trim() ? { channel: input.channel.trim() } : {}),
    ...(input.sessionId?.trim() ? { sessionId: input.sessionId.trim() } : {}),
    ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
  };
}

function latestEvent(
  events: readonly SalesRoomEventRecord[],
  types: readonly string[],
): SalesRoomEventRecord | undefined {
  return events
    .filter((event) => types.includes(event.type))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1);
}

function maxTimestamp(values: readonly string[]): string {
  return values
    .filter((value) => Number.isFinite(new Date(value).getTime()))
    .sort((left, right) => left.localeCompare(right))
    .at(-1) ?? values[0];
}

export function deriveSalesRoomState(input: {
  createdAt: string;
  events?: readonly SalesRoomEventRecord[];
  now?: string;
  reviewAfterDays?: number;
}): SalesRoomState {
  const events = input.events ?? [];
  const disabled = latestEvent(events, ['sales_room.disabled']);
  const enabled = latestEvent(events, ['sales_room.enabled']);
  const status: SalesRoomStatus =
    disabled && (!enabled || disabled.createdAt > enabled.createdAt)
      ? 'DISABLED'
      : 'ACTIVE';
  const lastActivityAt = maxTimestamp([
    input.createdAt,
    ...events.map((event) => event.createdAt),
  ]);
  const reviewDays = Number.isFinite(input.reviewAfterDays)
    ? Math.max(1, Number(input.reviewAfterDays))
    : DEFAULT_SALES_ROOM_REVIEW_DAYS;
  const reviewDueAt =
    status === 'ACTIVE'
      ? new Date(new Date(lastActivityAt).getTime() + reviewDays * 86_400_000).toISOString()
      : null;
  const now = new Date(input.now ?? new Date().toISOString()).getTime();
  const lastResolutionFailure = latestEvent(events, ['sales_room.resolution_failed']);
  const reason = lastResolutionFailure?.payload?.reason;

  return {
    status,
    createdAt: input.createdAt,
    lastActivityAt,
    reviewDueAt,
    reviewDue: Boolean(reviewDueAt && now >= new Date(reviewDueAt).getTime()),
    shareClicks: events.filter((event) => event.type === 'sales_room.share_clicked').length,
    lastResolutionError: typeof reason === 'string' ? reason : null,
  };
}
