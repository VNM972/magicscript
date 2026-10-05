/**
 * Pure deterministic phone extraction from already-fetched source material.
 *
 * SECURITY INVARIANT: MODEL CLAIM != SOURCE EVIDENCE.
 *
 * This module NEVER reads model-authored phone fields. It only parses raw fetched
 * content (document text / tel: hrefs / JSON-LD) that was independently observed
 * from a public source page. It performs NO LLM calls and invents no values.
 *
 * Evidence types (V1):
 *   TEL_HREF           — a tel: link found in fetched HTML
 *   JSON_LD_TELEPHONE — a JSON-LD structured-data telephone property
 *   VISIBLE_PAGE_TEXT  — a phone-shaped token found in visible page text
 *
 * Extraction priority is TEL_HREF > JSON_LD_TELEPHONE > VISIBLE_PAGE_TEXT.
 */

export type PhoneEvidenceType =
  | 'TEL_HREF'
  | 'JSON_LD_TELEPHONE'
  | 'VISIBLE_PAGE_TEXT';

export type PhoneEvidenceOrigin = 'FETCHED_SOURCE';

export interface IndependentPhoneEvidence {
  phone: string;
  normalizedDigits: string;
  sourceUrl: string;
  evidenceType: PhoneEvidenceType;
  evidenceOrigin: PhoneEvidenceOrigin;
  independentlyObserved: true;
}

/** French-mobile/international normalization: keep only digits, drop leading 00. */
export function normalizePhoneDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  return digits;
}

/** A conservative phone shape that rejects long business identifiers. */
export function looksLikePhone(raw: string): boolean {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return false;
  if (!/^\+?[0-9][0-9\s().\-/]{7,20}$/.test(trimmed)) return false;
  const digits = normalizePhoneDigits(trimmed);
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    return digits.length >= 8 && digits.length <= 15;
  }
  return digits.length === 10 && digits.startsWith('0');
}

/** Extract from a single tel: href value. */
function phoneFromTelHref(value: string): string | null {
  const trimmed = value.trim();
  const candidate = trimmed.toLowerCase().startsWith('tel:')
    ? trimmed.slice(4).trim()
    : trimmed;
  if (!looksLikePhone(candidate)) return null;
  return candidate;
}

/** Extract telephone value from a parsed JSON-LD node. */
function phoneFromJsonLd(node: unknown): string | null {
  if (typeof node === 'string') {
    const candidate = node.trim();
    return candidate ? candidate : null;
  }
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    const value = (node as Record<string, unknown>)['@value'];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** Walk a parsed JSON-LD value (object, array, scalar) for a telephone property. */
function collectJsonLdPhones(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectJsonLdPhones(item, out);
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (typeof (value as Record<string, unknown>)['telephone'] === 'string') {
    out.push((value as Record<string, unknown>)['telephone'] as string);
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    if (child && typeof child === 'object') collectJsonLdPhones(child, out);
  }
}

/** Extract tel: hrefs from raw HTML. */
export function extractPhoneFromTelHrefs(html: string, sourceUrl: string): IndependentPhoneEvidence | null {
  const hrefMatches = html.matchAll(/href\s*=\s*["']\s*tel\s*:\s*([^"']+)["']/gi);
  for (const match of hrefMatches) {
    const value = match[1]?.trim() ?? '';
    const phone = phoneFromTelHref(value);
    if (phone && looksLikePhone(phone)) {
      const normalizedDigits = normalizePhoneDigits(phone);
      if (normalizedDigits.length >= 8 && normalizedDigits.length <= 15) {
        return {
          phone: phone.replace(/[^0-9+]/g, ''),
          normalizedDigits,
          sourceUrl,
          evidenceType: 'TEL_HREF',
          evidenceOrigin: 'FETCHED_SOURCE',
          independentlyObserved: true,
        };
      }
    }
  }
  return null;
}

/** Extract a telephone from JSON-LD script content (fetched raw JSON-LD block). */
export function extractPhoneFromJsonLd(jsonLdText: string, sourceUrl: string): IndependentPhoneEvidence | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonLdText);
  } catch {
    return null;
  }
  const phones: string[] = [];
  collectJsonLdPhones(parsed, phones);
  for (const candidate of phones) {
    if (looksLikePhone(candidate)) {
      const normalizedDigits = normalizePhoneDigits(candidate);
      if (normalizedDigits.length >= 8 && normalizedDigits.length <= 15) {
        return {
          phone: candidate.replace(/[^0-9+]/g, ''),
          normalizedDigits,
          sourceUrl,
          evidenceType: 'JSON_LD_TELEPHONE',
          evidenceOrigin: 'FETCHED_SOURCE',
          independentlyObserved: true,
        };
      }
    }
  }
  return null;
}

/** Strip tags and decode a minimal set of HTML entities for visible-text scanning. */
function visibleText(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    // remove tel: anchors entirely (TEL_HREF is its own evidence type)
    .replace(/<a\b[^>]*href\s*=\s*["']\s*tel\s*:[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, ' ');
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');
  return withoutTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

/** Extract the first phone-shaped token from visible page text. */
export function extractPhoneFromVisibleText(html: string, sourceUrl: string): IndependentPhoneEvidence | null {
  const text = visibleText(html);
  const tokenMatches = text.match(/\+?\d[\d\s().\-/]{7,20}/g) ?? [];
  for (const token of tokenMatches) {
    const trimmed = token.trim();
    if (!looksLikePhone(trimmed)) continue;
    const normalizedDigits = normalizePhoneDigits(trimmed);
    if (normalizedDigits.length >= 8 && normalizedDigits.length <= 15) {
      return {
        phone: trimmed,
        normalizedDigits,
        sourceUrl,
        evidenceType: 'VISIBLE_PAGE_TEXT',
        evidenceOrigin: 'FETCHED_SOURCE',
        independentlyObserved: true,
      };
    }
  }
  return null;
}

/** Extract all JSON-LD script blocks from HTML. */
export function jsonLdBlocks(html: string): string[] {
  const matches = html.match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  return matches
    .map((block) => {
      const m = block.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
      return m ? m[1].trim() : '';
    })
    .filter(Boolean);
}

/**
 * Deterministically extract phone evidence from fetched source content.
 * Priority: TEL_HREF > JSON_LD_TELEPHONE > VISIBLE_PAGE_TEXT.
 */
export function extractPhoneEvidence(
  html: string,
  sourceUrl: string,
): IndependentPhoneEvidence | null {
  if (!html) return null;

  const fromTel = extractPhoneFromTelHrefs(html, sourceUrl);
  if (fromTel) return fromTel;

  for (const block of jsonLdBlocks(html)) {
    const fromJsonLd = extractPhoneFromJsonLd(block, sourceUrl);
    if (fromJsonLd) return fromJsonLd;
  }

  return extractPhoneFromVisibleText(html, sourceUrl);
}
