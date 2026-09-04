import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyCallCopilotAction,
  buildCallCopilotSnapshot,
  buildEndOfCallReview,
  extractMultiSignals,
  type CallCopilotSnapshot,
} from '../orchestrator/call-copilot';
import {
  CALL_COPILOT_SCENARIOS,
  simulateCallCopilotScenario,
} from '../simulation/call-copilot-scenarios';

const context = {
  prospectId: 'p-copilot',
  companyName: 'Entreprise Test',
  activity: 'Sécurité',
  location: 'Fort-de-France',
  primaryNeed: 'présence digitale',
  prototypeUrl: 'http://127.0.0.1:4173/demo/entreprise-test',
  salesRoomUrl: 'http://127.0.0.1:4173/p/entreprise-test',
  confirmedFacts: [{ key: 'activité', value: 'Sécurité' }],
  unknowns: ['Prix', 'Délai'],
};

const now = '2026-09-03T12:00:00.000Z';

function response(snapshot: CallCopilotSnapshot, text: string): CallCopilotSnapshot {
  return applyCallCopilotAction(snapshot, { type: 'PROSPECT_RESPONSE', text }, now);
}

test('copilot keeps predictions, operator input and validated knowledge in separate planes', () => {
  let snapshot = buildCallCopilotSnapshot(context, now, 'session-planes');
  const predictionId = snapshot.predictions[0].id;
  snapshot = applyCallCopilotAction(snapshot, { type: 'SELECT_PREDICTION', predictionId }, now);
  assert.equal(snapshot.confirmed_facts.some((fact) => fact.value === snapshot.predictions[0].text), false);
  assert.equal(snapshot.operator_inputs.at(-1)?.kind, 'OPERATOR_SELECTED_PREDICTION');
  assert.notEqual(snapshot.operator_inputs.at(-1)?.kind, 'STATED_BY_PROSPECT');

  snapshot = response(snapshot, 'Le prototype me plaît et je veux avancer.');
  assert.equal(snapshot.operator_inputs.at(-1)?.kind, 'OPERATOR_PARAPHRASE');
  assert.equal(snapshot.audit_trail.at(-1)?.action, 'PROSPECT_RESPONSE');
  assert.equal(snapshot.audit_trail.at(-1)?.detail.includes('transcription audio'), true);
  assert.equal(snapshot.confirmed_facts.some((fact) => fact.factual_status !== 'CONFIRMED'), false);

  snapshot = applyCallCopilotAction(snapshot, {
    type: 'VALIDATE_KNOWLEDGE',
    key: 'besoin_confirmé',
    value: 'présence digitale plus claire',
    rawInput: 'Le besoin confirmé est une présence digitale plus claire.',
  }, now);
  assert.equal(snapshot.validated_knowledge.at(-1)?.factual_status, 'CONFIRMED');
  assert.equal(snapshot.validated_knowledge.at(-1)?.provenance, 'OPERATOR_NOTE');
});

test('multi-signal extraction preserves independent signals and provenance', () => {
  const signals = extractMultiSignals(
    'Le prototype me plaît mais j’ai déjà payé quelqu’un, je ne veux pas remettre 3 000 €, par contre si je garde mon domaine ça m’intéresse.',
    'turn-1',
    now,
  );
  const types = signals.map((item) => item.type);
  for (const expected of ['prototype_acceptance', 'past_provider_or_investment', 'price_objection', 'domain_constraint', 'conditional_interest']) {
    assert.equal(types.includes(expected), true, expected);
  }
  assert.equal(signals.every((item) => item.provenance === 'OPERATOR_PARAPHRASE'), true);
  assert.equal(signals.every((item) => item.factual_status === 'UNVALIDATED'), true);
});

test('contradiction is visible and asks for clarification without auto-resolution', () => {
  let snapshot = buildCallCopilotSnapshot(context, now, 'session-contradiction');
  snapshot = response(snapshot, 'Je veux remplacer complètement notre ancien site.');
  snapshot = response(snapshot, 'En fait je veux conserver exactement l’ancien site.');
  assert.equal(snapshot.context_drift, true);
  assert.equal(snapshot.next_best_action.action, 'CLARIFY');
  assert.equal(snapshot.confirmed_facts.some((fact) => fact.key === 'site_scope'), false);
});

test('explicit refusal and material blockers prevent forced closing', () => {
  let refused = buildCallCopilotSnapshot(context, now, 'session-refusal');
  refused = response(refused, 'Non merci, je ne suis pas intéressé.');
  assert.equal(refused.conversation_mode, 'EXIT');
  assert.equal(refused.next_best_action.action, 'EXIT_GRACEFULLY');
  assert.equal(refused.stop_discovery, false);

  let blocked = buildCallCopilotSnapshot(context, now, 'session-blocked');
  blocked = response(blocked, 'Le budget est trop serré, mais envoyez le devis.');
  assert.equal(blocked.next_best_action.action, 'HANDLE_OBJECTION');
  assert.equal(blocked.stop_discovery, false);
  assert.equal(blocked.conversation_mode, 'OBJECTION');
});

test('ready to close stops discovery, and reopening is possible after objection resolution', () => {
  let snapshot = buildCallCopilotSnapshot(context, now, 'session-reopen');
  snapshot = response(snapshot, 'Je veux avancer et recevoir le devis.');
  assert.equal(snapshot.conversation_mode, 'READY_TO_CLOSE');
  assert.equal(snapshot.next_best_action.action, 'MOVE_TO_QUOTE');
  assert.equal(snapshot.stop_discovery, true);
  assert.equal(snapshot.alerts.includes('READY_TO_CLOSE'), true);

  snapshot = response(snapshot, 'Le budget est trop serré.');
  assert.equal(snapshot.stop_discovery, false);
  assert.equal(snapshot.next_best_action.action, 'HANDLE_OBJECTION');
  snapshot = response(snapshot, 'La contrainte est levée, envoyez le devis.');
  assert.equal(snapshot.stop_discovery, true);
  assert.equal(snapshot.next_best_action.action, 'MOVE_TO_QUOTE');
});

test('unknown stays unknown and basic/premium never invent commercial promises', () => {
  let snapshot = buildCallCopilotSnapshot(context, now, 'session-unknown');
  snapshot = response(snapshot, 'Pouvez-vous garantir la première place sur Google ?');
  assert.equal(snapshot.unknowns.includes('Prix'), true);
  assert.equal(snapshot.offer_suggestions.basic.includes('€'), false);
  assert.equal(snapshot.offer_suggestions.premium.includes('garanti'), false);
  assert.equal(snapshot.offer_suggestions.premium.includes('classement'), false);
  assert.equal(snapshot.next_best_action.action, 'SHOW_VALUE');
});

test('end-of-call review separates durable facts from inferences and notes', () => {
  let snapshot = buildCallCopilotSnapshot(context, now, 'session-review');
  snapshot = response(snapshot, 'Je veux garder mon domaine.');
  snapshot = applyCallCopilotAction(snapshot, { type: 'OPERATOR_NOTE', text: 'Vérifier le domaine avant toute proposition.' }, now);
  snapshot = applyCallCopilotAction(snapshot, { type: 'VALIDATE_KNOWLEDGE', key: 'domain', value: 'domaine existant à conserver' }, now);
  const review = buildEndOfCallReview(snapshot);
  assert.deepEqual(review.operator_notes, ['Vérifier le domaine avant toute proposition.']);
  assert.equal(review.requested_changes.length, 1);
  assert.equal(review.facts_to_confirm.length, 1);
  assert.equal(review.unknowns.includes('Prix'), true);
});

test('all deterministic Simulation Lab scenarios pass their declared contract', () => {
  assert.equal(CALL_COPILOT_SCENARIOS.length >= 35, true);
  for (const definition of CALL_COPILOT_SCENARIOS) {
    const snapshot = simulateCallCopilotScenario(definition, now);
    const actualSignals = new Set(snapshot.multi_signal_buffer.map((item) => item.type));
    for (const expectedSignal of definition.expected_signals) {
      assert.equal(actualSignals.has(expectedSignal), true, `${definition.scenario_id}: missing ${expectedSignal}`);
    }
    assert.equal(snapshot.conversation_mode, definition.expected_mode, definition.scenario_id);
    assert.equal(snapshot.next_best_action.action, definition.expected_next_best_action, definition.scenario_id);
    assert.equal(snapshot.stop_discovery, definition.expected_stop_discovery, definition.scenario_id);
    for (const forbidden of definition.forbidden_actions) {
      if (forbidden === 'MUTATE_PROSPECT_LIFECYCLE') assert.equal(snapshot.audit_trail.some((entry) => entry.action.includes('LIFECYCLE')), false, definition.scenario_id);
      if (forbidden === 'SEND_EXTERNAL_MESSAGE') assert.equal(snapshot.audit_trail.some((entry) => entry.action.includes('SEND')), false, definition.scenario_id);
    }
    const selectedPrediction = definition.operator_actions.some((action) => action.type === 'SELECT_PREDICTION');
    assert.equal(
      snapshot.operator_inputs.some((input) => input.kind === 'OPERATOR_SELECTED_PREDICTION' && input.provenance === 'OPERATOR_NOTE'),
      selectedPrediction,
      definition.scenario_id,
    );
    assert.equal(snapshot.confirmed_facts.some((fact) => fact.provenance === 'MODEL_PREDICTION'), false, definition.scenario_id);
  }
});
