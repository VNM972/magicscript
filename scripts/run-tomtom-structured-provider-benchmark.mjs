import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BENCHMARK_ID = 'tomtom-structured-provider-exploratory-v1';
export const SAMPLE_PATH = 'bulk/reports/tomtom-structured-provider-sample-v1.json';
export const RESULT_PATH = 'bulk/reports/tomtom-structured-provider-external-results-v1.json';
export const DISCOVER_ATTRIBUTES = 'results(id,type,title,address,contacts)';
export const DETAILS_ATTRIBUTES = 'id,type,title,address,contacts';
const API_ROOT = 'https://api.tomtom.com';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
export function normalizeText(value) { return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\d]+/gu, ' ').trim(); }
export function normalizePhone(value) { const digits = String(value ?? '').replace(/\D/g, ''); return digits.startsWith('00') ? digits.slice(2) : digits; }
function domain(value) { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } }
function values(value) { return Array.isArray(value) ? value : value == null ? [] : [value]; }
function firstString(...items) { return items.flatMap(values).find((x) => typeof x === 'string' && x.trim()) ?? null; }
function addressOf(poi) { const a = poi?.address ?? {}; return { full: firstString(a.freeformAddress, a.freeformAddressText, a.streetNameAndNumber, a.streetName) ?? null, locality: firstString(a.municipality, a.municipalitySubdivision, a.localName) ?? null, postalCode: firstString(a.postalCode) ?? null }; }
function contactsOf(poi) { const c = poi?.contacts ?? {}; const phones = c.phones ?? c.phone ?? []; const sites = c.websites ?? c.website ?? []; return { phone: firstString(...phones.flatMap((x) => [x?.value, x?.number, x])), website: firstString(...sites.flatMap((x) => [x?.url, x])) }; }
export function parseDiscover(payload) { const results = payload?.results ?? payload?.poiResults ?? []; return results.map((x) => ({ id: x.id ?? x.poi?.id ?? null, type: x.type ?? x.poi?.type ?? null, title: x.title ?? x.poi?.name ?? null, address: addressOf(x), contacts: contactsOf(x), raw: x })); }
export function parseDetails(payload) { const x = payload?.poi ?? payload; const a = addressOf(x); const c = contactsOf(x); return { id: x?.id ?? null, type: x?.type ?? null, title: x?.name ?? x?.title ?? null, address: a, contacts: c, raw: x }; }
function postal(address) { return (String(address ?? '').match(/\b(97\d{3})\b/) ?? [])[1] ?? null; }
export function evaluateIdentity(target, candidate) {
  const targetName = normalizeText(target.canonicalName); const providerName = normalizeText(candidate.title);
  const targetLocality = normalizeText(target.canonicalLocality); const providerLocality = normalizeText(candidate.address.locality);
  const targetPostal = target.canonicalPostalCode; const providerPostal = candidate.address.postalCode || postal(candidate.address.full);
  const targetDomain = domain(target.canonicalWebsite); const providerDomain = domain(candidate.contacts.website);
  const nameExact = !!targetName && targetName === providerName;
  const nameCompatible = nameExact || (!!targetName && !!providerName && (providerName.includes(targetName) || targetName.includes(providerName)));
  const localityCompatible = !targetLocality || !providerLocality || targetLocality === providerLocality || providerLocality.includes(targetLocality) || targetLocality.includes(providerLocality);
  const postalCompatible = !targetPostal || !providerPostal || targetPostal === providerPostal;
  const domainCompatible = !targetDomain || !providerDomain || targetDomain === providerDomain || targetDomain.endsWith(`.${providerDomain}`) || providerDomain.endsWith(`.${targetDomain}`);
  const signals = { nameExact, nameCompatible, localityCompatible, postalCompatible, domainCompatible, targetLocality, providerLocality, targetPostal, providerPostal, targetDomain: targetDomain || null, providerDomain: providerDomain || null };
  if (!nameCompatible || !localityCompatible || !postalCompatible || !domainCompatible) return { verdict: 'REJECTED', reason: 'material identity mismatch', signals };
  if (!nameExact && (!providerLocality || !postalCompatible)) return { verdict: 'AMBIGUOUS', reason: 'non-exact name without corroborating location', signals };
  return { verdict: 'VERIFIED', reason: 'exact compatible business identity with no contradictory location/domain signal', signals };
}
function queryFor(target) { return [target.canonicalName, target.canonicalLocality, 'Martinique', target.canonicalAddress].filter(Boolean).join(', '); }
function requestHeaders(attributes) { return { 'content-type': 'application/json', accept: 'application/json', 'accept-language': 'fr-FR,fr;q=0.9', 'TomTom-Api-Key': process.env.TTKEY, 'TomTom-Api-Version': '3', Attributes: attributes }; }
export function validateDiscoverRequest(body, prospectId) { if (typeof body.query !== 'string' || !body.query.trim()) throw new Error(`Invalid Discover query for prospect ${prospectId}`); if (!Number.isInteger(body.maxResults) || body.maxResults < 1 || body.maxResults > 100) throw new Error(`Invalid Discover maxResults for prospect ${prospectId}`); if (body.filters !== undefined && (!Array.isArray(body.filters.types) || body.filters.types.some((x) => x !== 'poi'))) throw new Error(`Invalid Discover filters for prospect ${prospectId}`); if (DISCOVER_ATTRIBUTES !== 'results(id,type,title,address,contacts)') throw new Error('Invalid Discover Attributes constant'); }
function sanitizedBody(body) { return { query: body.query, maxResults: body.maxResults, filters: body.filters }; }
async function responsePayload(response) { const text = await response.text(); let payload; try { payload = JSON.parse(text); } catch { payload = text.slice(0, 4000); } return { text, payload }; }
export function httpErrorDiagnostic({ operation, method, endpointPath, target, body, attributes, response, payload }) { return { status: response.status, operation, method, endpointPath, canonicalProspectId: target.prospectId, sampleRole: target.sampleRole, requestBody: body ? sanitizedBody(body) : undefined, attributes, responseBody: payload, contentType: response.headers?.get?.('content-type') ?? null }; }
async function providerRequest({ fetchImpl, operation, method, url, endpointPath, target, body, attributes }) {
  const response = await fetchImpl(url, { method, headers: requestHeaders(attributes), ...(body ? { body: JSON.stringify(body) } : {}) });
  const parsed = await responsePayload(response);
  if (!response.ok) { const diagnostic = httpErrorDiagnostic({ operation, method, endpointPath, target, body, attributes, response, payload: parsed.payload }); throw new Error(`TomTom ${operation} HTTP ${response.status}: ${JSON.stringify(diagnostic)}`); }
  return parsed;
}
function resultBase(target, query) { return { benchmarkId: BENCHMARK_ID, sampleHash: null, canonicalProspectId: target.prospectId, sampleRole: target.sampleRole, query, providerEntityId: null, providerName: null, providerAddress: null, providerLocality: null, providerPostalCode: null, providerWebsite: null, providerPhoneRaw: null, providerPhoneNormalized: null, identitySignals: null, identityVerdict: 'NOT_FOUND', identityReason: 'no candidate selected', positiveControlPhoneResult: target.sampleRole === 'POSITIVE_CONTROL' ? 'ABSENT' : 'NOT_APPLICABLE', incrementalPhone: false, providerResponseAcquiredAt: new Date().toISOString(), discoverResponseHash: null, detailsResponseHash: null, discoverRequestCount: 0, detailsRequestCount: 0 }; }
export async function runBenchmark({ fetchImpl = fetch } = {}) {
  const key = process.env.TTKEY; if (typeof key !== 'string' || !key.trim()) throw new Error('TTKEY is required');
  const sampleFile = JSON.parse(await fs.readFile(path.join(root, SAMPLE_PATH), 'utf8')); const expected = sampleFile.sampleHash; const actual = sha256(JSON.stringify(sampleFile.sample)); if (!expected || actual !== expected) throw new Error('Benchmark sample integrity check failed');
  const results = []; let discoverRequests = 0; let detailsRequests = 0;
  for (const target of sampleFile.sample) {
    const query = queryFor(target); const out = resultBase(target, query); const discoverBody = { query, maxResults: 3, filters: { types: ['poi'] } }; validateDiscoverRequest(discoverBody, target.prospectId); out.sampleHash = actual; out.discoverRequestCount = 1; discoverRequests++;
    const discoverPath = '/maps/orbis/places/discover'; const discover = await providerRequest({ fetchImpl, operation: 'DISCOVER', method: 'POST', url: `${API_ROOT}${discoverPath}`, endpointPath: discoverPath, target, body: discoverBody, attributes: DISCOVER_ATTRIBUTES }); const discoverPayload = JSON.parse(discover.text); out.discoverResponseHash = sha256(discover.text);
    const candidates = parseDiscover(discoverPayload).map((candidate) => ({ candidate, identity: evaluateIdentity(target, candidate) })); const verified = candidates.filter((x) => x.identity.verdict === 'VERIFIED');
    if (verified.length === 1) {
      const selected = verified[0]; out.providerEntityId = selected.candidate.id; out.providerName = selected.candidate.title; out.providerAddress = selected.candidate.address.full; out.providerLocality = selected.candidate.address.locality; out.providerPostalCode = selected.candidate.address.postalCode || postal(selected.candidate.address.full); out.identitySignals = selected.identity.signals; out.identityVerdict = 'VERIFIED'; out.identityReason = selected.identity.reason; out.detailsRequestCount = 1; detailsRequests++;
      const detailsPath = `/maps/orbis/places/details/pois/${encodeURIComponent(selected.candidate.id)}`; const details = await providerRequest({ fetchImpl, operation: 'DETAILS', method: 'GET', url: `${API_ROOT}${detailsPath}`, endpointPath: detailsPath, target, attributes: DETAILS_ATTRIBUTES }); const detailPayload = JSON.parse(details.text); out.detailsResponseHash = sha256(details.text); const detail = parseDetails(detailPayload); const dContacts = detail.contacts;
      out.providerName = detail.title || out.providerName; out.providerAddress = detail.address.full || out.providerAddress; out.providerLocality = detail.address.locality || out.providerLocality; out.providerPostalCode = detail.address.postalCode || postal(detail.address.full) || out.providerPostalCode; out.providerWebsite = dContacts.website; out.providerPhoneRaw = dContacts.phone; out.providerPhoneNormalized = dContacts.phone ? normalizePhone(dContacts.phone) : null;
      if (target.sampleRole === 'POSITIVE_CONTROL') { const expectedPhone = target.positiveControlExpectedPhone ? normalizePhone(target.positiveControlExpectedPhone) : null; out.positiveControlPhoneResult = !out.providerPhoneNormalized ? 'ABSENT' : expectedPhone === out.providerPhoneNormalized ? 'MATCH' : 'MISMATCH'; } else out.incrementalPhone = Boolean(out.providerPhoneNormalized);
    } else if (verified.length > 1) { out.identityVerdict = 'AMBIGUOUS'; out.identityReason = 'multiple identity-compatible candidates'; out.identitySignals = verified.map((x) => x.identity.signals); } else if (candidates.length) { out.identityVerdict = candidates.every((x) => x.identity.verdict === 'REJECTED') ? 'REJECTED' : 'AMBIGUOUS'; out.identityReason = candidates.every((x) => x.identity.verdict === 'REJECTED') ? 'all candidates rejected by deterministic identity binding' : 'candidate identity is ambiguous'; }
    results.push(out);
  }
  const artifact = { benchmarkId: BENCHMARK_ID, benchmarkSchemaVersion: 'tomtom-structured-provider-external-results.v1', sampleHash: actual, generatedAt: new Date().toISOString(), discoverRequests, detailsRequests, totalRequests: discoverRequests + detailsRequests, results }; await fs.writeFile(path.join(root, RESULT_PATH), JSON.stringify(artifact, null, 2) + '\n', 'utf8'); return artifact;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) runBenchmark().then((x) => console.log(`TomTom benchmark complete: ${x.totalRequests} requests; results written to ${RESULT_PATH}`)).catch((error) => { console.error(`TomTom benchmark aborted: ${error.message.replace(/TTKEY/gi, 'secret')}`); process.exitCode = 1; });
