import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildQuoteDossier,
  mergeQuoteDossier,
  resolveQuoteDossierConflict,
  applyCommercialScopeProfile,
  validateQuoteDossier,
} from '../orchestrator/quote-dossier';

const baseInput = {
  id: 'dossier-001',
  prospectId: 'prospect-001',
  companyName: 'Entreprise test',
  primaryFriction: 'Recevoir plus de demandes',
  now: '2026-09-03T16:00:00.000Z',
};

test('prefills confirmed values while keeping suggestions, unknowns, and pricing safe', () => {
  const dossier = buildQuoteDossier({
    ...baseInput,
    snapshot: {
      session_id: 'session-001',
      confirmed_facts: [{ key: 'site_scope', value: 'Site vitrine', factual_status: 'CONFIRMED', provenance: 'STATED_BY_PROSPECT' }],
      validated_knowledge: [],
      operator_notes: ['Le prospect veut simplifier son parcours'],
      unknowns: ['Prix'],
      inferences_to_review: ['Besoin de rÃ©servation'],
      timing: null,
      decision_authority: 'UNKNOWN',
      active_objections: [],
      multi_signal_buffer: [{ type: 'domain_constraint', value: 'Pas de paiement en ligne', factual_status: 'UNVALIDATED', source_turn: 'turn-1' }],
      next_best_action: { action: 'CLARIFY', why: 'Clarifier le besoin' },
    },
  });

  assert.equal(dossier.requestedScope.value, 'Site vitrine');
  assert.equal(dossier.requestedScope.evidenceStatus, 'CONFIRMED');
  assert.equal(dossier.recommendedNextAction.evidenceStatus, 'SYSTEM_SUGGESTION');
  assert.equal(dossier.pricing.value, null);
  assert.equal(dossier.pricing.evidenceStatus, 'UNKNOWN');
  assert.ok(dossier.openQuestions.includes('Prix'));
  assert.ok(dossier.openQuestions.includes('Besoin de rÃ©servation'));
  assert.ok(dossier.openQuestions.includes('AutoritÃ© de dÃ©cision'));
  assert.equal(dossier.constraints[0]?.evidenceStatus, 'OPERATOR_NOTE');
});

test('surfaces a canonical conflict and resolves only that field explicitly', () => {
  const existing = buildQuoteDossier({
    ...baseInput,
    snapshot: {
      session_id: 'session-001',
      confirmed_facts: [{ key: 'site_scope', value: 'Site vitrine', factual_status: 'CONFIRMED', provenance: 'human_review' }],
      validated_knowledge: [],
      operator_notes: [],
      unknowns: [],
      timing: null,
      decision_authority: 'UNKNOWN',
      active_objections: [],
      multi_signal_buffer: [],
      next_best_action: { action: 'CLARIFY', why: 'Clarifier' },
    },
  });
  const incoming = buildQuoteDossier({
    ...baseInput,
    now: '2026-09-03T16:01:00.000Z',
    snapshot: {
      session_id: 'session-002',
      confirmed_facts: [{ key: 'site_scope', value: 'Site e-commerce', factual_status: 'CONFIRMED', provenance: 'human_review' }],
      validated_knowledge: [],
      operator_notes: [],
      unknowns: [],
      timing: null,
      decision_authority: 'UNKNOWN',
      active_objections: [],
      multi_signal_buffer: [],
      next_best_action: { action: 'CLARIFY', why: 'Clarifier' },
    },
  });
  const conflicted = mergeQuoteDossier(existing, incoming);
  assert.deepEqual(conflicted.conflicts.length, 1);
  assert.match(conflicted.conflicts[0], /^requestedScope:/);
  assert.equal(conflicted.requestedScope.evidenceStatus, 'CONFLICT');

  const resolved = resolveQuoteDossierConflict(conflicted, 'requestedScope', 'Site e-commerce validÃ©', '2026-09-03T16:02:00.000Z');
  assert.equal(resolved.conflicts.length, 0);
  assert.equal(resolved.requestedScope.evidenceStatus, 'CONFIRMED');
  assert.equal(resolved.requestedScope.provenance, 'human_conflict_resolution');
  assert.equal(validateQuoteDossier(resolved, '2026-09-03T16:03:00.000Z').status, 'HUMAN_VALIDATED');
});

test('keeps arbitrary informational conflicts non-blocking and preserves them as questions', () => {
  const dossier = buildQuoteDossier(baseInput);
  const merged = mergeQuoteDossier(
    { ...dossier, conflicts: ['contradiction: information Ã  vÃ©rifier'] },
    dossier,
  );
  assert.deepEqual(merged.conflicts, []);
  assert.ok(merged.openQuestions.includes('contradiction: information Ã  vÃ©rifier'));
});
test('applies canonical fixed pricing only from a structured commercial scope', () => {
  const dossier = buildQuoteDossier(baseInput);

  const starter = applyCommercialScopeProfile(
    dossier,
    {
      siteKind: 'SHOWCASE',
      pageCount: 1,
      lightweightFeatures: [],
      complexRequirements: [],
    },
    '2026-09-04T19:00:00.000Z',
  );

  assert.equal(starter.commercialScope.pageCount, 1);
  assert.equal(starter.pricing.evidenceStatus, 'CONFIRMED');
  assert.equal(starter.pricing.provenance, 'canonical_pricing_policy');
  assert.equal(starter.pricing.sourceRef, 'STARTER');
  assert.match(starter.pricing.value ?? '', /790\.00 EUR/);

  const essentiel = applyCommercialScopeProfile(
    dossier,
    {
      siteKind: 'SHOWCASE',
      pageCount: 4,
      lightweightFeatures: [],
      complexRequirements: [],
    },
    '2026-09-04T19:01:00.000Z',
  );

  assert.equal(essentiel.pricing.sourceRef, 'ESSENTIEL');
  assert.match(essentiel.pricing.value ?? '', /1190\.00 EUR/);

  const business = applyCommercialScopeProfile(
    dossier,
    {
      siteKind: 'SHOWCASE',
      pageCount: 6,
      lightweightFeatures: ['THIRD_PARTY_BOOKING'],
      complexRequirements: [],
    },
    '2026-09-04T19:02:00.000Z',
  );

  assert.equal(business.pricing.sourceRef, 'BUSINESS');
  assert.match(business.pricing.value ?? '', /1690\.00 EUR/);
});

test('never turns Premium FROM pricing into an automatic final quote', () => {
  const dossier = buildQuoteDossier(baseInput);

  const premium = applyCommercialScopeProfile(
    dossier,
    {
      siteKind: 'SHOWCASE',
      pageCount: 9,
      lightweightFeatures: [],
      complexRequirements: [],
    },
    '2026-09-04T19:03:00.000Z',
  );

  assert.equal(premium.pricing.value, null);
  assert.equal(premium.pricing.evidenceStatus, 'UNKNOWN');
  assert.equal(premium.pricing.provenance, 'premium_floor_requires_exact_quote');
  assert.equal(premium.pricing.sourceRef, 'PREMIUM');
});

test('keeps custom and incomplete scopes fail-closed without an automatic amount', () => {
  const dossier = buildQuoteDossier(baseInput);

  const custom = applyCommercialScopeProfile(
    dossier,
    {
      siteKind: 'ECOMMERCE',
      pageCount: 4,
      lightweightFeatures: [],
      complexRequirements: [],
    },
    '2026-09-04T19:04:00.000Z',
  );

  assert.equal(custom.pricing.value, null);
  assert.equal(custom.pricing.evidenceStatus, 'UNKNOWN');
  assert.equal(custom.pricing.provenance, 'custom_quote_required');
  assert.equal(custom.pricing.sourceRef, 'CUSTOM');

  const unknown = applyCommercialScopeProfile(
    dossier,
    {
      siteKind: 'SHOWCASE',
      pageCount: null,
      lightweightFeatures: [],
      complexRequirements: [],
    },
    '2026-09-04T19:05:00.000Z',
  );

  assert.equal(unknown.pricing.value, null);
  assert.equal(unknown.pricing.evidenceStatus, 'UNKNOWN');
  assert.equal(unknown.pricing.provenance, 'commercial_scope_incomplete');
  assert.equal(unknown.pricing.sourceRef, null);
});


