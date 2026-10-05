import { publicHttpUrl } from './evidence-integrity';
import { extractSuppliedFirstPartyIdentity } from './website-seed';

export type SuppliedIdentityCandidate = ReturnType<typeof extractSuppliedFirstPartyIdentity>;
export type IdentityPageSelection = { state: 'NO_ELIGIBLE_LINK' | 'AMBIGUOUS_LINK' } |
  { state: 'SELECTED'; url: string };

const normalize = (value: string) => value.normalize('NFKD').toLowerCase()
  .replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const legalLabels = new Set(['mentions legales', 'informations legales', 'legal notice']);
const assetPath = /\.(?:pdf|zip|rar|7z|gz|tar|bz2|xz|exe|bin|dmg|iso|docx?|xlsx?|pptx?|csv|txt|json|xml|css|js|mjs|png|jpe?g|gif|webp|avif|bmp|tiff?|svg|ico|mp[34]|m4[av]|aac|flac|wav|og[agv]|avi|mov|webm|mpeg|mpg|wmv|woff2?|[ot]tf|eot)(?:\/|$)/i;
function decode(value: string): string {
  const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, code: string) => {
    if (!code.startsWith('#')) return entities[code.toLowerCase()] ?? original;
    const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : original;
  });
}

/** V1: only complete explicit anchors and exact labels. No path inference,
 * metadata inference, scripts, browser navigation or resource loading. */
export function selectSuppliedIdentityPage(homepageUrl: string, html: string): IdentityPageSelection {
  const homepage = publicHttpUrl(homepageUrl);
  if (!homepage || typeof html !== 'string' || html.length > 250_000) return { state: 'NO_ELIGIBLE_LINK' };
  const legal = new Set<string>();
  const contact = new Set<string>();
  let legalPresent = false;
  // Tokenize tags with quoted attributes intact; never recognize anchors inside
  // comments, raw-text/inert blocks or attribute values. Unsupported base URLs
  // fail closed rather than silently resolving a relative link differently.
  const inert = /<!--[^]*?(?:-->|$)|<(script|style|iframe|object|template|noscript|svg|math|textarea|title)\b[^>]*>[^]*?<\/\1\s*>/gi;
  const source = html.replace(inert, ' ');
  if (/<(?:base|script|style|iframe|object|template|noscript|svg|math|textarea|title)\b/i.test(source))
    return { state: 'NO_ELIGIBLE_LINK' };
  let anchor: { href?: string; text: string; download: boolean } | undefined;
  for (const token of source.matchAll(/<(?:"[^"]*"|'[^']*'|[^'">])*?>|[^<]+/g)) {
    const part = token[0];
    if (!part.startsWith('<')) { if (anchor) anchor.text += decode(part); continue; }
    if (/^<a\b/i.test(part)) {
      if (anchor) return { state: 'AMBIGUOUS_LINK' };
      const attrs: Record<string, string> = {};
      for (const attr of part.slice(2, -1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        const key = attr[1].toLowerCase();
        if (key in attrs) return { state: 'AMBIGUOUS_LINK' };
        attrs[key] = decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
      }
      anchor = { href: attrs.href, text: '', download: 'download' in attrs };
    } else if (/^<\/a\s*>$/i.test(part) && anchor) {
      const label = anchor.text.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '')
        .trim().replace(/\s+/g, ' ');
      const isLegal = legalLabels.has(label);
      if (isLegal) legalPresent = true;
      if (isLegal || label === 'contact') {
        const raw = anchor.href?.trim();
        if (raw && !raw.startsWith('#') && !/[\u0000-\u0020\u007f\\]/.test(raw) && !anchor.download) {
          try {
            const url = publicHttpUrl(new URL(raw, homepage).href);
            const path = url && decodeURIComponent(url.pathname);
            if (url && url.origin === homepage.origin && !url.port && url.href !== homepage.href &&
                path && !assetPath.test(path) && !/(?:^|\/)(?:downloads?|telecharger)(?:\/|$)/i.test(path)) {
              (isLegal ? legal : contact).add(url.href);
            }
          } catch { /* Malformed URL is ineligible. */ }
        }
      }
      anchor = undefined;
    } else if (anchor) anchor.text += ' ';
  }
  if (anchor) return { state: 'AMBIGUOUS_LINK' };
  const selected = legalPresent ? legal : contact;
  if (selected.size > 1) return { state: 'AMBIGUOUS_LINK' };
  return selected.size === 1 ? { state: 'SELECTED', url: [...selected][0] } : { state: 'NO_ELIGIBLE_LINK' };
}

/** Preserve supplied facts; conflict never silently chooses a page. R55 itself
 * revalidates registrations and classifies the union, so no threshold is copied
 * or relaxed here. The inert serialization is classification input, not evidence. */
export function mergeSuppliedIdentityCandidates(homepage: SuppliedIdentityCandidate,
  page: SuppliedIdentityCandidate): SuppliedIdentityCandidate {
  if (homepage.state === 'IDENTITY_CONFLICT' || page.state === 'IDENTITY_CONFLICT')
    return { state: 'IDENTITY_CONFLICT' };
  const merged = { ...homepage.identity };
  for (const [field, value] of Object.entries(page.identity ?? {})) {
    const key = field as keyof typeof merged;
    if (value === undefined) continue;
    if (merged[key] !== undefined && normalize(merged[key]!) !== normalize(value))
      return { state: 'IDENTITY_CONFLICT' };
    merged[key] ??= value;
  }
  const node = { '@type': 'Organization', name: merged.exactOperatorName,
    siren: merged.directSiren, siret: merged.directSiret,
    address: { addressLocality: merged.municipality, postalCode: merged.postcode,
      streetAddress: merged.street, streetNumber: merged.streetNumber } };
  return extractSuppliedFirstPartyIdentity('<script type="application/ld+json">' +
    JSON.stringify(node).replace(/</g, '\\u003c') + '</script>');
}
