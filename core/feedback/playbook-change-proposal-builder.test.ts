import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlaybookChangeProposals } from './playbook-change-proposal-builder';
import { assertPlaybookChangeProposal, type PlaybookChangeProposal } from './playbook-change-proposal-contract';
import type { AggregatedInsight } from './aggregated-insight-contract';

function insight(overrides: Partial<AggregatedInsight> = {}): AggregatedInsight {
  return {
    schemaVersion: 1,
    insightVersion: 'AGGREGATED_COMMERCIAL_INSIGHT_V1',
    insightId: 'insight-edit-1',
    pattern: 'edited_field=cta observed',
    dimensions: [{ name: 'edited_field', value: 'cta' }],
    eventCount: 3,
    counts: { SECTION_EDITED: 3 },
    ratio: null,
    eventIds: ['event-3', 'event-1', 'event-2'],
    prospectCount: 3,
    observationWindow: { from: '2026-01-01T00:00:00Z', to: '2026-01-03T00:00:00Z' },
    evidenceSufficient: true,
    recommendationEligible: true,
    ...overrides,
  };
}

function one(value: readonly PlaybookChangeProposal[]): PlaybookChangeProposal {
  assert.equal(value.length, 1);
  return value[0];
}

test('sufficient insight generates a bounded, unapplied proposal', () => {
  const proposal = one(buildPlaybookChangeProposals([insight()]));
  assert.equal(proposal.targetScope.type, 'EDITED_FIELD');
  assert.equal(proposal.targetScope.value, 'cta');
  assert.equal(proposal.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(proposal.applicationStatement, 'NOT_APPLIED_PENDING_HUMAN_REVIEW');
  assertPlaybookChangeProposal(proposal);
});

test('insufficient insight cannot generate a proposal', () => {
  assert.deepEqual(buildPlaybookChangeProposals([insight({ evidenceSufficient: false })]), []);
  assert.deepEqual(buildPlaybookChangeProposals([insight({ recommendationEligible: false })]), []);
});

test('identity and output are independent of input order', () => {
  const a = insight({ insightId: 'insight-a', eventIds: ['event-b', 'event-a'] });
  const b = insight({ insightId: 'insight-b', dimensions: [{ name: 'channel', value: 'EMAIL' }], eventIds: ['event-d', 'event-c'] });
  assert.deepEqual(buildPlaybookChangeProposals([a, b]), buildPlaybookChangeProposals([b, a]));
});

test('duplicate insight IDs do not duplicate proposals', () => {
  assert.equal(buildPlaybookChangeProposals([insight(), insight()]).length, 1);
});

test('exact insight and raw event provenance is retained', () => {
  const proposal = one(buildPlaybookChangeProposals([insight()]));
  assert.deepEqual(proposal.originatingInsightIds, ['insight-edit-1']);
  assert.deepEqual(proposal.rawFeedbackEventIds, ['event-1', 'event-2', 'event-3']);
});

test('ambiguous and unsupported target scopes fail closed', () => {
  assert.deepEqual(buildPlaybookChangeProposals([insight({ dimensions: [] })]), []);
  assert.deepEqual(buildPlaybookChangeProposals([insight({ dimensions: [{ name: 'signal_channel', value: 'EDITED:EMAIL' }] })]), []);
  assert.deepEqual(buildPlaybookChangeProposals([insight({ dimensions: [{ name: 'signal', value: 'EDITED' }] })]), []);
});

test('builder does not mutate A2 input', () => {
  const input = insight();
  const before = JSON.stringify(input);
  buildPlaybookChangeProposals([input]);
  assert.equal(JSON.stringify(input), before);
});

test('proposal makes no applied or causal claim', () => {
  const proposal = one(buildPlaybookChangeProposals([insight()]));
  assert.match(proposal.proposedChange, /Consider testing/);
  assert.match(proposal.reason, /does not establish causality/);
  assert.equal(proposal.applicationStatement, 'NOT_APPLIED_PENDING_HUMAN_REVIEW');
});

// CP01/CP02/CP03/playbook behavior is intentionally not imported or invoked by this layer.
test('proposal layer has no playbook mutation surface', () => {
  const proposal = one(buildPlaybookChangeProposals([insight()]));
  assert.equal(proposal.status, 'PENDING_HUMAN_REVIEW');
  assert.equal(proposal.applicationStatement, 'NOT_APPLIED_PENDING_HUMAN_REVIEW');
});
