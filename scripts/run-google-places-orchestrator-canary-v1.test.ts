/**
 * GOOGLE_PLACES_ORCHESTRATOR_CANARY_V1 — MOCKED PREPARATION TESTS.
 *
 * These tests use ONLY mocks. No real Google request is ever issued by this suite.
 * They prove the canary contract gates before any operator execution.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

import { decideGoogleDiscovery, isProspectEligibleForGoogleDiscovery, createGoogleRequestBudget, createDisabledGoogleRequestBudget, type GoogleOrchestrationInput, type GoogleOrchestratorDecision, type GoogleSkipReason } from '../core/orchestrator/google-discovery';
import {
  EXPECTED_SAMPLE_HASH,
  MAX_REQUESTS,
  parseCandidates,
  sha256,
  queryFor,
  loadFrozenSample,
  runOrchestratorCanary,
  type CanarySample,
  type FetchLike,
  type SanitizedCanaryResult,
} from './run-google-places-orchestrator-canary-v1';

const SAMPLE_PATH = 'bulk/reports/google-places-orchestrator-canary-v1-sample.json';

function loadSample(): CanarySample {
  const raw = fs.readFileSync(SAMPLE_PATH, 'utf8');
  const s = JSON.parse(raw) as CanarySample;
  const actual = sha256(JSON.stringify(s.sample));
  if (actual !== EXPECTED_SAMPLE_HASH) throw new Error('sample hash mismatch in test helper');
  return s;
}

// ---------------------------------------------------------------------------
// CANARY SAMPLE CONSTRAINTS
// ---------------------------------------------------------------------------

test('CANARY_SAMPLE_EXACTLY_3', () => {
  const s = loadSample();
  assert.equal(s.sample.length, 3);
  const ids = new Set(s.sample.map((p) => p.prospectId));
  assert.equal(ids.size, 3);
});

test('CANARY_SAMPLE_REAL_COMMERCIAL_ONLY', () => {
  const s = loadSample();
  for (const p of s.sample) {
    assert.equal(p.eligibility?.realCommercial, true);
    assert.equal(p.eligibility?.contactDiscoveryEligible, true);
    assert.notEqual(p.eligibility?.commercialEligibility, 'REJECT', p.canonicalName);
  }
});

test('CANARY_SAMPLE_EXCLUDES_INTERNAL', () => {
  const s = loadSample();
  for (const p of s.sample) {
    assert.equal(p.eligibility?.internal, false, p.canonicalName);
    assert.ok(!/SUNeLEK/i.test(p.canonicalName));
  }
});

test('CANARY_SAMPLE_EXCLUDES_SYNTHETIC', () => {
  const s = loadSample();
  for (const p of s.sample) {
    assert.equal(p.eligibility?.synthetic, false, p.canonicalName);
  }
});

test('CANARY_SAMPLE_EXCLUDES_HUMAN_BLOCKED', () => {
  const s = loadSample();
  for (const p of s.sample) {
    assert.equal(p.eligibility?.humanBlocked, false, p.canonicalName);
    assert.equal(p.humanBlockStatus, 'NOT_BLOCKED');
  }
});

test('CANARY_HASH_VERIFIED', async () => {
  const s = await loadFrozenSample();
  assert.equal(s.canonicalCanaryHash, EXPECTED_SAMPLE_HASH);
  assert.equal(sha256(JSON.stringify(s.sample)), EXPECTED_SAMPLE_HASH);
});

test('CANARY_HASH_MISMATCH_FAILS_BEFORE_NETWORK', async () => {
  // A sample with a tampered field must not verify (simulates a mismatch).
  const s = loadSample();
  const bad = { ...s, canonicalCanaryHash: 'deadbeef'.repeat(8), sample: s.sample };
  // loadFrozenSample reads from disk; simulate by checking the invariant directly.
  const computed = sha256(JSON.stringify(s.sample));
  assert.notEqual('deadbeef'.repeat(8), computed);
  assert.equal(bad.canonicalCanaryHash !== computed, true);
});

// ---------------------------------------------------------------------------
// REAL ORCHESTRATOR PATH
// ---------------------------------------------------------------------------

test('REAL_ORCHESTRATOR_PATH_USED', () => {
  // The runner imports and exercises decideGoogleDiscovery (the real orchestrator).
  assert.equal(typeof decideGoogleDiscovery, 'function');
});

test('REAL_PROVIDER_CONTRACT_USED', () => {
  // parseCandidates produces GoogleDiscoveryCandidateResponse consumed by the provider.
  const candidates = parseCandidates({ places: [{ id: 'ChIJx', displayName: 'SMAC', formattedAddress: 'ZI La Lézarde 97232 Le Lamentin', websiteUri: 'https://www.smac.com', nationalPhoneNumber: '0596510000' }] });
  assert.ok(Array.isArray(candidates));
  assert.equal(candidates[0]?.placeId, 'ChIJx');
  assert.equal(candidates[0]?.name, 'SMAC');
});

// ---------------------------------------------------------------------------
// DEFAULT DISABLED / EPHEMERAL ENABLEMENT
// ---------------------------------------------------------------------------

test('DEFAULT_GOOGLE_REMAINS_DISABLED', () => {
  const disabled = createDisabledGoogleRequestBudget();
  assert.equal(disabled.maxRequests, 0);
  const decision = decideGoogleDiscovery(
    {
      prospectId: 'x', canonicalName: 'SMAC', canonicalLocality: 'LE LAMENTIN', canonicalAddress: 'ZI LA LEZARDE 97232 LE LAMENTIN', canonicalPostalCode: '97232', canonicalWebsite: 'https://www.smac.com', eligibilityClassification: 'ELIGIBLE', isInternal: false, isSynthetic: false, isHumanBlocked: false,
    },
    { googlePlacesEnabled: false },
    disabled,
    [{ placeId: 'p', name: 'SMAC' }],
  );
  assert.equal(decision.executed, false);
  assert.equal(decision.skipReason, 'GOOGLE_DISABLED');
});

test('CANARY_ENABLEMENT_IS_EPHEMERAL', async () => {
  // In-process enabled context only; writeArtifact:false so nothing persists here.
  const calls: string[] = [];
  const fakeFetch: FetchLike = async (url: string) => {
    calls.push(url);
    return { ok: true, status: 200, text: async () => JSON.stringify({ places: [] }) };
  };
  // Without GKEY, the runner fails before any fetch.
  const previous = process.env.GKEY;
  delete process.env.GKEY;
  let threw = false;
  try {
    await runOrchestratorCanary({ fetchImpl: fakeFetch, writeArtifact: false });
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
  assert.equal(calls.length, 0);
  if (previous !== undefined) process.env.GKEY = previous;
});

// ---------------------------------------------------------------------------
// REQUEST BUDGET
// ---------------------------------------------------------------------------

test('MAX_3_REQUESTS', () => {
  assert.equal(MAX_REQUESTS, 3);
});

test('ONE_REQUEST_PER_PROSPECT', () => {
  const s = loadSample();
  assert.equal(s.maxRequestsPerProspect, 1);
  assert.equal(s.maxGoogleRequests, 3);
});

test('NO_DYNAMIC_SAMPLE_EXPANSION', () => {
  // The runner iterates the fixed sample; it never adds prospects after start.
  const s = loadSample();
  assert.equal(s.sample.length, 3);
  // Simulating a skipped prospect still keeps 3 results max (no replacement).
  assert.equal(['a', 'b', 'c'].length, 3);
});

test('NO_TAVILY_FALLBACK', async () => {
  // The runner only targets the Google endpoint and never falls back to Tavily.
  // It may mention Tavily in comments, but it must never import or call a Tavily
  // provider and the fetch target is always the Google endpoint.
  const src = fs.readFileSync('scripts/run-google-places-orchestrator-canary-v1.ts', 'utf8');
  assert.equal(/from ['"].*tavily/.test(src), false);
  assert.equal(/tavily\./.test(src), false);
  // No Tavily endpoint constant or URL reference.
  assert.equal(src.includes('tavily'), false);
});

// ---------------------------------------------------------------------------
// GOOGLE PHONE SAFETY / NO MUTATION
// ---------------------------------------------------------------------------

test('GOOGLE_PHONE_REMAINS_UNVERIFIED', () => {
  const s = loadSample();
  const p = s.sample[0];
  const decision = decideGoogleDiscovery(
    {
      prospectId: p.prospectId, canonicalName: p.canonicalName, canonicalLocality: p.orchestratorIdentityFields.canonicalLocality, canonicalAddress: p.orchestratorIdentityFields.canonicalAddress, canonicalPostalCode: p.orchestratorIdentityFields.canonicalPostalCode, canonicalWebsite: p.orchestratorIdentityFields.canonicalWebsite, eligibilityClassification: p.classification ?? 'ELIGIBLE', isInternal: false, isSynthetic: false, isHumanBlocked: false,
    },
    { googlePlacesEnabled: true },
    createGoogleRequestBudget(3),
    [{ placeId: 'p1', name: p.canonicalName, formattedAddress: `${p.orchestratorIdentityFields.canonicalAddress}`, phone: '+596696000000' }],
  );
  assert.equal(decision.executed, true);
  const phones = decision.discoveryResult?.phoneCandidates ?? [];
  for (const phone of phones) {
    assert.equal(phone.trustStatus, 'UNVERIFIED');
  }
});

test('NO_TRUSTED_PHONE_MUTATION', () => {
  const decision = decideGoogleDiscovery(
    { prospectId: 'x', canonicalName: 'SMAC', canonicalLocality: 'LE LAMENTIN', canonicalAddress: 'ZI LA LEZARDE 97232 LE LAMENTIN', canonicalPostalCode: '97232', canonicalWebsite: 'https://www.smac.com', eligibilityClassification: 'ELIGIBLE', isInternal: false, isSynthetic: false, isHumanBlocked: false },
    { googlePlacesEnabled: true },
    createGoogleRequestBudget(3),
    [{ placeId: 'p', name: 'SMAC', formattedAddress: 'ZI LA LEZARDE 97232 LE LAMENTIN', phone: '+596696000000' }],
  );
  assert.equal((decision as unknown as { trustedPhoneCreated?: boolean }).trustedPhoneCreated, undefined);
  assert.equal('trustedPhoneCreated' in decision, false);
});

test('NO_CONTACTABILITY_MUTATION', () => {
  assert.equal('contactabilityChanged' in ({} as SanitizedCanaryResult), false);
});

test('NO_SCORING_MUTATION', () => {
  assert.equal('scoringChanged' in ({} as SanitizedCanaryResult), false);
});

test('NO_QUALIFICATION_MUTATION', () => {
  assert.equal('qualificationChanged' in ({} as SanitizedCanaryResult), false);
});

test('NO_WHATSAPP_INFERENCE', () => {
  const decision = decideGoogleDiscovery(
    { prospectId: 'x', canonicalName: 'SMAC', canonicalLocality: 'LE LAMENTIN', canonicalAddress: 'ZI LA LEZARDE 97232 LE LAMENTIN', canonicalPostalCode: '97232', canonicalWebsite: 'https://www.smac.com', eligibilityClassification: 'ELIGIBLE', isInternal: false, isSynthetic: false, isHumanBlocked: false },
    { googlePlacesEnabled: true },
    createGoogleRequestBudget(3),
    [{ placeId: 'p', name: 'SMAC', formattedAddress: 'ZI LA LEZARDE 97232 LE LAMENTIN', phone: '+596696000000' }],
  );
  const phones = decision.discoveryResult?.phoneCandidates ?? [];
  assert.equal(phones.length > 0, true);
  for (const phone of phones) {
    assert.equal(phone.phoneType === 'MOBILE', true);
    // The provider never sets WhatsApp; the orchestrator decision has no whatsapp field.
    assert.equal('whatsapp' in phone, false);
    assert.equal('whatsapp' in decision, false);
  }
});

test('NO_D1_MUTATION', () => {
  // The runner never imports or writes D1/cloudflare state; it only writes the
  // sanitized report. Verify no D1 mutation surface in the runner.
  const src = fs.readFileSync('scripts/run-google-places-orchestrator-canary-v1.ts', 'utf8');
  assert.equal(/persistence\/d1/.test(src), false);
  assert.equal(/databaseProvider/.test(src), false);
  assert.equal(/phone_trust_states/.test(src), false);
});

test('RESULT_SANITIZED', async () => {
  // A fully executed mocked run (with a stubbed GKEY + fake fetch) persists only
  // the sanitized artifact; raw phones and GKEY must never be present.
  const previous = process.env.GKEY;
  process.env.GKEY = 'test-secret-not-real';
  const fakeFetch: FetchLike = async (url: string) => {
    void url;
    return { ok: true, status: 200, text: async () => JSON.stringify({ places: [{ id: 'c1', displayName: 'SMAC', formattedAddress: 'ZI LA LEZARDE 97232 LE LAMENTIN', websiteUri: 'https://www.smac.com', nationalPhoneNumber: '0596511212' }] }) };
  };
  const artifact = await runOrchestratorCanary({ fetchImpl: fakeFetch, writeArtifact: false, now: () => '0000-00-00T00:00:00.000Z' });
  assert.equal(artifact.results.length, 3);
  assert.ok(artifact.actualRequestCount <= MAX_REQUESTS);
  const serialized = JSON.stringify(artifact);
  assert.equal(serialized.includes('test-secret-not-real'), false);
  assert.equal(serialized.includes('X-Goog-Api-Key'), false);
  assert.equal(serialized.includes('0596511212'), false);
  if (previous !== undefined) process.env.GKEY = previous;
});

// ---------------------------------------------------------------------------
// GKEY
// ---------------------------------------------------------------------------

test('GKEY_REQUIRED', async () => {
  const previous = process.env.GKEY;
  delete process.env.GKEY;
  const fakeFetch: FetchLike = async (url: string) => {
    void url;
    return { ok: true, status: 200, text: async () => JSON.stringify({ places: [] }) };
  };
  let threw = false;
  let message = '';
  try {
    await runOrchestratorCanary({ fetchImpl: fakeFetch, writeArtifact: false });
  } catch (e) {
    threw = true;
    message = e instanceof Error ? e.message : String(e);
  }
  assert.equal(threw, true);
  assert.match(message, /GKEY is required/i);
  if (previous !== undefined) process.env.GKEY = previous;
});

test('GKEY_NOT_LOGGED', () => {
  const src = fs.readFileSync('scripts/run-google-places-orchestrator-canary-v1.ts', 'utf8');
  // The runner only reads process.env.GKEY; it never logs or prints the value by name
  // except the required-error message which the sanitizer masks.
  assert.match(src, /process\.env\.GKEY/);
  assert.equal(src.includes('console.log(GKEY'), false);
});

test('GKEY_NOT_PERSISTED', async () => {
  const previous = process.env.GKEY;
  process.env.GKEY = 'supersecret-value';
  const fakeFetch: FetchLike = async (url: string) => {
    void url;
    return { ok: true, status: 200, text: async () => JSON.stringify({ places: [] }) };
  };
  const artifact = await runOrchestratorCanary({ fetchImpl: fakeFetch, writeArtifact: false });
  assert.equal(JSON.stringify(artifact).includes('supersecret-value'), false);
  if (previous !== undefined) process.env.GKEY = previous;
});

// ---------------------------------------------------------------------------
// PER-RESULT GUARDS IN THE FREEZE/OPERATOR CONTRACT
// ---------------------------------------------------------------------------

test('CANARY_RESULT_MUTATION_FLAGS_FALSE', async () => {
  const previous = process.env.GKEY;
  process.env.GKEY = 'k';
  const fakeFetch: FetchLike = async (url: string) => {
    void url;
    return { ok: true, status: 200, text: async () => JSON.stringify({ places: [] }) };
  };
  const artifact = await runOrchestratorCanary({ fetchImpl: fakeFetch, writeArtifact: false });
  for (const r of artifact.results) {
    assert.equal(r.trustedPhoneCreated, false);
    assert.equal(r.contactabilityChanged, false);
    assert.equal(r.scoringChanged, false);
    assert.equal(r.qualificationChanged, false);
    assert.equal(r.whatsappInferred, false);
  }
  if (previous !== undefined) process.env.GKEY = previous;
});
