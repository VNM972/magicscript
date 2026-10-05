import { classifySourceType } from '../contact-acquisition/agent';
import { publicHttpUrl } from './evidence-integrity';

type PainSource = { url: string; note: string; supports: readonly string[] };
type PainPage = { url: string; html: string; observedAt?: string; snapshotDigest: string };
type ActionFetchResult = { ok: true } | { ok: false; reason: string; redirectCount?: number };

export type DigitalPainType = 'UNDER_CONSTRUCTION' | 'REBUILDING' | 'WEBSITE_VERIFIED_ABSENT' | 'BROKEN_PRIMARY_ACTION';
export interface DigitalPainObservation {
  type: DigitalPainType;
  observation: string;
  sourceUrl: string;
  sourceType: 'OWNED_WEBSITE' | 'VERIFIED_FIRST_PARTY_BUSINESS_PROFILE';
  evidenceType: 'VISIBLE_SITE_NOTICE' | 'FIRST_PARTY_ABSENCE_STATEMENT' | 'PRIMARY_ACTION_FAILURE';
  integrityStatus: 'ACCEPTED';
  inspectionMethod: 'FETCHED_TITLE_H1' | 'FETCHED_FIRST_PARTY_STATEMENT' | 'SAFE_GET_ACTION_INSPECTION';
  observedAt: string;
  snapshotDigest: string;
  finalUrl: string;
  supportingText: string;
  locator: string;
  targetUrl?: string;
  outcome?: 'MALFORMED_TARGET' | 'HTTP_404' | 'HTTP_410' | 'HTTP_5XX_CORROBORATED';
  trace?: readonly { checkedAt: string; targetUrl: string; status: number; redirectCount: number }[];
  identityName?: string;
  identityCity?: string;
  conflictCheck?: 'NO_VERIFIED_OWNED_WEBSITE';
}
export interface DigitalPainEvidence {
  status: 'VERIFIED' | 'UNKNOWN';
  observations: readonly DigitalPainObservation[];
}

const unknown = (): DigitalPainEvidence => ({ status: 'UNKNOWN', observations: [] });
const visibleText = (html: string): string => html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
const validDigest = (value: unknown): value is string =>
  typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
const observedAt = (): string => new Date().toISOString();
const validTime = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString() === value && Date.parse(value) <= Date.now() + 300_000;
const primaryActionLabel = /^(?:contact(?:ez[- ]nous)?|nous contacter|demander un devis|devis|réserver|réservation|book|booking|appeler|call|email|e-mail|postuler|apply|acheter|purchase)$/i;

/** Only explicit site-wide notices already recognized by the canonical siteStatus contract. */
export function noticeType(value: string): DigitalPainType | undefined {
  const text = value.normalize('NFKC').trim().replace(/\s+/g, ' ').replace(/[.!]+$/, '').toLowerCase();
  if (/^(?:notre |ce )?site (?:internet |web )?est en construction$/.test(text) ||
      /^site (?:internet |web )?en construction$/.test(text) ||
      /^(?:our )?website (?:is )?under construction$/.test(text)) return 'UNDER_CONSTRUCTION';
  if (/^(?:notre |ce )?site (?:internet |web )?est en cours de refonte$/.test(text) ||
      /^site (?:internet |web )?en cours de refonte$/.test(text) ||
      /^we are rebuilding (?:our|the) website$/.test(text)) return 'REBUILDING';
  return undefined;
}

/** Product-selected search representatives; noticeType remains the recognition authority. */
export function canonicalNoticePhrase(conditionClass: 'SITE_UNDER_CONSTRUCTION' | 'SITE_REBUILDING'): string {
  return conditionClass === 'SITE_UNDER_CONSTRUCTION' ? 'site en construction' : 'site en cours de refonte';
}

function acceptedOwnedHomepage(source: PainSource): boolean {
  const url = publicHttpUrl(source.url);
  return Boolean(url && (url.pathname === '/' || url.pathname === '/index.html') &&
    source.supports.includes('website') && classifySourceType(source.url, true) === 'OWNED_WEBSITE');
}

/** Pure inspection of pages that the caller already fetched from accepted sources. */
export function extractDigitalPainEvidence(
  acceptedSources: readonly PainSource[],
  pages: readonly PainPage[],
  identity?: { companyName: string; city: string },
  verifiedOwnedWebsite = false,
): DigitalPainEvidence {
  const eligible = new Set(acceptedSources.filter(acceptedOwnedHomepage).map((source) => source.url));
  const profiles = new Set(acceptedSources.filter((source) =>
    source.supports.includes('websiteAbsent') &&
    ['FACEBOOK', 'INSTAGRAM'].includes(classifySourceType(source.url)),
  ).map((source) => source.url));
  const websiteConflict = verifiedOwnedWebsite || eligible.size > 0 ||
    acceptedSources.some((source) => source.supports.includes('website') && classifySourceType(source.url, true) === 'OWNED_WEBSITE');
  const observations: DigitalPainObservation[] = [];
  for (const page of pages) {
    const url = publicHttpUrl(page.url)?.toString();
    if (!url) continue;
    const when = page.observedAt ?? observedAt();
    if (!validTime(when) || !validDigest(page.snapshotDigest)) continue;
    if (profiles.has(url) && !websiteConflict && identity?.companyName && identity.city) {
      const title = visibleText(page.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
      const body = visibleText(page.html);
      const norm = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
      const statement = body.match(/(?:nous n'avons pas de site (?:internet|web)|notre entreprise n'a pas de site (?:internet|web)|we do not have a website)[.!]?/i)?.[0];
      if (norm(title).includes(norm(identity.companyName)) && norm(body).includes(norm(identity.city)) && statement) {
        observations.push({ type: 'WEBSITE_VERIFIED_ABSENT', observation: statement, sourceUrl: url,
          sourceType: 'VERIFIED_FIRST_PARTY_BUSINESS_PROFILE', evidenceType: 'FIRST_PARTY_ABSENCE_STATEMENT',
          integrityStatus: 'ACCEPTED', inspectionMethod: 'FETCHED_FIRST_PARTY_STATEMENT', observedAt: when,
          snapshotDigest: page.snapshotDigest, finalUrl: url, supportingText: statement, locator: 'profile-visible-text',
          identityName: identity.companyName, identityCity: identity.city, conflictCheck: 'NO_VERIFIED_OWNED_WEBSITE' });
      }
    }
    if (!eligible.has(url)) continue;
    // A lone word in page copy, menu, article, or script is not a site-wide notice.
    for (const match of page.html.matchAll(/<(title|h1)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const observation = visibleText(match[2]);
      const type = noticeType(observation);
      if (type && !observations.some((item) => item.type === type && item.sourceUrl === url)) {
        observations.push({ type, observation, sourceUrl: url, sourceType: 'OWNED_WEBSITE', evidenceType: 'VISIBLE_SITE_NOTICE',
          integrityStatus: 'ACCEPTED', inspectionMethod: 'FETCHED_TITLE_H1', observedAt: when,
          snapshotDigest: page.snapshotDigest, finalUrl: url, supportingText: observation, locator: match[1].toLowerCase() });
      }
    }
  }
  // Incompatible notices have no arbitrary precedence.
  return new Set(observations.map((item) => item.type)).size === 1
    ? { status: 'VERIFIED', observations }
    : unknown();
}

/** Inspect only a single explicitly marked primary link. Never submit forms or execute actions. */
export async function inspectBrokenPrimaryAction(
  source: PainSource,
  page: PainPage,
  fetchTarget: (url: string) => Promise<ActionFetchResult>,
  pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 1000)),
): Promise<DigitalPainEvidence> {
  const url = publicHttpUrl(page.url)?.toString();
  if (!url || url !== source.url || !source.supports.includes('website') ||
      classifySourceType(source.url, true) !== 'OWNED_WEBSITE') return unknown();
  if (/<script\b|\bonclick\s*=|\bonmousedown\s*=/i.test(page.html)) return unknown();
  const actions = [...page.html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
    .map((match, index) => ({
      label: visibleText(match[2]),
      href: match[1].match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1],
      marked: /\b(?:class|id|data-primary)\s*=\s*["'][^"']*(?:primary|cta)[^"']*["']/i.test(match[1]),
      locator: 'a[action=' + index + ']',
    })).filter((item) => primaryActionLabel.test(item.label));
  if (actions.length !== 1 || !actions[0].marked || !actions[0].href) return unknown();
  const action = actions[0];
  const href = action.href;
  if (!href || /^(?:mailto:|tel:|javascript:|#)/i.test(href)) return unknown();
  let target: URL | undefined;
  try { target = new URL(href, url); } catch { /* malformed */ }
  const when = page.observedAt ?? observedAt();
  if (!validTime(when) || !validDigest(page.snapshotDigest)) return unknown();
  let outcome: DigitalPainObservation['outcome'];
  let trace: DigitalPainObservation['trace'];
  if (!target || !publicHttpUrl(target.toString())) {
    outcome = 'MALFORMED_TARGET';
  } else {
    const first = await fetchTarget(target.toString());
    if (first.ok || !/^HTTP_STATUS_(404|410|5\d\d)$/.test(first.reason) ||
        first.redirectCount !== 0) return unknown();
    await pause();
    const second = await fetchTarget(target.toString());
    if (second.ok || second.reason !== first.reason || second.redirectCount !== 0) return unknown();
    const status = Number(first.reason.slice('HTTP_STATUS_'.length));
    outcome = status === 404 ? 'HTTP_404' : status === 410 ? 'HTTP_410' : 'HTTP_5XX_CORROBORATED';
    trace = [
      { checkedAt: when, targetUrl: target.toString(), status, redirectCount: 0 },
      { checkedAt: observedAt(), targetUrl: target.toString(), status, redirectCount: 0 },
    ];
  }
  const observation: DigitalPainObservation = {
    type: 'BROKEN_PRIMARY_ACTION', observation: action.label + ': ' + outcome,
    sourceUrl: url, sourceType: 'OWNED_WEBSITE', evidenceType: 'PRIMARY_ACTION_FAILURE',
    integrityStatus: 'ACCEPTED', inspectionMethod: 'SAFE_GET_ACTION_INSPECTION',
    observedAt: when, snapshotDigest: page.snapshotDigest, finalUrl: url,
    supportingText: action.label, locator: action.locator, targetUrl: target?.toString() ?? href,
    outcome, ...(trace ? { trace } : {}),
  };
  return { status: 'VERIFIED', observations: [observation] };
}

/** Revalidate runner observations against the accepted scored source set. */
export function acceptedDigitalPainEvidence(value: unknown, sources: readonly PainSource[], verifiedOwnedWebsite = false): DigitalPainEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unknown();
  const input = value as Record<string, unknown>;
  if (input.status !== 'VERIFIED' || !Array.isArray(input.observations)) return unknown();
  const observations: DigitalPainObservation[] = [];
  for (const raw of input.observations) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return unknown();
    const item = raw as Record<string, unknown>;
    const source = sources.find((candidate) => candidate.url === item.sourceUrl);
    if (!source || item.integrityStatus !== 'ACCEPTED' || !validTime(item.observedAt) ||
        !validDigest(item.snapshotDigest) ||
        item.finalUrl !== item.sourceUrl || typeof item.observation !== 'string' || !item.observation.trim() ||
        typeof item.supportingText !== 'string' || !item.supportingText.trim() || typeof item.locator !== 'string') return unknown();
    if (item.type === 'UNDER_CONSTRUCTION' || item.type === 'REBUILDING') {
      if (!acceptedOwnedHomepage(source) || item.sourceType !== 'OWNED_WEBSITE' || item.evidenceType !== 'VISIBLE_SITE_NOTICE' ||
          item.inspectionMethod !== 'FETCHED_TITLE_H1' || !['title', 'h1'].includes(item.locator) ||
          item.supportingText !== item.observation || noticeType(item.observation) !== item.type) return unknown();
    } else if (item.type === 'WEBSITE_VERIFIED_ABSENT') {
      if (!source.supports.includes('websiteAbsent') || !['FACEBOOK', 'INSTAGRAM'].includes(classifySourceType(source.url)) ||
          verifiedOwnedWebsite || sources.some((candidate) => candidate.supports.includes('website') && classifySourceType(candidate.url, true) === 'OWNED_WEBSITE') ||
          item.sourceType !== 'VERIFIED_FIRST_PARTY_BUSINESS_PROFILE' || item.evidenceType !== 'FIRST_PARTY_ABSENCE_STATEMENT' ||
          item.inspectionMethod !== 'FETCHED_FIRST_PARTY_STATEMENT' || item.conflictCheck !== 'NO_VERIFIED_OWNED_WEBSITE' ||
          typeof item.identityName !== 'string' || !item.identityName.trim() || typeof item.identityCity !== 'string' || !item.identityCity.trim() ||
          item.supportingText !== item.observation || !/(?:n'avons pas de site|n'a pas de site|do not have a website)/i.test(item.observation) ||
          Date.now() - Date.parse(item.observedAt as string) > 30 * 24 * 60 * 60 * 1000) return unknown();
    } else if (item.type === 'BROKEN_PRIMARY_ACTION') {
      if (!source.supports.includes('website') || classifySourceType(source.url, true) !== 'OWNED_WEBSITE' ||
          item.sourceType !== 'OWNED_WEBSITE' || item.evidenceType !== 'PRIMARY_ACTION_FAILURE' ||
          item.inspectionMethod !== 'SAFE_GET_ACTION_INSPECTION' || typeof item.targetUrl !== 'string' ||
          !primaryActionLabel.test(item.supportingText)) return unknown();
      if (item.outcome === 'MALFORMED_TARGET') {
        if (publicHttpUrl(item.targetUrl)) return unknown();
      } else {
        const status = item.outcome === 'HTTP_404' ? 404 : item.outcome === 'HTTP_410' ? 410 : undefined;
        if (!status && item.outcome !== 'HTTP_5XX_CORROBORATED') return unknown();
        const trace = item.trace;
        if (!Array.isArray(trace) || trace.length !== 2 || !trace.every((entry) =>
          entry && typeof entry === 'object' && validTime(entry.checkedAt) &&
          entry.targetUrl === item.targetUrl && entry.redirectCount === 0 &&
          (status ? entry.status === status : Number.isInteger(entry.status) && entry.status >= 500 && entry.status <= 599 && entry.status === trace[0].status))) return unknown();
      }
    } else return unknown();
    observations.push(item as unknown as DigitalPainObservation);
  }
  return observations.length && new Set(observations.map((item) => item.type)).size === 1
    ? { status: 'VERIFIED', observations }
    : unknown();
}
