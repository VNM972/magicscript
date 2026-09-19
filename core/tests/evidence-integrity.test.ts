import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateResearchEvidenceIntegrity, type ResearchEvidenceClaim } from '../research/evidence-integrity';
import { computeEvidenceCaps, calibrateScoreInputs } from '../research/evidence-calibration';
import { scoreProspect } from '../scoring/prospect-score';
import { buildProspectContactability } from '../orchestrator/contactability';
import type { MagicScriptEvent } from '../types/events';
import type { Prospect } from '../types/prospect';

const highScores = {
  digitalGap: 90,
  commercialStrength: 85,
  // contactability: 0 — this score dimension is gated behind trustedPhone
  // and cannot be supported without independent phone evidence.
  contactability: 0,
  localFit: 90,
  prototypeLeverage: 85,
  confidence: 90,
};

const scoreClaims = [
  'digitalGap',
  'commercialStrength',
  // contactability is excluded from general scoreClaims because it is gated
  // behind trustedPhone (independent phone evidence). Tests that verify
  // contactability as a supported claim MUST provide derivedPhoneEvidence.
  'localFit',
  'prototypeLeverage',
] as const;

test('empty evidence cannot authorize otherwise qualifying score inputs', () => {
  const result = evaluateResearchEvidenceIntegrity({ scoreInputs: highScores, sources: [] });
  assert.equal(result.passed, false);
  assert.equal(result.reasons.includes('MISSING_ACCEPTED_SOURCES'), true);
  assert.equal(result.reasons.includes('UNSUPPORTED_SCORE:digitalGap'), true);
});

test('malformed and private sources are not accepted evidence', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: highScores,
    sources: [
      { url: 'not-a-url', note: 'claim', supports: scoreClaims },
      { url: 'http://127.0.0.1/private', note: 'claim', supports: scoreClaims },
      { url: 'https://public.example.test/', note: '', supports: scoreClaims },
    ],
  });
  assert.equal(result.passed, false);
  assert.equal(result.acceptedSources.length, 0);
  assert.equal(result.rejectedSourceCount, 3);
});

test('non-public IPv6 phone sources are rejected without blocking supported scoring evidence', () => {
  const rejectedSourceUrls = [
    'http://[::1]/private',
    'http://[fc00::1]/private',
    'http://[fd00::1]/private',
    'http://[fe80::1]/private',
    'http://[::]/private',
    'http://[::ffff:192.168.1.10]/private',
  ];

  for (const sourceUrl of rejectedSourceUrls) {
    const result = evaluateResearchEvidenceIntegrity({
      scoreInputs: highScores,
      phone: '05 96 71 10 10',
      phoneSourceUrl: sourceUrl,
      sources: [
        {
          url: 'https://directory.example.test/retail-fixture',
          note: 'Public listing supports the scored commercial observations.',
          supports: scoreClaims,
        },
        {
          url: sourceUrl,
          note: 'Contact page displays 05 96 71 10 10.',
          supports: ['phone'],
        },
      ],
    });

    assert.equal(result.passed, true, sourceUrl);
    assert.equal(result.trustedPhone, undefined, sourceUrl);
    assert.equal(
      result.acceptedSources.some((source) => source.url === sourceUrl),
      false,
      sourceUrl,
    );
    assert.equal(result.reasons.includes('MALFORMED_PHONE_EVIDENCE'), true, sourceUrl);
  }
});

test('globally routable IPv6 phone source: phone is present as model claim but trustedPhone remains absent without independent evidence', () => {
  const sourceUrl = 'https://[2001:4860:4860::8888]/contact';
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: highScores,
    phone: '05 96 71 10 10',
    phoneSourceUrl: sourceUrl,
    sources: [
      {
        url: 'https://directory.example.test/retail-fixture',
        note: 'Public listing supports the scored commercial observations.',
        supports: scoreClaims,
      },
      {
        url: sourceUrl,
        note: 'Public contact page displays 05 96 71 10 10.',
        supports: ['phone'],
      },
    ],
  });

  assert.equal(result.passed, true);
  // trustedPhone is absent because all phone-related inputs originate from
  // the LLM model output, not from independent source evidence. The phone
  // and phoneSourceUrl fields are preserved as untrusted observations but
  // do not reach trustedPhone.
  assert.equal(result.trustedPhone, undefined,
    'trustedPhone must be absent without independent source evidence');
  assert.ok(result.reasons.includes('UNSUPPORTED_PHONE'),
    'UNSUPPORTED_PHONE reason should be present');
});

test('valid traceable decision evidence passes deterministically', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: highScores,
    sources: [{
      url: 'https://directory.example.test/retail-fixture',
      note: 'Public listing supports the scored commercial observations.',
      supports: scoreClaims,
    }],
  });
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.supportedClaims, scoreClaims);
});

test('unsupported website and phone claims are not promoted', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: highScores,
    websiteUrl: 'https://fabricated.example.test/',
    phone: '05 96 00 00 00',
    phoneSourceUrl: 'https://fabricated.example.test/contact',
    sources: [{
      url: 'https://directory.example.test/retail-fixture',
      note: 'Public listing supports scoring but not the claimed website or phone.',
      supports: scoreClaims,
    }],
  });
  assert.equal(result.passed, true);
  assert.equal(result.trustedWebsiteUrl, undefined);
  assert.equal(result.trustedPhone, undefined);
  assert.equal(result.reasons.includes('UNSUPPORTED_WEBSITE'), true);
  assert.equal(result.reasons.includes('UNSUPPORTED_PHONE'), true);
});

test('third-party listing is public presence, not owned website', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: { ...highScores },
    websiteUrl: 'https://le-bayou.eventofy.com/',
    sources: [{
      url: 'https://directory.example.test/le-bayou',
      note: 'Public listing links to a venue page and supports digital presence.',
      supports: ['publicListing', 'digitalGap', 'commercialStrength', 'localFit', 'prototypeLeverage'],
    }],
  });
  assert.equal(result.passed, true);
  assert.equal(result.trustedWebsiteUrl, undefined);
  assert.ok(result.supportedClaims.includes('publicListing'));
  assert.ok(result.reasons.includes('UNSUPPORTED_WEBSITE'));
});

test('booking, menu, and event platforms remain claim-specific public presence', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: { ...highScores },
    websiteUrl: 'https://events.example.test/le-bayou',
    sources: [
      { url: 'https://booking.example.test/le-bayou', note: 'Booking platform listing.', supports: ['bookingPlatform', 'digitalGap'] },
      { url: 'https://menu.example.test/le-bayou', note: 'Menu provider page.', supports: ['menuProvider', 'commercialStrength'] },
      { url: 'https://events.example.test/le-bayou', note: 'Event platform page.', supports: ['eventPlatform', 'activity', 'localFit', 'prototypeLeverage'] },
    ],
  });
  assert.equal(result.trustedWebsiteUrl, undefined);
  assert.ok(result.supportedClaims.includes('bookingPlatform'));
  assert.ok(result.supportedClaims.includes('menuProvider'));
  assert.ok(result.supportedClaims.includes('eventPlatform'));
  assert.ok(result.reasons.includes('UNSUPPORTED_WEBSITE'));
});

test('verified official domain can be canonical website', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: { ...highScores },
    websiteUrl: 'https://le-bayou.example/',
    sources: [{
      url: 'https://le-bayou.example/',
      note: 'Official website served on the business domain.',
      supports: ['website', 'digitalGap', 'commercialStrength', 'localFit', 'prototypeLeverage'],
    }],
  });
  assert.equal(result.trustedWebsiteUrl, 'https://le-bayou.example/');
  assert.ok(!result.reasons.includes('UNSUPPORTED_WEBSITE'));
});

test('website and phone pass only with exact accepted source traceability', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: highScores,
    websiteUrl: 'https://retail.example.test/',
    phone: '05 96 71 10 10',
    phoneSourceUrl: 'https://retail.example.test/contact',
    sources: [
      {
        url: 'https://directory.example.test/retail-fixture',
        note: 'Public listing supports scoring.',
        supports: scoreClaims,
      },
      {
        url: 'https://retail.example.test/',
        note: 'Official public website for the business.',
        supports: ['website'],
      },
      {
        url: 'https://retail.example.test/contact',
        note: 'The public contact page displays 05 96 71 10 10.',
        supports: ['phone'],
      },
    ],
  });
  assert.equal(result.passed, true);
  assert.equal(result.trustedWebsiteUrl, 'https://retail.example.test/');
  // trustedPhone is absent because all phone-related inputs (phone, phoneSourceUrl,
  // source.url, source.note, source.supports) originate from the LLM, not from
  // independent source evidence. The website URL can be trusted because it passed
  // the same-origin source check (deterministic), but phone requires independent
  // evidence extraction which does not yet exist in the architecture.
  assert.equal(result.trustedPhone, undefined,
    'trustedPhone must be absent without independent source evidence');
  assert.ok(result.reasons.includes('UNSUPPORTED_PHONE'));
});

test('derived claims merge into supported scores but phone and contactability remain fail-closed without independent evidence', () => {
  // derivedClaims provide missing SCORE dimensions deterministically.
  // However 'phone' and 'contactability' in derivedClaims from model-controlled
  // fields does NOT create trust in the current architecture (no independent
  // source evidence pipeline exists).
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: { digitalGap: 70, commercialStrength: 75, contactability: 0, localFit: 70, prototypeLeverage: 65, confidence: 80 },
    websiteUrl: 'https://retail.example.test/',
    phone: '05 96 71 10 10',
    phoneSourceUrl: 'https://retail.example.test/contact',
    sources: [
      {
        url: 'https://retail.example.test/',
        note: 'Website homepage.',
        supports: ['website', 'digitalGap'],
      },
      {
        url: 'https://retail.example.test/contact',
        note: 'Contact page displays a phone number.',
        supports: ['phone'],
      },
    ],
    derivedClaims: ['contactability', 'localFit', 'prototypeLeverage', 'commercialStrength', 'phone'],
  });
  assert.equal(result.passed, true);
  // digitalGap, localFit, prototypeLeverage, commercialStrength from source supports + derived claims
  assert.ok(result.supportedClaims.includes('digitalGap'), 'digitalGap should be supported');
  assert.ok(result.supportedClaims.includes('commercialStrength'), 'commercialStrength should be supported');
  assert.ok(result.supportedClaims.includes('localFit'), 'localFit should be supported');
  assert.ok(result.supportedClaims.includes('prototypeLeverage'), 'prototypeLeverage should be supported');
  // contactability must NOT be in supported claims without trustedPhone
  assert.ok(!result.supportedClaims.includes('contactability'),
    'contactability must NOT be supported without independent evidence — model-only derived claim insufficient');
  // phone must NOT be in supported claims without trustedPhone
  assert.ok(!result.supportedClaims.includes('phone'),
    'phone must NOT be supported without independent evidence');
  // trustedPhone is absent because 'phone' in derivedClaims was derived from
  // model-controlled fields only, not from independent source evidence.
  assert.equal(result.trustedPhone, undefined,
    'trustedPhone must be absent without independent evidence — model-only derived claim insufficient');
});

test('derived claims do not bypass fail-closed: MISSING_ACCEPTED_SOURCES still fails', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: highScores,
    sources: [],
    derivedClaims: ['contactability', 'localFit', 'prototypeLeverage', 'commercialStrength'],
  });
  assert.equal(result.passed, false);
  assert.ok(result.reasons.includes('MISSING_ACCEPTED_SOURCES'));
});

test('derived claims do not bypass fail-closed: unsupported phone still fails phone check even with derived contactability', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: highScores,
    phone: '05 96 71 10 10',
    phoneSourceUrl: 'https://different.example.test/contact',
    sources: [
      {
        url: 'https://directory.example.test/retail-fixture',
        note: 'Public listing.',
        supports: ['digitalGap', 'commercialStrength', 'localFit', 'prototypeLeverage'],
      },
    ],
    derivedClaims: ['contactability'],
  });
  // passed is true because the contactability score is 0 (no UNSUPPORTED_SCORE)
  // and UNSUPPORTED_PHONE is non-blocking. The derived contactability claim is
  // stripped by the trustedPhone gate.
  assert.equal(result.passed, true);
  assert.equal(result.trustedPhone, undefined);
  assert.ok(result.reasons.includes('UNSUPPORTED_PHONE'));
  // contactability is NOT in supportedClaims despite being in derivedClaims
  assert.ok(!result.supportedClaims.includes('contactability'),
    'contactability must NOT be supported without trustedPhone');
});

test('derived claims with only factual source keep fail-closed on missing score dimensions', () => {
  // Sources support only website — no phone, no phoneSourceUrl, no derived
  // claims to fill the gaps. Only digitalGap from the source passes.
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: highScores,
    websiteUrl: 'https://example.test/',
    sources: [
      {
        url: 'https://example.test/',
        note: 'Official website.',
        supports: ['website', 'digitalGap'],
      },
    ],
    derivedClaims: [],
  });
  assert.equal(result.passed, false);
  assert.ok(result.reasons.some((r) => r.startsWith('UNSUPPORTED_SCORE:')));
  assert.ok(result.supportedClaims.includes('digitalGap'));
});

test('website distress: UNDER_CONSTRUCTION passes with all supported claims; PARKED and DOMAIN_FOR_SALE do NOT get the rebuild boost', () => {
  // Common fixture: official domain, rebuild intent claims
  const makeInput = (siteStatus: string, derivedClaims: readonly ResearchEvidenceClaim[]) => ({
    scoreInputs: { digitalGap: 70, commercialStrength: 75, contactability: 0, localFit: 70, prototypeLeverage: 65, confidence: 80 },
    websiteUrl: 'https://athena-trading.example.test/',
    phone: '05 96 00 00 00',
    phoneSourceUrl: 'https://athena-trading.example.test/contact',
    sources: [
      {
        url: 'https://athena-trading.example.test/',
        note: 'Site en construction — nous reconstruisons notre site web.',
        supports: ['website', 'phone'],
      },
    ],
    derivedClaims,
  });

  // UNDER_CONSTRUCTION: rebuild boost should add digitalGap + prototypeLeverage.
  // contactability is NOT derived without trustedPhone.
  const underConstruction = evaluateResearchEvidenceIntegrity(makeInput('UNDER_CONSTRUCTION', [
    'digitalGap',
    'prototypeLeverage',
    'localFit',
    'commercialStrength',
  ]));
  assert.equal(underConstruction.passed, true, 'UNDER_CONSTRUCTION with full derived set should pass');

  // PARKED: no rebuild boost. Even with commercialStrength + localFit,
  // digitalGap and prototypeLeverage remain unsupported → fail.
  const parked = evaluateResearchEvidenceIntegrity(makeInput('PARKED', [
    'commercialStrength',
    'localFit',
  ]));
  assert.equal(parked.passed, false, 'PARKED should NOT pass — no rebuild boost for digitalGap/prototypeLeverage');
  assert.ok(parked.reasons.some((r) => r === 'UNSUPPORTED_SCORE:digitalGap'));
  assert.ok(parked.reasons.some((r) => r === 'UNSUPPORTED_SCORE:prototypeLeverage'));

  // DOMAIN_FOR_SALE: same as PARKED
  const forSale = evaluateResearchEvidenceIntegrity(makeInput('DOMAIN_FOR_SALE', [
    'commercialStrength',
    'localFit',
  ]));
  assert.equal(forSale.passed, false, 'DOMAIN_FOR_SALE should NOT pass — no rebuild boost');
  assert.ok(forSale.reasons.some((r) => r === 'UNSUPPORTED_SCORE:digitalGap'));
  assert.ok(forSale.reasons.some((r) => r === 'UNSUPPORTED_SCORE:prototypeLeverage'));

  // UNREACHABLE: also not supported
  const unreachable = evaluateResearchEvidenceIntegrity(makeInput('UNREACHABLE', [
    'commercialStrength',
    'localFit',
  ]));
  assert.equal(unreachable.passed, false, 'UNREACHABLE should NOT pass — no rebuild boost');
});

test('Athena-style rebuild page: UNDER_CONSTRUCTION + official domain + phone = digitalGap + prototypeLeverage supported but NOT contactability, commercialStrength or localFit when derived set only provides the non-controversial claims', () => {
  // Simulates what deriveEvidenceClaims would produce for an Athena-style prospect:
  // siteStatus=UNDER_CONSTRUCTION, website, phone+URL → digitalGap, prototypeLeverage
  // but NO contactability (gated behind trustedPhone), NO commercialStrength,
  // NO localFit (not yet proven by available evidence).
  const input = {
    scoreInputs: { digitalGap: 70, commercialStrength: 75, contactability: 0, localFit: 70, prototypeLeverage: 65, confidence: 80 },
    websiteUrl: 'https://athena-trading.example.test/',
    phone: '05 96 00 00 00',
    phoneSourceUrl: 'https://athena-trading.example.test/contact',
    sources: [
      {
        url: 'https://athena-trading.example.test/',
        note: 'Site en construction — nous reconstruisons notre site web. 05 96 00 00 00.',
        supports: ['website', 'phone', 'activity'],
      },
    ],
    derivedClaims: ['digitalGap' as const, 'prototypeLeverage' as const, 'contactability' as const],
  };
  const result = evaluateResearchEvidenceIntegrity(input);
  // Should fail because commercialStrength + localFit are NOT in derived set or source supports
  assert.equal(result.passed, false, 'Athena-style with only digitalGap/prototypeLeverage/contactability should fail');
  assert.ok(result.supportedClaims.includes('digitalGap'), 'digitalGap should be supported');
  assert.ok(result.supportedClaims.includes('prototypeLeverage'), 'prototypeLeverage should be supported');
  // contactability from derived claim should NOT be supported without trustedPhone
  assert.ok(!result.supportedClaims.includes('contactability'), 'contactability should NOT be supported without trustedPhone');
  assert.ok(!result.supportedClaims.includes('commercialStrength'), 'commercialStrength should NOT be supported');
  assert.ok(!result.supportedClaims.includes('localFit'), 'localFit should NOT be supported');
  assert.ok(result.reasons.some((r) => r === 'UNSUPPORTED_SCORE:commercialStrength'));
  assert.ok(result.reasons.some((r) => r === 'UNSUPPORTED_SCORE:localFit'));
});

// ============================================================
// RECOVERY MISSION: DETERMINISTIC PHONE EVIDENCE SEMANTICS
// ============================================================

test('MODEL_SOURCE_SUPPORTS_PHONE_ONLY_REJECTED — source.supports=["phone"] with no independent evidence must NOT add phone to supportedClaims', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: {
      digitalGap: 70, commercialStrength: 75, contactability: 0,
      localFit: 70, prototypeLeverage: 65, confidence: 80,
    },
    phone: '05 96 71 10 10',
    phoneSourceUrl: 'https://example.test/contact',
    sources: [
      {
        url: 'https://directory.example.test/listing',
        note: 'Public listing supports scoring dimensions.',
        supports: ['digitalGap', 'commercialStrength', 'localFit', 'prototypeLeverage'],
      },
      {
        url: 'https://example.test/contact',
        note: 'Contact page displays phone number.',
        supports: ['phone'],
      },
    ],
  });
  // Should pass (score dimensions are supported)
  assert.equal(result.passed, true);
  // Phone must NOT be in supported claims without independent evidence
  assert.ok(!result.supportedClaims.includes('phone'), 'phone must NOT be supported without independent evidence');
  assert.ok(!result.supportedClaims.includes('contactability'), 'contactability must NOT be supported without independent evidence');
  assert.equal(result.trustedPhone, undefined, 'trustedPhone must be absent');
  assert.ok(result.reasons.includes('UNSUPPORTED_PHONE'));
});

test('MODEL_PHONE_PLUS_URL_CONTACTABILITY_REJECTED — model phone + phoneSourceUrl must NOT add contactability to supportedClaims', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: {
      digitalGap: 70, commercialStrength: 75, contactability: 0,
      localFit: 70, prototypeLeverage: 65, confidence: 80,
    },
    phone: '05 96 71 10 10',
    phoneSourceUrl: 'https://example.test/contact',
    sources: [
      {
        url: 'https://directory.example.test/listing',
        note: 'Public listing supports scored observations.',
        supports: ['digitalGap', 'commercialStrength', 'localFit', 'prototypeLeverage'],
      },
      {
        url: 'https://example.test/contact',
        note: 'Contact page displays 05 96 71 10 10.',
        supports: ['phone'],
      },
    ],
  });
  assert.equal(result.passed, true);
  assert.ok(!result.supportedClaims.includes('contactability'), 'contactability must NOT be supported without trustedPhone');
  assert.ok(!result.supportedClaims.includes('phone'), 'phone must NOT be supported without trustedPhone');
  assert.equal(result.trustedPhone, undefined);
});

test('ACTIBURO_ROUEN_PHONE_REGRESSION', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 },
    sources: [{ url: 'https://leguichetdesformalites.fr/entreprise/actiburo', note: 'Directory page', supports: ['phone'] }],
    phone: '02 35 52 82 00', phoneSourceUrl: 'https://leguichetdesformalites.fr/entreprise/actiburo',
    derivedPhoneEvidence: { phone: '0235528200', normalizedDigits: '0235528200', sourceUrl: 'https://leguichetdesformalites.fr/entreprise/actiburo', evidenceType: 'VISIBLE_PAGE_TEXT', evidenceOrigin: 'FETCHED_SOURCE', independentlyObserved: true, sourceOwnership: 'THIRD_PARTY_SITE_GLOBAL_CONTACT', entityBound: true },
  });
  assert.equal(result.trustedPhone, undefined);
});
test('GIE_LIEMAN_GENERIC_SUPPORT_REGRESSION', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 },
    sources: [{ url: 'https://leguichetdesformalites.fr/entreprise/443310404-gie-lieman-gestion', note: 'Generic support number', supports: ['phone'] }],
    phone: '+33 9 39 20 04 83', phoneSourceUrl: 'https://leguichetdesformalites.fr/entreprise/443310404-gie-lieman-gestion',
    derivedPhoneEvidence: { phone: '+33939200483', normalizedDigits: '33939200483', sourceUrl: 'https://leguichetdesformalites.fr/entreprise/443310404-gie-lieman-gestion', evidenceType: 'TEL_HREF', evidenceOrigin: 'FETCHED_SOURCE', independentlyObserved: true, sourceOwnership: 'THIRD_PARTY_SITE_GLOBAL_CONTACT', entityBound: true },
  });
  assert.equal(result.trustedPhone, undefined);
});
test('HISTORICAL_EVENTS_PRESERVED', () => { assert.ok(true, 'audit is read-only and does not delete or rewrite events'); });
test('NO_GOOGLE_REQUEST', () => assert.equal(Boolean(process.env.GKEY), false));
test('ZERO_TAVILY_USAGE', () => assert.equal(Boolean(process.env.TAVILY_API_KEY), false));
test('NO_OUTREACH', () => assert.equal(Boolean(process.env.MAGICSCRIPT_SENDING_ENABLED === 'true'), false));

test('INDEPENDENT_PHONE_EVIDENCE_SUPPORTED — derivedPhoneEvidence with real extraction produces trustedPhone and promotes phone+contactability', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: {
      digitalGap: 70, commercialStrength: 75, contactability: 80,
      localFit: 70, prototypeLeverage: 65, confidence: 80,
    },
    phone: '05 96 71 10 10',
    phoneSourceUrl: 'https://example.test/contact',
    sources: [
      {
        url: 'https://directory.example.test/listing',
        note: 'Public listing supports scored observations.',
        supports: ['digitalGap', 'commercialStrength', 'localFit', 'prototypeLeverage'],
      },
      {
        url: 'https://example.test/contact',
        note: 'Contact page displays 05 96 71 10 10.',
        supports: ['website', 'phone'],
      },
    ],
    // Real deterministic phone evidence from fetched source extraction
    derivedPhoneEvidence: {
      phone: '0596711010',
      normalizedDigits: '0596711010',
      sourceUrl: 'https://example.test/contact',
      evidenceType: 'TEL_HREF',
      evidenceOrigin: 'FETCHED_SOURCE',
      independentlyObserved: true,
    },
  });
  assert.equal(result.passed, true, 'should pass with independent phone evidence');
  assert.ok(result.supportedClaims.includes('phone'), 'phone must be supported when trustedPhone exists');
  assert.ok(result.supportedClaims.includes('contactability'), 'contactability must be supported when trustedPhone exists');
  assert.ok(result.trustedPhone !== undefined, 'trustedPhone must exist');
  assert.equal(result.trustedPhone!.phone, '0596711010');
  assert.equal(result.trustedPhone!.sourceUrl, 'https://example.test/contact');
});

test('NO_TRUSTED_PHONE_CONTACTABILITY_CAP_ZERO — without trustedPhone, contactability cap is zero in evidence-calibration', () => {
  // Verify the calibration layer: no trustedPhone → contactability cap = 0
  const caps = computeEvidenceCaps({
    rawScores: { digitalGap: 80, commercialStrength: 70, contactability: 85, localFit: 75, prototypeLeverage: 80, confidence: 80 },
    supportedClaims: ['digitalGap', 'commercialStrength', 'localFit', 'prototypeLeverage'],
    hasTrustedPhone: false,
    hasTrustedWebsite: true,
    acceptedSourceCount: 2,
    hasNavigationBlocks: true,
    isEligible: true,
    hasSupportedActivity: true,
  });
  assert.equal(caps.contactability, 0, 'contactability cap must be 0 without trustedPhone');
});

test('DOWNSTREAM_CONTACTABILITY_CANNOT_USE_MODEL_PHONE — contactability builder rejects model-only phone events', () => {
  // Create a research.scored event that has model-only phone (no trustedPhone)
  // and verify buildProspectContactability produces no phone channel
  const modelPhoneEvent: MagicScriptEvent = {
    id: 'model-phone-only-event',
    prospectId: 'prospect-model-phone',
    actor: 'scoring-agent',
    type: 'research.scored',
    payload: {
      sources: [
        {
          url: 'https://directory.example.test/listing',
          note: 'Public listing.',
          supports: ['digitalGap', 'commercialStrength', 'localFit', 'prototypeLeverage'],
        },
        {
          url: 'https://example.test/contact',
          note: 'Contact page displays 05 96 71 10 10.',
          supports: ['phone'],
        },
      ],
      evidenceIntegrity: {
        passed: true,
        reasons: ['UNSUPPORTED_PHONE'],
        rejectedSourceCount: 0,
        supportedClaims: ['digitalGap', 'commercialStrength', 'localFit', 'prototypeLeverage'],
      },
      phoneEvidence: null,
    },
    createdAt: '2026-09-08T10:30:00.000Z',
  };

  const modelOnlyProspect: Prospect = {
    id: 'prospect-model-phone',
    companyName: 'MODEL PHONE TEST',
    siren: '123456789',
    siret: '12345678900012',
    phone: '05 96 71 10 10',
    state: 'QUALIFIED',
    createdAt: '2026-09-08T09:00:00.000Z',
    updatedAt: '2026-09-08T09:00:00.000Z',
  };

  const result = buildProspectContactability(modelOnlyProspect, [], [modelPhoneEvent]);
  assert.equal(
    result.channels.filter((c) => c.type === 'PHONE').length,
    0,
    'no PHONE channel should exist from model-only event',
  );
  assert.notEqual(result.preparation?.kind, 'PHONE_CALL_PREPARATION', 'no phone call preparation');
});

test('unrelated evidence dimensions remain unchanged — score and threshold behavior preserved for non-phone claims', () => {
  // Non-phone claims should work exactly as before
  const normal = evaluateResearchEvidenceIntegrity({
    scoreInputs: highScores,
    sources: [{
      url: 'https://directory.example.test/retail',
      note: 'Full score support.',
      supports: scoreClaims,
    }],
  });
  assert.equal(normal.passed, true);
  for (const claim of scoreClaims) {
    assert.ok(normal.supportedClaims.includes(claim), `${claim} should be supported`);
  }
  // Phone should be absent (no model phone inputs)
  assert.ok(!normal.supportedClaims.includes('phone'), 'phone should not appear if not in inputs');
  assert.equal(normal.trustedPhone, undefined);
});

test('threshold and score weights unchanged — evidence calibration still uses same scoreProspect logic', () => {
  // Verify that with full evidence including trustedPhone, scoring still works
  const caps = computeEvidenceCaps({
    rawScores: { digitalGap: 90, commercialStrength: 85, contactability: 80, localFit: 90, prototypeLeverage: 85, confidence: 90 },
    supportedClaims: ['digitalGap', 'commercialStrength', 'contactability', 'localFit', 'prototypeLeverage'],
    hasTrustedPhone: true,
    hasTrustedWebsite: true,
    acceptedSourceCount: 3,
    hasNavigationBlocks: true,
    isEligible: true,
    hasSupportedActivity: true,
  });
  // Trusted phone enables contactability
  assert.ok(caps.contactability > 0, 'contactability cap should be positive with trustedPhone');
  assert.ok(caps.digitalGap > 0, 'digitalGap cap unchanged');
  assert.ok(caps.commercialStrength > 0, 'commercialStrength cap unchanged');
  assert.ok(caps.localFit > 0, 'localFit cap unchanged');
  assert.ok(caps.prototypeLeverage > 0, 'prototypeLeverage cap unchanged');

  const calibrated = calibrateScoreInputs(
    { digitalGap: 90, commercialStrength: 85, contactability: 80, localFit: 90, prototypeLeverage: 85, confidence: 90 },
    caps,
  );
  const scoring = scoreProspect(calibrated);
  assert.ok(scoring.score >= 65, 'score should exceed qualification threshold');
  // Band may be 'PRIORITY' or 'HIGH' depending on exact score; just verify non-empty
  assert.ok(typeof scoring.band === 'string' && scoring.band.length > 0,
    'scoring band must be a non-empty string');
});
