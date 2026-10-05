import { acceptPainFirstSearchCandidate, MAX_RESULTS_PER_QUERY, MAX_HOMEPAGE_FETCHES_PER_QUERY, painFirstQueryPlans } from './pain-first-staging';
import type { PainFirstSearchCandidate } from './pain-first-staging';
import { noticeType } from './digital-pain-evidence';

export interface ManualPainFirstSubmission {
  conditionClass: string;
  urlsText: string;
}

export interface ManualPainFirstRejection {
  conditionClass: string;
  resultPosition: number;
  reason: 'CONDITION_REJECTED' | 'INPUT_LIMIT' | 'URL_REJECTED' | 'DUPLICATE_URL';
}

/** One complete run, with no transport, persistence, replacement, or authority promotion. */
export function intakeManualPainFirstUrls(submissions: readonly ManualPainFirstSubmission[], acquiredAt: string): {
  candidates: PainFirstSearchCandidate[];
  rejections: ManualPainFirstRejection[];
  acceptedCount: number;
  rejectedCount: number;
} {
  const plans = painFirstQueryPlans();
  const candidates: PainFirstSearchCandidate[] = [];
  const rejections: ManualPainFirstRejection[] = [];
  const positions = new Map<string, number>();
  const seen = new Set<string>();
  for (const submission of submissions) {
    const plan = plans.find((item) => item.conditionClass === submission.conditionClass);
    for (const resultUrl of submission.urlsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
      const resultPosition = (positions.get(submission.conditionClass) ?? 0) + 1;
      positions.set(submission.conditionClass, resultPosition);
      const reject = (reason: ManualPainFirstRejection['reason']) => rejections.push({
        conditionClass: submission.conditionClass, resultPosition, reason,
      });
      if (!plan) { reject('CONDITION_REJECTED'); continue; }
      // Rejected and duplicate inputs still consume their submitted position: no fill pressure.
      if (resultPosition > MAX_RESULTS_PER_QUERY) { reject('INPUT_LIMIT'); continue; }
      const candidate: PainFirstSearchCandidate = {
        schemaVersion: 1, queryPlanId: plan.planId, conditionClass: plan.conditionClass,
        providerClass: 'MANUAL_OPERATOR', providerRunId: `manual-operator:${acquiredAt}`,
        resultUrl, resultPosition, acquiredAt, authority: 'NONE',
      };
      // The R55 filter owns public URL validation, normalization, and source classification.
      const accepted = acceptPainFirstSearchCandidate(candidate);
      if (accepted.state !== 'URL_ACCEPTED') { reject('URL_REJECTED'); continue; }
      if (seen.has(accepted.homepageUrl)) { reject('DUPLICATE_URL'); continue; }
      seen.add(accepted.homepageUrl);
      candidates.push({ ...candidate, resultUrl: accepted.homepageUrl });
    }
  }
  return { candidates, rejections, acceptedCount: candidates.length, rejectedCount: rejections.length };
}

export interface PainFirstSearchHint {
  candidate: PainFirstSearchCandidate;
  /** Verbatim title/heading reported by discovery, never accepted page evidence. */
  noticeText: string;
  identityHint?: string;
  localityHint?: string;
}

/** Sourcing only: never replace a deep search URL with its origin. Hints rank
 * inspection priority; all selected candidates still require live qualification. */
export function preselectPainFirstSearchResults(hints: readonly PainFirstSearchHint[],
  excludedHomepageUrls: readonly string[], limit = 5) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new Error('INVALID_PRESELECTION_LIMIT');
  const excluded = new Set(excludedHomepageUrls.flatMap((url) => intakeManualPainFirstUrls([{
    conditionClass: 'SITE_UNDER_CONSTRUCTION', urlsText: url,
  }], '2026-01-01T00:00:00.000Z').candidates.map((candidate) => candidate.resultUrl)));
  const seen = new Set<string>();
  const queryCounts = new Map<string, number>();
  const ranked: { candidate: PainFirstSearchCandidate; priority: number; position: number }[] = [];
  const rejections: { resultUrl: string; reason: string }[] = [];
  hints.forEach((hint, position) => {
    const candidate = hint.candidate;
    const reject = (reason: string) => rejections.push({ resultUrl: candidate.resultUrl, reason });
    const key = JSON.stringify([candidate.providerRunId, candidate.queryPlanId]);
    const count = (queryCounts.get(key) ?? 0) + 1;
    queryCounts.set(key, count);
    if (count > MAX_RESULTS_PER_QUERY) { reject('INPUT_LIMIT'); return; }
    const accepted = acceptPainFirstSearchCandidate(candidate);
    if (accepted.state !== 'URL_ACCEPTED') { reject('URL_REJECTED'); return; }
    if (excluded.has(accepted.homepageUrl)) { reject('ALREADY_EVALUATED'); return; }
    if (seen.has(accepted.homepageUrl)) { reject('DUPLICATE_URL'); return; }
    seen.add(accepted.homepageUrl);
    const expected = candidate.conditionClass === 'SITE_UNDER_CONSTRUCTION' ? 'UNDER_CONSTRUCTION' : 'REBUILDING';
    if (noticeType(hint.noticeText) !== expected) { reject('NO_MATCHING_NOTICE_HINT'); return; }
    ranked.push({ candidate: { ...candidate, resultUrl: accepted.homepageUrl }, position,
      priority: Number(Boolean(hint.identityHint?.trim())) * 2 + Number(Boolean(hint.localityHint?.trim())) });
  });
  ranked.sort((a, b) => b.priority - a.priority || a.position - b.position);
  const candidates: PainFirstSearchCandidate[] = [];
  const selectedPerQuery = new Map<string, number>();
  for (const { candidate } of ranked) {
    const key = JSON.stringify([candidate.providerRunId, candidate.queryPlanId]);
    const count = selectedPerQuery.get(key) ?? 0;
    if (candidates.length >= limit) { rejections.push({ resultUrl: candidate.resultUrl, reason: 'BATCH_LIMIT' }); continue; }
    if (count >= MAX_HOMEPAGE_FETCHES_PER_QUERY) { rejections.push({ resultUrl: candidate.resultUrl, reason: 'QUERY_INSPECTION_LIMIT' }); continue; }
    selectedPerQuery.set(key, count + 1);
    candidates.push(candidate);
  }
  return { authority: 'NONE' as const, candidates, rejections };
}
