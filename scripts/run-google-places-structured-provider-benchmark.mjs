import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BENCHMARK_ID = 'google-places-structured-provider-exploratory-v1';
export const SAMPLE_PATH = 'bulk/reports/tomtom-structured-provider-sample-v1.json';
export const RESULT_PATH = 'bulk/reports/google-places-structured-provider-external-results-v1.json';
export const GOOGLE_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
export const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri';
export const EXPECTED_SAMPLE_HASH = 'b39721d123fd252a1e9dca276fa49446a454027fcb381958be6cfe207699d75d';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
export function normalizeText(value) { return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
export function normalizePhone(value) { const digits = String(value ?? '').replace(/\D/g, ''); return digits.startsWith('00') ? `+${digits.slice(2)}` : digits ? `+${digits}` : null; }
function domain(value) { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } }
function postal(value) { return String(value ?? '').match(/\b(97\d{3})\b/)?.[1] ?? null; }
function text(value) { return typeof value === 'string' ? value.trim() || null : value?.text?.trim?.() || null; }
function targetAddress(target) { return `${target.canonicalAddress ?? ''} ${target.canonicalLocality ?? ''}`.trim(); }

export function queryFor(target) { return [target.canonicalName, target.canonicalLocality, 'Martinique', target.canonicalAddress].filter(Boolean).join(', '); }
export function parseCandidates(payload) { return Array.isArray(payload?.places) ? payload.places.map((place) => ({ id: place.id ?? null, name: text(place.displayName), address: place.formattedAddress ?? null, website: place.websiteUri ?? null, nationalPhone: place.nationalPhoneNumber ?? null, internationalPhone: place.internationalPhoneNumber ?? null })) : []; }

export function evaluateIdentity(target, candidate) {
  const targetName = normalizeText(target.canonicalName); const providerName = normalizeText(candidate.name);
  const targetLocation = normalizeText(target.canonicalLocality); const providerAddress = normalizeText(candidate.address);
  const targetPostal = target.canonicalPostalCode || postal(targetAddress(target)); const providerPostal = postal(candidate.address);
  const targetDomain = domain(target.canonicalWebsite); const providerDomain = domain(candidate.website);
  const nameExact = Boolean(targetName && providerName && targetName === providerName);
  const nameCompatible = nameExact || Boolean(targetName && providerName && (providerName.includes(targetName) || targetName.includes(providerName)));
  const localityCompatible = !targetLocation || providerAddress.includes(targetLocation);
  const postalCompatible = !targetPostal || !providerPostal || targetPostal === providerPostal;
  const websiteCompatible = !targetDomain || !providerDomain || targetDomain === providerDomain || targetDomain.endsWith(`.${providerDomain}`) || providerDomain.endsWith(`.${targetDomain}`);
  const signals = { nameExact, nameCompatible, localityCompatible, postalCompatible, websiteCompatible, targetLocality: target.canonicalLocality ?? null, providerAddress: candidate.address ?? null, targetPostal: targetPostal ?? null, providerPostal: providerPostal ?? null, targetDomain: targetDomain || null, providerDomain: providerDomain || null };
  if (!providerName && !providerAddress && !providerPostal && !providerDomain) return { verdict: 'AMBIGUOUS', reason: 'candidate lacks identity evidence', signals };
  if (!nameCompatible || !localityCompatible || !postalCompatible || !websiteCompatible) return { verdict: 'REJECTED', reason: 'material identity mismatch', signals };
  if (!nameExact && (!providerAddress || !targetLocation || !providerPostal || !postalCompatible)) return { verdict: 'AMBIGUOUS', reason: 'non-exact name lacks complete corroborating location', signals };
  if (!nameExact && !providerPostal && !targetLocation) return { verdict: 'AMBIGUOUS', reason: 'non-exact name lacks location corroboration', signals };
  return { verdict: 'VERIFIED', reason: 'deterministic name, location, postal-code, and website compatibility', signals };
}

function resultBase(target, query, sampleHash) { return { benchmarkId: BENCHMARK_ID, sampleHash, canonicalProspectId: target.prospectId, sampleRole: target.sampleRole, query, providerPlaceId: null, providerName: null, providerAddress: null, providerWebsite: null, providerNationalPhone: null, providerInternationalPhone: null, providerPhoneNormalized: null, identitySignals: null, identityVerdict: 'NOT_FOUND', identityReason: 'no candidate returned', incrementalPhone: false, positiveControlPhoneResult: target.sampleRole === 'POSITIVE_CONTROL' ? 'ABSENT' : 'NOT_APPLICABLE', responseAcquiredAt: null, responseHash: null, requestCount: 0 }; }
function requestHeaders(apiKey) { return { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK }; }
export function validateTextSearchRequest(body) { if (!body || typeof body.textQuery !== 'string' || !body.textQuery.trim()) throw new Error('Invalid Google textQuery'); if (body.pageSize !== 3) throw new Error('Google pageSize must be 3'); }
async function readResponse(response) { const payloadText = await response.text(); if (!response.ok) throw new Error(`Google Places request failed with HTTP ${response.status}`); let payload; try { payload = JSON.parse(payloadText); } catch { throw new Error('Google Places returned invalid JSON'); } return { payload, payloadText }; }

export async function runBenchmark({ fetchImpl = fetch, now = () => new Date().toISOString() } = {}) {
  const apiKey = process.env.GKEY;
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('GKEY is required');
  const sampleText = await fs.readFile(path.join(root, SAMPLE_PATH), 'utf8'); const sampleFile = JSON.parse(sampleText); const actualHash = sha256(JSON.stringify(sampleFile.sample));
  if (actualHash !== EXPECTED_SAMPLE_HASH || sampleFile.sampleHash !== EXPECTED_SAMPLE_HASH) throw new Error('Benchmark sample integrity check failed');
  const results = []; let requestCount = 0;
  for (const target of sampleFile.sample) {
    const query = queryFor(target); const out = resultBase(target, query, actualHash); const body = { textQuery: query, pageSize: 3 }; validateTextSearchRequest(body);
    const response = await fetchImpl(GOOGLE_ENDPOINT, { method: 'POST', headers: requestHeaders(apiKey), body: JSON.stringify(body) }); requestCount++;
    const { payload, payloadText } = await readResponse(response); const candidates = parseCandidates(payload); out.responseAcquiredAt = now(); out.responseHash = sha256(payloadText); out.requestCount = 1;
    const evaluated = candidates.map((candidate) => ({ candidate, identity: evaluateIdentity(target, candidate) })); const verified = evaluated.filter((x) => x.identity.verdict === 'VERIFIED');
    if (verified.length === 1) { const selected = verified[0]; const c = selected.candidate; out.providerPlaceId = c.id; out.providerName = c.name; out.providerAddress = c.address; out.providerWebsite = c.website; out.providerNationalPhone = c.nationalPhone; out.providerInternationalPhone = c.internationalPhone; out.providerPhoneNormalized = normalizePhone(c.internationalPhone || c.nationalPhone); out.identitySignals = selected.identity.signals; out.identityVerdict = 'VERIFIED'; out.identityReason = selected.identity.reason; if (target.sampleRole === 'POSITIVE_CONTROL') { const expected = normalizePhone(target.positiveControlExpectedPhone); out.positiveControlPhoneResult = out.providerPhoneNormalized ? (out.providerPhoneNormalized === expected ? 'MATCH' : 'MISMATCH') : 'ABSENT'; } else out.incrementalPhone = Boolean(out.providerPhoneNormalized); }
    else if (verified.length > 1) { out.identityVerdict = 'AMBIGUOUS'; out.identityReason = 'multiple identity-compatible candidates'; out.identitySignals = verified.map((x) => x.identity.signals); }
    else if (evaluated.length) { out.identityVerdict = evaluated.every((x) => x.identity.verdict === 'REJECTED') ? 'REJECTED' : 'AMBIGUOUS'; out.identityReason = evaluated.every((x) => x.identity.verdict === 'REJECTED') ? 'all candidates rejected by deterministic identity binding' : 'candidate identity is ambiguous'; }
    results.push(out);
  }
  const artifact = { benchmarkId: BENCHMARK_ID, provider: 'GOOGLE_PLACES_NEW', sampleHash: actualHash, generatedAt: now(), requestCount, results };
  await fs.writeFile(path.join(root, RESULT_PATH), JSON.stringify(artifact, null, 2) + '\n', 'utf8'); return artifact;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) runBenchmark().then((x) => console.log(`Google Places benchmark complete: ${x.requestCount} requests; results written to ${RESULT_PATH}`)).catch((error) => { console.error(`Google Places benchmark aborted: ${String(error.message).replace(/GKEY/gi, 'secret')}`); process.exitCode = 1; });
