export type WebDesignReviewStatus =
  | 'PASS'
  | 'PASS_WITH_NOTES'
  | 'BLOCKED'
  | 'WAITING_EXTERNAL'
  | 'UNKNOWN';

export interface WebDesignReview {
  status: WebDesignReviewStatus;
  owner: string;
  verifier: string;
  checks?: readonly string[];
  blockers?: readonly string[];
  notes?: readonly string[];
  checkedAt?: string;
}

const statuses = new Set<WebDesignReviewStatus>([
  'PASS',
  'PASS_WITH_NOTES',
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

  const owner = typeof value.owner === 'string' ? value.owner.trim() : '';
  const verifier = typeof value.verifier === 'string' ? value.verifier.trim() : '';
  if (!owner || !verifier) return null;

  return {
    status: value.status as WebDesignReviewStatus,
    owner,
    verifier,
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
