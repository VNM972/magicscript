import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  createPlaybookChangeHumanDecision,
  InMemoryHumanDecisionStore,
  type PlaybookChangeProposal,
} from '../index';

const proposal: PlaybookChangeProposal = {
  schemaVersion: 1,
  proposalVersion: 'PLAYBOOK_CHANGE_PROPOSAL_V1',
  proposalId: 'playbook-proposal-1',
  status: 'PENDING_HUMAN_REVIEW',
  originatingInsightIds: ['insight-1'],
  rawFeedbackEventIds: ['event-1'],
  targetScope: { type: 'CHANNEL_MESSAGING', component: 'messaging', value: 'EMAIL' },
  currentBehaviorQuestioned: 'Current behavior is questioned.',
  proposedChange: 'Consider a bounded test.',
  reason: 'Evidence is eligible.',
  supportingObservation: 'Repeated signal.',
  supportingCounts: { EDITED: 2 },
  sampleSize: 2,
  evidenceSufficient: true,
  expectedBenefit: 'Better fit.',
  knownRisks: ['May not generalize.'],
  reversibility: 'Reversible.',
  applicationStatement: 'NOT_APPLIED_PENDING_HUMAN_REVIEW',
  createdAt: '2026-01-01T00:00:00Z',
  observationWindow: { from: '2025-12-01T00:00:00Z', to: '2026-01-01T00:00:00Z' },
};

function decision(decision: 'APPROVE' | 'REJECT' | 'KEEP_TESTING', id = `decision-${decision}`) {
  return createPlaybookChangeHumanDecision(proposal, {
    decisionId: id,
    decision,
    humanActor: 'operator-1',
    decidedAt: '2026-01-02T00:00:00Z',
    rationale: { summary: 'Human review recorded.' },
  });
}

describe('CP05-A4 human decisions', () => {
  it('records all explicit decision values and retains exact provenance', async () => {
    for (const value of ['APPROVE', 'REJECT', 'KEEP_TESTING'] as const) {
      const store = new InMemoryHumanDecisionStore();
      await store.save(decision(value));
      const saved = await store.listByProposal(proposal.proposalId);
      assert.equal(saved[0].decision, value);
      assert.deepEqual(saved[0].originatingInsightIds, proposal.originatingInsightIds);
      assert.deepEqual(saved[0].rawFeedbackEventIds, proposal.rawFeedbackEventIds);
      assert.equal(saved[0].applied, false);
    }
  });

  it('fails closed for malformed authority and non-review proposals', () => {
    assert.throws(() => createPlaybookChangeHumanDecision(proposal, {
      decisionId: 'missing-actor', decision: 'APPROVE', humanActor: '', decidedAt: 'invalid',
    }), /HUMAN_ACTOR_REQUIRED/);
    assert.throws(() => createPlaybookChangeHumanDecision({ ...proposal, status: 'DRAFT' }, {
      decisionId: 'draft', decision: 'APPROVE', humanActor: 'operator-1', decidedAt: '2026-01-02T00:00:00Z',
    }), /PROPOSAL_NOT_AWAITING_HUMAN_REVIEW/);
  });

  it('binds identity and revision and rejects immutable/conflicting writes', async () => {
    const store = new InMemoryHumanDecisionStore();
    const first = decision('APPROVE', 'fixed-id');
    await store.save(first);
    await assert.rejects(() => store.save({ ...first, decision: 'REJECT' }), /IMMUTABLE_HUMAN_DECISION_CONFLICT/);
    const successor = { ...proposal, proposalId: 'successor-proposal' };
    const successorDecision = createPlaybookChangeHumanDecision(successor, {
      decisionId: 'successor-decision', decision: 'APPROVE', humanActor: 'operator-1', decidedAt: '2026-01-02T00:00:00Z',
    });
    assert.notEqual(successorDecision.proposalFingerprint, first.proposalFingerprint);
    await store.save(successorDecision);
  });
});
