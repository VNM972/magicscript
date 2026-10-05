import { candidateFromPainFirstAcceptance, MAX_HOMEPAGE_FETCHES_PER_QUERY,
  painFirstTransition, stagePainFirstSuppliedPage } from './pain-first-staging';
import type { AcceptedPainFirstSearchCandidate, PainFirstPageStagingResult,
  SuppliedFirstPartyPageObservation } from './pain-first-staging';
import { createPainFirstBoundHomepageTransport, PainFirstUnsupportedNetwork } from './pain-first-homepage-network';
import type { PainFirstNetworkDependencies } from './pain-first-homepage-network';
import { selectSuppliedIdentityPage, mergeSuppliedIdentityCandidates } from './pain-first-identity-enrichment';
import type { SuppliedIdentityCandidate } from './pain-first-identity-enrichment';
import { extractSuppliedFirstPartyIdentity } from './website-seed';

// R55 permits at most 250,000 supplied HTML characters. This stricter byte cap
// also fits the existing source-fetcher's 512,000-byte convention.
export const PAIN_FIRST_MAX_BODY_BYTES = 250_000;
export const PAIN_FIRST_TIMEOUT_MS = 10_000;
export const PAIN_FIRST_LIVE_TRANSPORT_STATUS = 'SAFE_BINDING_IMPLEMENTED';
const consumedAcceptances = new WeakSet<AcceptedPainFirstSearchCandidate>();

/** Offline dependency only. Must return fixture responses, never resolve or fetch
 * prospect hosts. No global fetch fallback exists. */
export type PainFirstFixtureTransport = (url: string, init: RequestInit) => Promise<Response>;
export interface PainFirstHomepageInspection {
  pageState: 'PAGE_OBSERVED' | 'FETCH_FAILED';
  observation: SuppliedFirstPartyPageObservation;
  staging: PainFirstPageStagingResult;
}

/** Same small tag/text inspection convention as R42, with inert blocks removed.
 * Never truncate title/H1 into positive evidence; unsupported bounds fail closed. */
function titleAndH1(html: string): { boundedTitle?: string; boundedH1: string[] } | null {
  const inert = /<!--[^]*?(?:-->|$)|<(script|style|iframe|object|template|noscript|svg|math)\b[^>]*>[^]*?<\/\1\s*>/gi;
  const inspectable = html.replace(inert, ' ');
  if (/<(?:script|style|iframe|object|template|noscript|svg|math)\b/i.test(inspectable)) return null;
  const text = (value: string) => value.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) => {
      const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : '\uFFFD';
    }).replace(/\s+/g, ' ').trim();
  const titles = [...inspectable.matchAll(/<title\b[^>]*>([^]*?)<\/title\s*>/gi)];
  const headings = [...inspectable.matchAll(/<h1\b[^>]*>([^]*?)<\/h1\s*>/gi)];
  // Missing tags are allowed; malformed/unclosed tags are not extracted.
  if (titles.length > 1 || headings.length > 4 ||
      (inspectable.match(/<title\b/gi)?.length ?? 0) !== titles.length ||
      (inspectable.match(/<h1\b/gi)?.length ?? 0) !== headings.length) return null;
  const boundedTitle = titles.length ? text(titles[0][1]) : undefined;
  const boundedH1 = headings.map((match) => text(match[1]));
  if ((boundedTitle?.length ?? 0) > 512 || boundedH1.some((value) => value.length > 512)) return null;
  return { boundedTitle, boundedH1 };
}

async function boundedHtml(response: Response, signal: AbortSignal): Promise<string | null> {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > PAIN_FIRST_MAX_BODY_BYTES)) {
    void response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const abortRead = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', abortRead, { once: true });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let html = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > PAIN_FIRST_MAX_BODY_BYTES) { void reader.cancel().catch(() => undefined); return null; }
      try { html += decoder.decode(value, { stream: true }); }
      catch { void reader.cancel().catch(() => undefined); return null; }
    }
    if (signal.aborted) return null;
    try { html += decoder.decode(); } catch { return null; }
    // Binary bytes or damaged text never reach HTML extraction or R42.
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(html) ? null : html;
  } finally { signal.removeEventListener('abort', abortRead); reader.releaseLock(); }
}

async function observeSinglePage(requestedUrl: string, fixtureTransport: PainFirstFixtureTransport,
  timeoutMs: number): Promise<SuppliedFirstPartyPageObservation> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let activeResponse: Response | undefined;
    const base = { schemaVersion: 1 as const, requestedUrl: requestedUrl,
      inspectedAt: new Date().toISOString() };
    const failed = (httpResultClass: SuppliedFirstPartyPageObservation['httpResultClass']) =>
      ({ ...base, httpResultClass });
    const observe = async (): Promise<SuppliedFirstPartyPageObservation> => {
      const response = await fixtureTransport(requestedUrl, {
        method: 'GET', redirect: 'manual', credentials: 'omit', signal: controller.signal,
        headers: { 'User-Agent': 'MagicScript/1.0 (research evidence; +https://magicscript.fr)', Accept: 'text/html' },
      });
      activeResponse = response;
      if (controller.signal.aborted) { void response.body?.cancel().catch(() => undefined); return failed('TIMEOUT'); }
      const status = response.status;
      const httpResultClass = status >= 300 && status < 400 ? 'REDIRECT' :
        status >= 400 && status < 500 ? 'CLIENT_ERROR' : status >= 500 && status < 600 ? 'SERVER_ERROR' :
          status >= 200 && status < 300 ? 'SUCCESS' : 'UNSUPPORTED';
      if (httpResultClass !== 'SUCCESS') {
        void response.body?.cancel().catch(() => undefined);
        return failed(httpResultClass);
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.split(';')[0].trim().toLowerCase() !== 'text/html' ||
          /charset\s*=\s*["']?(?!utf-8\b|us-ascii\b)[\w-]+/i.test(contentType) ||
          response.headers.has('content-disposition') || response.redirected ||
          (response.url && response.url !== requestedUrl)) {
        void response.body?.cancel().catch(() => undefined);
        return failed('UNSUPPORTED');
      }
      const html = await boundedHtml(response, controller.signal);
      if (html === null) return failed('UNSUPPORTED');
      const extracted = titleAndH1(html);
      if (!extracted) return failed('UNSUPPORTED');
      return { ...base, httpResultClass: 'SUCCESS', contentType, ...extracted, suppliedHtml: html };
    };
    const deadline = new Promise<SuppliedFirstPartyPageObservation>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        // Cancel a pending reader as well as aborting the injected transport.
        void activeResponse?.body?.cancel().catch(() => undefined);
        resolve(failed('TIMEOUT'));
      }, timeoutMs);
    });
    let observation: SuppliedFirstPartyPageObservation;
    try {
      observation = await Promise.race([observe(), deadline]);
    } catch (error) {
      observation = failed(error instanceof PainFirstUnsupportedNetwork ? 'UNSUPPORTED' : controller.signal.aborted ||
        (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) ? 'TIMEOUT' : 'NETWORK_ERROR');
    } finally { clearTimeout(timer!); }
    return observation;
}

/** Explicit one-candidate inspection; budgets live only for this session.
 * Re-accepting a candidate cannot reset its consumed request budget. */
export function createPainFirstOfflineHomepageInspector(fixtureTransport: PainFirstFixtureTransport,
  options?: { timeoutMs?: number }): (accepted: AcceptedPainFirstSearchCandidate) => Promise<PainFirstHomepageInspection> {
  if (typeof fixtureTransport !== 'function') throw new Error('OFFLINE_TRANSPORT_REQUIRED');
  const consumed = new Set<string>();
  const queryCounts = new Map<string, number>();
  const timeoutMs = options?.timeoutMs ?? PAIN_FIRST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > PAIN_FIRST_TIMEOUT_MS)
    throw new Error('INVALID_TIMEOUT');
  return async (accepted) => {
    const candidate = candidateFromPainFirstAcceptance(accepted);
    if (!candidate) throw new Error('VALIDATED_CANDIDATE_REQUIRED');
    const queryKey = JSON.stringify([candidate.providerRunId, candidate.queryPlanId]);
    const candidateKey = JSON.stringify([candidate.providerRunId, accepted.homepageUrl]);
    if (consumedAcceptances.has(accepted) || consumed.has(candidateKey))
      throw new Error('CANDIDATE_REQUEST_BUDGET_EXHAUSTED');
    if ((queryCounts.get(queryKey) ?? 0) >= MAX_HOMEPAGE_FETCHES_PER_QUERY)
      throw new Error('QUERY_REQUEST_BUDGET_EXHAUSTED');
    consumed.add(candidateKey);
    consumedAcceptances.add(accepted);
    queryCounts.set(queryKey, (queryCounts.get(queryKey) ?? 0) + 1);
    const observation = await observeSinglePage(accepted.homepageUrl, fixtureTransport, timeoutMs);
    const pageState = painFirstTransition('URL_ACCEPTED',
      observation.httpResultClass === 'SUCCESS' ? 'PAGE_OBSERVED' : 'FETCH_FAILED') as 'PAGE_OBSERVED' | 'FETCH_FAILED';
    const staging = stagePainFirstSuppliedPage(candidate, observation, { stopAfterPainSignal: true });
    return { pageState, observation, staging };
  };
}

/** Explicit live opt-in, sharing the R58Z budgets, bounded HTML reader and R42
 * adapter. Construction performs no network work; only an accepted inspection does. */
export function createPainFirstLiveHomepageInspector(options?: PainFirstNetworkDependencies & { timeoutMs?: number }) {
  return createPainFirstOfflineHomepageInspector(createPainFirstBoundHomepageTransport(options), options);
}

export interface PainFirstIdentityEnrichment {
  outcome: 'NOT_NEEDED' | 'NO_ELIGIBLE_LINK' | 'AMBIGUOUS_LINK' | 'FETCH_FAILED' | 'SUCCESS';
  identityPage?: string;
  identityPageTransportClass?: SuppliedFirstPartyPageObservation['httpResultClass'];
  finalIdentity: SuppliedIdentityCandidate;
}
const consumedEnrichments = new WeakSet<AcceptedPainFirstSearchCandidate>();

/** Exactly one additional GET from an explicit supplied link after confirmed
 * pain. No second staging call: this page can only add candidate identity facts. */
export function createPainFirstOfflineIdentityEnricher(fixtureTransport: PainFirstFixtureTransport,
  options?: { timeoutMs?: number }) {
  if (typeof fixtureTransport !== 'function') throw new Error('OFFLINE_TRANSPORT_REQUIRED');
  const timeoutMs = options?.timeoutMs ?? PAIN_FIRST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > PAIN_FIRST_TIMEOUT_MS)
    throw new Error('INVALID_TIMEOUT');
  return async (accepted: AcceptedPainFirstSearchCandidate, inspection: PainFirstHomepageInspection,
    initial: SuppliedIdentityCandidate): Promise<PainFirstIdentityEnrichment> => {
    if (!candidateFromPainFirstAcceptance(accepted)) throw new Error('VALIDATED_CANDIDATE_REQUIRED');
    const { observation, staging } = inspection;
    if (observation.httpResultClass !== 'SUCCESS' || staging.state !== 'PAIN_SIGNAL_CONFIRMED' ||
        observation.requestedUrl !== accepted.homepageUrl ||
        (initial.state !== 'IDENTITY_PARTIAL' && initial.state !== 'IDENTITY_ABSENT'))
      return { outcome: 'NOT_NEEDED', finalIdentity: initial };
    if (!observation.suppliedHtml) return { outcome: 'NO_ELIGIBLE_LINK', finalIdentity: initial };
    const selected = selectSuppliedIdentityPage(accepted.homepageUrl, observation.suppliedHtml);
    if (selected.state !== 'SELECTED') return { outcome: selected.state, finalIdentity: initial };
    if (consumedEnrichments.has(accepted)) throw new Error('IDENTITY_REQUEST_BUDGET_EXHAUSTED');
    consumedEnrichments.add(accepted);
    // Pathname only; query parameters and internal transport details never reach UI.
    const identityPage = new URL(selected.url).pathname.slice(0, 512);
    const page = await observeSinglePage(selected.url, fixtureTransport, timeoutMs);
    const identityPageTransportClass = page.httpResultClass;
    if (page.httpResultClass !== 'SUCCESS') return { outcome: 'FETCH_FAILED', identityPage, identityPageTransportClass, finalIdentity: initial };
    const extracted = extractSuppliedFirstPartyIdentity(page.suppliedHtml ?? '');
    return { outcome: 'SUCCESS', identityPage, identityPageTransportClass,
      finalIdentity: mergeSuppliedIdentityCandidates(initial, extracted) };
  };
}

export function createPainFirstLiveIdentityEnricher(options?: PainFirstNetworkDependencies & { timeoutMs?: number }) {
  return createPainFirstOfflineIdentityEnricher(createPainFirstBoundHomepageTransport(options), options);
}
