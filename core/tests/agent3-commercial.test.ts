import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePricingPackage } from '../orchestrator/pricing-policy';
import { projectCommercialCatalog, catalogEntryIsCanonical } from '../outreach/commercial-catalog';
import { abstain, claimIssues, contextIssues, decideCommercialPrerequisites, validCanonicalLink, type CommercialContext, type CommercialClaim } from '../outreach/commercial-contract';
import { ABSTENTION_DECISIONS, ANTI_GENERIC_POLICY, CHANNEL_POLICIES, COMMERCIAL_DOCTRINE, COMMERCIAL_PLAYBOOK_VERSION } from '../outreach/commercial-policy';
import { COMMERCIAL_ORACLE_IDS, commercialContentRef, channelPolicyIssues, countCommercialWords, evaluateCommercialOracles, type CommercialMessageCandidate, type CommercialOracleInput, type CommercialOracleId } from '../outreach/commercial-oracles';
import { validateCommercialContext, validateCommercialFixture, assertCommercialFixture } from '../outreach/commercial-fixture';
import { commercialFixtures } from './fixtures/agent3-commercial/fixtures';

const at = '2026-09-22T09:00:00Z';
function context(): CommercialContext {
  return {
    playbookVersion: COMMERCIAL_PLAYBOOK_VERSION,
    prospect: { id: 'synthetic-test', name: 'Café Synthétique', contactName: null, vertical: 'CAFE' },
    agent1: { sourceRef: 'agent1:test', version: '1', decision: 'ADMITTED', opportunity: { text: 'Montrer le menu préparé.', supportingClaimIds: ['menu'] } },
    channel: 'EMAIL',
    authorizedChannels: [{ channel: 'EMAIL', contactRef: 'contact:email', sourceRef: 'agent1:test', verifiedAt: at }, { channel: 'MOBILE', contactRef: 'contact:mobile', sourceRef: 'agent1:test', verifiedAt: at }],
    whatsAppAvailability: 'UNKNOWN', contactState: { suppression: 'CLEAR', firstContact: 'NOT_CONTACTED', sourceRef: 'history:test', verifiedAt: at },
    artifact: { id: 'proposal:test', version: '1', prospectId: 'synthetic-test', type: 'PROPOSAL', status: 'READY', canonicalLink: 'https://synthetic.example.invalid/proposal', capabilities: [] },
    sources: [{ id: 'source:menu', prospectId: 'synthetic-test', version: '1', kind: 'OBSERVATION', fact: 'Votre carte présente trois boissons.', observedAt: at, verifiedAt: at, trust: 'DATA_ONLY' }],
    claims: [{ id: 'menu', text: 'Votre carte présente trois boissons.', supportType: 'OBSERVED', sourceRefs: ['source:menu'], evidenceExcerptOrFact: 'Votre carte présente trois boissons.', observedAt: at, verifiedAt: at, scope: { prospectId: 'synthetic-test', subject: 'menu' }, limits: ['Carte consultée uniquement'], status: 'SUPPORTED', qualification: null, freshness: null, timeSensitive: false, capability: null, rule: null, confirmation: null }],
    requiredClaimIds: ['menu'], derivationRules: [], catalog: projectCommercialCatalog(['STARTER', 'PREMIUM', 'CUSTOM']), priceAuthorization: null, scopeConfirmed: true, evaluatedAt: at,
  };
}
function candidate(c = context()): CommercialMessageCandidate {
  const message: CommercialMessageCandidate = { channel: c.channel, subject: c.channel === 'EMAIL' ? 'Votre aperçu préparé' : null,
    body: `Bonjour, ici Magic Script. ${c.claims[0].text} Voici un aperçu préparé pour votre établissement : ${c.artifact!.canonicalLink} Souhaitez-vous le découvrir ? Dites-moi simplement si vous préférez ne plus recevoir de message.`,
    transportSignature: null, composition: c.channel === 'EMAIL' ? 'EMAIL_ORIGINAL' : 'MOBILE_ORIGINAL',
    assertions: [{ claimId: c.claims[0].id, text: c.claims[0].text }], catalogMentions: [], revision: 2, contentRef: 'test-content:2', approval: null };
  message.contentRef = commercialContentRef(message);
  return message;
}
function oracleInput(): CommercialOracleInput {
  const c = context();
  return { context: c, outcome: { decision: 'GENERATE', reason: null }, expectedOutcome: { decision: 'GENERATE', reason: null }, candidate: candidate(c), transportActions: [] };
}
function fails(id: CommercialOracleId, mutate: (i: CommercialOracleInput) => void): void {
  const input = oracleInput(); mutate(input);
  assert.equal(evaluateCommercialOracles(input).find(o => o.id === id)?.pass, false, id);
}

test('canonical context is valid; upstream identity and playbook version are mandatory', () => {
  assert.deepEqual(contextIssues(context()), []);
  assert.deepEqual(decideCommercialPrerequisites(context()), { decision: 'GENERATE', reason: null });
  const c = context(); c.agent1.version = '';
  assert.ok(contextIssues(c).includes('AGENT1_AUTHORITY_REQUIRED'));
  assert.equal(decideCommercialPrerequisites(c).decision, 'INSUFFICIENT_GROUNDING');
});

test('unknown runtime inputs fail validation safely and closed schemas reject a second prospect score', () => {
  for (const malformed of [null, undefined, false, 3, 'input', [], {}, { claims: null }, { prospect: [] }]) {
    assert.ok(validateCommercialContext(malformed).length > 0);
    assert.ok(validateCommercialFixture(malformed).length > 0);
  }
  assert.deepEqual(validateCommercialContext(context()), []);
  const c = context();
  assert.ok(validateCommercialContext({ ...c, prospectScore: 90 }).length > 0);
  assert.ok(validateCommercialContext({ ...c, prospect: { ...c.prospect, score: 90 } }).length > 0);
  assert.ok(validateCommercialContext({ ...c, claims: [{ ...c.claims[0], sourceRefs: null }] }).length > 0);
});

test('observed claims require resolvable owned sources, evidence and supported status', () => {
  const c = context(); assert.deepEqual(claimIssues(c.claims[0], c), []);
  for (const status of ['UNSUPPORTED', 'CONFLICTED'] as const) {
    const claim = { ...c.claims[0], status }; assert.ok(claimIssues(claim, c).includes(`CLAIM_${status}`));
  }
  assert.ok(claimIssues({ ...c.claims[0], sourceRefs: [] }, c).includes('ORPHAN_CLAIM'));
  assert.ok(claimIssues({ ...c.claims[0], sourceRefs: ['missing'] }, c).includes('ORPHAN_CLAIM'));
  assert.ok(claimIssues({ ...c.claims[0], evidenceExcerptOrFact: 'invention' }, c).includes('EVIDENCE_EXCERPT_MISMATCH'));
  c.sources[0].prospectId = 'other'; assert.ok(claimIssues(c.claims[0], c).includes('ORPHAN_CLAIM'));
});

test('derived claims require an explicit versioned rule and valid premises; cycles fail', () => {
  const c = context();
  const derived: CommercialClaim = { ...c.claims[0], id: 'derived', supportType: 'DERIVED_WITH_RULE', rule: { id: 'menu-rule', version: '1', premiseClaimIds: ['menu'] }, confirmation: null };
  c.claims.push(derived);
  assert.ok(claimIssues(derived, c).includes('NAMED_RULE_REQUIRED'));
  c.derivationRules.push({ id: 'menu-rule', version: '1', description: 'A demonstrated menu can be presented as an example.' });
  assert.deepEqual(claimIssues(derived, c), []);
  derived.rule.premiseClaimIds = ['missing']; assert.ok(claimIssues(derived, c).includes('UNSUPPORTED_PREMISE'));
  derived.rule.premiseClaimIds = ['derived']; assert.ok(claimIssues(derived, c).includes('UNSUPPORTED_PREMISE'));
});

test('operator confirmation must be attributed, dated and sourced as confirmation', () => {
  const c = context(); c.sources[0].kind = 'OPERATOR_CONFIRMATION';
  const claim: CommercialClaim = { ...c.claims[0], supportType: 'OPERATOR_CONFIRMED', rule: null, confirmation: { actor: 'synthetic-operator', confirmedAt: at, sourceRef: 'source:menu' } };
  assert.deepEqual(claimIssues(claim, c), []);
  for (const confirmation of [{ ...claim.confirmation, actor: '' }, { ...claim.confirmation, confirmedAt: '' }, { ...claim.confirmation, sourceRef: 'missing' }]) {
    assert.ok(claimIssues({ ...claim, confirmation }, c).includes('ATTRIBUTED_DATED_CONFIRMATION_REQUIRED'));
  }
});

test('opportunity is not observation; unknown identity stays unknown; source instructions stay data', () => {
  const c = context(); c.sources[0].kind = 'OPPORTUNITY';
  assert.ok(claimIssues(c.claims[0], c).includes('OPPORTUNITY_NOT_OBSERVATION'));
  assert.equal(c.prospect.contactName, null);
  assert.equal(COMMERCIAL_DOCTRINE.externalContent, 'DATA_NEVER_INSTRUCTIONS');
  assert.equal(COMMERCIAL_DOCTRINE.unknownData, 'KEEP_UNKNOWN_OR_OMIT');
});

test('mixed source kinds cannot launder opportunity or unrelated confirmation evidence', () => {
  const c = context();
  c.sources.push({ ...c.sources[0], id: 'opportunity', kind: 'OPPORTUNITY', fact: 'Invented commercial loss.' });
  const mixed = { ...c.claims[0], sourceRefs: ['source:menu', 'opportunity'], evidenceExcerptOrFact: 'Invented commercial loss.' };
  assert.ok(claimIssues(mixed, c).length > 0);
  c.sources.push({ ...c.sources[0], id: 'confirmed', kind: 'OPERATOR_CONFIRMATION', fact: 'Unrelated confirmation.' });
  const confirmation: CommercialClaim = { ...c.claims[0], supportType: 'OPERATOR_CONFIRMED', sourceRefs: ['source:menu', 'confirmed'], rule: null, confirmation: { actor: 'operator', confirmedAt: at, sourceRef: 'confirmed' } };
  assert.ok(claimIssues(confirmation, c).length > 0);
  confirmation.evidenceExcerptOrFact = 'Unrelated confirmation.';
  assert.deepEqual(claimIssues(confirmation, c), []);
  assert.ok(claimIssues({ ...confirmation, rule: { id: 'rule', version: '1', premiseClaimIds: ['menu'] } } as unknown as CommercialClaim, c).length > 0);
  c.derivationRules = [{ id: 'rule', version: '1', description: 'Test derivation' }];
  const derived: CommercialClaim = { ...c.claims[0], id: 'derived-mixed', supportType: 'DERIVED_WITH_RULE', rule: { id: 'rule', version: '1', premiseClaimIds: ['menu'] }, confirmation: null };
  assert.deepEqual(claimIssues(derived, c), []);
  assert.ok(claimIssues({ ...derived, confirmation: confirmation.confirmation } as unknown as CommercialClaim, c).length > 0);
});

test('abstention oracle rejects mismatched reason mapping even when expected matches actual', () => {
  fails('EXPECTED_ABSTENTION', i => {
    i.outcome = { decision: 'QUALITY_ABSTENTION', reason: 'INVALID_CHANNEL' };
    i.expectedOutcome = i.outcome;
    i.candidate = null;
  });
});

test('approval content binding rejects changed body, assertions and catalog without granting approval', () => {
  const input = oracleInput(); const m = input.candidate!;
  m.approval = { revision: m.revision, contentRef: m.contentRef };
  assert.equal(evaluateCommercialOracles(input).find(o => o.id === 'REVISION_APPROVAL_NOT_TRANSFERRED')!.pass, true);
  m.body += ' Dernière chance !';
  assert.equal(evaluateCommercialOracles(input).find(o => o.id === 'REVISION_APPROVAL_NOT_TRANSFERRED')!.pass, false);
  m.contentRef = commercialContentRef(m);
  assert.equal(evaluateCommercialOracles(input).find(o => o.id === 'REVISION_APPROVAL_NOT_TRANSFERRED')!.pass, false);
  fails('REVISION_APPROVAL_NOT_TRANSFERRED', i => { i.candidate!.assertions[0].text = 'Changed assertion'; });
  fails('REVISION_APPROVAL_NOT_TRANSFERRED', i => { i.candidate!.catalogMentions.push({ offerId: 'PREMIUM', name: 'Premium', priceMode: 'FIXED', amountCents: 1, capabilityMentions: [], additionalTerms: [] }); });
});

test('freshness is explicit and demonstrative capabilities cannot become live', () => {
  const c = context(); const claim = c.claims[0]; claim.timeSensitive = true;
  assert.ok(claimIssues(claim, c).includes('FRESHNESS_REQUIRED'));
  claim.freshness = { policyId: 'daily-menu', validUntil: '2026-09-23T09:00:00Z' };
  assert.deepEqual(claimIssues(claim, c), []);
  claim.freshness.validUntil = '2026-09-21T09:00:00Z'; assert.ok(claimIssues(claim, c).includes('FRESHNESS_REQUIRED'));
  claim.timeSensitive = false; c.artifact!.capabilities.push({ id: 'booking', status: 'DEMONSTRATIVE', sourceRef: 'source:menu' });
  claim.capability = { id: 'booking', use: 'LIVE' }; assert.ok(claimIssues(claim, c).includes('DEMO_IS_NOT_LIVE'));
  claim.capability.use = 'DEMONSTRATIVE'; assert.deepEqual(claimIssues(claim, c), []);
});

test('artifact ownership and canonical link are prerequisite conditions', () => {
  const c = context(); c.artifact!.prospectId = 'wrong'; assert.equal(decideCommercialPrerequisites(c).reason, 'CONFLICTED_CONTEXT');
  c.artifact = null; assert.equal(decideCommercialPrerequisites(c).reason, 'INSUFFICIENT_GROUNDING');
  for (const url of ['', 'not a URL', 'http://synthetic.example.invalid', 'https://user:pass@synthetic.example.invalid']) assert.equal(validCanonicalLink(url), false);
  const missing = context(); missing.artifact!.canonicalLink = ''; assert.ok(contextIssues(missing).includes('ARTIFACT_REFERENCE'));
});

test('EMAIL and MOBILE policies freeze different composition and maximum lengths', () => {
  assert.deepEqual(CHANNEL_POLICIES.EMAIL.targetWords, [70, 120]);
  assert.deepEqual(CHANNEL_POLICIES.MOBILE.targetWords, [35, 70]);
  for (const [channel, max] of [['EMAIL', 140], ['MOBILE', 90]] as const) {
    const c = context(); c.channel = channel; const m = candidate(c);
    const prefix = channel === 'MOBILE' ? 'Bonjour, ici Magic Script. Question ?' : 'Bonjour';
    m.body = `${prefix} ${Array(max - countCommercialWords(prefix)).fill('mot').join(' ')}`;
    assert.deepEqual(channelPolicyIssues(m), []);
    m.body += ' excessif'; assert.ok(channelPolicyIssues(m).includes('LENGTH'));
  }
  const email = candidate(); email.transportSignature = Array(200).fill('signature').join(' '); assert.deepEqual(channelPolicyIssues(email), []);
  email.subject = null; assert.ok(channelPolicyIssues(email).includes('EMAIL_STRUCTURE'));
  const c = context(); c.channel = 'MOBILE'; const mobile = candidate(c); mobile.composition = 'SHORTENED_EMAIL'; assert.ok(channelPolicyIssues(mobile).includes('MOBILE_STRUCTURE'));
  mobile.composition = 'MOBILE_ORIGINAL'; mobile.body += ' Cordialement'; assert.ok(channelPolicyIssues(mobile).includes('MOBILE_EMAIL_SIGNOFF'));
  assert.equal(CHANNEL_POLICIES.MOBILE.impliesWhatsAppAvailability, false);
  assert.equal(decideCommercialPrerequisites(c).decision, 'GENERATE');
});

test('catalog projection reuses fixed/from/quote authority and rejects mutated commercial terms', () => {
  const entries = projectCommercialCatalog(['STARTER', 'ESSENTIEL', 'BUSINESS', 'PREMIUM', 'CUSTOM']);
  for (const entry of entries) {
    const authority = resolvePricingPackage(entry.offerId);
    assert.equal(entry.amountCents, authority.priceCents);
    assert.equal(entry.priceMode, authority.status === 'CUSTOM' ? 'QUOTE' : authority.status);
    assert.equal(catalogEntryIsCanonical(entry), true);
    assert.deepEqual(entry.authorizedCapabilities, []);
    for (const field of ['annualCareCents', 'depositPercent', 'includedRevisionRounds', 'taxStatus', 'discount']) assert.equal(field in entry, false);
  }
  assert.equal(entries.find(e => e.offerId === 'PREMIUM')!.priceMode, 'FROM');
  assert.equal(entries.find(e => e.offerId === 'CUSTOM')!.amountCents, null);
  assert.equal(catalogEntryIsCanonical({ ...entries[0], amountCents: 1 }), false);
  assert.equal(catalogEntryIsCanonical({ ...entries[0], authorizedCapabilities: ['Live booking included'] }), false);
});

test('abstention decisions preserve upstream authority and block opposition/channel/history', () => {
  assert.equal(Object.keys(ABSTENTION_DECISIONS).length, 9);
  for (const reason of Object.keys(ABSTENTION_DECISIONS) as (keyof typeof ABSTENTION_DECISIONS)[]) assert.equal(abstain(reason).decision, ABSTENTION_DECISIONS[reason]);
  for (const suppression of ['SUPPRESSED', 'OPPOSED', 'UNKNOWN'] as const) {
    const c = context(); c.contactState.suppression = suppression; const before = JSON.stringify(c.agent1);
    assert.equal(decideCommercialPrerequisites(c).reason, 'SUPPRESSED_OR_OPPOSED'); assert.equal(JSON.stringify(c.agent1), before);
  }
  const c = context(); c.authorizedChannels = []; assert.equal(decideCommercialPrerequisites(c).reason, 'INVALID_CHANNEL');
  const contacted = context(); contacted.contactState.firstContact = 'CONTACTED'; assert.equal(decideCommercialPrerequisites(contacted).reason, 'ALREADY_CONTACTED_OR_DUPLICATE');
  const noValue = context(); noValue.agent1.opportunity = null; assert.equal(decideCommercialPrerequisites(noValue).reason, 'NO_SUPPORTED_VALUE');
  assert.equal(COMMERCIAL_DOCTRINE.prospectScoring, false); assert.equal(COMMERCIAL_DOCTRINE.autonomousOfferSelection, false);
  assert.equal(Object.keys(c).some(key => /score/i.test(key)), false);
});

test('anti-generic classes distinguish eight blocking patterns and seven rewrite patterns', () => {
  assert.equal(Object.values(ANTI_GENERIC_POLICY).filter(p => p.action === 'BLOCK').length, 8);
  assert.equal(Object.values(ANTI_GENERIC_POLICY).filter(p => p.action === 'REWRITE').length, 7);
  assert.equal(ANTI_GENERIC_POLICY.EMAIL_LIKE_MOBILE.action, 'REWRITE');
  assert.equal(ANTI_GENERIC_POLICY.INVENTED_PRICE_OR_DISCOUNT.action, 'BLOCK');
});

test('all 12 objective oracles pass a grounded synthetic candidate and each detects its negative witness', () => {
  assert.equal(COMMERCIAL_ORACLE_IDS.length, 12);
  assert.deepEqual(evaluateCommercialOracles(oracleInput()).filter(o => !o.pass), []);
  fails('CHANNEL_ALLOWED', i => { i.context.authorizedChannels = []; });
  fails('CONTACT_NOT_SUPPRESSED', i => { i.context.contactState.suppression = 'OPPOSED'; });
  fails('FIRST_CONTACT_ALLOWED', i => { i.context.contactState.firstContact = 'DUPLICATE'; });
  fails('PROPOSAL_BELONGS_TO_PROSPECT', i => { i.context.artifact!.prospectId = 'wrong'; });
  fails('CANONICAL_LINK_EXACT', i => { i.candidate!.body = i.candidate!.body.replace(i.context.artifact!.canonicalLink, 'https://wrong.example.invalid/'); });
  fails('NO_PLACEHOLDERS', i => { i.candidate!.body += ' {{nom}}'; });
  fails('LENGTH_WITHIN_LIMIT', i => { i.candidate!.body = Array(141).fill('mot').join(' '); });
  fails('CLAIMS_RESOLVE', i => { i.candidate!.assertions[0].claimId = 'orphan'; });
  fails('CATALOG_REFERENCE_ALLOWED', i => { const e = i.context.catalog[0]; i.context.priceAuthorization = { actor: 'synthetic-operator', at, offerIds: [e.offerId] }; i.candidate!.catalogMentions = [{ offerId: e.offerId, name: e.name, priceMode: e.priceMode, amountCents: 1, additionalTerms: [], capabilityMentions: [] }]; });
  fails('EXPECTED_ABSTENTION', i => { i.expectedOutcome = abstain('NO_SUPPORTED_VALUE'); });
  fails('NO_TRANSPORT_ACTION', i => { i.transportActions = ['synthetic recorded send attempt']; });
  fails('REVISION_APPROVAL_NOT_TRANSFERRED', i => { i.candidate!.approval = { revision: 1, contentRef: 'test-content:1' }; });
  fails('REVISION_APPROVAL_NOT_TRANSFERRED', i => { i.candidate!.approval = { revision: 2, contentRef: 'different-content' }; });
});

test('canonical authorized pricing passes while discount/annual/tax assertions are rejected', () => {
  const input = oracleInput(); const e = input.context.catalog.find(entry => entry.offerId === 'PREMIUM')!;
  input.context.priceAuthorization = { actor: 'synthetic-operator', at, offerIds: [e.offerId] };
  input.candidate!.catalogMentions = [{ offerId: e.offerId, name: e.name, priceMode: e.priceMode, amountCents: e.amountCents, additionalTerms: [], capabilityMentions: [] }];
  assert.equal(evaluateCommercialOracles(input).find(o => o.id === 'CATALOG_REFERENCE_ALLOWED')!.pass, true);
  for (const term of ['10% discount', 'annual care included', 'TTC', 'HT']) {
    input.candidate!.catalogMentions[0].additionalTerms = [term]; assert.equal(evaluateCommercialOracles(input).find(o => o.id === 'CATALOG_REFERENCE_ALLOWED')!.pass, false);
  }
});

test('28 independently specified synthetic fixtures validate and their channel outcomes agree', () => {
  assert.equal(commercialFixtures.length, 28); assert.equal(new Set(commercialFixtures.map(f => f.id)).size, 28);
  let evaluatedCases = 0;
  for (const fixture of commercialFixtures) {
    assert.deepEqual(validateCommercialFixture(fixture), [], fixture.id); assertCommercialFixture(fixture);
    for (const scenario of fixture.cases) {
      const c = structuredClone(fixture.context); c.channel = scenario.channel;
      assert.deepEqual(decideCommercialPrerequisites(c), scenario.expected, `${fixture.id}:${scenario.name}`);
      let message: CommercialMessageCandidate | null = null;
      if (scenario.expected.decision === 'GENERATE') {
        message = candidate(c);
        const claims = c.claims.filter(claim => !claimIssues(claim, c).length && (fixture.allowedAssertions.includes(claim.text) || c.requiredClaimIds.includes(claim.id)));
        message.assertions = claims.map(claim => ({ claimId: claim.id, text: claim.text }));
        message.body = `Bonjour, ici Magic Script. ${claims.map(claim => claim.text).join(' ')} Voici votre aperçu préparé : ${c.artifact!.canonicalLink} Souhaitez-vous le découvrir ? Dites-moi si vous préférez ne plus recevoir de message.`;
        message.contentRef = commercialContentRef(message);
      }
      const results = evaluateCommercialOracles({ context: c, outcome: decideCommercialPrerequisites(c), expectedOutcome: scenario.expected, candidate: message, transportActions: [] });
      assert.equal(results.length, 12);
      for (const id of ['EXPECTED_ABSTENTION', 'NO_TRANSPORT_ACTION', ...(message ? ['CLAIMS_RESOLVE', 'CANONICAL_LINK_EXACT', 'REVISION_APPROVAL_NOT_TRANSFERRED'] : [])]) {
        assert.equal(results.find(result => result.id === id)!.pass, true, `${fixture.id}:${scenario.name}:${id}`);
      }
      evaluatedCases++;
    }
  }
  assert.equal(evaluatedCases, 38);
  assert.ok(validateCommercialFixture(null).length > 0);
  const invalid = structuredClone(commercialFixtures[0]); invalid.synthetic = false as true;
  assert.ok(validateCommercialFixture(invalid).length > 0);
  assert.throws(() => assertCommercialFixture(invalid));
});

test('foundation modules import no outbound transport and expose no execution path', () => {
  for (const file of ['commercial-contract', 'commercial-policy', 'commercial-catalog', 'commercial-oracles', 'commercial-fixture']) {
    const source = readFileSync(new URL(`../outreach/${file}.ts`, import.meta.url), 'utf8');
    const imports = source.match(/(?:import|export)\s[^;]*?from\s*['"][^'"]+['"]/g) ?? [];
    assert.equal(imports.some(line => /transport|send-email|provider|resend|twilio/i.test(line)), false, file);
    assert.equal(/\b(?:fetch|sendEmail|sendSms|sendWhatsApp)\s*\(/.test(source), false, file);
  }
  assert.equal(COMMERCIAL_DOCTRINE.transportAuthorization, false);
});
