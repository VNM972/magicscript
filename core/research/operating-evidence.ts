import { classifySourceType } from '../contact-acquisition/agent';
import { matchSupportedLocalServiceText } from '../icp/local-service-archetypes';
import { isCommercialFamilyOperatorType, resolveCommercialFamilyFromOperatingFacts, type CommercialFamily } from '../icp/icp-decision';
import { publicHttpUrl, type AcceptedResearchSource } from './evidence-integrity';

export interface OperatingFact {
  kind: 'SCHEMA_ORG_TYPE' | 'SERVICE_TYPE' | 'AUDIENCE_TYPE';
  value: string;
  sourceUrl: string;
  evidenceType: 'JSON_LD' | 'OWNED_PAGE_TEXT';
  sourceType?: 'OWNED_WEBSITE';
  integrityStatus?: 'ACCEPTED';
  supportingText?: string;
  /** JSON-LD operator URL, retained only when it equals the fetched owned homepage. */
  operatorUrl?: string;
}

export interface OperatingEvidence {
  status: 'VERIFIED' | 'UNKNOWN';
  facts: readonly OperatingFact[];
  commercialFamily?: CommercialFamily;
}

const genericTypes = new Set(['Thing', 'WebPage', 'WebSite', 'Organization', 'LocalBusiness', 'Place', 'Service']);
const schemaType = (value: unknown, schemaContext: boolean): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const type = value.startsWith('https://schema.org/') ? value.slice(19) : schemaContext ? value : '';
  return /^[A-Z][A-Za-z]{2,64}$/.test(type) && !genericTypes.has(type) ? type : undefined;
};
const factValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 160 ? value.trim() : undefined;

function ownedOperatingSource(source: AcceptedResearchSource): boolean {
  const url = publicHttpUrl(source.url);
  if (!url || !source.supports.includes('activity') || classifySourceType(source.url, true) !== 'OWNED_WEBSITE') return false;
  // These third-party hosts can have a homepage and still are not the candidate's owned site.
  return !/(^|\.)(?:google|tripadvisor|thefork|ubereats|deliveroo|facebook|instagram|directory|registry|marketplace|search|provider)\.|(^|\.)eats\.uber\./i.test(url.hostname);
}

function visibleText(value: string): string {
  const entities: Record<string, string> = { amp: '&', nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', ucirc: 'û', rsquo: '’', apos: "'", quot: '"' };
  return value.replace(/<[^>]*>/g, ' ').replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1]?.toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return entities[entity.toLowerCase()] ?? match;
  }).replace(/\s+/g, ' ').trim();
}

function ownedPageServiceTexts(html: string): string[] {
  const content = html.replace(/<!--[^]*?-->|<(script|style|noscript|svg|nav|footer|aside)\b[^>]*>[^]*?<\/\1>/gi, '');
  const headings = [...content.matchAll(/<(h1|h2)\b[^>]*>([^]*?)<\/\1>/gi)]
    .map((match) => visibleText(match[2]).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  if (headings.some((heading) => /\b(?:restaurant|cafe|barbier|coiffure|salon de beaute|beauty salon|hair salon|boutique|magasin|photograph(?:e|ie) corporate|corporate photograph)\b/.test(heading))) return [];
  return [...content.matchAll(/<(h1|h2|h3|p)\b[^>]*>([^]*?)<\/\1>/gi)]
    .map((match) => visibleText(match[2]))
    .filter((value) => value.length > 0 && value.length <= 600);
}

/** Records explicit facts from fetched, accepted owned activity pages. */
export function extractOperatingEvidence(
  acceptedSources: readonly AcceptedResearchSource[],
  pages: readonly { url: string; html: string }[],
): OperatingEvidence {
  const eligible = new Set(acceptedSources.filter(ownedOperatingSource)
    .map((source) => publicHttpUrl(source.url)?.toString()).filter((url): url is string => Boolean(url)));
  const facts: OperatingFact[] = [];
  const add = (fact: OperatingFact) => {
    if (!facts.some((current) => current.kind === fact.kind && current.value === fact.value && current.sourceUrl === fact.sourceUrl && current.evidenceType === fact.evidenceType && current.operatorUrl === fact.operatorUrl)) {
      facts.push(fact);
    }
  };
  for (const page of pages) {
    const sourceUrl = publicHttpUrl(page.url)?.toString();
    if (!sourceUrl || !eligible.has(sourceUrl)) continue;
    const pageUrl = new URL(sourceUrl);
    const origin = pageUrl.origin;
    const operatorHomepage = pageUrl.pathname === '/' && !pageUrl.search && !pageUrl.hash;
    for (const match of page.html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      let parsed: unknown;
      try { parsed = JSON.parse(match[1]); } catch { continue; }
      const visit = (value: unknown, context = false): void => {
        if (Array.isArray(value)) { value.forEach((item) => visit(item, context)); return; }
        if (!value || typeof value !== 'object') return;
        const object = value as Record<string, unknown>;
        const schemaContext = context || (typeof object['@context'] === 'string' && /^https?:\/\/schema\.org\/?$/.test(object['@context']));
        const url = publicHttpUrl(object.url);
        // A page can embed unrelated organizations. Its business entity must
        // explicitly identify this accepted owned origin before facts count.
        if (schemaContext && url?.origin === origin) {
          const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']];
          for (const raw of types) {
            const type = schemaType(raw, schemaContext);
            if (type) add({
              kind: 'SCHEMA_ORG_TYPE', value: type, sourceUrl, evidenceType: 'JSON_LD',
              ...(isCommercialFamilyOperatorType(type) && operatorHomepage && url.toString() === sourceUrl
                ? { operatorUrl: sourceUrl } : {}),
            });
          }
          const service = factValue(object.serviceType);
          if (service) add({ kind: 'SERVICE_TYPE', value: service, sourceUrl, evidenceType: 'JSON_LD', sourceType: 'OWNED_WEBSITE', integrityStatus: 'ACCEPTED', supportingText: service });
          const audience = object.audience;
          const audienceType = factValue(audience && typeof audience === 'object' && !Array.isArray(audience)
            ? (audience as Record<string, unknown>).audienceType : audience);
          if (audienceType) add({ kind: 'AUDIENCE_TYPE', value: audienceType, sourceUrl, evidenceType: 'JSON_LD' });
        }
        for (const nested of Object.values(object)) visit(nested, schemaContext);
      };
      visit(parsed);
    }
    for (const supportingText of ownedPageServiceTexts(page.html)) {
      const value = matchSupportedLocalServiceText(supportingText);
      if (value) add({ kind: 'SERVICE_TYPE', value, sourceUrl, evidenceType: 'OWNED_PAGE_TEXT', sourceType: 'OWNED_WEBSITE', integrityStatus: 'ACCEPTED', supportingText });
    }
  }
  const commercialFamily = resolveCommercialFamilyFromOperatingFacts(facts);
  return { status: facts.length ? 'VERIFIED' : 'UNKNOWN', facts, ...(commercialFamily ? { commercialFamily } : {}) };
}

/** Rebind runner evidence to the final accepted source set at scoring time. */
export function acceptedOperatingEvidence(value: unknown, acceptedSources: readonly AcceptedResearchSource[]): OperatingEvidence {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const eligible = new Set(acceptedSources.filter(ownedOperatingSource).map((source) => source.url));
  const facts: OperatingFact[] = [];
  if (input.status === 'VERIFIED' && Array.isArray(input.facts)) for (const raw of input.facts) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const fact = raw as Record<string, unknown>;
    if ((fact.evidenceType !== 'JSON_LD' && fact.evidenceType !== 'OWNED_PAGE_TEXT') || typeof fact.sourceUrl !== 'string' || !eligible.has(fact.sourceUrl)) continue;
    if (fact.kind !== 'SCHEMA_ORG_TYPE' && fact.kind !== 'SERVICE_TYPE' && fact.kind !== 'AUDIENCE_TYPE') continue;
    const value = factValue(fact.value);
    if (!value) continue;
    if (fact.evidenceType === 'OWNED_PAGE_TEXT') {
      if (fact.kind !== 'SERVICE_TYPE' || fact.sourceType !== 'OWNED_WEBSITE' || fact.integrityStatus !== 'ACCEPTED' || typeof fact.supportingText !== 'string' || fact.supportingText.length > 600 || matchSupportedLocalServiceText(fact.supportingText) !== value) continue;
      facts.push({ kind: 'SERVICE_TYPE', value, sourceUrl: fact.sourceUrl, evidenceType: 'OWNED_PAGE_TEXT', sourceType: 'OWNED_WEBSITE', integrityStatus: 'ACCEPTED', supportingText: fact.supportingText });
    } else if (fact.kind === 'SERVICE_TYPE') {
      facts.push({ kind: 'SERVICE_TYPE', value, sourceUrl: fact.sourceUrl, evidenceType: 'JSON_LD', sourceType: 'OWNED_WEBSITE', integrityStatus: 'ACCEPTED', supportingText: value });
    } else {
      const operatorPage = publicHttpUrl(fact.sourceUrl);
      facts.push({
        kind: fact.kind, value, sourceUrl: fact.sourceUrl, evidenceType: 'JSON_LD',
        ...(fact.kind === 'SCHEMA_ORG_TYPE' && isCommercialFamilyOperatorType(value) &&
          fact.operatorUrl === fact.sourceUrl && operatorPage?.pathname === '/' && !operatorPage.search && !operatorPage.hash
          ? { operatorUrl: fact.sourceUrl } : {}),
      });
    }
  }
  const commercialFamily = resolveCommercialFamilyFromOperatingFacts(facts);
  return { status: facts.length ? 'VERIFIED' : 'UNKNOWN', facts, ...(commercialFamily ? { commercialFamily } : {}) };
}
