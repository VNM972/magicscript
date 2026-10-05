import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialFixtures } from './fixtures/agent3-commercial/fixtures';
import { prepareCommercialOutreach, mobileGeneratorAdapter, type PreparationContext } from '../outreach/commercial-preparation';
import { MAX_REGENERATION_ATTEMPTS } from '../outreach/commercial-quality-gate';
import { SITE_UNDER_CONSTRUCTION_STATE, resolveVerticalProfile, V1_VERTICAL_PROFILES } from '../outreach/commercial-profiles';

const qualityFixture = commercialFixtures.find(f => f.id === 'F01')!;
function context(channel: 'EMAIL' | 'MOBILE' = 'EMAIL') {
  const c = structuredClone(qualityFixture.context); c.channel = channel; return c;
}
test('CP03 exposes exactly four bounded V1 profiles and neutral mode', () => {
  assert.deepEqual(V1_VERTICAL_PROFILES, ['RESTAURANTS_BARS_CAFES', 'BEAUTY_HAIR_BARBER', 'LOCAL_RETAIL', 'LOCAL_SERVICES']);
  assert.equal(resolveVerticalProfile('UNKNOWN_VERTICAL').id, 'NEUTRAL_EVIDENCE_ONLY');
});
test('canonical preparation makes a ready native EMAIL candidate through CP02', () => {
  const result = prepareCommercialOutreach(context('EMAIL'));
  assert.equal(result.decision, 'READY_FOR_OPERATOR');
  assert.equal(result.qualityGate?.decision, 'READY_FOR_OPERATOR');
  assert.equal(result.trace.attempts, 1);
  assert.equal((result.body!.match(/https:\/\//g) ?? []).length, 1);
  assert.equal(result.candidate?.composition, 'EMAIL_ORIGINAL');
});
test('MOBILE uses a distinct native adapter and preserves manual semantics', () => {
  const result = prepareCommercialOutreach(context('MOBILE'), mobileGeneratorAdapter);
  assert.equal(result.decision, 'READY_FOR_OPERATOR');
  assert.equal(result.candidate?.composition, 'MOBILE_ORIGINAL');
  assert.equal(result.candidate?.subject, null);
  assert.equal(result.candidate?.transportSignature, null);
  assert.equal(result.body!.split('\n')[0], 'Bonjour, ici Magic Script. J’ai relevé ce détail chez Atelier Fictif F01 : Ces deux cartes peuvent être regroupées dans une présentation. La carte du midi et la carte du soir figurent sur deux pages distinctes.. Nous avons préparé une démo : https://demo.example.test/f01');
});
test('missing or wrong-prospect demo cannot become ready', () => {
  const missing = context(); missing.artifact = null;
  assert.notEqual(prepareCommercialOutreach(missing).decision, 'READY_FOR_OPERATOR');
  const wrong = context(); wrong.artifact!.prospectId = 'other';
  assert.notEqual(prepareCommercialOutreach(wrong).decision, 'READY_FOR_OPERATOR');
});
test('Athena uses explicit supported under-construction evidence without generic opportunity linkage', () => {
  const absent = context() as PreparationContext; absent.commercialState = SITE_UNDER_CONSTRUCTION_STATE;
  assert.equal(prepareCommercialOutreach(absent).decision, 'ABSTAIN');
  const supported = context() as PreparationContext; supported.commercialState = SITE_UNDER_CONSTRUCTION_STATE; supported.agent1.opportunity = null;
  const source = supported.sources[0]; source.fact = 'Le site est actuellement under construction.';
  supported.claims[0].text = source.fact; supported.claims[0].evidenceExcerptOrFact = source.fact;
  const ready = prepareCommercialOutreach(supported);
  assert.equal(ready.decision, 'READY_FOR_OPERATOR');
  assert.deepEqual(ready.claimsUsed, [supported.claims[0].id]);
  const unsupported = structuredClone(supported); unsupported.claims[0].status = 'UNSUPPORTED';
  assert.equal(prepareCommercialOutreach(unsupported).decision, 'ABSTAIN');
  const conflicted = structuredClone(supported); conflicted.claims[0].status = 'CONFLICTED';
  assert.equal(prepareCommercialOutreach(conflicted).decision, 'ABSTAIN');
});
test('preparation never exceeds one targeted correction', () => {
  const result = prepareCommercialOutreach(context());
  assert.ok(result.trace.attempts <= MAX_REGENERATION_ATTEMPTS + 1);
  assert.ok(result.correctionHistory.length <= MAX_REGENERATION_ATTEMPTS);
});
test('twelve annotated exemplars remain separate and exact', async () => {
  const { COMMERCIAL_EXEMPLARS } = await import('../outreach/commercial-exemplars');
  assert.equal(COMMERCIAL_EXEMPLARS.length, 12);
  assert.equal(new Set(COMMERCIAL_EXEMPLARS.map(x => x.id)).size, 12);
});
