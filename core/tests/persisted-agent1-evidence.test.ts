import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildAgent1QualifiedEvidence, researchScoredAuthority, type PersistedAgent1Authorities } from '../admission/persisted-agent1-evidence';
import { projectAgent1EvidenceToContactOpportunityPackV2 } from '../admission/agent1-evidence-projection';
import { decidePackIcp } from '../icp/icp-decision';
import { classifySourceType } from '../contact-acquisition/agent';
import { extractOperatingEvidence } from '../research/operating-evidence';
import { extractDigitalPainEvidence } from '../research/digital-pain-evidence';

const source = { url: 'https://lebon.example/', note: 'Bounded fetched homepage', supports: ['website', 'digitalGap'] as const };
const observedPage = (url: string, html: string) => ({ url, html, snapshotDigest: `sha256:${createHash('sha256').update(html).digest('hex')}` });
const pain = extractDigitalPainEvidence([source], [observedPage(source.url, '<title>Site en construction</title>')]);
function authorities(overrides: Partial<PersistedAgent1Authorities> = {}): PersistedAgent1Authorities {
  return {
    prospect: { id: 'p1', companyName: 'Le Bon Restaurant', city: 'Fort-de-France', location: 'Martinique', state: 'QUALIFIED' },
    latestResearchRun: { status: 'SUCCEEDED', result: {} },
    scoredEvidence: { acceptedSources: [source], supportedClaims: ['website', 'digitalGap'], trustedWebsiteUrl: source.url, digitalPainSignals: ['Site en construction'], digitalPainEvidence: pain, evidenceIntegrityPassed: true },
    validatedContacts: [{ email: 'hello@lebon.example', sourceUrl: 'https://lebon.example/contact', isValidated: true, isSuppressed: false }],
    commercialFamily: 'RESTAURANTS_BARS_CAFES',
    ...overrides,
  };
}

test('qualified restaurant with grounded pain and validated email projects', () => {
  const result = buildAgent1QualifiedEvidence(authorities());
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') assert.equal(result.evidence.contacts[0]?.channel, 'EMAIL');
});

test('a failed research run remains blocked even with legacy QUALIFIED state', () => {
  const result = buildAgent1QualifiedEvidence(authorities({ latestResearchRun: { status: 'FAILED' } }));
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status === 'INSUFFICIENT_EVIDENCE') assert.ok(result.reasons.some((reason) => reason.code === 'RESEARCH_NOT_SUCCEEDED'));
});

test('legacy DISQUALIFIED scores 64 and 0 cannot veto complete persisted V2 evidence', () => {
  for (const score of [64, 0]) {
    const result = buildAgent1QualifiedEvidence(authorities({ prospect: { ...authorities().prospect, state: 'DISQUALIFIED', score } }));
    assert.equal(result.status, 'PROJECTABLE', `score ${score}`);
    if (result.status !== 'PROJECTABLE') continue;
    assert.equal(result.evidence.qualified, false);
    const projection = projectAgent1EvidenceToContactOpportunityPackV2(result.evidence);
    assert.equal(projection.status, 'PROJECTABLE', `score ${score}`);
    if (projection.status === 'PROJECTABLE') {
      assert.equal(projection.pack.schemaVersion, 'CONTACT_OPPORTUNITY_PACK_V2');
      assert.equal(decidePackIcp(projection.pack).outcome, 'ADMIT');
    }
  }
});

test('high legacy score never overrides missing explicit persisted V2 evidence', () => {
  const base = authorities();
  const high = { ...base.prospect, score: 100 };
  const cases = [
    { code: 'DIGITAL_PAIN_UNPROVEN', input: authorities({ prospect: high, scoredEvidence: { ...base.scoredEvidence, digitalPainSignals: ['Narrative'], digitalPainEvidence: undefined } }) },
    { code: 'COMMERCIAL_FAMILY_UNRESOLVED', input: authorities({ prospect: high, commercialFamily: undefined }) },
    { code: 'WEBSITE_STATUS_UNVERIFIED', input: authorities({ prospect: high, scoredEvidence: { ...base.scoredEvidence, trustedWebsiteUrl: undefined } }) },
    { code: 'OPERATING_MODEL_UNRESOLVED', input: authorities({ prospect: { ...high, activity: '55.20Z' }, commercialFamily: 'LOCAL_SERVICES' }) },
    { code: 'RESEARCH_EVIDENCE_MISSING', input: authorities({ prospect: high, scoredEvidence: { ...base.scoredEvidence, acceptedSources: [] } }) },
  ];
  for (const { code, input } of cases) {
    const result = buildAgent1QualifiedEvidence(input);
    assert.equal(result.status, 'INSUFFICIENT_EVIDENCE', code);
    if (result.status === 'INSUFFICIENT_EVIDENCE') assert.ok(result.reasons.some((reason) => reason.code === code), code);
  }
});

test('do-not-contact state and suppressed email remain closed without a qualifying V2 channel', () => {
  const base = authorities();
  const opposed = buildAgent1QualifiedEvidence(authorities({ prospect: { ...base.prospect, state: 'DO_NOT_CONTACT', score: 100 } }));
  assert.equal(opposed.status, 'INSUFFICIENT_EVIDENCE');
  if (opposed.status === 'INSUFFICIENT_EVIDENCE') assert.ok(opposed.reasons.some((reason) => reason.code === 'CONTACT_EVIDENCE_UNVALIDATED'));

  const suppressed = buildAgent1QualifiedEvidence(authorities({
    validatedContacts: [{ ...base.validatedContacts[0]!, isSuppressed: true }],
    scoredEvidence: { ...base.scoredEvidence, contactPresence: { email: { status: 'VERIFIED', values: ['hello@lebon.example'], evidence: [{ value: 'hello@lebon.example', sourceUrl: 'https://lebon.example/contact' }] } } },
  }));
  assert.equal(suppressed.status, 'PROJECTABLE');
  if (suppressed.status === 'PROJECTABLE') {
    assert.equal(suppressed.evidence.contacts.length, 0);
    const projection = projectAgent1EvidenceToContactOpportunityPackV2(suppressed.evidence);
    assert.equal(projection.status, 'PROJECTABLE');
    if (projection.status === 'PROJECTABLE') assert.equal(decidePackIcp(projection.pack).outcome, 'NEEDS_CONTACT_DISCOVERY');
  }
});

test('website authority distinguishes present, missing, explicit absence, and unreachable', () => {
  const present = buildAgent1QualifiedEvidence(authorities());
  assert.equal(present.status, 'PROJECTABLE');
  if (present.status === 'PROJECTABLE') assert.equal(present.evidence.research.website?.status, 'VERIFIED_PRESENT');
  const missing = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: { ...authorities().scoredEvidence, trustedWebsiteUrl: undefined, supportedClaims: ['digitalGap'], acceptedSources: [source] } }));
  assert.equal(missing.status, 'INSUFFICIENT_EVIDENCE');
  const absentSource = { url: 'https://research.example/no-site', note: 'Bounded directory and domain research found no official site', supports: ['websiteAbsent', 'digitalGap'] as const };
  const absent = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: { ...authorities().scoredEvidence, acceptedSources: [absentSource], supportedClaims: ['websiteAbsent', 'digitalGap'], trustedWebsiteUrl: undefined, websiteAbsent: true } }));
  assert.equal(absent.status, 'INSUFFICIENT_EVIDENCE');
  const unreachable = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: { ...authorities().scoredEvidence, acceptedSources: [{ ...source, supports: ['digitalGap'] }], supportedClaims: ['digitalGap'], trustedWebsiteUrl: undefined } }));
  assert.equal(unreachable.status, 'INSUFFICIENT_EVIDENCE');
});

test('trusted mobile is MOBILE, landline is not, and untrusted phone is omitted', () => {
  const base = authorities().scoredEvidence;
  const mobile = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: { ...base, supportedClaims: ['website', 'digitalGap', 'phone'], trustedPhone: { phone: '06 96 00 00 00', normalizedDigits: '0696000000', sourceUrl: source.url, evidenceType: 'VISIBLE_PAGE_TEXT', evidenceOrigin: 'FETCHED_SOURCE', independentlyObserved: true } } }));
  assert.equal(mobile.status, 'PROJECTABLE');
  if (mobile.status === 'PROJECTABLE') assert.ok(mobile.evidence.contacts.some((contact) => contact.channel === 'MOBILE'));
  const landline = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: { ...base, supportedClaims: ['website', 'digitalGap', 'phone'], trustedPhone: { phone: '05 96 51 12 36', normalizedDigits: '0596511236', sourceUrl: source.url, evidenceType: 'VISIBLE_PAGE_TEXT', evidenceOrigin: 'FETCHED_SOURCE', independentlyObserved: true } } }));
  assert.equal(landline.status, 'PROJECTABLE');
  if (landline.status === 'PROJECTABLE') assert.ok(!landline.evidence.contacts.some((contact) => contact.channel === 'MOBILE'));
});

test('persisted D1 prospects.activity is canonical NAF authority for retail', () => {
  for (const activity of ['47.19B', '47.78A']) {
    const result = buildAgent1QualifiedEvidence(authorities({
      prospect: { ...authorities().prospect, activity },
      commercialFamily: undefined,
    }));
    assert.equal(result.status, 'PROJECTABLE');
    if (result.status === 'PROJECTABLE') assert.equal(result.evidence.classification.commercialFamily, 'LOCAL_RETAIL');
  }
});

test('explicit persisted absence and scored claims survive the authority loader', () => {
  const absentSource = { url: 'https://www.facebook.com/lebon', note: 'Accepted first-party profile', supports: ['websiteAbsent', 'digitalGap'] as const };
  const absentEvidence = extractDigitalPainEvidence([absentSource], [observedPage(absentSource.url, "<title>Le Bon Restaurant | Facebook</title><main>Le Bon Restaurant Fort-de-France. Nous n'avons pas de site internet.</main>")], { companyName: 'Le Bon Restaurant', city: 'Fort-de-France' });
  const result = buildAgent1QualifiedEvidence({
    ...authorities(),
    scoredEvidence: researchScoredAuthority({
      sources: [absentSource],
      websiteAbsent: true,
      primaryFriction: 'No clear conversion path',
      digitalPainEvidence: absentEvidence,
      evidenceIntegrity: { passed: true, supportedClaims: ['websiteAbsent', 'digitalGap', 'primaryFriction'] },
    }),
  });
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') {
    assert.equal(result.evidence.research.website?.status, 'VERIFIED_ABSENT');
    assert.deepEqual(result.evidence.research.digitalPainSignals, [absentEvidence.observations[0]?.observation]);
  }
});

test('explicit outside-ICP foundation evidence survives the authority loader', () => {
  const result = buildAgent1QualifiedEvidence({
    ...authorities(),
    scoredEvidence: researchScoredAuthority({
      sources: [source],
      outsideCommercialIcp: true,
      evidenceIntegrity: { passed: true, supportedClaims: ['website', 'digitalGap'] },
      websiteUrl: source.url,
      digitalPainEvidence: pain,
      primaryFriction: 'No clear conversion path',
    }),
  });
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') {
    const projected = projectAgent1EvidenceToContactOpportunityPackV2(result.evidence);
    assert.equal(projected.status, 'PROJECTABLE');
    if (projected.status === 'PROJECTABLE') assert.equal(decidePackIcp(projected.pack).outcome, 'REJECT');
  }
});

test('NAF 55.20Z remains fail-closed without operating-model evidence', () => {
  const result = buildAgent1QualifiedEvidence(authorities({ prospect: { ...authorities().prospect, activity: '55.20Z' }, commercialFamily: 'LOCAL_SERVICES' }));
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
});

test('nested VERIFIED contact presence survives loader and canonical email validation', () => {
  const result = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: {
    ...authorities().scoredEvidence,
    contactPresence: {
      website: { status: 'VERIFIED', values: ['https://sintorin.example'] },
      email: { status: 'VERIFIED', values: ['contact@sintorin.com'] },
    },
    evidenceIntegrityPassed: true,
    supportedClaims: ['website', 'digitalGap'],
  }}));
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') {
    assert.equal(result.evidence.research.website?.url, 'https://sintorin.example');
    assert.ok(result.evidence.contacts.some((contact) => contact.value === 'contact@sintorin.com'));
  }
});

function schemeLessWebsite(value: string, sources: PersistedAgent1Authorities['scoredEvidence']['acceptedSources'], status = 'VERIFIED') {
  const base = authorities();
  const owned = sources.find((item) => item.url === 'https://www.example.com/');
  return buildAgent1QualifiedEvidence(authorities({ scoredEvidence: {
    ...base.scoredEvidence,
    trustedWebsiteUrl: undefined,
    acceptedSources: sources,
    digitalPainEvidence: owned ? extractDigitalPainEvidence(sources, [observedPage(owned.url, '<title>Site en construction</title>')]) : undefined,
    contactPresence: { website: { status, values: [value] } },
  } }));
}

const acceptedOwnedSource = { url: 'https://www.example.com/', note: 'Accepted owned homepage', supports: ['website', 'digitalGap'] as const };

test('VERIFIED scheme-less website recovers the accepted owned origin', () => {
  const result = schemeLessWebsite('www.example.com', [acceptedOwnedSource]);
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') assert.equal(result.evidence.research.website?.url, 'https://www.example.com/');
});

test('accepted homepage and contact page on one host yield the site origin', () => {
  const result = schemeLessWebsite('www.example.com', [
    acceptedOwnedSource,
    { url: 'https://www.example.com/contact', note: 'Accepted contact page', supports: ['website'] },
  ]);
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') assert.equal(result.evidence.research.website?.url, 'https://www.example.com/');
});

test('scheme-less registry host cannot recover owned website authority', () => {
  const result = schemeLessWebsite('annuaire-entreprises.data.gouv.fr', [
    { url: 'https://annuaire-entreprises.data.gouv.fr/', note: 'Accepted registry', supports: ['website'] },
  ]);
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status === 'INSUFFICIENT_EVIDENCE') assert.ok(result.reasons.some((reason) => reason.code === 'WEBSITE_STATUS_UNVERIFIED'));
});

test('scheme-less website with no accepted sources ignores presence sourceUrl', () => {
  const base = authorities();
  const result = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: {
    ...base.scoredEvidence,
    trustedWebsiteUrl: undefined,
    acceptedSources: [],
    contactPresence: { website: { status: 'VERIFIED', values: ['www.example.com'], evidence: [{ value: 'www.example.com', sourceUrl: 'https://www.example.com/' }] } },
  } }));
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status === 'INSUFFICIENT_EVIDENCE') assert.ok(result.reasons.some((reason) => reason.code === 'WEBSITE_STATUS_UNVERIFIED'));
});

test('UNKNOWN scheme-less website does not recover accepted owned source', () => {
  const result = schemeLessWebsite('www.example.com', [acceptedOwnedSource], 'UNKNOWN');
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status === 'INSUFFICIENT_EVIDENCE') assert.ok(result.reasons.some((reason) => reason.code === 'WEBSITE_STATUS_UNVERIFIED'));
});

test('incompatible accepted owned origins for a scheme-less host fail closed', () => {
  const result = schemeLessWebsite('www.example.com', [
    acceptedOwnedSource,
    { url: 'http://www.example.com/', note: 'Conflicting accepted origin', supports: ['website'] },
  ]);
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status === 'INSUFFICIENT_EVIDENCE') assert.ok(result.reasons.some((reason) => reason.code === 'WEBSITE_AUTHORITY_CONFLICT'));
});

test('UNKNOWN contact presence and unaccepted friction remain fail-closed', () => {
  const result = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: {
    ...authorities().scoredEvidence,
    contactPresence: { website: { status: 'UNKNOWN', values: ['https://fake.example'] }, email: { status: 'UNKNOWN', values: ['bad@example.com'] } },
    evidenceIntegrityPassed: false,
    digitalPainSignals: ['unsupported claim'],
    supportedClaims: ['website'],
  }}));
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
});

test('accepted scored site notice reaches the existing pain adapter with provenance', () => {
  const scoredSource = { url: 'https://lebon.example/', note: 'Accepted homepage', supports: ['website', 'digitalGap'] as const };
  const digitalPainEvidence = extractDigitalPainEvidence([scoredSource], [observedPage(scoredSource.url, '<h1>Site en construction</h1>')]);
  const scored = researchScoredAuthority({
    sources: [scoredSource], websiteUrl: scoredSource.url,
    evidenceIntegrity: { passed: true, supportedClaims: ['website', 'digitalGap'] },
    digitalPainEvidence,
  });
  assert.equal(scored.digitalPainEvidence?.status, 'VERIFIED');
  assert.equal(scored.digitalPainEvidence?.observations[0]?.sourceUrl, scoredSource.url);
  const result = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: scored }));
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') assert.deepEqual(result.evidence.research.digitalPainSignals, ['Site en construction']);
});

test('empty scored pain evidence keeps the existing adapter fail-closed', () => {
  const scored = researchScoredAuthority({ sources: [source], evidenceIntegrity: { passed: true, supportedClaims: ['website', 'digitalGap'] }, digitalPainEvidence: { status: 'UNKNOWN', observations: [] } });
  const result = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: scored }));
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status === 'INSUFFICIENT_EVIDENCE') assert.ok(result.reasons.some((reason) => reason.code === 'DIGITAL_PAIN_UNPROVEN'));
});

test('narrative, generic label, support label and legacy numeric score have zero V2 pain authority', () => {
  const variants = [
    { primaryFriction: 'Le site convertit mal' },
    { digitalPain: 'digitalGap' },
    { scoreInputs: { digitalGap: 100 } },
    { primaryFriction: 'Le site convertit mal', digitalPain: 'digitalGap', scoreInputs: { digitalGap: 100 } },
  ];
  for (const variant of variants) {
    const event = JSON.parse(JSON.stringify({
      sources: [source], websiteUrl: source.url,
      evidenceIntegrity: { passed: true, supportedClaims: ['website', 'digitalGap', 'primaryFriction'] },
      ...variant,
    }));
    const scored = researchScoredAuthority(event);
    assert.equal(scored.digitalPainEvidence?.status, 'UNKNOWN');
    assert.equal(scored.digitalPainSignals, undefined);
    const adapted = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: scored }));
    assert.equal(adapted.status, 'INSUFFICIENT_EVIDENCE');
    if (adapted.status === 'INSUFFICIENT_EVIDENCE') assert.ok(adapted.reasons.some((reason) => reason.code === 'DIGITAL_PAIN_UNPROVEN'));
  }
});

test('scored rebuilding observation retains provenance through authority, adapter and projection', () => {
  const evidence = extractDigitalPainEvidence([source], [observedPage(source.url, '<h1>Notre site est en cours de refonte</h1>')]);
  const event = JSON.parse(JSON.stringify({ sources: [source], websiteUrl: source.url,
    evidenceIntegrity: { passed: true, supportedClaims: ['website'] }, digitalPainEvidence: evidence }));
  const scored = researchScoredAuthority(event);
  assert.equal(scored.digitalPainEvidence?.observations[0]?.snapshotDigest, evidence.observations[0]?.snapshotDigest);
  const adapted = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: scored }));
  assert.equal(adapted.status, 'PROJECTABLE');
  if (adapted.status === 'PROJECTABLE') {
    assert.equal(adapted.evidence.research.digitalPainEvidence?.observations[0]?.type, 'REBUILDING');
    assert.equal(projectAgent1EvidenceToContactOpportunityPackV2(adapted.evidence).status, 'PROJECTABLE');
  }
});

test('verified absence and professional-site assessment conflict fails closed', () => {
  const profile = { url: 'https://www.facebook.com/lebon', note: 'First-party business profile', supports: ['websiteAbsent'] as const };
  const evidence = extractDigitalPainEvidence([profile], [observedPage(profile.url, "<title>Le Bon Restaurant | Facebook</title><main>Fort-de-France. Nous n'avons pas de site internet.</main>")], { companyName: 'Le Bon Restaurant', city: 'Fort-de-France' });
  const scored = researchScoredAuthority({ sources: [profile], evidenceIntegrity: { passed: true, supportedClaims: ['websiteAbsent'] }, digitalPainEvidence: evidence, websiteQuality: { isProfessional: true } });
  const adapted = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: scored }));
  assert.equal(adapted.status, 'INSUFFICIENT_EVIDENCE');
  if (adapted.status === 'INSUFFICIENT_EVIDENCE') assert.ok(adapted.reasons.some((reason) => reason.code === 'WEBSITE_AUTHORITY_CONFLICT'));
});

test('registry authority is not an owned website but remains classified for identity/activity', () => {
  assert.equal(classifySourceType('https://annuaire-entreprises.data.gouv.fr/entreprise/x'), 'REGISTRY');
  const result = buildAgent1QualifiedEvidence(authorities({ scoredEvidence: {
    ...authorities().scoredEvidence,
    contactPresence: { website: { status: 'VERIFIED', values: ['https://annuaire-entreprises.data.gouv.fr/entreprise/x'] } },
    supportedClaims: ['digitalGap'],
  }}));
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
});

test('adapter, projector and ICP remain canonical end to end', () => {
  const result = buildAgent1QualifiedEvidence(authorities());
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') {
    const pack = projectAgent1EvidenceToContactOpportunityPackV2(result.evidence);
    assert.equal(pack.status, 'PROJECTABLE');
    if (pack.status === 'PROJECTABLE') assert.equal(decidePackIcp(pack.pack).outcome, 'ADMIT');
  }
});

const serviceSource = { url: 'https://service.example/', note: 'Accepted owned activity page', supports: ['activity', 'website', 'digitalGap'] as const };

function serviceAuthorities(html: string, overrides: Partial<PersistedAgent1Authorities> = {}): PersistedAgent1Authorities {
  const operatingEvidence = extractOperatingEvidence([serviceSource], [{ url: serviceSource.url, html }]);
  const digitalPainEvidence = extractDigitalPainEvidence([serviceSource], [observedPage(serviceSource.url, '<title>Site en construction</title>')]);
  const scoredEvidence = researchScoredAuthority({
    sources: [serviceSource], websiteUrl: serviceSource.url, operatingEvidence, digitalPainEvidence,
    primaryFriction: 'No clear quote CTA',
    evidenceIntegrity: { passed: true, supportedClaims: ['activity', 'website', 'digitalGap'] },
  });
  return authorities({
    prospect: { ...authorities().prospect, companyName: 'Example', state: 'DISQUALIFIED', score: 0 },
    commercialFamily: undefined,
    scoredEvidence,
    ...overrides,
  });
}

test('electrical service survives extraction, scored authority, adapter and pack projection', () => {
  const input = serviceAuthorities('<h1>Installation électrique</h1>');
  assert.deepEqual(input.scoredEvidence.operatingEvidence?.facts[0], {
    kind: 'SERVICE_TYPE', value: 'ELECTRICAL_INSTALLATION', sourceUrl: serviceSource.url,
    evidenceType: 'OWNED_PAGE_TEXT', sourceType: 'OWNED_WEBSITE', integrityStatus: 'ACCEPTED', supportingText: 'Installation électrique',
  });
  const adapted = buildAgent1QualifiedEvidence(input);
  assert.equal(adapted.status, 'PROJECTABLE');
  if (adapted.status !== 'PROJECTABLE') return;
  assert.equal(adapted.evidence.classification.commercialFamily, 'LOCAL_SERVICES');
  const projected = projectAgent1EvidenceToContactOpportunityPackV2(adapted.evidence);
  assert.equal(projected.status, 'PROJECTABLE');
  if (projected.status === 'PROJECTABLE') {
    assert.equal(projected.pack.opportunity.icp?.commercialFamily, 'LOCAL_SERVICES');
    assert.ok(projected.pack.evidence?.some((item) => item.url === serviceSource.url));
  }
});

test('other explicitly supported service archetypes resolve from accepted owned facts', () => {
  for (const html of [
    '<h1>Auto-école et formation à la conduite</h1>',
    '<h1>Photographe mariage et photographie événementielle</h1>',
    '<h1>Installation et maintenance de climatisation</h1>',
    '<h1>Paysagiste et élagage</h1>',
  ]) {
    const result = buildAgent1QualifiedEvidence(serviceAuthorities(html));
    assert.equal(result.status, 'PROJECTABLE', html);
    if (result.status === 'PROJECTABLE') assert.equal(result.evidence.classification.commercialFamily, 'LOCAL_SERVICES', html);
  }
});

test('corporate photography, generic services and unsupported service remain unresolved', () => {
  for (const html of ['<h1>Photographie corporate</h1>', '<h1>Nos services</h1>', '<h1>Expertise comptable</h1>']) {
    const result = buildAgent1QualifiedEvidence(serviceAuthorities(html));
    assert.equal(result.status, 'INSUFFICIENT_EVIDENCE', html);
    if (result.status === 'INSUFFICIENT_EVIDENCE') assert.ok(result.reasons.some((reason) => reason.code === 'COMMERCIAL_FAMILY_UNRESOLVED'), html);
  }
});

test('registry NAF 43.21A, company name and high score cannot invent LOCAL_SERVICES', () => {
  const base = authorities();
  const result = buildAgent1QualifiedEvidence(authorities({
    prospect: { ...base.prospect, companyName: 'Electricite Example', activity: '43.21A', score: 100 },
    commercialFamily: undefined,
    scoredEvidence: {
      ...base.scoredEvidence,
      acceptedSources: [{ url: 'https://annuaire-entreprises.data.gouv.fr/entreprise/123', note: 'Registry activity', supports: ['activity'] }],
      operatingEvidence: { status: 'UNKNOWN', facts: [] },
    },
  }));
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status === 'INSUFFICIENT_EVIDENCE') assert.ok(result.reasons.some((reason) => reason.code === 'COMMERCIAL_FAMILY_UNRESOLVED'));
});

test('service family uses persisted scored facts, never raw model, name, NAF or score', () => {
  for (const score of [0, 100]) {
    const input = serviceAuthorities('<h1>Installation électrique</h1>', { prospect: { ...authorities().prospect, companyName: 'Unrelated Name', activity: '43.21A', state: 'DISQUALIFIED', score } });
    const positive = buildAgent1QualifiedEvidence(input);
    assert.equal(positive.status, 'PROJECTABLE', `score ${score}`);
    if (positive.status === 'PROJECTABLE') assert.equal(positive.evidence.classification.commercialFamily, 'LOCAL_SERVICES');
    const missing = buildAgent1QualifiedEvidence({ ...input, scoredEvidence: { ...input.scoredEvidence, operatingEvidence: { status: 'UNKNOWN', facts: [] } } });
    assert.equal(missing.status, 'INSUFFICIENT_EVIDENCE', `score ${score}`);
    if (missing.status === 'INSUFFICIENT_EVIDENCE') assert.ok(missing.reasons.some((reason) => reason.code === 'COMMERCIAL_FAMILY_UNRESOLVED'));
  }
});

test('retail NAF and explicit specialized families precede general service evidence', () => {
  const input = serviceAuthorities('<h1>Installation électrique</h1>');
  for (const family of ['RESTAURANTS_BARS_CAFES', 'BEAUTY_HAIR_BARBER'] as const) {
    const result = buildAgent1QualifiedEvidence({ ...input, commercialFamily: family });
    assert.equal(result.status, 'PROJECTABLE');
    if (result.status === 'PROJECTABLE') assert.equal(result.evidence.classification.commercialFamily, family);
  }
  const retail = buildAgent1QualifiedEvidence({ ...input, prospect: { ...input.prospect, activity: '47.78C' } });
  assert.equal(retail.status, 'PROJECTABLE');
  if (retail.status === 'PROJECTABLE') assert.equal(retail.evidence.classification.commercialFamily, 'LOCAL_RETAIL');
});

test('owned Restaurant schema and conflicting service facts cannot be flattened to LOCAL_SERVICES', () => {
  const restaurant = serviceAuthorities(`<script type="application/ld+json">{"@context":"https://schema.org","@type":"Restaurant","url":"${serviceSource.url}","serviceType":"Electrical installation"}</script><h1>Restaurant</h1>`);
  const rejectedRestaurant = buildAgent1QualifiedEvidence(restaurant);
  assert.equal(rejectedRestaurant.status, 'INSUFFICIENT_EVIDENCE');
  if (rejectedRestaurant.status === 'INSUFFICIENT_EVIDENCE') assert.ok(rejectedRestaurant.reasons.some((reason) => reason.code === 'COMMERCIAL_FAMILY_UNRESOLVED'));

  const conflicting = serviceAuthorities(`<script type="application/ld+json">{"@context":"https://schema.org","@type":"ProfessionalService","url":"${serviceSource.url}","serviceType":"Accounting"}</script><h1>Installation électrique</h1>`);
  const rejectedConflict = buildAgent1QualifiedEvidence(conflicting);
  assert.equal(rejectedConflict.status, 'INSUFFICIENT_EVIDENCE');
  if (rejectedConflict.status === 'INSUFFICIENT_EVIDENCE') assert.ok(rejectedConflict.reasons.some((reason) => reason.code === 'COMMERCIAL_FAMILY_UNRESOLVED'));
});

test('service family does not erase independent DIGITAL_PAIN_UNPROVEN', () => {
  const input = serviceAuthorities('<h1>Installation électrique</h1>');
  const result = buildAgent1QualifiedEvidence({ ...input, scoredEvidence: { ...input.scoredEvidence, digitalPainSignals: ['Narrative'], digitalPainEvidence: undefined, supportedClaims: ['activity', 'website'] } });
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status === 'INSUFFICIENT_EVIDENCE') {
    assert.ok(result.reasons.some((reason) => reason.code === 'DIGITAL_PAIN_UNPROVEN'));
    assert.ok(!result.reasons.some((reason) => reason.code === 'COMMERCIAL_FAMILY_UNRESOLVED'));
  }
});
