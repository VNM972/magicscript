/** Deterministic, read-only contact & presence enrichment (V1). */

export type EnrichmentStatus = 'UNKNOWN' | 'VERIFIED' | 'N/A' | 'REJECTED';
export type PresenceKind = 'phone' | 'email' | 'social' | 'whatsapp' | 'contactForm' | 'instagram' | 'facebook' | 'tiktok';
export type SocialPlatform = 'instagram' | 'facebook' | 'tiktok';

export interface IdentityInput { companyName?: string; domain?: string; city?: string }
export interface IdentityObservation { name?: string; domain?: string; city?: string }
export interface IdentityBinding { status: EnrichmentStatus; matched: boolean; reason: string; observations: IdentityObservation[] }
export interface Evidence { value: string; sourceUrl: string; kind: PresenceKind; evidenceType: string }
export interface PresenceField { status: EnrichmentStatus; values: string[]; evidence: Evidence[] }
export interface ContactPresenceResult {
  status: EnrichmentStatus;
  identity: IdentityBinding;
  phone: PresenceField;
  email: PresenceField;
  website: PresenceField;
  social: PresenceField;
  instagram: PresenceField;
  facebook: PresenceField;
  tiktok: PresenceField;
  whatsapp: PresenceField;
  contactForm: PresenceField;
  sourcesProcessed: number;
  sourcesChecked: string[];
  reasons: string[];
  enrichedAt: string;
  truncated: boolean;
}
import type { PhoneSourceOwnership } from '../research/evidence-integrity';
export type { PhoneSourceOwnership } from '../research/evidence-integrity';

export interface EnrichmentSource { url: string; html: string; metadata?: Record<string, unknown> }
export interface EnrichmentOptions { maxSources?: number; maxBytesPerSource?: number }
export interface PhoneEvidenceOptions {
  sourceOwnership?: PhoneSourceOwnership;
  entityBound?: boolean;
}

const empty = (): PresenceField => ({ status: 'UNKNOWN', values: [], evidence: [] });
const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const domainOf = (value: string): string => { try { return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const hostMatches = (a: string, b: string) => { const x = domainOf(a), y = domainOf(b); return !!x && !!y && (x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`)); };
const unescape = (s: string) => s.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ');
const visible = (html: string) => unescape(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));

function jsonLd(html: string): unknown[] {
  const blocks = html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi); const out: unknown[] = [];
  for (const m of blocks) try { out.push(JSON.parse(m[1])); } catch { /* malformed JSON-LD is simply not evidence */ }
  return out;
}
function walk(value: unknown, fn: (o: Record<string, unknown>) => void): void {
  if (Array.isArray(value)) return value.forEach(v => walk(v, fn));
  if (!value || typeof value !== 'object') return;
  fn(value as Record<string, unknown>);
  Object.values(value as Record<string, unknown>).forEach(v => walk(v, fn));
}
function add(field: PresenceField, value: string, sourceUrl: string, kind: PresenceKind, evidenceType: string): void {
  const v = value.trim(); if (!v || field.values.includes(v)) return;
  field.values.push(v); field.evidence.push({ value: v, sourceUrl, kind, evidenceType }); field.status = 'VERIFIED';
}

export function bindIdentity(identity: IdentityInput, html: string, sourceUrl: string): IdentityBinding {
  const observations: IdentityObservation[] = [];
  for (const block of jsonLd(html)) walk(block, o => {
    const name = typeof o.name === 'string' ? o.name : undefined;
    const url = typeof o.url === 'string' ? o.url : undefined;
    let city: string | undefined;
    const address = o.address;
    if (address && typeof address === 'object' && typeof (address as Record<string, unknown>).addressLocality === 'string') city = (address as Record<string, unknown>).addressLocality as string;
    if (name || url || city) observations.push({ name, domain: url ? domainOf(url) : undefined, city });
  });
  observations.push({ domain: domainOf(sourceUrl) });
  const candidates = observations.filter(o => o.name || o.domain || o.city);
  if (!identity.companyName && !identity.domain && !identity.city) return { status: 'UNKNOWN', matched: false, reason: 'no target identity supplied', observations: candidates };
  const targetName = identity.companyName ? normalize(identity.companyName) : '';
  const targetCity = identity.city ? normalize(identity.city) : '';
  const domainOk = identity.domain ? candidates.some(o => !!o.domain && hostMatches(o.domain, identity.domain!)) : true;
  const named = candidates.filter(o => o.name && targetName && (normalize(o.name) === targetName || normalize(o.name).includes(targetName) || targetName.includes(normalize(o.name))));
  const cityOk = !targetCity || candidates.some(o => o.city && normalize(o.city) === targetCity) || !candidates.some(o => o.city);
  const nameRequired = !!targetName && candidates.some(o => o.name);
  const nameOk = !targetName || named.length > 0 || !nameRequired;
  // Exact business-name evidence is stronger than a broad/stale location label
  // (for example a prospect location of "Martinique" versus a directory city
  // of "Le Lamentin"). Do not reject a same-name source solely on that
  // mismatch; domain and name mismatches remain fail-closed.
  const exactNameMatch = named.some(o => normalize(o.name ?? '') === targetName);
  if (!domainOk || !nameOk || (!cityOk && !exactNameMatch)) return { status: 'REJECTED', matched: false, reason: 'identity mismatch', observations: candidates };
  const corroboration = (identity.domain && domainOk ? 1 : 0) + (identity.companyName && named.length ? 1 : 0) + (identity.city && cityOk ? 1 : 0);
  if (corroboration < 1) return { status: 'UNKNOWN', matched: false, reason: 'identity is ambiguous', observations: candidates };
  return { status: 'VERIFIED', matched: true, reason: 'identity bound', observations: candidates };
}

/** Parse only already-fetched HTML; this function performs no network requests or submissions. */
export function parseContactPresence(html: string, sourceUrl: string, identity?: IdentityInput, phoneOptions: PhoneEvidenceOptions = {}): ContactPresenceResult {
  const result: ContactPresenceResult = { status: 'UNKNOWN', identity: identity ? bindIdentity(identity, html, sourceUrl) : { status: 'UNKNOWN', matched: false, reason: 'identity not supplied', observations: [] }, phone: empty(), email: empty(), website: empty(), social: empty(), instagram: empty(), facebook: empty(), tiktok: empty(), whatsapp: empty(), contactForm: empty(), sourcesProcessed: 1, sourcesChecked: [sourceUrl], reasons: [], enrichedAt: new Date().toISOString(), truncated: false };
  const thirdPartyGlobalPhone = phoneOptions.sourceOwnership === 'THIRD_PARTY_SITE_GLOBAL_CONTACT';
  const phoneEntityBound = phoneOptions.entityBound ?? (phoneOptions.sourceOwnership === undefined ? true : result.identity.matched);
  const phoneAllowed = !thirdPartyGlobalPhone && phoneEntityBound && (
    phoneOptions.sourceOwnership === undefined ||
    phoneOptions.sourceOwnership === 'OWNED_BUSINESS_SOURCE' ||
    phoneOptions.sourceOwnership === 'DIRECT_STRUCTURED_BUSINESS_SOURCE' ||
    phoneOptions.sourceOwnership === 'THIRD_PARTY_LISTING_BUSINESS_FIELD'
  );
  const blocked = result.identity.status === 'REJECTED';
  if (blocked) { result.status = 'REJECTED'; return result; }
  if (identity?.domain && hostMatches(sourceUrl, identity.domain)) add(result.website, sourceUrl, sourceUrl, 'social', 'OWNED_WEBSITE');
  const addHref = html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi);
  for (const m of addHref) {
    const href = unescape(m[1].trim()); const low = href.toLowerCase();
    if (low.startsWith('tel:')) { const v = href.slice(4).replace(/[?].*$/, '').trim(); if (phoneAllowed && /^\+?[0-9][0-9 .()\-/]{7,20}$/.test(v)) add(result.phone, v.replace(/\s+/g, ' '), sourceUrl, 'phone', 'TEL_HREF'); }
    else if (low.startsWith('mailto:')) { const v = href.slice(7).split(/[?#]/)[0].trim().toLowerCase(); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) add(result.email, v, sourceUrl, 'email', 'MAILTO_HREF'); }
    if (/wa\.me\//i.test(href) || /api\.whatsapp\.com\/send/i.test(href) || /whatsapp/i.test(href)) add(result.whatsapp, href, sourceUrl, 'whatsapp', 'WHATSAPP_LINK');
    if (/facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com|youtube\.com|tiktok\.com/i.test(href)) add(result.social, href, sourceUrl, 'social', 'SOCIAL_HREF');
    if (/instagram\.com/i.test(href)) add(result.instagram, href, sourceUrl, 'instagram', 'INSTAGRAM_HREF');
    if (/facebook\.com/i.test(href)) add(result.facebook, href, sourceUrl, 'facebook', 'FACEBOOK_HREF');
    if (/tiktok\.com/i.test(href)) add(result.tiktok, href, sourceUrl, 'tiktok', 'TIKTOK_HREF');
  }
  for (const block of jsonLd(html)) walk(block, o => {
    if (phoneAllowed && typeof o.telephone === 'string') add(result.phone, o.telephone, sourceUrl, 'phone', 'JSON_LD_TELEPHONE');
    if (typeof o.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) add(result.email, o.email.toLowerCase(), sourceUrl, 'email', 'JSON_LD_EMAIL');
    if (Array.isArray(o.sameAs)) for (const x of o.sameAs) if (typeof x === 'string') add(result.social, x, sourceUrl, 'social', 'JSON_LD_SAME_AS');
  });
  const text = visible(html);
  for (const m of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) add(result.email, m[0].toLowerCase(), sourceUrl, 'email', 'VISIBLE_EMAIL');
  if (phoneAllowed) for (const m of text.matchAll(/(?:\+?[0-9][0-9 .()\-/]{7,20})/g)) { const v = m[0].trim(); const digits = v.replace(/\D/g, ''); if ((v.startsWith('+') ? digits.length >= 8 && digits.length <= 15 : digits.length === 10 && digits.startsWith('0'))) add(result.phone, v, sourceUrl, 'phone', 'VISIBLE_PHONE'); }
  if (!phoneAllowed && /(?:\+?[0-9][0-9 .()\-/]{7,20})/.test(text)) result.reasons.push(thirdPartyGlobalPhone ? 'THIRD_PARTY_SITE_GLOBAL_CONTACT_REJECTED' : 'PHONE_SOURCE_NOT_ENTITY_BOUND');
  if (/<form\b[^>]*>/i.test(html)) result.contactForm = { status: 'VERIFIED', values: [sourceUrl], evidence: [{ value: sourceUrl, sourceUrl, kind: 'contactForm', evidenceType: 'CONTACT_FORM' }] };
  result.status = result.identity.status === 'UNKNOWN' ? 'UNKNOWN' : 'VERIFIED';
  result.reasons.push(result.identity.reason);
  return result;
}

/** Bounded deterministic waterfall over supplied metadata; sources are never fetched here. */
export function enrichContactPresence(sources: readonly EnrichmentSource[], identity?: IdentityInput, options: EnrichmentOptions = {}): ContactPresenceResult {
  const maxSources = Math.max(0, Math.min(options.maxSources ?? 3, 20)); const maxBytes = Math.max(0, options.maxBytesPerSource ?? 500_000);
  const first = sources.slice(0, maxSources); const combined = first.map(s => parseContactPresence(s.html.slice(0, maxBytes), s.url, identity));
  const out = combined[0] ?? parseContactPresence('', identity?.domain ?? '', identity); out.sourcesProcessed = first.length; out.sourcesChecked = first.map(s => s.url); out.truncated = sources.length > first.length || first.some(s => s.html.length > maxBytes);
  for (const r of combined.slice(1)) for (const key of ['phone','email','social','instagram','facebook','tiktok','whatsapp','contactForm'] as const) { for (const e of r[key].evidence) add(out[key], e.value, e.sourceUrl, e.kind, e.evidenceType); }
  if (first.length > 0) for (const key of ['phone','email','social','instagram','facebook','tiktok','whatsapp','contactForm'] as const) if (!out[key].values.length) out[key].status = 'N/A';
  out.reasons.push(`bounded sources checked: ${first.length}`);
  if (first.length === 0) {
    out.status = 'UNKNOWN';
    for (const key of ['phone','email','social','instagram','facebook','tiktok','whatsapp','contactForm'] as const) out[key].status = 'UNKNOWN';
    return out;
  }
  out.status = out.identity.status === 'REJECTED' ? 'REJECTED' : (out.identity.status === 'UNKNOWN' ? 'UNKNOWN' : 'VERIFIED'); return out;
}
