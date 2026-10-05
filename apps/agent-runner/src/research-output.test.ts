import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeResearchResult } from './research-output';
import { createHash } from 'node:crypto';
import { enrichResearchResultWithOperatingEvidence } from './operating-evidence';
import { evaluateResearchEvidenceIntegrity } from '../../../core/research/evidence-integrity';
import { acceptedDigitalPainEvidence, extractDigitalPainEvidence, type DigitalPainEvidence } from '../../../core/research/digital-pain-evidence';

const prospect = {
  id: 'p1',
  companyName: 'Entreprise test',
  activity: 'Activité vérifiée',
  location: 'Martinique',
  websiteUrl: 'https://example.test',
  opportunity: 'B',
  state: 'DISCOVERED',
} as const;

test('normalizes a navigation array without inventing research scores', () => {
  const result = normalizeResearchResult(
    [{ label: 'Accueil', kind: 'navigation' }],
    prospect,
  );

  assert.equal(result.opportunity, 'B');
  assert.deepEqual(result.sourceNavigationBlocks, [
    { label: 'Accueil', kind: 'navigation' },
  ]);
  assert.deepEqual(result.scoreInputs, {
    digitalGap: 0,
    commercialStrength: 0,
    contactability: 0,
    localFit: 0,
    prototypeLeverage: 0,
    confidence: 0,
  });
  assert.equal((result.researchNormalization as { safeScoring: boolean }).safeScoring, true);
});

test('normalizes brand asset evidence without accepting local file URLs', () => {
  const result = normalizeResearchResult(
    {
      brandAsset: {
        status: 'OFFICIAL_LOGO_FOUND',
        sourceUrl: 'https://example.test/brand',
        assetUrl: 'file:///C:/private/logo.svg',
        reuseDecision: 'REUSE_IF_RIGHTS_CLEAR',
        note: 'Logo visible sur la page officielle.',
      },
    },
    prospect,
  );

  assert.deepEqual(result.brandAsset, {
    status: 'OFFICIAL_LOGO_FOUND',
    reuseDecision: 'REUSE_IF_RIGHTS_CLEAR',
    sourceUrl: 'https://example.test/brand',
    note: 'Logo visible sur la page officielle.',
  });
});

test('preserves complete scores and clamps them to the contract range', () => {
  const result = normalizeResearchResult(
    {
      scoreInputs: {
        digitalGap: 110,
        commercialStrength: 80,
        contactability: 0,
        localFit: 40,
        prototypeLeverage: 20,
        confidence: 90,
      },
      primaryCta: 'Découvrir',
      sources: [{ url: 'https://example.test/', note: 'Explicit local fit evidence.', supports: ['localFit'] }],
    },
    prospect,
  );

  assert.deepEqual(result.scoreInputs, {
    digitalGap: 100,
    commercialStrength: 80,
    contactability: 0,
    localFit: 40,
    prototypeLeverage: 20,
    confidence: 90,
  });
  assert.equal(result.primaryCta, 'Découvrir');
});


test('model-only phone and contactability remain absent from canonical output', () => {
  const result = normalizeResearchResult(
    {
      phone: '05 96 71 10 10',
      phoneSourceUrl: 'https://example.test/contact',
      scoreInputs: {
        digitalGap: 0,
        commercialStrength: 0,
        contactability: 100,
        localFit: 0,
        prototypeLeverage: 0,
        confidence: 90,
      },
    },
    prospect,
  );

  assert.equal(result.phone, undefined);
  assert.equal(result.phoneSourceUrl, undefined);
  assert.equal((result.scoreInputs as Record<string, number>).contactability, 0);
});

test('preserves public listing semantics without turning it into owned website', () => {
  const result = normalizeResearchResult(
    {
      websiteUrl: 'https://le-bayou.eventofy.com/',
      sources: [{
        url: 'https://directory.example.test/le-bayou',
        note: 'Public listing for venue presence.',
        supports: ['publicListing', 'bookingPlatform', 'menuProvider', 'eventPlatform', 'digitalGap', 'website'],
      }],
    },
    prospect,
  );

  assert.equal(result.websiteUrl, 'https://le-bayou.eventofy.com/');
  assert.deepEqual(result.sources, [{
    url: 'https://directory.example.test/le-bayou',
    note: 'Public listing for venue presence.',
    supports: ['publicListing', 'bookingPlatform', 'menuProvider', 'eventPlatform', 'digitalGap', 'website'],
  }]);
});

test('preserves explicit claim mappings on well-formed public sources', () => {
  const result = normalizeResearchResult(
    {
      sources: [{
        url: 'https://directory.example.test/business',
        note: 'The listing visibly supports the business location and activity.',
        supports: ['location', 'activity', 'location'],
      }],
    },
    prospect,
  );

  assert.deepEqual(result.sources, [{
    url: 'https://directory.example.test/business',
    note: 'The listing visibly supports the business location and activity.',
    supports: ['location', 'activity'],
  }]);
});

test('drops sources that have no traceable claim mapping', () => {
  const result = normalizeResearchResult(
    {
      sources: [
        { url: 'https://example.test/', note: 'Generic model prose.' },
        { url: 'file:///private/result.txt', note: 'Local artifact.', supports: ['digitalGap'] },
      ],
    },
    prospect,
  );

  assert.deepEqual(result.sources, []);
});

test('does NOT inject phone into source note — model claim must not manufacture evidence', () => {
  const result = normalizeResearchResult(
    {
      phone: '05 96 71 10 10',
      phoneSourceUrl: 'https://example.test/contact',
      sources: [
        {
          url: 'https://example.test/',
          note: 'Site internet officiel.',
          supports: ['website', 'digitalGap'],
        },
        {
          url: 'https://example.test/contact',
          note: 'Page de contact.',
          supports: ['phone'],
        },
      ],
    },
    prospect,
  );

  const sources = Array.isArray(result.sources)
    ? (result.sources as Array<{ url: string; note: string }>)
    : [];
  const contactSource = sources.find(
    (s) => s.url === 'https://example.test/contact',
  );
  assert.ok(contactSource, 'contact source should exist');
  // The source note must NOT contain the phone digits. The phone value is a
  // model claim and must not be injected into evidence.
  assert.equal(contactSource.note, 'Page de contact.',
    'source note should NOT contain injected phone digits');
  // Website source note should NOT be modified
  const websiteSource = sources.find(
    (s) => s.url === 'https://example.test/',
  );
  assert.equal(websiteSource?.note, 'Site internet officiel.');
});

test('siteStatus is normalized from case-insensitive values', () => {
  const result = normalizeResearchResult(
    {
      siteStatus: 'Under Construction',
      sources: [],
    },
    prospect,
  );
  assert.equal(result.siteStatus, 'UNDER_CONSTRUCTION');
});

test('siteStatus defaults to UNKNOWN when absent', () => {
  const result = normalizeResearchResult({ sources: [] }, prospect);
  assert.equal(result.siteStatus, 'UNKNOWN');
});

test('siteStatus rejects invalid values and falls back to UNKNOWN', () => {
  const result = normalizeResearchResult(
    {
      siteStatus: 'SOMETHING_RANDOM',
      sources: [],
    },
    prospect,
  );
  assert.equal(result.siteStatus, 'UNKNOWN');
});

test('phone is never injected into source note — provider parity invariant', () => {
  // This verifies the core security invariant: the normalizer preserves
  // the source note text without injecting phone digits regardless of
  // whether phoneSourceUrl matches a source URL.
  const sources = [
    { url: 'https://example.test/contact', note: 'Page contact.', supports: ['phone'] },
  ];
  const result = normalizeResearchResult(
    { phone: '06 12 34 56 78', phoneSourceUrl: 'https://example.test/contact', sources },
    prospect,
  );
  const normalized = Array.isArray(result.sources)
    ? (result.sources as Array<{ url: string; note: string }>)
    : [];
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0]!.note, 'Page contact.',
    'source note must NOT be modified with phone digits');
  assert.equal(result.phone, undefined,
    'phone field remains absent until independent evidence is attached');
});

const r34Source = {
  url: 'https://villa-ancinel.com/',
  note: 'Site en cours de refonte. Villa Ancinel, Le Diamant, Martinique.',
  supports: ['website', 'activity', 'digitalGap'],
};
const r34Prospect = { ...prospect, companyName: 'Villa Ancinel', websiteUrl: r34Source.url };

test('R34 unsupported localFit 80 becomes zero without manufacturing support', () => {
  const raw = { scoreInputs: { localFit: 80, digitalGap: 50, commercialStrength: 80, prototypeLeverage: 70, confidence: 90 }, sources: [r34Source] };
  const before = structuredClone(raw);
  const result = normalizeResearchResult(raw, r34Prospect);
  assert.deepEqual(result.scoreInputs, { ...raw.scoreInputs, contactability: 0, localFit: 0 });
  assert.deepEqual(result.sources, raw.sources);
  assert.deepEqual(raw, before);
  assert.ok(!evaluateResearchEvidenceIntegrity(result).supportedClaims.includes('localFit'));
});

test('R34 explicit accepted localFit support preserves positive clamp and round semantics', () => {
  const supportedSource = { ...r34Source, supports: [...r34Source.supports, 'localFit'] };
  for (const [raw, expected] of [[90, 90], [90.6, 91], [110, 100]]) {
    const result = normalizeResearchResult({ scoreInputs: { localFit: raw }, sources: [supportedSource] }, r34Prospect);
    assert.equal((result.scoreInputs as Record<string, number>).localFit, expected);
    assert.deepEqual(result.sources, [supportedSource]);
    assert.equal(evaluateResearchEvidenceIntegrity(result).passed, true);
  }
});

test('R34 unsupported zero localFit remains valid canonical zero', () => {
  const result = normalizeResearchResult({ scoreInputs: { localFit: 0 }, sources: [r34Source] }, r34Prospect);
  assert.equal((result.scoreInputs as Record<string, number>).localFit, 0);
  assert.equal(evaluateResearchEvidenceIntegrity(result).passed, true);
  assert.deepEqual(result.sources, [r34Source]);
});

test('R34 local fit narrative and geographic identity never create score support', () => {
  const narrative = { ...r34Source, note: 'Strong local fit: Villa Ancinel is located in Le Diamant, Martinique.' };
  const result = normalizeResearchResult({
    scoreInputs: { localFit: 80 }, sources: [narrative],
    siren: '879884922', siret: '87988492200011', city: 'Le Diamant',
    location: 'Le Diamant, Martinique', activity: 'Local tourist business',
    primaryAsset: 'Strong local fit for Martinique',
  }, r34Prospect);
  assert.equal((result.scoreInputs as Record<string, number>).localFit, 0);
  assert.deepEqual(result.sources, [narrative]);
  assert.equal(result.commercialEligibility, undefined);
  assert.ok(!evaluateResearchEvidenceIntegrity(result).supportedClaims.includes('localFit'));
});

test('R34 rejected localFit source annotations cannot preserve a positive score', () => {
  for (const source of [
    { ...r34Source, url: 'http://127.0.0.1/', supports: ['localFit'] },
    { ...r34Source, url: 'https://user:password@example.test/', supports: ['localFit'] },
    { ...r34Source, note: ' ', supports: ['localFit'] },
    { ...r34Source, url: 'file:///private/evidence', supports: ['localFit'] },
    { ...r34Source, supports: ['localFit narrative'] },
  ]) {
    const result = normalizeResearchResult({ scoreInputs: { localFit: 80 }, sources: [source] }, r34Prospect);
    assert.equal((result.scoreInputs as Record<string, number>).localFit, 0);
    assert.ok(!evaluateResearchEvidenceIntegrity(result).supportedClaims.includes('localFit'));
  }
});

test('R34 unsupported localFit repair preserves independently extracted REBUILDING evidence', async () => {
  const html = '<title>Villa Ancinel</title><h1>Site en cours de refonte</h1>';
  const observedAt = '2026-09-28T08:46:05.833Z';
  const snapshotDigest = `sha256:${createHash('sha256').update(html).digest('hex')}`;
  const expected = extractDigitalPainEvidence([r34Source], [{ url: r34Source.url, html, observedAt, snapshotDigest }]);
  assert.equal(expected.observations[0]?.type, 'REBUILDING');
  const normalized = normalizeResearchResult({ scoreInputs: { localFit: 80 }, sources: [r34Source] }, r34Prospect);
  const result = await enrichResearchResultWithOperatingEvidence(normalized, async (url) => {
    assert.equal(url, r34Source.url);
    return { ok: true, url, finalUrl: url, text: html, contentType: 'text/html' };
  });
  assert.equal((result.scoreInputs as Record<string, number>).localFit, 0);
  assert.deepEqual(result.sources, [r34Source]);
  const pain = result.digitalPainEvidence as DigitalPainEvidence;
  assert.deepEqual(pain.observations, expected.observations.map((item) => ({ ...item, observedAt: pain.observations[0]!.observedAt })));
  const integrity = evaluateResearchEvidenceIntegrity(result);
  assert.equal(integrity.passed, true);
  assert.deepEqual(acceptedDigitalPainEvidence(pain, integrity.acceptedSources), pain);
});

const absenceIdentity = { companyName: 'Le Bon', city: 'Fort-de-France' };
const absenceProspect = { id: 'r30', companyName: absenceIdentity.companyName, state: 'DISCOVERED' };
const absenceSource = {
  url: 'https://www.facebook.com/lebon',
  note: 'Public business profile identifies Le Bon in Fort-de-France.',
  supports: ['websiteAbsent'],
};
const absenceHtml = "<title>Le Bon | Business profile</title><main>Le Bon, Fort-de-France. Nous n'avons pas de site internet.</main>";
const absenceClaim = { websiteAbsent: true, sources: [absenceSource] };
const unknownPain = { status: 'UNKNOWN', observations: [] };
const painOf = (result: Record<string, unknown>) => result.digitalPainEvidence as DigitalPainEvidence;

test('R30 normalization preserves structured websiteAbsent and its source association without authority', () => {
  assert.equal(absenceClaim.websiteAbsent, true);
  assert.deepEqual(absenceClaim.sources[0], absenceSource);
  const result = normalizeResearchResult(absenceClaim, absenceProspect);
  assert.equal(result.websiteAbsent, true);
  assert.deepEqual(result.sources, absenceClaim.sources);
  assert.deepEqual(evaluateResearchEvidenceIntegrity(result).acceptedSources, absenceClaim.sources);
  assert.equal(result.digitalPainEvidence, undefined);
  assert.deepEqual(absenceClaim, { websiteAbsent: true, sources: [absenceSource] });
});

test('R30 normalized absence claim reaches fetched Facebook and Instagram strict inspection', async () => {
  for (const url of [absenceSource.url, 'https://www.instagram.com/lebon/']) {
    const profile = { ...absenceSource, url };
    const normalized = normalizeResearchResult({ websiteAbsent: true, sources: [profile] }, absenceProspect);
    const visited: string[] = [];
    const before = Date.now();
    const result = await enrichResearchResultWithOperatingEvidence(normalized, async (requestedUrl) => {
      visited.push(requestedUrl);
      return { ok: true, url: requestedUrl, finalUrl: requestedUrl, text: absenceHtml, contentType: 'text/html' };
    }, absenceIdentity);
    assert.deepEqual(visited, [url]);
    const evidence = painOf(result);
    assert.equal(evidence.status, 'VERIFIED');
    assert.equal(evidence.observations.length, 1);
    const observation = evidence.observations[0]!;
    assert.ok(Date.parse(observation.observedAt) >= before && Date.parse(observation.observedAt) <= Date.now());
    assert.deepEqual(observation, {
      type: 'WEBSITE_VERIFIED_ABSENT',
      observation: "Nous n'avons pas de site internet.",
      sourceUrl: url,
      sourceType: 'VERIFIED_FIRST_PARTY_BUSINESS_PROFILE',
      evidenceType: 'FIRST_PARTY_ABSENCE_STATEMENT',
      integrityStatus: 'ACCEPTED',
      inspectionMethod: 'FETCHED_FIRST_PARTY_STATEMENT',
      observedAt: observation.observedAt,
      snapshotDigest: `sha256:${createHash('sha256').update(absenceHtml).digest('hex')}`,
      finalUrl: url,
      supportingText: "Nous n'avons pas de site internet.",
      locator: 'profile-visible-text',
      identityName: absenceIdentity.companyName,
      identityCity: absenceIdentity.city,
      conflictCheck: 'NO_VERIFIED_OWNED_WEBSITE',
    });
    assert.deepEqual(acceptedDigitalPainEvidence(evidence, evaluateResearchEvidenceIntegrity(result).acceptedSources), evidence);
  }
});

test('R30 raw websiteAbsent without an independently fetched qualifying source stays UNKNOWN', async () => {
  const rawOnly = normalizeResearchResult({ websiteAbsent: true }, absenceProspect);
  const unfetched = await enrichResearchResultWithOperatingEvidence(rawOnly, async () => {
    assert.fail('a raw boolean must not initiate inspection');
  }, absenceIdentity);
  assert.deepEqual(painOf(unfetched), unknownPain);
  const visited: string[] = [];
  const failed = await enrichResearchResultWithOperatingEvidence(normalizeResearchResult(absenceClaim, absenceProspect), async (url) => {
    visited.push(url);
    return { ok: false, reason: 'TIMEOUT' };
  }, absenceIdentity);
  assert.deepEqual(visited, [absenceSource.url]);
  assert.deepEqual(painOf(failed), unknownPain);
});

test('R30 registry-only absence remains UNKNOWN even with explicit text', async () => {
  const registry = { ...absenceSource, url: 'https://annuaire-entreprises.data.gouv.fr/etablissement/123' };
  const normalized = normalizeResearchResult({ websiteAbsent: true, sources: [registry] }, absenceProspect);
  assert.deepEqual(normalized.sources, [registry]);
  const result = await enrichResearchResultWithOperatingEvidence(normalized, async () => {
    assert.fail('registry absence must not initiate a qualifying fetch');
  }, absenceIdentity);
  assert.deepEqual(painOf(result), unknownPain);
  assert.deepEqual(extractDigitalPainEvidence(evaluateResearchEvidenceIntegrity(normalized).acceptedSources, [{
    url: registry.url, html: absenceHtml, observedAt: new Date().toISOString(),
    snapshotDigest: `sha256:${createHash('sha256').update(absenceHtml).digest('hex')}`,
  }], absenceIdentity), unknownPain);
});

test('R30 missing or null website alone never infers absence', async () => {
  for (const raw of [{}, { websiteUrl: null }]) {
    const normalized = normalizeResearchResult(raw, absenceProspect);
    assert.equal(normalized.websiteAbsent, undefined);
    assert.deepEqual(normalized.sources, []);
    const result = await enrichResearchResultWithOperatingEvidence(normalized, async () => {
      assert.fail('missing website is not an absence source');
    }, absenceIdentity);
    assert.deepEqual(painOf(result), unknownPain);
  }
});

test('R30 free-text/model absence narrative never becomes a structured claim or pain', async () => {
  const normalized = normalizeResearchResult({
    primaryFriction: 'No website',
    sources: [{ ...absenceSource, note: "Le Bon has no website. Nous n'avons pas de site internet.", supports: ['primaryFriction', 'digitalGap'] }],
    digitalPainEvidence: { status: 'VERIFIED', observations: [{ type: 'WEBSITE_VERIFIED_ABSENT' }] },
  }, absenceProspect);
  assert.equal(normalized.websiteAbsent, undefined);
  assert.equal(normalized.digitalPainEvidence, undefined);
  assert.ok(!evaluateResearchEvidenceIntegrity(normalized).supportedClaims.includes('websiteAbsent'));
  const result = await enrichResearchResultWithOperatingEvidence(normalized, async () => {
    assert.fail('narrative must not initiate absence inspection');
  }, absenceIdentity);
  assert.deepEqual(painOf(result), unknownPain);
});

test('R30 normalized qualifying absence is blocked by VERIFIED owned website conflict', async () => {
  const normalized = normalizeResearchResult({ ...absenceClaim,
    contactPresence: { website: { status: 'VERIFIED', values: ['https://lebon.example.com/'] } },
  }, absenceProspect);
  const visited: string[] = [];
  const result = await enrichResearchResultWithOperatingEvidence(normalized, async (url) => {
    visited.push(url);
    return { ok: true, url, finalUrl: url, text: absenceHtml, contentType: 'text/html' };
  }, absenceIdentity);
  assert.deepEqual(visited, [absenceSource.url]);
  assert.deepEqual(painOf(result), unknownPain);
});

test('R30 qualifying normalized source requires digest at extraction and acceptance', () => {
  const sources = evaluateResearchEvidenceIntegrity(normalizeResearchResult(absenceClaim, absenceProspect)).acceptedSources;
  const page = { url: absenceSource.url, html: absenceHtml, observedAt: new Date().toISOString(),
    snapshotDigest: `sha256:${createHash('sha256').update(absenceHtml).digest('hex')}` };
  const proof = extractDigitalPainEvidence(sources, [page], absenceIdentity);
  assert.equal(proof.status, 'VERIFIED');
  for (const snapshotDigest of [undefined, '', 'sha256:invalid']) {
    const missingDigest = snapshotDigest as unknown as string;
    assert.deepEqual(extractDigitalPainEvidence(sources, [{ ...page, snapshotDigest: missingDigest }], absenceIdentity), unknownPain);
    assert.deepEqual(acceptedDigitalPainEvidence({ ...proof,
      observations: [{ ...proof.observations[0]!, snapshotDigest: missingDigest }],
    }, sources), unknownPain);
  }
});

test('R30 fetched qualifying profile still requires explicit absence statement and matching identity', async () => {
  for (const html of [
    absenceHtml.replace("Nous n'avons pas de site internet.", 'No website found by the model.'),
    absenceHtml.replaceAll('Le Bon', 'Another business'),
    absenceHtml.replace('Fort-de-France', 'Paris'),
  ]) {
    let fetched = false;
    const result = await enrichResearchResultWithOperatingEvidence(normalizeResearchResult(absenceClaim, absenceProspect), async (url) => {
      fetched = true;
      return { ok: true, url, finalUrl: url, text: html, contentType: 'text/html' };
    }, absenceIdentity);
    assert.equal(fetched, true);
    assert.deepEqual(painOf(result), unknownPain);
  }
});
