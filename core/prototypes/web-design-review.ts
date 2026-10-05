export type WebDesignReviewStatus =
  | 'PASS'
  | 'PASS_WITH_NOTES'
  | 'REWORK'
  | 'BLOCKED'
  | 'WAITING_EXTERNAL'
  | 'UNKNOWN';

export type WebDesignReviewType =
  | 'DETERMINISTIC_COMPLIANCE'
  | 'CREATIVE_VISUAL'
  | 'COMBINED';

export interface WebDesignFinding {
  category: string;
  severity: 'INFO' | 'WARNING' | 'BLOCKING';
  description: string;
  evidence?: string;
  suggestedAction?: string;
}

export interface WebDesignReview {
  status: WebDesignReviewStatus;
  owner: string;
  verifier: string;
  reviewType?: WebDesignReviewType;
  findings?: readonly WebDesignFinding[];
  reworkRequired?: boolean;
  reworkSummary?: string;
  filesChanged?: readonly string[];
  checks?: readonly string[];
  blockers?: readonly string[];
  notes?: readonly string[];
  checkedAt?: string;
}

const statuses = new Set<WebDesignReviewStatus>([
  'PASS',
  'PASS_WITH_NOTES',
  'REWORK',
  'BLOCKED',
  'WAITING_EXTERNAL',
  'UNKNOWN',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function parseWebDesignReview(value: unknown): WebDesignReview | null {
  if (!isRecord(value) || typeof value.status !== 'string' || !statuses.has(value.status as WebDesignReviewStatus)) {
    return null;
  }

  const reviewType = value.reviewType === 'DETERMINISTIC_COMPLIANCE' || value.reviewType === 'CREATIVE_VISUAL' || value.reviewType === 'COMBINED'
    ? value.reviewType
    : undefined;
  const findings = Array.isArray(value.findings)
    ? value.findings.flatMap((item) => {
        if (!isRecord(item) || typeof item.category !== 'string' || typeof item.description !== 'string') return [];
        const severity: WebDesignFinding['severity'] = item.severity === 'INFO' || item.severity === 'WARNING' || item.severity === 'BLOCKING' ? item.severity : 'WARNING';
        return [{ category: item.category, severity, description: item.description, ...(typeof item.evidence === 'string' ? { evidence: item.evidence } : {}), ...(typeof item.suggestedAction === 'string' ? { suggestedAction: item.suggestedAction } : {}) }];
      })
    : undefined;

  const owner = typeof value.owner === 'string' ? value.owner.trim() : '';
  const verifier = typeof value.verifier === 'string' ? value.verifier.trim() : '';
  if (!owner || !verifier) return null;

  return {
    status: value.status as WebDesignReviewStatus,
    owner,
    verifier,
    ...(reviewType ? { reviewType } : {}),
    ...(findings ? { findings } : {}),
    ...(typeof value.reworkRequired === 'boolean' ? { reworkRequired: value.reworkRequired } : {}),
    ...(typeof value.reworkSummary === 'string' ? { reworkSummary: value.reworkSummary } : {}),
    ...(stringArray(value.filesChanged) ? { filesChanged: stringArray(value.filesChanged) } : {}),
    ...(stringArray(value.checks) ? { checks: stringArray(value.checks) } : {}),
    ...(stringArray(value.blockers) ? { blockers: stringArray(value.blockers) } : {}),
    ...(stringArray(value.notes) ? { notes: stringArray(value.notes) } : {}),
    ...(typeof value.checkedAt === 'string' ? { checkedAt: value.checkedAt } : {}),
  };
}

export function webDesignReviewFromQaFindings(value: unknown): WebDesignReview | null {
  if (typeof value === 'string') {
    try {
      return webDesignReviewFromQaFindings(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!isRecord(value)) return null;
  return parseWebDesignReview(value.webDesignReview);
}

export function webDesignReviewStatus(value: unknown): WebDesignReviewStatus {
  return webDesignReviewFromQaFindings(value)?.status ?? 'UNKNOWN';
}

export function canPromoteWithWebDesignReview(value: unknown): boolean {
  const review = webDesignReviewFromQaFindings(value);
  if (!review || (review.status !== 'PASS' && review.status !== 'PASS_WITH_NOTES')) return false;
  return (review.blockers?.length ?? 0) === 0;
}

export function webDesignReviewBlockReason(value: unknown): string {
  const review = webDesignReviewFromQaFindings(value);
  if (!review) return 'Web Design review is missing or malformed';
  if (review.blockers?.length) return 'Web Design review has blocking findings';
  if (review.status === 'UNKNOWN') return 'Web Design review status is UNKNOWN';
  if (review.status === 'WAITING_EXTERNAL') return 'Web Design review is WAITING_EXTERNAL';
  if (review.status === 'BLOCKED') return 'Web Design review is BLOCKED';
  return 'Web Design review did not pass';
}
