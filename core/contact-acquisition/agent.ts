import { publicHttpUrl } from '../research/evidence-integrity';

export type SearchProviderStatus = 'SEARCH_PROVIDER_AVAILABLE' | 'SEARCH_PROVIDER_UNAVAILABLE' | 'SEARCH_PROVIDER_FAILED';
export type IdentityStatus = 'IDENTITY_VERIFIED' | 'IDENTITY_PROBABLE' | 'IDENTITY_AMBIGUOUS' | 'IDENTITY_REJECTED';
export type SourceType = 'OWNED_WEBSITE' | 'CONTACT_PAGE' | 'LEGAL_PAGE' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'WHATSAPP' | 'BOOKING_PLATFORM' | 'MENU_ORDER_PLATFORM' | 'VERTICAL_PLATFORM' | 'BUSINESS_DIRECTORY' | 'REGISTRY' | 'SEARCH_PROVIDER' | 'SEARCH_ENGINE' | 'OTHER_PUBLIC_SOURCE';

export interface ContactAcquisitionIdentity { companyName: string; legalName?: string; siren?: string; siret?: string; address?: string; postcode?: string; city?: string; activity?: string; websiteUrl?: string; }
export interface ContactAcquisitionQuery { query: string; purpose: 'phone' | 'contact' | 'instagram' | 'facebook' | 'activity' | 'identity' | 'website'; }
export interface ContactAcquisitionCandidate { url: string; sourceType: SourceType; queryOrigin: string; identityStatus: IdentityStatus; identityEvidence: string[]; fetchStatus: 'NOT_FETCHED' | 'FETCHED' | 'FETCH_FAILED'; }
export interface ContactAcquisitionResult { schemaVersion: 'contact-acquisition.v1'; prospectId?: string; startedAt: string; completedAt: string; status: SearchProviderStatus; queries: ContactAcquisitionQuery[]; sources: ContactAcquisitionCandidate[]; sourceCounts: Record<string, number>; ownedPathManifest?: OwnedPathManifestEntry[]; blocker: { code: string; detail: string } | null; }

export const OWNED_SITE_PATHS = ['/contact', '/contactez-nous', '/nous-contacter', '/mentions-legales', '/mentions-légales', '/legal', '/about', '/a-propos'];
export type OwnedPathLifecycle = 'GENERATED' | 'SELECTED' | 'FETCH_ATTEMPTED' | 'FETCH_SUCCEEDED' | 'FETCH_FAILED' | 'SKIPPED';
export interface OwnedPathManifestEntry { path:string; pathOrigin:'HOMEPAGE'|'GENERATED_CONTACT_PATH'|'GENERATED_LEGAL_PATH'|'DISCOVERED_LINK'; normalizedUrl:string; generatedAt:string; lifecycle:OwnedPathLifecycle; failureReason?:string; httpStatus?:number; contentType?:string; responseBytes?:number; redirectCount?:number; }
export function generatedOwnedPathManifest(websiteUrl:string, generatedAt:string): OwnedPathManifestEntry[] { const base=normalizeCandidateUrl(websiteUrl); if(!base)return []; return [{path:'/',pathOrigin:'HOMEPAGE',normalizedUrl:base,generatedAt,lifecycle:'GENERATED'},...OWNED_SITE_PATHS.map(path=>({path,pathOrigin:/mentions|legal/.test(path)?'GENERATED_LEGAL_PATH' as const:'GENERATED_CONTACT_PATH' as const,normalizedUrl:new URL(path,base).toString(),generatedAt,lifecycle:'GENERATED' as const}))]; }
export function sameOriginContactLinks(homepageUrl:string,html:string,generatedAt:string):OwnedPathManifestEntry[] { const base=normalizeCandidateUrl(homepageUrl); if(!base)return []; const origin=new URL(base).origin; const out:OwnedPathManifestEntry[]=[]; for(const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)){try{const u=new URL(m[1],base);const path=u.pathname.toLowerCase();if(u.origin===origin&&/(contact|contacter|mentions|legal|about|a-propos|à-propos)/i.test(path)){const normalized=u.toString();if(!out.some(x=>x.normalizedUrl===normalized))out.push({path:u.pathname,pathOrigin:/mentions|legal/.test(path)?'GENERATED_LEGAL_PATH':'DISCOVERED_LINK',normalizedUrl:normalized,generatedAt,lifecycle:'GENERATED'});}}catch{}} return out.slice(0,5); }
export function ownedSiteExplorationUrls(websiteUrl: string): string[] {
  const base = normalizeCandidateUrl(websiteUrl); if (!base) return [];
  return OWNED_SITE_PATHS.map((path) => new URL(path, base).toString()).slice(0, OWNED_SITE_PATHS.length);
}

const clean = (value?: string) => value?.trim().replace(/\s+/g, ' ') || '';
const quote = (value: string) => `"${clean(value)}"`;

export function buildContactAcquisitionQueryPlan(identity: ContactAcquisitionIdentity): ContactAcquisitionQuery[] {
  const name = clean(identity.companyName), city = clean(identity.city), activity = clean(identity.activity), legal = clean(identity.legalName);
  const base = [[`${quote(name)} ${quote(city)} téléphone`, 'phone'], [`${quote(name)} ${quote(city)} contact`, 'contact'], [`${quote(name)} ${quote(city)} Instagram`, 'instagram'], [`${quote(name)} ${quote(city)} Facebook`, 'facebook'], [`${quote(name)} ${quote(activity)} ${quote(city)}`, 'activity'], [`${quote(legal || name)} ${quote(city)}`, 'identity'], [`${quote(name)} site officiel`, 'website']] as const;
  const out = base.filter(([query]) => query.replace(/[" ]/g, '').length > 0).map(([query, purpose]) => ({ query, purpose } as ContactAcquisitionQuery));
  if (identity.siren) out.push({ query: `${quote(name)} ${quote(identity.siren)} contact`, purpose: 'identity' });
  if (identity.siret) out.push({ query: `${quote(name)} ${quote(identity.siret)} téléphone`, purpose: 'phone' });
  return out.slice(0, 10);
}

export function normalizeCandidateUrl(value: unknown): string | null { return publicHttpUrl(value)?.toString() ?? null; }
export function classifySourceType(url: string, verifiedWebsite = false): SourceType {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  // Repository authority: TavilySearchProvider.search and the R31 Google search capture.
  if (host === 'api.tavily.com') return 'SEARCH_PROVIDER';
  if (host === 'www.google.com') return 'SEARCH_ENGINE';
  if (host.includes('instagram.')) return 'INSTAGRAM'; if (host.includes('facebook.')) return 'FACEBOOK'; if (host.includes('tiktok.')) return 'TIKTOK'; if (host.includes('wa.me') || host.includes('whatsapp.')) return 'WHATSAPP';
  if (host.includes('annuaire-entreprises') || host.includes('recherche-entreprises')) return 'REGISTRY';
  if (/(^|\.)(pagesjaunes\.fr|yelp\.[a-z.]+|tripadvisor\.[a-z.]+|pappers\.fr|societe\.com|hoodspot\.fr|118000\.fr|kompass\.com)$/.test(host)) return 'BUSINESS_DIRECTORY';
  if (/(^|\.)(booking\.com|airbnb\.[a-z.]+)$/.test(host)) return 'BOOKING_PLATFORM';
  if (/contact|contactez|nous-contacter/.test(parsed.pathname.toLowerCase())) return 'CONTACT_PAGE';
  if (/mentions|legal/.test(parsed.pathname.toLowerCase())) return 'LEGAL_PAGE';
  if (verifiedWebsite && parsed.pathname === '/' && publicHttpUrl(url)) return 'OWNED_WEBSITE';
  return 'OTHER_PUBLIC_SOURCE';
}
export function dedupeCandidates(candidates: ContactAcquisitionCandidate[]): ContactAcquisitionCandidate[] {
  const seen = new Set<string>(); return candidates.filter((candidate) => { const normalized = normalizeCandidateUrl(candidate.url); if (!normalized || seen.has(normalized)) return false; seen.add(normalized); candidate.url = normalized; return true; }).slice(0, 30);
}

export function bindCandidateIdentity(identity: ContactAcquisitionIdentity, candidate: { url: string; text?: string; sourceType?: SourceType }): IdentityStatus {
  const text = `${candidate.text ?? ''} ${candidate.url}`.toLocaleLowerCase(); const name = clean(identity.companyName).toLocaleLowerCase(); const legal = clean(identity.legalName).toLocaleLowerCase();
  const domain = identity.websiteUrl ? new URL(identity.websiteUrl).hostname.replace(/^www\./, '').toLocaleLowerCase() : '';
  if (domain && candidate.url.toLocaleLowerCase().includes(domain)) return 'IDENTITY_VERIFIED';
  const city = clean(identity.city).toLocaleLowerCase();
  const hasDifferentCity = Boolean(city && /\b(paris|lyon|marseille|bordeaux|toulouse|nantes)\b/i.test(text) && !text.includes(city));
  if (hasDifferentCity) return 'IDENTITY_REJECTED';
  if (name && text.includes(name) && (!city || text.includes(city))) return 'IDENTITY_VERIFIED';
  if (legal && text.includes(legal) && (!city || text.includes(city))) return 'IDENTITY_VERIFIED';
  if (identity.city && text.includes(identity.city.toLocaleLowerCase())) return 'IDENTITY_PROBABLE';
  return 'IDENTITY_AMBIGUOUS';
}

export interface SearchProvider { search(query: string, limit: number): Promise<Array<{ url: string; title?: string; snippet?: string }>>; }
export type CandidateFetcher = (url: string) => Promise<{ ok: boolean; text?: string }>;

export async function fetchAndVerifyCandidates(identity: ContactAcquisitionIdentity, candidates: ContactAcquisitionCandidate[], fetchPage: CandidateFetcher): Promise<ContactAcquisitionCandidate[]> {
  const expanded = [...candidates];
  const owned = candidates.filter((candidate) => candidate.sourceType === 'OWNED_WEBSITE' && candidate.identityStatus === 'IDENTITY_VERIFIED');
  for (const candidate of owned) {
    try {
      const homepage = await fetchPage(candidate.url);
      if (homepage.ok) for (const link of sameOriginContactLinks(candidate.url, homepage.text ?? '', new Date().toISOString())) {
        if (!expanded.some((item) => item.url === link.normalizedUrl)) expanded.push({ url: link.normalizedUrl, sourceType: classifySourceType(link.normalizedUrl), queryOrigin: 'owned-site-discovered-link', identityStatus: 'IDENTITY_VERIFIED', identityEvidence: ['same-origin bounded contact/legal link'], fetchStatus: 'NOT_FETCHED' });
      }
    } catch { /* traversal discovery is bounded and fail-closed */ }
    for (const url of ownedSiteExplorationUrls(candidate.url)) {
      if (!expanded.some((item) => item.url === url)) expanded.push({ url, sourceType: classifySourceType(url), queryOrigin: 'owned-site-exploration', identityStatus: 'IDENTITY_VERIFIED', identityEvidence: ['same-origin bounded fallback path'], fetchStatus: 'NOT_FETCHED' });
    }
  }
  const bounded = dedupeCandidates(expanded).sort((a, b) => (a.queryOrigin === 'owned-site-discovered-link' ? -1 : 0) - (b.queryOrigin === 'owned-site-discovered-link' ? -1 : 0)).slice(0, 30);
  for (const candidate of bounded) {
    try {
      const fetched = await fetchPage(candidate.url);
      candidate.fetchStatus = fetched.ok ? 'FETCHED' : 'FETCH_FAILED';
      if (fetched.ok && candidate.identityStatus !== 'IDENTITY_VERIFIED') candidate.identityStatus = bindCandidateIdentity(identity, { url: candidate.url, text: fetched.text });
    } catch { candidate.fetchStatus = 'FETCH_FAILED'; }
  }
  return bounded;
}

export async function acquireContactSources(identity: ContactAcquisitionIdentity, options: { prospectId?: string; provider?: SearchProvider; fetchPage?: CandidateFetcher; now?: string } = {}): Promise<ContactAcquisitionResult> {
  const startedAt = options.now ?? new Date().toISOString(); const queries = buildContactAcquisitionQueryPlan(identity); const sources: ContactAcquisitionCandidate[] = []; const ownedPathManifest = identity.websiteUrl ? generatedOwnedPathManifest(identity.websiteUrl, startedAt) : [];
  if (identity.websiteUrl) { const url = normalizeCandidateUrl(identity.websiteUrl); if (url) sources.push({ url, sourceType: 'OWNED_WEBSITE', queryOrigin: 'canonical.websiteUrl', identityStatus: 'IDENTITY_VERIFIED', identityEvidence: ['canonical website domain'], fetchStatus: 'NOT_FETCHED' }); }
  if (!options.provider) return { schemaVersion: 'contact-acquisition.v1', prospectId: options.prospectId, startedAt, completedAt: options.now ?? new Date().toISOString(), status: 'SEARCH_PROVIDER_UNAVAILABLE', queries, sources: dedupeCandidates(sources), sourceCounts: { canonical: sources.length }, ownedPathManifest, blocker: { code: 'SEARCH_PROVIDER_UNAVAILABLE', detail: 'No authorized public search provider is configured.' } };
  let status: SearchProviderStatus = 'SEARCH_PROVIDER_AVAILABLE';
  let providerError: string | null = null;
  try { for (const query of queries) { const results = await options.provider.search(query.query, 5); for (const result of results) { const url = normalizeCandidateUrl(result.url); if (!url) continue; const identityStatus = bindCandidateIdentity(identity, { url, text: `${result.title ?? ''} ${result.snippet ?? ''}` }); sources.push({ url, sourceType: classifySourceType(url), queryOrigin: query.query, identityStatus, identityEvidence: [result.title ?? result.snippet ?? 'search result'], fetchStatus: 'NOT_FETCHED' }); } } } catch (error) { status = 'SEARCH_PROVIDER_FAILED'; providerError = error instanceof Error ? error.message.replace(/TAVILY_API_KEY|api[_-]?key\s*[:=]\s*[^\s,}]+/gi, '[redacted]').slice(0, 240) : 'provider error'; }
  const accepted = dedupeCandidates(sources); const blocked = accepted.filter((source) => source.identityStatus === 'IDENTITY_AMBIGUOUS' || source.identityStatus === 'IDENTITY_REJECTED').length;
  return { schemaVersion: 'contact-acquisition.v1', prospectId: options.prospectId, startedAt, completedAt: options.now ?? new Date().toISOString(), status, queries, sources: accepted, sourceCounts: Object.fromEntries([...new Set(accepted.map((s) => s.sourceType))].map((type) => [type, accepted.filter((s) => s.sourceType === type).length])), ownedPathManifest, blocker: status === 'SEARCH_PROVIDER_FAILED' ? { code: 'SEARCH_PROVIDER_FAILED', detail: providerError ?? 'Configured provider failed.' } : blocked ? { code: 'IDENTITY_AMBIGUOUS', detail: `${blocked} candidate source(s) require rejection or review.` } : null };
}
