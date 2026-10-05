import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.ts';

const persistedAuthorities = {
  prospect: { id: 'shadow-1', companyName: 'Restaurant Shadow', city: 'Fort-de-France', location: 'Martinique', state: 'DISQUALIFIED', score: 64 },
  latestResearchRun: { status: 'SUCCEEDED', result: {} },
  scoredEvidence: {
    acceptedSources: [{ url: 'https://shadow.example/', note: 'Fetched source', supports: ['website', 'digitalGap'] }],
    supportedClaims: ['website', 'digitalGap'],
    trustedWebsiteUrl: 'https://shadow.example/',
    digitalPainSignals: ['MISSING_CTA'],
    evidenceIntegrityPassed: true,
  },
  validatedContacts: [{ email: 'hello@shadow.example', sourceUrl: 'https://shadow.example/contact', isValidated: true, isSuppressed: false }],
  commercialFamily: 'RESTAURANTS_BARS_CAFES',
};
const shadowEnv = {
  MAGICSCRIPT_API_TOKEN: 'shadow-token',
};

test('shadow qualification projects and never invokes admission or production', async () => {
  const response = await worker.fetch(new Request('https://local.test/api/v2/qualification/shadow', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer shadow-token' },
    body: JSON.stringify({ authorities: persistedAuthorities }),
  }), shadowEnv);
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json();
  assert.equal(body.shadow, true);
  assert.equal(body.status, 'PROJECTABLE');
  assert.equal(body.icp.outcome, 'ADMIT');
  assert.equal(body.pack.schemaVersion, 'CONTACT_OPPORTUNITY_PACK_V2');
});

test('shadow qualification rejects incomplete evidence without DB', async () => {
  const response = await worker.fetch(new Request('https://local.test/api/v2/qualification/shadow', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer shadow-token' },
    body: JSON.stringify({ authorities: { ...persistedAuthorities, scoredEvidence: { ...persistedAuthorities.scoredEvidence, trustedWebsiteUrl: undefined } } }),
  }), shadowEnv);
  assert.equal(response.status, 422, await response.clone().text());
  const body = await response.json();
  assert.equal(body.shadow, true);
  assert.equal(body.status, 'INSUFFICIENT_EVIDENCE');
  assert.ok(body.reasons.some((reason) => reason.code === 'WEBSITE_STATUS_UNVERIFIED'));
});

test('shadow projection ignores legacy qualification flags but preserves explicit evidence blockers', async () => {
  const request = (evidence) => new Request('https://local.test/api/v2/qualification/shadow', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer shadow-token' },
    body: JSON.stringify(evidence),
  });
  const projected = await worker.fetch(request({ authorities: persistedAuthorities }), shadowEnv);
  assert.equal(projected.status, 200, await projected.clone().text());
  assert.equal((await projected.json()).status, 'PROJECTABLE');

  const incomplete = { ...persistedAuthorities, prospect: { ...persistedAuthorities.prospect, state: 'QUALIFIED', score: 100 }, scoredEvidence: { ...persistedAuthorities.scoredEvidence, digitalPainSignals: [] } };
  const blocked = await worker.fetch(request({ authorities: incomplete }), shadowEnv);
  assert.equal(blocked.status, 422);
  const body = await blocked.json();
  assert.ok(body.reasons.some((reason) => reason.code === 'DIGITAL_PAIN_UNPROVEN'));
  assert.ok(!body.reasons.some((reason) => reason.code === 'QUALIFICATION_NOT_COMPLETE'));
});
