export type WatchDeltaStatus = 'CHANGE' | 'NO_CHANGE' | 'UNKNOWN';
export type WatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface WatchSource {
  url?: string;
  checkedAt: string;
  confidence: WatchConfidence;
}

export interface BuWatchDelta {
  id: string;
  businessUnit: string;
  specialty: string;
  status: WatchDeltaStatus;
  changedWhat: string;
  source: WatchSource | null;
  whyItMatters: string;
  businessUnitImpact: string;
  affectedArtifact: string;
  recommendation: string;
  confidence: WatchConfidence;
}

export interface WatchValidation {
  accepted: boolean;
  reasons: readonly string[];
}

const STATUSES: readonly WatchDeltaStatus[] = ['CHANGE', 'NO_CHANGE', 'UNKNOWN'];
const CONFIDENCES: readonly WatchConfidence[] = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates a compact BU knowledge delta. UNKNOWN is valid, but it can never
 * be represented as a confirmed change or a confirmed absence of change.
 */
export function validateBuWatchDelta(delta: Partial<BuWatchDelta>): WatchValidation {
  const reasons: string[] = [];
  if (!hasText(delta.id)) reasons.push('watch delta id is required');
  if (!hasText(delta.businessUnit)) reasons.push('business unit is required');
  if (!hasText(delta.specialty)) reasons.push('specialty is required');
  if (!STATUSES.includes(delta.status as WatchDeltaStatus)) reasons.push('watch delta status is invalid');
  if (!hasText(delta.changedWhat)) reasons.push('changedWhat is required');
  if (!hasText(delta.whyItMatters)) reasons.push('whyItMatters is required');
  if (!hasText(delta.businessUnitImpact)) reasons.push('business unit impact is required');
  if (!hasText(delta.affectedArtifact)) reasons.push('affected artifact is required');
  if (!hasText(delta.recommendation)) reasons.push('recommendation is required');
  if (!CONFIDENCES.includes(delta.confidence as WatchConfidence)) reasons.push('confidence must be explicit');

  if (delta.source === null || delta.source === undefined) {
    if (delta.status !== 'UNKNOWN') reasons.push('source is required for a confirmed change or no-change result');
  } else {
    if (!hasText(delta.source.checkedAt)) reasons.push('source checkedAt is required');
    if (!CONFIDENCES.includes(delta.source.confidence)) reasons.push('source confidence is invalid');
    if (delta.source.url !== undefined && (!hasText(delta.source.url) || !isHttpUrl(delta.source.url))) {
      reasons.push('source URL must be HTTP or HTTPS');
    }
    if (delta.status !== 'UNKNOWN' && !hasText(delta.source.url)) reasons.push('source URL is required for a confirmed result');
  }
  if (delta.status !== 'UNKNOWN' && delta.confidence === 'UNKNOWN') {
    reasons.push('confirmed result cannot have UNKNOWN confidence');
  }

  return { accepted: reasons.length === 0, reasons };
}

export function normalizeBuWatchDelta(delta: BuWatchDelta): BuWatchDelta {
  const validation = validateBuWatchDelta(delta);
  if (!validation.accepted) throw new Error(`Invalid BU watch delta: ${validation.reasons.join('; ')}`);

  return {
    ...delta,
    id: delta.id.trim(),
    businessUnit: delta.businessUnit.trim(),
    specialty: delta.specialty.trim(),
    changedWhat: delta.changedWhat.trim(),
    whyItMatters: delta.whyItMatters.trim(),
    businessUnitImpact: delta.businessUnitImpact.trim(),
    affectedArtifact: delta.affectedArtifact.trim(),
    recommendation: delta.recommendation.trim(),
    ...(delta.source === null ? { source: null } : {
      source: {
        ...delta.source,
        ...(delta.source.url ? { url: delta.source.url.trim() } : {}),
        checkedAt: delta.source.checkedAt.trim(),
      },
    }),
  };
}
