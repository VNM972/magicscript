import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VALIDATION_ID = 'google-places-production-validation-v1';
export const SAMPLE_PATH = 'bulk/reports/google-places-production-validation-v1-sample-v3.json';
export const RESULT_PATH = 'bulk/reports/google-places-production-validation-v1-external-results-v3.json';
export const EXPECTED_SAMPLE_HASH = '14dbf9dcff8540ba11e2edb2dcafa599a8c867fe87080ae81d0e4d37dcca31b2';
export const GOOGLE_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
export const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri';
export const MAX_REQUESTS = 10;
export const QUERY_CONTRACT_VERSION = 'exploratory-parity-address.v1';
export const IDENTITY_CONTRACT_VERSION = 'deterministic-multi-signal.v1';
export const OBSERVABILITY_SCHEMA_VERSION = 'sanitized-response-stage.v1';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
export function normalizePhone(value) { const digits = String(value ?? '').replace(/\D/g, ''); return digits ? `+${digits.replace(/^00/, '')}` : null; }
function text(value) { return typeof value === 'string' ? value.trim() || null : value?.text?.trim?.() || null; }
function norm(value) { return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function domain(value) { try { return new URL(value ?? '').hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } }
function postal(value) { return String(value ?? '').match(/\b(97\d{3})\b/)?.[1] ?? null; }
export function validateGoldControls(controls) { return Array.isArray(controls) && controls.length === 10 && controls.every((c) => c.goldPhoneNormalized && ['FIRST_PARTY_OFFICIAL_SITE', 'AUTHORITATIVE_GOVERNMENT_SOURCE'].includes(c.goldSourceType) && typeof c.goldSourceUrl === 'string' && c.goldSourceUrl.startsWith('https://')); }
export function queryFor(control) { return [control.name, control.commune, 'Martinique', control.address].filter(Boolean).join(', '); }
export function evaluateIdentity(control, candidate) {
  const targetName = norm(control.name); const providerName = norm(candidate.name); const address = norm(candidate.address);
  const locality = norm(control.commune); const targetPostal = postal(control.address); const providerPostal = postal(candidate.address);
  const name = !providerName ? 'MISSING' : providerName === targetName ? 'MATCH' : providerName.includes(targetName) || targetName.includes(providerName) ? 'COMPATIBLE' : 'CONFLICT';
  const local = !locality ? 'MISSING' : address.includes(locality) ? 'MATCH' : 'CONFLICT';
  const postalSignal = !targetPostal || !providerPostal ? 'MISSING' : targetPostal === providerPostal ? 'MATCH' : 'CONFLICT';
  const website = !control.canonicalWebsite || !candidate.website ? 'MISSING' : domain(control.canonicalWebsite) === domain(candidate.website) ? 'MATCH' : 'CONFLICT';
  const signals = { businessName: name, locality: local, addressOrPostalCode: postalSignal, websiteDomain: website };
  const reasonCodes = [];
  if (!providerName && !candidate.address) reasonCodes.push('NO_IDENTITY_SIGNALS');
  if (name === 'CONFLICT') reasonCodes.push('BUSINESS_NAME_CONFLICT');
  if (local === 'CONFLICT') reasonCodes.push('LOCALITY_CONFLICT');
  if (postalSignal === 'CONFLICT') reasonCodes.push('POSTAL_CODE_CONFLICT');
  if (website === 'CONFLICT') reasonCodes.push('WEBSITE_DOMAIN_CONFLICT');
  if (reasonCodes.length) return { verdict: 'REJECTED', signals, reasonCodes };
  if (!providerName || (name !== 'MATCH' && local !== 'MATCH' && postalSignal !== 'MATCH')) return { verdict: 'AMBIGUOUS', signals, reasonCodes: [...reasonCodes, 'INSUFFICIENT_CORROBORATION'] };
  return { verdict: 'VERIFIED', signals, reasonCodes: ['DETERMINISTIC_SIGNALS_COMPATIBLE'] };
}
export function comparePhone(gold, google) { if (!google) return 'ABSENT'; if (!gold) return 'NOT_VERIFIABLE'; return google === gold ? 'EXACT_MATCH' : 'CONFLICT'; }
export function parseCandidates(payload) { return Array.isArray(payload?.places) ? payload.places.map((p) => ({ id: p.id ?? null, name: text(p.displayName), address: p.formattedAddress ?? null, website: p.websiteUri ?? null, phone: normalizePhone(p.internationalPhoneNumber || p.nationalPhoneNumber) })) : []; }
export function classifyStage({ httpStatus, rawPlaceCount, parsedPlaceCount, identityCandidateCount, identityVerifiedCount, identityVerdict, branchVerdict, schemaError }) {
  if (schemaError) return 'SCHEMA_ERROR'; if (httpStatus < 200 || httpStatus >= 300) return 'HTTP_ERROR'; if (rawPlaceCount === 0) return 'GOOGLE_ZERO_RESULTS'; if (parsedPlaceCount === 0) return 'PARSER_ZERO_CANDIDATES'; if (identityVerifiedCount === 0) return identityVerdict === 'AMBIGUOUS' ? 'IDENTITY_AMBIGUOUS' : 'IDENTITY_REJECTED'; if (branchVerdict === 'REJECTED') return 'BRANCH_REJECTED'; return 'VERIFIED';
}
async function loadFrozenSample() {
  const sample = JSON.parse(await fs.readFile(path.join(root, SAMPLE_PATH), 'utf8')); const actual = sha256(JSON.stringify(sample.controls));
  if (sample.controls.length !== 10 || sample.canonicalControlsHash !== EXPECTED_SAMPLE_HASH || actual !== EXPECTED_SAMPLE_HASH || !validateGoldControls(sample.controls)) throw new Error('Frozen Google validation V3 integrity or gold completeness check failed');
  return sample;
}
function headers(key) { return { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK }; }
export async function runValidation({ fetchImpl = fetch, now = () => new Date().toISOString(), writeArtifact = true } = {}) {
  const key = process.env.GKEY; if (typeof key !== 'string' || !key.trim()) throw new Error('GKEY is required');
  const sample = await loadFrozenSample(); const results = []; let requestCount = 0;
  for (const control of sample.controls) {
    if (requestCount >= MAX_REQUESTS) throw new Error('Google request budget exceeded');
    const query = queryFor(control); const response = await fetchImpl(GOOGLE_ENDPOINT, { method: 'POST', headers: headers(key), body: JSON.stringify({ textQuery: query, pageSize: 3 }) }); requestCount++;
    const body = await response.text(); const responseHash = sha256(body); let payload; let schemaError = false; try { payload = JSON.parse(body); } catch { schemaError = true; payload = {}; }
    const rawPlaceCount = Array.isArray(payload?.places) ? payload.places.length : schemaError ? null : 0; const candidates = parseCandidates(payload); const evaluated = candidates.map((candidate) => ({ candidate, identity: evaluateIdentity(control, candidate) })); const verified = evaluated.filter((x) => x.identity.verdict === 'VERIFIED'); const selected = verified.length === 1 ? verified[0] : null; const identityVerdict = verified.length === 1 ? 'VERIFIED' : verified.length > 1 ? 'AMBIGUOUS' : evaluated.some((x) => x.identity.verdict === 'AMBIGUOUS') ? 'AMBIGUOUS' : 'REJECTED'; const branchVerdict = selected ? (selected.identity.signals.locality === 'MATCH' ? 'MATCH' : 'REJECTED') : 'NOT_EVALUATED'; const stage = classifyStage({ httpStatus: response.status, rawPlaceCount, parsedPlaceCount: candidates.length, identityCandidateCount: evaluated.length, identityVerifiedCount: verified.length, identityVerdict, branchVerdict, schemaError });
    results.push({ requestSequence: requestCount, canonicalProspectId: control.prospectId, queryHash: sha256(query), responseHash, httpStatus: response.status, rawPlaceCount, parsedPlaceCount: candidates.length, identityCandidateCount: evaluated.length, identityVerifiedCount: verified.length, identityVerdict, identityReasonCodes: evaluated.flatMap((x) => x.identity.reasonCodes), branchVerdict, branchReasonCodes: branchVerdict === 'REJECTED' ? ['LOCALITY_BRANCH_MISMATCH'] : [], rejectionStage: stage, rejectionReasonCodes: stage === 'VERIFIED' ? [] : [stage], selectedPlaceId: selected?.candidate.id ?? null, googlePhonePresent: Boolean(selected?.candidate.phone), phoneComparison: comparePhone(control.goldPhoneNormalized, selected?.candidate.phone ?? null), websitePresent: Boolean(selected?.candidate.website), acquiredAt: now() });
  }
  const artifact = { validationId: VALIDATION_ID, validationVersion: 'V3', canonicalControlsHash: EXPECTED_SAMPLE_HASH, requestBudget: MAX_REQUESTS, actualRequestCount: requestCount, queryContractVersion: QUERY_CONTRACT_VERSION, identityContractVersion: IDENTITY_CONTRACT_VERSION, observabilitySchemaVersion: OBSERVABILITY_SCHEMA_VERSION, results };
  if (writeArtifact) await fs.writeFile(path.join(root, RESULT_PATH), JSON.stringify(artifact, null, 2) + '\n', 'utf8'); return artifact;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) runValidation().then((a) => console.log(`Google Places V3 validation complete: ${a.actualRequestCount} bounded requests; sanitized artifact written.`)).catch((e) => { console.error(`Google Places V3 validation aborted: ${e.message.replace(/GKEY/gi, 'secret')}`); process.exitCode = 1; });
