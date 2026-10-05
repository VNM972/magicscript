import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HunterClient, domainFromWebsite } from '../core/providers/hunter';
import { inspectSuppliedWebsiteSeed, validateProviderDomain } from '../core/research/website-seed';
import { inspectSuppliedDigitalPainPreflight } from '../core/research/digital-pain-preflight';

const root = resolve(import.meta.dirname, '..');
const evidencePath = resolve(import.meta.dirname, 'evidence.json');
const preservedPath = resolve(root, '.r39-runtime/final-cycle-20260928/final-state.json');
const targetNames = ['BODY ILES', 'CATLEIA', 'KREOL POKE', 'RITA CHAILLON'] as const;
const key = process.env.HUNTER_API_KEY;
const evidence: {
  status: 'COMPLETE' | 'BLOCKED_CAPABILITY' | 'PRODUCT_DEFECT_FOUND';
  capabilityGate: 'PASS' | 'FAIL';
  hunterLiveCapability: 'PROVEN' | 'NOT_PROVEN';
  results: Array<{
    targetIdentityKey: string;
    target: string;
    hunterState: string;
    hunterDomain?: string;
    hunterRequests: number;
    requestTimestamp?: string;
    knownDomainAvailable?: 'YES' | 'NO';
    hunterDomainMatchesKnownDomain?: 'YES' | 'NO' | 'NO_HUNTER_RESULT' | 'NO_REFERENCE';
    firstPartyFetch: 'PASS' | 'REDIRECT_NOT_FOLLOWED' | 'FAIL' | 'NOT_REACHED';
    firstPartyIdentity: string;
    r42Result: string;
    r42Condition: string;
    firstPartyRequests: number;
  }>;
} = { status: 'BLOCKED_CAPABILITY', capabilityGate: 'FAIL', hunterLiveCapability: 'NOT_PROVEN', results: [] };
const save = () => writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
const report = () => console.log(JSON.stringify(evidence));

if (!key) { save(); report(); process.exit(0); }

const preserved = JSON.parse(readFileSync(preservedPath, 'utf8')) as {
  prospects: Array<{ id: string; company_name: string; legal_name?: string; siren?: string; siret?: string;
    city?: string; location?: string; website_url?: string }>;
};
const targets = targetNames.map((name) => {
  const row = preserved.prospects.find((item) => item.company_name === name);
  if (!row || !row.id || !row.siren || !row.siret || !row.city || !row.location) throw new Error('PRESERVED_IDENTITY_MISSING');
  const match = row.location.match(/\b(97\d{3})\s+(.+)$/);
  if (!match || match[2] !== row.city) throw new Error('PRESERVED_ADDRESS_UNPARSEABLE');
  const address = row.location.slice(0, match.index).trim();
  const numbered = address.match(/^(\d+\s*(?:bis|ter|[a-z])?)\s+(.+)$/i);
  return {
    target: name,
    identity: {
      candidateIdentityKey: row.id,
      siren: row.siren,
      siret: row.siret,
      factualNames: [...new Set([row.company_name, row.legal_name].filter((value): value is string => Boolean(value)))],
      municipality: row.city,
      postcode: match[1],
      street: numbered ? numbered[2] : address,
      ...(numbered ? { streetNumber: numbered[1] } : {}),
    },
    company: row.company_name,
  };
});

let transportCalls = 0;
let observedStatus: number | undefined;
let observedBody: unknown;
const transport: typeof fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.origin !== 'https://api.hunter.io' || url.pathname !== '/v2/domain-finder' ||
      !targetNames.includes(url.searchParams.get('company') as typeof targetNames[number]) ||
      url.searchParams.get('limit') !== '1' ||
      [...url.searchParams.keys()].sort().join(',') !== 'api_key,company,limit' ||
      init?.method !== 'GET' || init.redirect !== 'error') throw new Error('HUNTER_REQUEST_BOUND_VIOLATION');
  transportCalls += 1;
  observedStatus = undefined;
  observedBody = undefined;
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  observedStatus = response.status;
  if (response.ok) {
    try { observedBody = await response.clone().json(); } catch { observedBody = undefined; }
  }
  return response;
};
const hunter = new HunterClient(key, undefined, transport);

const knownReference = (identityKey: string): string | undefined => {
  const historical = JSON.parse(readFileSync(preservedPath, 'utf8')) as typeof preserved;
  const url = historical.prospects.find((item) => item.id === identityKey)?.website_url;
  if (!url) return undefined;
  const domain = domainFromWebsite(url);
  return domain?.replace(/\.$/, '');
};

const visibleText = (html: string): string => html.replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
const suppliedTitleH1 = (html: string) => {
  const safe = html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const title = safe.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const h1 = [...safe.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => visibleText(match[1]));
  return { kind: 'TITLE_H1' as const, ...(title === undefined ? {} : { title: visibleText(title) }), h1 };
};

const fetchHomepage = async (url: string): Promise<{ kind: 'PASS' | 'REDIRECT_NOT_FOLLOWED' | 'FAIL'; html?: string }> => {
  try {
    const response = await fetch(url, {
      method: 'GET', redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { accept: 'text/html, text/plain;q=0.9' }, signal: AbortSignal.timeout(15000),
    });
    if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); return { kind: 'REDIRECT_NOT_FOLLOWED' }; }
    const type = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!response.ok || !/^text\/(?:html|plain)(?:;|$)/.test(type)) {
      await response.body?.cancel(); return { kind: 'FAIL' };
    }
    const maxBytes = 256 * 1024;
    const length = Number(response.headers.get('content-length'));
    if (length > maxBytes || !response.body) { await response.body?.cancel(); return { kind: 'FAIL' }; }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); return { kind: 'FAIL' }; }
      chunks.push(part.value);
    }
    const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    return { kind: 'PASS', html: new TextDecoder().decode(buffer) };
  } catch { return { kind: 'FAIL' }; }
};

for (const target of targets) {
  const row: typeof evidence.results[number] = {
    targetIdentityKey: target.identity.candidateIdentityKey,
    target: target.target,
    hunterState: 'NOT_REACHED', hunterRequests: 0,
    firstPartyFetch: 'NOT_REACHED', firstPartyIdentity: 'NOT_REACHED',
    r42Result: 'NOT_REACHED', r42Condition: 'NOT_REACHED', firstPartyRequests: 0,
  };
  evidence.results.push(row);
  const before = transportCalls;
  row.requestTimestamp = new Date().toISOString();
  const provider = await hunter.domainFinder({ company: target.company });
  row.hunterRequests = transportCalls - before;
  row.hunterState = provider.state;
  if (provider.state === 'CANDIDATE_DOMAIN') row.hunterDomain = provider.domain;
  save(); // Freeze provider output before consulting historical website evidence.

  const responseIsDocumentedShape = observedStatus === 200 &&
    Boolean(observedBody && typeof observedBody === 'object' && !Array.isArray(observedBody) &&
      Array.isArray((observedBody as { data?: unknown }).data) &&
      (observedBody as { data: unknown[] }).data.every((item) => item && typeof item === 'object' &&
        !Array.isArray(item) && typeof (item as { domain?: unknown }).domain === 'string'));
  const normalizedDomains = responseIsDocumentedShape
    ? (observedBody as { data: Array<{ domain: string }> }).data.map((item) => validateProviderDomain(item.domain))
    : [];
  const oneValidDomainInResponse = normalizedDomains.length > 0 &&
    normalizedDomains.every(Boolean) && new Set(normalizedDomains).size === 1;
  if (oneValidDomainInResponse && provider.state !== 'CANDIDATE_DOMAIN') {
    evidence.status = 'PRODUCT_DEFECT_FOUND';
    save();
    console.log(JSON.stringify({ discrepancy: {
      httpStatus: observedStatus, dataType: 'array', itemDomainType: 'string',
      itemDomainSyntaxValid: true, r48State: provider.state,
    } }));
    report();
    process.exit(0);
  }
  if (evidence.hunterLiveCapability === 'NOT_PROVEN') {
    if (!responseIsDocumentedShape || provider.state === 'PROVIDER_FAILURE') {
      save(); report(); process.exit(0);
    }
    evidence.capabilityGate = 'PASS';
    evidence.hunterLiveCapability = 'PROVEN';
  }

  const reference = knownReference(target.identity.candidateIdentityKey);
  row.knownDomainAvailable = reference ? 'YES' : 'NO';
  row.hunterDomainMatchesKnownDomain = !reference ? 'NO_REFERENCE' :
    provider.state !== 'CANDIDATE_DOMAIN' ? 'NO_HUNTER_RESULT' :
    domainFromWebsite(provider.candidateUrl)?.replace(/\.$/, '') === reference ? 'YES' : 'NO';
  save();

  if (provider.state !== 'CANDIDATE_DOMAIN') continue;
  row.firstPartyRequests = 1;
  const fetched = await fetchHomepage(provider.candidateUrl);
  row.firstPartyFetch = fetched.kind;
  save();
  if (fetched.kind !== 'PASS' || fetched.html === undefined) continue;
  const identity = inspectSuppliedWebsiteSeed({ identity: target.identity, providerResult: provider, homepageHtml: fetched.html });
  row.firstPartyIdentity = identity.state === 'ACCEPTED_SEED' ? identity.matchMethod : identity.state;
  if (identity.state === 'ACCEPTED_SEED') {
    const r42 = inspectSuppliedDigitalPainPreflight({
      origin: provider.candidateUrl,
      content: suppliedTitleH1(fetched.html),
      seedProvenance: { kind: 'CANDIDATE_URL', reference: provider.candidateUrl },
    });
    row.r42Result = r42.state;
    row.r42Condition = r42.condition ?? 'NONE';
  }
  save();
}

evidence.status = 'COMPLETE';
save();
report();
