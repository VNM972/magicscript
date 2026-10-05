import { classifySourceType } from '../contact-acquisition/agent';
import { publicHttpUrl } from './evidence-integrity';

type ProviderSeedBase = {
  provider: 'HUNTER_DOMAIN_FINDER'; authority: 'NON_AUTHORITATIVE'; requestCount: 0 | 1;
};
export type ProviderWebsiteSeedResult = ProviderSeedBase & (
  | { state: 'PROVIDER_NO_RESULT' | 'PROVIDER_FAILURE' | 'AMBIGUOUS_PROVIDER_RESULT' | 'INVALID_PROVIDER_DOMAIN' }
  | { state: 'CANDIDATE_DOMAIN'; domain: string; candidateUrl: string }
);
export interface WebsiteSeedIdentity {
  candidateIdentityKey: string;
  siren?: string;
  siret?: string;
  factualNames: readonly string[];
  municipality?: string;
  postcode?: string;
  street?: string;
  streetNumber?: string;
}
export type FirstPartyIdentityMatchMethod =
  'SIRET_EXACT_NAME' | 'SIREN_EXACT_LOCAL_IDENTITY' | 'NAME_FULL_ADDRESS_EXACT';
export type FirstPartyWebsiteSeedResult = {
  authority: 'NON_AUTHORITATIVE'; provider: 'HUNTER_DOMAIN_FINDER';
  candidateIdentityKey: string; providerLookupState: ProviderWebsiteSeedResult['state'];
} & (
  | { state: 'PROVIDER_NO_RESULT' | 'PROVIDER_FAILURE' | 'AMBIGUOUS_PROVIDER_RESULT' | 'INVALID_PROVIDER_DOMAIN'
      | 'FIRST_PARTY_IDENTITY_INSUFFICIENT' | 'FIRST_PARTY_IDENTITY_CONFLICT' }
  | { state: 'ACCEPTED_SEED'; candidateUrl: string; domain: string;
      matchMethod: FirstPartyIdentityMatchMethod; matchedFields: readonly string[];
      inspection: { kind: 'SUPPLIED_HOMEPAGE_HTML'; characterCount: number; operatorBlockCount: number } }
);

/** Syntax only, without DNS. Preserve www; never invent a host or transport variant. */
export function validateProviderDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim().normalize('NFC').toLowerCase();
  if (!raw || /[\s/@:#?\\\[\]%]/u.test(raw) || raw.endsWith('.')) return null;
  try {
    const url = new URL(`https://${raw}/`);
    const host = url.hostname;
    const labels = host.split('.');
    if (host.length > 253 || labels.length < 2 ||
        labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
        !/^(?:[a-z]{2,63}|xn--[a-z0-9-]+)$/.test(labels.at(-1)!) ||
        /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example|onion)$/.test(host) ||
        !publicHttpUrl(url.href) || classifySourceType(url.href) !== 'OTHER_PUBLIC_SOURCE') return null;
    // WHATWG URL rejects malformed punycode; ASCII input must not be rewritten as an IP.
    if (/^[\x00-\x7F]+$/.test(raw) && raw !== host) return null;
    return host;
  } catch { return null; }
}

const normalize = (value: string): string => value.normalize('NFKD').toLowerCase()
  .replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const textValue = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const digits = (value: string): string => value.replace(/[\s.\-]/g, '');
export function validRegistration(value: string, length: 9 | 14): boolean {
  const number = digits(value);
  if (!new RegExp(`^\\d{${length}}$`).test(number) || /^0+$/.test(number)) return false;
  let sum = 0;
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i]);
    if ((number.length - 1 - i) % 2) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0 && (length === 9 || validRegistration(number.slice(0, 9), 9));
}
interface OperatorBlock {
  names: string[]; siren: string[]; siret: string[];
  municipality: string[]; postcode: string[]; street: string[]; streetNumber: string[];
}
const emptyBlock = (): OperatorBlock => ({ names: [], siren: [], siret: [], municipality: [], postcode: [], street: [], streetNumber: [] });
function add(block: OperatorBlock, key: keyof OperatorBlock, value: unknown): void {
  const text = textValue(value);
  if (text && !block[key].includes(text)) block[key].push(text);
}
function address(block: OperatorBlock, street: unknown): void {
  const text = textValue(street);
  const numbered = text.match(/^(\d+\s*(?:bis|ter|[a-z])?)\s+(.+)$/i);
  if (numbered) { add(block, 'streetNumber', numbered[1]); add(block, 'street', numbered[2]); }
  else add(block, 'street', text);
}

// Deliberately bounded valid schema.org types; unknown types yield insufficient evidence.
const operatorTypes = new Set(['Organization', 'LocalBusiness', 'Restaurant', 'BarOrPub', 'CafeOrCoffeeShop',
  'FoodEstablishment', 'Bakery', 'FastFoodRestaurant', 'IceCreamShop', 'Brewery', 'Winery',
  'HealthAndBeautyBusiness', 'BeautySalon', 'HairSalon', 'NailSalon', 'DaySpa', 'TattooParlor',
  'Store', 'GroceryStore', 'ConvenienceStore', 'ClothingStore', 'Florist', 'AutoRepair',
  'HomeAndConstructionBusiness', 'Electrician', 'Plumber', 'Locksmith', 'GeneralContractor',
  'ProfessionalService', 'LodgingBusiness', 'Hotel', 'RealEstateAgent', 'Dentist', 'MedicalBusiness']);
function jsonBlocks(value: unknown): OperatorBlock[] {
  if (Array.isArray(value)) return value.flatMap(jsonBlocks);
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  // Only top-level nodes, never publisher, reviews, testimonials or related organizations.
  if (Array.isArray(object['@graph'])) return object['@graph'].flatMap(jsonBlocks);
  const types = Array.isArray(object['@type']) ? object['@type'] : [object['@type']];
  if (!types.some((type) => typeof type === 'string' && operatorTypes.has(type.replace(/^https?:\/\/schema\.org\//, '')))) return [];
  const block = emptyBlock();
  for (const key of ['name', 'legalName', 'alternateName']) add(block, 'names', object[key]);
  for (const key of ['siren', 'siret'] as const) add(block, key, object[key]);
  const identifiers = Array.isArray(object.identifier) ? object.identifier : [object.identifier];
  for (const identifier of identifiers) {
    if (identifier && typeof identifier === 'object' && !Array.isArray(identifier)) {
      const id = identifier as Record<string, unknown>;
      const label = normalize(textValue(id.propertyID) || textValue(id.name));
      if (label === 'siren' || label === 'siret') add(block, label, id.value);
    } else if (typeof identifier === 'string') {
      const match = identifier.match(/^\s*(SIREN|SIRET)\s*[:=]?\s*([\d .-]+)\s*$/i);
      if (match) add(block, match[1].toLowerCase() as 'siren' | 'siret', match[2]);
    }
  }
  const addresses = Array.isArray(object.address) ? object.address : [object.address];
  for (const item of addresses) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const fields = item as Record<string, unknown>;
    add(block, 'municipality', fields.addressLocality); add(block, 'postcode', fields.postalCode);
    address(block, fields.streetAddress); add(block, 'streetNumber', fields.streetNumber);
  }
  return [block];
}

interface HtmlNode { tag: string; attrs: Record<string, string>; children: (HtmlNode | string)[] }
function decodeText(text: string): string {
  const entities: Record<string, string> = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, entity: string) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? original;
    const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : original;
  });
}
/** Inert, conservative tokenizer: no DOM, script execution, URL resolution or resource loading. */
function suppliedBlocks(html: string): { blocks: OperatorBlock[]; usable: boolean } {
  const root: HtmlNode = { tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  let usable = true;
  const voidTags = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;
  for (const token of html.matchAll(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]*>|[^<]+/gi)) {
    const part = token[0];
    if (/^<!--|^<!/i.test(part)) continue;
    if (!part.startsWith('<')) { stack.at(-1)!.children.push(decodeText(part)); continue; }
    const closing = part.match(/^<\/([\w-]+)\s*>$/);
    if (closing) {
      if (stack.at(-1)?.tag === closing[1].toLowerCase()) stack.pop();
      else usable = false;
      continue;
    }
    const opening = part.match(/^<([\w-]+)\b([^>]*?)>/);
    if (!opening) { usable = false; continue; }
    const node: HtmlNode = { tag: opening[1].toLowerCase(), attrs: {}, children: [] };
    for (const attr of opening[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const key = attr[1].toLowerCase();
      if (key in node.attrs) usable = false;
      node.attrs[key] = decodeText(attr[2] ?? attr[3] ?? attr[4] ?? '');
    }
    stack.at(-1)!.children.push(node);
    if (node.tag === 'script' || node.tag === 'style') {
      node.children.push(part.slice(opening[0].length).replace(/<\/(?:script|style)\s*>$/i, ''));
    } else if (!voidTags.test(node.tag) && !/\/\s*>$/.test(opening[0])) stack.push(node);
  }
  if (stack.length !== 1) usable = false;
  const excluded = (node: HtmlNode): boolean =>
    /^(?:iframe|object|template|noscript|blockquote|svg|math|style)$/i.test(node.tag) ||
    'hidden' in node.attrs || node.attrs['aria-hidden'] === 'true' ||
    /display\s*:\s*none|visibility\s*:\s*hidden/i.test(node.attrs.style ?? '') ||
    /credit|agency|agence|testimonial|temoignage|témoignage|review|widget|publisher|partner|partenaire/i.test(
      `${node.attrs.id ?? ''} ${node.attrs.class ?? ''} ${node.attrs.itemprop ?? ''}`);
  const visible = (node: HtmlNode): string => excluded(node) || node.tag === 'script' ? '' :
    node.children.map((child) => typeof child === 'string' ? child : visible(child)).join(' ') +
      (/^(?:p|li|dt|dd|div|section|address|h[1-6]|br)$/.test(node.tag) ? '\n' : '');
  const blocks: OperatorBlock[] = [];
  const walk = (node: HtmlNode): boolean => {
    if (excluded(node)) return false;
    if (node.tag === 'script') {
      if (node.attrs.type?.toLowerCase() === 'application/ld+json') {
        try { blocks.push(...jsonBlocks(JSON.parse(node.children.join('')))); }
        catch { usable = false; }
      }
      return false;
    }
    const nested = node.children.filter((child): child is HtmlNode => typeof child !== 'string').map(walk).some(Boolean);
    const qualified = node.tag === 'footer' || node.tag === 'address' ||
      /^(?:contact|legal|mentions-legales|business-identity)$/.test(node.attrs.id ?? '') ||
      /(?:^|\s)(?:contact|legal|business-identity)(?:\s|$)/.test(node.attrs.class ?? '');
    if (qualified && !nested) {
      const block = emptyBlock();
      const labels: Record<string, keyof OperatorBlock> = { nom: 'names', entreprise: 'names', 'raison sociale': 'names',
        siren: 'siren', siret: 'siret', commune: 'municipality', ville: 'municipality',
        'code postal': 'postcode', rue: 'street', adresse: 'street', numero: 'streetNumber' };
      for (const line of visible(node).split(/[\n;|]/)) {
        if (/site.*(?:concu|conçu|realise|réalisé|cree|créé)|powered by|designed by/i.test(line)) continue;
        const match = line.trim().match(/^([^:]+):\s*(.+)$/);
        const key = match && labels[normalize(match[1])];
        if (match && key) { if (key === 'street') address(block, match[2]); else add(block, key, match[2]); }
      }
      if (block.names.length) blocks.push(block);
    }
    return qualified || nested;
  };
  walk(root);
  return { blocks, usable };
}

/** Extract only internally consistent operator facts from already supplied homepage HTML. */
export function extractSuppliedFirstPartyIdentity(html: string): {
  state: 'IDENTITY_STRONG' | 'IDENTITY_PARTIAL' | 'IDENTITY_CONFLICT' | 'IDENTITY_ABSENT';
  identity?: { exactOperatorName?: string; directSiren?: string; directSiret?: string;
    municipality?: string; postcode?: string; street?: string; streetNumber?: string };
} {
  if (typeof html !== 'string' || !html.trim()) return { state: 'IDENTITY_ABSENT' };
  const parsed = suppliedBlocks(html);
  if (!parsed.usable) return { state: 'IDENTITY_CONFLICT' };
  const blocks = parsed.blocks.filter((block) => Object.values(block).some((values) => values.length));
  if (!blocks.length) return { state: 'IDENTITY_ABSENT' };
  const facts = blocks.map((block) => {
    const values = (key: keyof OperatorBlock) => [...new Map(block[key].map((value) => [normalize(value), value])).values()];
    const names = values('names');
    const sirens = values('siren').map(digits);
    const sirets = values('siret').map(digits);
    const municipality = values('municipality');
    const postcode = values('postcode');
    const street = values('street');
    const streetNumber = values('streetNumber');
    const conflict = [names, sirens, sirets, municipality, postcode, street, streetNumber]
      .some((items) => items.length > 1) ||
      sirens.some((id) => !validRegistration(id, 9)) || sirets.some((id) => !validRegistration(id, 14)) ||
      Boolean(sirens[0] && sirets[0] && sirets[0].slice(0, 9) !== sirens[0]);
    return { conflict, identity: { exactOperatorName: names[0], directSiren: sirens[0] ?? sirets[0]?.slice(0, 9),
      directSiret: sirets[0], municipality: municipality[0], postcode: postcode[0],
      street: street[0], streetNumber: streetNumber[0] } };
  });
  if (facts.some((item) => item.conflict)) return { state: 'IDENTITY_CONFLICT' };
  const unique = [...new Map(facts.map((item) => [JSON.stringify(item.identity), item.identity])).values()];
  if (unique.length !== 1) return { state: 'IDENTITY_CONFLICT' };
  const identity = unique[0];
  const strong = Boolean(identity.directSiret || identity.directSiren && identity.exactOperatorName ||
    identity.exactOperatorName && identity.postcode && (identity.municipality || identity.street));
  return { state: strong ? 'IDENTITY_STRONG' : 'IDENTITY_PARTIAL', identity };
}

/** Pure supplied-content identity qualification; never creates Agent1/source/admission authority. */
export function inspectSuppliedWebsiteSeed(input: {
  identity: WebsiteSeedIdentity; providerResult: ProviderWebsiteSeedResult; homepageHtml: string;
}): FirstPartyWebsiteSeedResult {
  const { identity, providerResult: provider } = input;
  const base = { authority: 'NON_AUTHORITATIVE' as const, provider: 'HUNTER_DOMAIN_FINDER' as const,
    candidateIdentityKey: identity.candidateIdentityKey, providerLookupState: provider.state };
  if (provider.state !== 'CANDIDATE_DOMAIN') return { ...base, state: provider.state };
  const domain = validateProviderDomain(provider.domain);
  if (!domain || provider.candidateUrl !== `https://${domain}/` || provider.authority !== 'NON_AUTHORITATIVE' ||
      provider.provider !== 'HUNTER_DOMAIN_FINDER') return { ...base, state: 'INVALID_PROVIDER_DOMAIN' };
  const insufficient = (): FirstPartyWebsiteSeedResult => ({ ...base, state: 'FIRST_PARTY_IDENTITY_INSUFFICIENT' });
  if (typeof input.homepageHtml !== 'string' || !input.homepageHtml.trim() || !identity.candidateIdentityKey ||
      !identity.factualNames?.length) return insufficient();
  if (identity.siren && identity.siret && digits(identity.siret).slice(0, 9) !== digits(identity.siren)) return insufficient();
  const parsed = suppliedBlocks(input.homepageHtml);
  const names = identity.factualNames.map(normalize).filter(Boolean);
  const matchesName = (block: OperatorBlock) => block.names.some((name) => names.includes(normalize(name)));
  const idMatch = (block: OperatorBlock) => block.siret.some((id) => digits(id) === identity.siret) ||
    block.siren.some((id) => digits(id) === identity.siren);
  // Do not merge across nodes, even when fields happen to be complementary.
  const relevant = parsed.blocks.filter((block) => matchesName(block) || idMatch(block));
  const localKeys = ['municipality', 'postcode', 'street', 'streetNumber'] as const;
  const conflict = (block: OperatorBlock): boolean =>
    block.names.some((name) => !names.includes(normalize(name))) ||
    block.siret.some((id) => !validRegistration(id, 14) || (identity.siret ? digits(id) !== identity.siret :
      Boolean(identity.siren && digits(id).slice(0, 9) !== identity.siren))) ||
    block.siren.some((id) => !validRegistration(id, 9) || (identity.siren ? digits(id) !== identity.siren :
      Boolean(identity.siret && digits(id) !== identity.siret.slice(0, 9)))) ||
    localKeys.some((key) => identity[key] && block[key].some((value) => normalize(value) !== normalize(identity[key]!)));
  if (relevant.some(conflict)) return { ...base, state: 'FIRST_PARTY_IDENTITY_CONFLICT' };
  const distinct = [...new Map(relevant.map((block) => [JSON.stringify(Object.fromEntries(
    Object.entries(block).map(([key, values]) => [key, [...new Set((values as string[]).map(normalize))].sort()]))), block])).values()];
  if (!parsed.usable || distinct.length !== 1) return insufficient();
  const block = distinct[0];
  const fullAddress = localKeys.every((key) => key === 'streetNumber' && !identity[key] ||
    Boolean(identity[key] && block[key].length && block[key].every((value) => normalize(value) === normalize(identity[key]!))));
  let matchMethod: FirstPartyIdentityMatchMethod;
  let matchedFields: string[];
  if (identity.siret && validRegistration(identity.siret, 14) && block.siret.some((id) => digits(id) === identity.siret)) {
    matchMethod = 'SIRET_EXACT_NAME'; matchedFields = ['siret', 'name'];
  } else if (identity.siren && validRegistration(identity.siren, 9) &&
      block.siren.some((id) => digits(id) === identity.siren) && fullAddress) {
    matchMethod = 'SIREN_EXACT_LOCAL_IDENTITY'; matchedFields = ['siren', 'name', ...localKeys.filter((key) => identity[key])];
  } else if (!parsed.blocks.some((item) => item.siren.length || item.siret.length) && fullAddress) {
    matchMethod = 'NAME_FULL_ADDRESS_EXACT'; matchedFields = ['name', ...localKeys.filter((key) => identity[key])];
  } else return insufficient();
  if (!matchesName(block)) return insufficient();
  return { ...base, state: 'ACCEPTED_SEED', domain, candidateUrl: provider.candidateUrl, matchMethod, matchedFields,
    inspection: { kind: 'SUPPLIED_HOMEPAGE_HTML', characterCount: input.homepageHtml.length, operatorBlockCount: distinct.length } };
}
