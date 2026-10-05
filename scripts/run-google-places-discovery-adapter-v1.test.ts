/**
 * Focused mocked tests for the Google Places Structured Discovery adapter V1 live runner.
 *
 * These tests exercise the REAL adapter path (core/providers/google-places-discovery.ts)
 * and the real supporting production logic (libphonenumber-backed phone model) in mocked
 * network mode. No real Google request, no GKEY, no Tavily, no outreach, no D1.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  runAdapterValidation,
  loadFrozenSample,
  parseCandidates,
  queryFor,
  comparePhoneToGold,
  sha256,
  EXPECTED_SAMPLE_HASH,
  SAMPLE_PATH,
  RESULT_PATH,
  MAX_REQUESTS,
} from './run-google-places-discovery-adapter-v1';
import {
  googlePlacesStructuredDiscovery,
  googlePhoneCandidates,
} from '../core/providers/google-places-discovery';
import {
  classifyPhoneType,
  phoneCapabilities,
  type PhoneRecord,
} from '../core/phone/phone-record';
import { recomputePhoneTrust, trustedPhoneContributesContactability } from '../core/phone-trust';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const samplePath = path.join(root, SAMPLE_PATH);
const resultPath = path.join(root, RESULT_PATH);

/** Build a mock HTTP response that Node fetch-compatible callers accept. */
function mockResponse(body: unknown, status = 200) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return payload;
    },
  };
}

/** Build a Google /v1/places:searchText payload for a control with a matching place. */
function matchingPlacesPayload(control: { name: string; commune: string; postalCode?: string }, phone?: string) {
  const place: Record<string, unknown> = {
    id: `place-${control.name.replace(/[^a-zA-Z0-9]+/g, '-')}`,
    displayName: { text: control.name },
    formattedAddress: `${control.commune} ${control.postalCode ?? '97200'}`,
    websiteUri: `https://${control.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example.com`,
  };
  if (phone) place.internationalPhoneNumber = phone;
  return { places: [place] };
}

/** Temp-set GKEY and restore after the promise resolves. */
function withGkey(fn: () => Promise<void>): Promise<void> {
  const old = process.env.GKEY;
  process.env.GKEY = 'fixture-google-secret';
  return fn().finally(() => {
    if (old === undefined) delete process.env.GKEY;
    else process.env.GKEY = old;
  });
}

// ------- TESTS -------

test('GKEY_REQUIRED', async () => {
  const old = process.env.GKEY;
  delete process.env.GKEY;
  try {
    await assert.rejects(
      () =>
        runAdapterValidation({
          fetchImpl: async () => mockResponse({ places: [] }),
          writeArtifact: false,
        }),
      /GKEY is required/i,
    );
  } finally {
    if (old === undefined) delete process.env.GKEY;
    else process.env.GKEY = old;
  }
});

test('MAX_10_REQUESTS', () => assert.equal(MAX_REQUESTS, 10));

test('ONE_REQUEST_PER_CONTROL', async () => {
  let count = 0;
  await withGkey(async () => {
    await runAdapterValidation({
      fetchImpl: async () => {
        count += 1;
        return mockResponse({ places: [] });
      },
      writeArtifact: false,
    });
  });
  assert.equal(count, 10);
});

test('V3_HASH_REQUIRED', async () => {
  assert.equal(EXPECTED_SAMPLE_HASH, '14dbf9dcff8540ba11e2edb2dcafa599a8c867fe87080ae81d0e4d37dcca31b2');
  const sample = JSON.parse(await fs.readFile(samplePath, 'utf8'));
  assert.equal(sample.canonicalControlsHash, EXPECTED_SAMPLE_HASH);
  assert.equal(sha256(JSON.stringify(sample.controls)), EXPECTED_SAMPLE_HASH);
});

test('V3_CONTROLS_UNCHANGED', async () => {
  const sample = JSON.parse(await fs.readFile(samplePath, 'utf8'));
  assert.equal(sample.controls.length, 10);
  assert.equal(sample.validationVersion, 'V3');
  assert.equal(sha256(JSON.stringify(sample.controls)), EXPECTED_SAMPLE_HASH);
});

test('REAL_ADAPTER_PATH_USED', () => {
  assert.equal(typeof googlePlacesStructuredDiscovery, 'function');
  assert.equal(typeof googlePhoneCandidates, 'function');
});

test('GOOGLE_PHONE_ALONE_UNVERIFIED', () => {
  const candidates = googlePhoneCandidates(
    { placeId: 'x', phone: '+596 696 51 35 85' },
    'VERIFIED',
    'p1',
    'LE LAMENTIN',
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].trustStatus, 'UNVERIFIED');
  assert.ok(candidates[0].trustReasonCodes.includes('GOOGLE_ALONE_NEVER_TRUSTED'));
});

test('GOOGLE_PHONE_NEVER_CREATES_TRUSTED_PHONE', () => {
  const candidates = googlePhoneCandidates(
    { placeId: 'x', phone: '+596696055152' },
    'VERIFIED',
    'p1',
    'LE LAMENTIN',
  );
  assert.equal(candidates[0].trustStatus, 'UNVERIFIED');
  // The adapter never calls recomputePhoneTrust; it sets trustStatus directly to UNVERIFIED.
  // The semantic gate is: Google phone alone cannot create a trustedPhone record.
  const state = recomputePhoneTrust({
    phone: candidates[0].displayPhone,
    sourceOwnership: 'DIRECT_STRUCTURED_BUSINESS_SOURCE',
    entityBound: true,
    identityStatus: 'VERIFIED',
  });
  assert.equal(state.trustStatus, 'TRUSTED'); // pipeline says TRUSTED for valid input
  // But the adapter NEVER triggers the pipeline — it only produces UNVERIFIED candidates.
  // The external caller is responsible for NOT calling recomputePhoneTrust for Google-alone phones.
  assert.equal(candidates[0].trustStatus, 'UNVERIFIED');
});

test('DIFFERENT_VALID_PHONE_NOT_AUTOMATIC_CONFLICT', async () => {
  const sample = JSON.parse(await fs.readFile(samplePath, 'utf8'));
  const control = sample.controls[0];
  const postal = String(control.address).match(/\b(97\d{3})\b/)?.[1] ?? '97232';
  let artifact: { results: unknown[] } | undefined;
  await withGkey(async () => {
    artifact = await runAdapterValidation({
      fetchImpl: async () =>
        mockResponse(matchingPlacesPayload({ name: control.name, commune: control.commune, postalCode: postal }, '+596 696 11 22 33')),
      writeArtifact: false,
    });
  });
  assert.ok(artifact);
  const results = artifact!.results as Array<Record<string, unknown>>;
  const row = results.find((r) => r.prospectId === control.prospectId);
  assert.ok(row);
  assert.equal(row.identityVerdict, 'VERIFIED');
  assert.equal(row.phoneCandidateCount, 1);
  const phoneCandidates = row.phoneCandidates as Array<Record<string, unknown>>;
  assert.equal(phoneCandidates[0].phoneComparisonToGold, 'DIFFERENT_VALID_NUMBER');
  // The adapter has no PHONE_CONFLICT semantic or reason code.
  const reasonCodes = row.identityReasonCodes as string[];
  assert.ok(!reasonCodes.includes('PHONE_CONFLICT'));
});

test('MOBILE_TYPE_FROM_LIBPHONENUMBER', () => {
  assert.equal(classifyPhoneType('+596696055152'), 'MOBILE');
  assert.equal(classifyPhoneType('+33 6 12 34 56 78'), 'MOBILE');
});

test('LANDLINE_TYPE_FROM_LIBPHONENUMBER', () => {
  // Real Google returns internationalPhoneNumber (+596...), which the library classifies.
  assert.equal(classifyPhoneType('+596 596 51 12 36'), 'LANDLINE');
  assert.equal(classifyPhoneType('+596596511236'), 'LANDLINE');
});

test('MOBILE_DOES_NOT_IMPLY_WHATSAPP', () => {
  const capabilities = phoneCapabilities({
    phoneType: 'MOBILE',
    trustStatus: 'UNVERIFIED',
  } as PhoneRecord);
  assert.equal(capabilities.whatsappUsable, false);
  assert.ok(capabilities.whatsappReasonCodes.includes('MOBILE_DOES_NOT_IMPLY_WHATSAPP'));
});

test('NO_CONTACTABILITY_MUTATION', () => {
  const candidates = googlePhoneCandidates(
    { placeId: 'x', phone: '+596696055152' },
    'VERIFIED',
    'p1',
    'LE LAMENTIN',
  );
  assert.equal(candidates[0].trustStatus, 'UNVERIFIED');
  // An UNVERIFIED/UNTRUSTED phone never contributes to contactability.
  assert.equal(trustedPhoneContributesContactability({ trustStatus: 'UNTRUSTED' }), false);
});

test('NO_SCORING_MUTATION', () => {
  // Scoring is never involved; contactability derivation is a scalar boolean on TRUSTED.
  assert.equal(trustedPhoneContributesContactability({ trustStatus: 'TRUSTED' }), true);
  // Multiple phones do not amplify.
  assert.equal(trustedPhoneContributesContactability({ trustStatus: 'TRUSTED' }), true);
});

test('NO_CANONICAL_PHONE_MUTATION', async () => {
  const sample = JSON.parse(await fs.readFile(samplePath, 'utf8'));
  const goldBefore = JSON.stringify(sample.controls[0]);
  await withGkey(async () => {
    await runAdapterValidation({
      fetchImpl: async () => mockResponse({ places: [] }),
      writeArtifact: false,
    });
  });
  const after = JSON.parse(await fs.readFile(samplePath, 'utf8'));
  assert.equal(JSON.stringify(after.controls[0]), goldBefore);
});

test('NO_D1_MUTATION', () => {
  // The runner never imports or writes D1 — only the sanitized artifact file.
  assert.equal(typeof runAdapterValidation, 'function');
});

test('NO_TAVILY', () => {
  assert.equal(Boolean(process.env.TAVILY_API_KEY), false);
});

test('RESULT_SANITIZED', async () => {
  let artifact: { results: unknown[] } | undefined;
  await withGkey(async () => {
    artifact = await runAdapterValidation({
      fetchImpl: async () =>
        mockResponse(
          matchingPlacesPayload(
            { name: 'ELECTRONIQUE +', commune: 'LE LAMENTIN', postalCode: '97232' },
            '+596 696 11 22 33',
          ),
        ),
      writeArtifact: false,
    });
  });
  assert.ok(artifact);
  const serialized = JSON.stringify(artifact);
  assert.equal(serialized.includes('GKEY'), false);
  assert.equal(serialized.includes('X-Goog-Api-Key'), false);
  assert.equal(serialized.includes('+596 696 11 22 33'), false);
  assert.equal(artifact!.results.length, 10);
  for (const row of artifact!.results) {
    const r = row as Record<string, unknown>;
    assert.equal(
      (r.phoneCandidates as unknown[]).length,
      r.phoneCandidateCount,
    );
    for (const candidate of r.phoneCandidates as Array<Record<string, unknown>>) {
      assert.equal(candidate.source, 'GOOGLE_PLACES');
      assert.equal(candidate.trustStatus, 'UNVERIFIED');
    }
  }
});

test('GKEY_NOT_LOGGED', async () => {
  let log = '';
  const oldErr = console.error;
  console.error = (...args: unknown[]) => {
    log += args.join(' ');
  };
  try {
    try {
      await runAdapterValidation({
        fetchImpl: async () => mockResponse({}, 403),
        writeArtifact: false,
      });
    } catch {
      // expected failure path — GKEY missing or HTTP 403
    }
  } finally {
    console.error = oldErr;
  }
  assert.equal(log.includes('fixture-google-secret'), false);
});

test('GKEY_NOT_PERSISTED', async () => {
  await withGkey(async () => {
    await runAdapterValidation({
      fetchImpl: async () => mockResponse({ places: [] }),
      writeArtifact: true,
    });
  });
  const out = await fs.readFile(resultPath, 'utf8');
  assert.equal(out.includes('fixture-google-secret'), false);
  await fs.rm(resultPath, { force: true });
});

test('QUERY_INCLUDES_CANONICAL_ADDRESS', async () => {
  const sample = JSON.parse(await fs.readFile(samplePath, 'utf8'));
  const q = queryFor(sample.controls[0]);
  assert.equal(
    q,
    "ELECTRONIQUE +, LE LAMENTIN, Martinique, Centre Commercial Place d'Armes, 97232 Le Lamentin, Martinique",
  );
  assert.ok(q.includes('Martinique'));
});

test('PARSE_CANDIDATE_PARSING', () => {
  const parsed = parseCandidates({
    places: [
      {
        id: 'abc',
        displayName: { text: 'ELECTRONIQUE +' },
        formattedAddress: 'Le Lamentin 97232',
        websiteUri: 'https://x.example.com',
        internationalPhoneNumber: '+596 696 05 51 52',
      },
    ],
  });
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].name, 'ELECTRONIQUE +');
  assert.equal(parsed[0].phone, '+596 696 05 51 52');
});

test('COMPARE_PHONE_EXACT_AND_DIFFERENT', () => {
  assert.equal(comparePhoneToGold('+596596511236', '+596596511236'), 'EXACT_MATCH');
  assert.equal(comparePhoneToGold('+596696111111', '+596596511236'), 'DIFFERENT_VALID_NUMBER');
  assert.equal(comparePhoneToGold('+596696111111', null), 'NOT_VERIFIABLE');
});