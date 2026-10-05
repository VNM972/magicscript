import test from 'node:test';
import assert from 'node:assert/strict';
import { contextIssues, type CommercialContext } from '../outreach/commercial-contract';
import { commercialContentRef, type CommercialMessageCandidate } from '../outreach/commercial-oracles';
import { COMMERCIAL_PLAYBOOK_VERSION } from '../outreach/commercial-policy';
import { evaluateCommercialQualityGate, QUALITY_THRESHOLD, QUALITY_DIMENSION_WEIGHTS, MAX_REGENERATION_ATTEMPTS, type BoundedSemanticAssessment } from '../outreach/commercial-quality-gate';
import { projectCommercialCatalog } from '../outreach/commercial-catalog';

const at = '2026-09-01T12:00:00Z';
function context(channel: 'EMAIL' | 'MOBILE' = 'EMAIL'): CommercialContext {
  const prospectId = 'synthetic:quality';
  const link = 'https://quality.example.test/proposal';
  const fact = 'La carte présente trois boissons locales.';
  return { playbookVersion: COMMERCIAL_PLAYBOOK_VERSION, prospect: { id: prospectId, name: 'Café Qualité', contactName: null, vertical: 'CAFE' }, agent1: { sourceRef: 'agent1:quality', version: '1', decision: 'ADMITTED', opportunity: { text: 'Présenter la carte préparée.', supportingClaimIds: ['claim'] } }, channel, authorizedChannels: [{ channel: 'EMAIL', contactRef: 'email', sourceRef: 'channel', verifiedAt: at }, { channel: 'MOBILE', contactRef: 'mobile', sourceRef: 'channel', verifiedAt: at }], whatsAppAvailability: 'UNKNOWN', contactState: { suppression: 'CLEAR', firstContact: 'NOT_CONTACTED', sourceRef: 'history', verifiedAt: at }, artifact: { id: 'proposal', version: '1', prospectId, type: 'PROPOSAL', status: 'READY', canonicalLink: link, capabilities: [] }, sources: [{ id: 'source', prospectId, version: '1', kind: 'OBSERVATION', fact, observedAt: at, verifiedAt: at, trust: 'DATA_ONLY' }], claims: [{ id: 'claim', text: fact, supportType: 'OBSERVED', sourceRefs: ['source'], evidenceExcerptOrFact: fact, observedAt: at, verifiedAt: at, scope: { prospectId, subject: 'menu' }, limits: ['synthetic'], status: 'SUPPORTED', qualification: null, freshness: null, timeSensitive: false, capability: null, rule: null, confirmation: null }], requiredClaimIds: ['claim'], derivationRules: [], catalog: projectCommercialCatalog(['STARTER']), priceAuthorization: null, scopeConfirmed: true, evaluatedAt: at };
}
function candidate(c: CommercialContext): CommercialMessageCandidate {
  const body = c.channel === 'EMAIL' ? `Bonjour, ici Magic Script. ${c.claims[0].text} Voici l'aperçu préparé : ${c.artifact!.canonicalLink} Souhaitez-vous le découvrir ? Dites-moi si vous préférez ne plus recevoir de message.` : `Bonjour, ici Magic Script. ${c.claims[0].text} Aperçu préparé : ${c.artifact!.canonicalLink} . Souhaitez-vous le voir ? Dites stop si vous préférez ne plus recevoir de message.`;
  const result: CommercialMessageCandidate = { channel: c.channel, subject: c.channel === 'EMAIL' ? 'Votre aperçu préparé' : null, body, transportSignature: null, composition: c.channel === 'EMAIL' ? 'EMAIL_ORIGINAL' : 'MOBILE_ORIGINAL', assertions: [{ claimId: 'claim', text: c.claims[0].text }], catalogMentions: [], revision: 1, contentRef: '', approval: null };
  result.contentRef = commercialContentRef(result); return result;
}
const quality: BoundedSemanticAssessment = { specificity: 4, commercialRelevance: 4, humanness: 4, channelFit: 4, ctaQuality: 4, concision: 4, antiGenericQuality: 4, assessor: 'synthetic' };
const expected = { decision: 'GENERATE' as const, reason: null };

test('canonical weighted threshold and dimension minimums are explicit', () => { assert.equal(QUALITY_THRESHOLD, 80); assert.deepEqual(QUALITY_DIMENSION_WEIGHTS, { SPECIFICITY: 20, COMMERCIAL_RELEVANCE: 20, HUMANNESS: 15, CHANNEL_FIT: 15, CTA_QUALITY: 10, CONCISION: 10, ANTI_GENERIC: 10 }); });
test('ready result is exact-content bound and separate from approval', () => { const c = context(); const result = evaluateCommercialQualityGate({ context: c, candidate: candidate(c), expectedOutcome: expected, semanticAssessment: quality }); assert.equal(result.decision, 'READY_FOR_OPERATOR'); assert.equal(result.totalScore, 100); assert.equal(result.contentIdentity.revision, 1); assert.ok(result.contentIdentity.fingerprint); });
test('hard blocker wins over high score', () => { const c = context(); c.contactState.suppression = 'OPPOSED'; const result = evaluateCommercialQualityGate({ context: c, candidate: candidate(c), expectedOutcome: { decision: 'DO_NOT_CONTACT', reason: 'SUPPRESSED_OR_OPPOSED' }, semanticAssessment: quality }); assert.equal(result.decision, 'ABSTAIN'); assert.equal(result.regenerationAllowed, false); });
test('unsupported evidence abstains and cannot regenerate', () => { const c = context(); c.claims[0].status = 'UNSUPPORTED'; const result = evaluateCommercialQualityGate({ context: c, candidate: candidate(c), expectedOutcome: { decision: 'INSUFFICIENT_GROUNDING', reason: 'UNSUPPORTED_REQUIRED_CLAIM' }, semanticAssessment: quality }); assert.equal(result.decision, 'ABSTAIN'); assert.equal(result.regenerationAllowed, false); });
test('rewrite defect regenerates once then remains below threshold', () => { const c = context(); const m = candidate(c); m.body += ' Dans le monde digital d’aujourd’hui.'; m.contentRef = commercialContentRef(m); const first = evaluateCommercialQualityGate({ context: c, candidate: m, expectedOutcome: expected, semanticAssessment: { ...quality, channelFit: 1 } }); assert.equal(first.decision, 'REGENERATE'); assert.equal(first.regenerationAllowed, true); const second = evaluateCommercialQualityGate({ context: c, candidate: m, expectedOutcome: expected, semanticAssessment: { ...quality, channelFit: 1 }, regenerationAttempt: MAX_REGENERATION_ATTEMPTS }); assert.equal(second.decision, 'REGENERATE'); assert.equal(second.regenerationAllowed, false); });
test('EMAIL and MOBILE are independently structured', () => { const email = context('EMAIL'); const mobile = context('MOBILE'); const bad = candidate(mobile); bad.composition = 'SHORTENED_EMAIL'; const result = evaluateCommercialQualityGate({ context: mobile, candidate: bad, expectedOutcome: expected, semanticAssessment: quality }); assert.equal(result.decision, 'BLOCKED'); assert.ok(result.blockers.includes('MOBILE_STRUCTURE')); assert.equal(evaluateCommercialQualityGate({ context: email, candidate: candidate(email), expectedOutcome: expected, semanticAssessment: quality }).decision, 'READY_FOR_OPERATOR'); });
test('edited false price, link, feature, pressure and stale identity fail fresh evaluation', () => { const c = context(); const base = candidate(c); assert.equal(evaluateCommercialQualityGate({ context: c, candidate: base, expectedOutcome: expected, semanticAssessment: quality }).decision, 'READY_FOR_OPERATOR'); for (const mutation of [' 99€', ' https://wrong.example.test/x', ' réservation connectée', ' dernière chance aujourd’hui']) { const edited = { ...base, body: base.body + mutation }; const result = evaluateCommercialQualityGate({ context: c, candidate: edited, expectedOutcome: expected, semanticAssessment: quality }); assert.notEqual(result.decision, 'READY_FOR_OPERATOR'); } assert.deepEqual(contextIssues(c), []); });
test('claim-aware CTA and MOBILE question detection ignores factual assertion punctuation', () => {
  for (const channel of ['EMAIL', 'MOBILE'] as const) {
    const c = context(channel);
    const factual = channel === 'EMAIL' ? 'Réservez directement par téléphone au 0596 00 00 00.' : 'Réservez directement par téléphone au 0596 00 00 00 ?';
    c.sources[0].fact = factual; c.claims[0].text = factual; c.claims[0].evidenceExcerptOrFact = factual;
    const m = candidate(c);
    const result = evaluateCommercialQualityGate({ context: c, candidate: m, expectedOutcome: expected, semanticAssessment: quality });
    assert.equal(result.decision, 'READY_FOR_OPERATOR', channel);
    assert.ok(!result.blockers.includes('COMPETING_CTAS'), channel);
    assert.ok(!result.blockers.includes('MOBILE_ONE_QUESTION'), channel);
  }
});
test('real competing commercial CTAs and real multiple MOBILE questions still fail', () => {
  const email = context('EMAIL'); const emailCandidate = candidate(email); emailCandidate.body += ' Appelez-moi ou réservez maintenant.';
  const emailResult = evaluateCommercialQualityGate({ context: email, candidate: emailCandidate, expectedOutcome: expected, semanticAssessment: quality });
  assert.ok(emailResult.blockers.includes('COMPETING_CTAS'));
  const mobile = context('MOBILE'); const mobileCandidate = candidate(mobile); mobileCandidate.body = mobileCandidate.body.replace('Souhaitez-vous le voir ?', 'Souhaitez-vous le voir ? Voulez-vous répondre ?');
  const mobileResult = evaluateCommercialQualityGate({ context: mobile, candidate: mobileCandidate, expectedOutcome: expected, semanticAssessment: quality });
  assert.ok(mobileResult.blockers.includes('MOBILE_ONE_QUESTION'));
});
test('no transport and no second prospect score', () => { const c = context(); const result = evaluateCommercialQualityGate({ context: c, candidate: candidate(c), expectedOutcome: expected, semanticAssessment: quality, transportActions: [] }); assert.equal(result.objectiveCheckResults.find(x => x.id === 'NO_TRANSPORT_ACTION')?.pass, true); assert.equal('prospectScore' in result, false); });
test('required M01-M14 mutations fail for their intended deterministic reason', () => {
  const mutations: Array<[string, (c: CommercialContext, m: CommercialMessageCandidate) => void, string]> = [
    ['M01', (_c, m) => { m.body = m.body.replace('https://quality.example.test/proposal', 'https://wrong.example.test/x'); }, 'CANONICAL_LINK_EXACT'],
    ['M02', (c, m) => { m.assertions[0] = { claimId: 'missing', text: c.claims[0].text }; }, 'CLAIMS_RESOLVE'],
    ['M03', c => { c.claims[0].status = 'CONFLICTED'; }, 'ABSTAIN'],
    ['M04', (_c, m) => { m.body += ' Réservation connectée incluse.'; }, 'INVENTED_FEATURE'],
    ['M05', (_c, m) => { m.body += ' Premium à 99€.'; }, 'UNAUTHORIZED_COMMERCIAL_TERM'],
    ['M06', (_c, m) => { m.body += ' Remise de 20%.'; }, 'UNAUTHORIZED_COMMERCIAL_TERM'],
    ['M07', (_c, m) => { m.body += ' Comme convenu lors de notre échange.'; }, 'FAKE_PRIOR_RELATIONSHIP'],
    ['M08', (_c, m) => { m.body += ' Dernière chance aujourd’hui.'; }, 'INVENTED_URGENCY'],
    ['M09', (_c, m) => { m.body += ' Vous perdez des clients.'; }, 'INVENTED_COMMERCIAL_LOSS'],
    ['M10', (_c, m) => { m.body += ' Appelez-moi ou réservez maintenant.'; }, 'COMPETING_CTAS'],
    ['M11', (_c, m) => { m.composition = 'SHORTENED_EMAIL'; }, 'MOBILE_STRUCTURE'],
    ['M12', (_c, m) => { m.body += ' {{nom}}'; }, 'NO_PLACEHOLDERS'],
    ['M13', (_c, m) => { m.revision = 2; }, 'REVISION_APPROVAL_NOT_TRANSFERRED'],
    ['M14', c => { c.artifact!.prospectId = 'synthetic:other'; }, 'ABSTAIN'],
  ];
  for (const [id, mutate, expectedReason] of mutations) {
    const mobile = id === 'M11'; const c = context(mobile ? 'MOBILE' : 'EMAIL'); const m = candidate(c); mutate(c, m);
    const result = evaluateCommercialQualityGate({ context: c, candidate: m, expectedOutcome: c.artifact?.prospectId === c.prospect.id ? expected : { decision: 'INSUFFICIENT_GROUNDING', reason: 'CONFLICTED_CONTEXT' }, semanticAssessment: quality });
    if (expectedReason === 'ABSTAIN') assert.equal(result.decision, 'ABSTAIN', id); else assert.ok(result.blockers.includes(expectedReason) || result.warnings.includes(expectedReason) || result.objectiveCheckResults.some(check => check.id === expectedReason && !check.pass), id);
  }
});
test('all CP01 fixtures and 38 channel cases execute through the quality gate', async () => {
  const { commercialFixtures } = await import('./fixtures/agent3-commercial/fixtures');
  let count = 0;
  for (const fixture of commercialFixtures) for (const scenario of fixture.cases) {
    const c = structuredClone(fixture.context); c.channel = scenario.channel;
    const scenarioCandidate = scenario.expected.decision === 'GENERATE' ? candidate(c) : null;
    const result = evaluateCommercialQualityGate({ context: c, candidate: scenarioCandidate, expectedOutcome: scenario.expected, semanticAssessment: quality });
    assert.equal(result.abstentionReason, scenario.expected.reason, `${fixture.id}:${scenario.name}`);
    assert.equal(result.decision === 'ABSTAIN', scenario.expected.decision !== 'GENERATE', `${fixture.id}:${scenario.name}:decision`);
    count++;
  }
  assert.equal(commercialFixtures.length, 28); assert.equal(count, 38);
});
