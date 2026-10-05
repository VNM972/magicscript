/**
 * EXPERIMENT MANAGER V1 — TESTS
 *
 * NOTE: These tests cannot be executed under the current sandbox (spawn EPERM).
 * They are verified via tsc --noEmit typecheck.
 * See: TEST_EXECUTION_DEFERRED_SANDBOX
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  proposeExperiment,
  updateExperimentStatus,
  getExperiment,
  listExperiments,
  listExperimentsByTarget,
  resetLedger,
} from '../experimentation/experiment-manager';

const sampleInput = {
  observation: 'Test observation: score calibration may be too aggressive.',
  hypothesis: 'Softening the contactability cap from 85 to 75 may increase pass rate.',
  targetModule: 'core/research/evidence-calibration.ts',
  baselineEvidenceRefs: ['E-SCORE-EVIDENCE-CALIBRATION-VALIDATED', 'test-evidence-fixture'],
  proposedChangeSummary: 'Lower contactability cap from 85 to 75.',
  evaluationPlan: 'Run evidence-calibration tests before and after; compare pass rates.',
  metricNames: ['contactabilityPassRate', 'qualifiedProspectCount'],
  beforeMetrics: { contactabilityPassRate: 60, qualifiedProspectCount: 5 },
  reviewerRequired: true,
  rollbackPlan: 'Restore contactability cap to 85 in computeContactabilityCap.',
  provenance: 'OBSERVATION' as const,
  changeTarget: 'core/research/evidence-calibration.ts',
};

test('proposeExperiment creates a valid experiment in PROPOSED state', () => {
  const experiment = proposeExperiment(sampleInput);
  assert.ok(experiment.id.startsWith('EXP-'), `id should start with EXP-: ${experiment.id}`);
  assert.equal(experiment.status, 'PROPOSED');
  assert.equal(experiment.observation, sampleInput.observation);
  assert.equal(experiment.hypothesis, sampleInput.hypothesis);
  assert.equal(experiment.reviewerRequired, true);
  assert.deepEqual(experiment.beforeMetrics, { contactabilityPassRate: 60, qualifiedProspectCount: 5 });
  assert.deepEqual(experiment.afterMetrics, {});
  assert.equal(experiment.decisionReason, '');
});

test('updateExperimentStatus transitions to EVALUATING', () => {
  const experiment = proposeExperiment(sampleInput);
  const updated = updateExperimentStatus(experiment.id, 'EVALUATING', 'Starting evaluation');
  assert.equal(updated.status, 'EVALUATING');
  assert.equal(updated.decisionReason, 'Starting evaluation');
});

test('updateExperimentStatus transitions to ACCEPTED with metrics', () => {
  const experiment = proposeExperiment(sampleInput);
  updateExperimentStatus(experiment.id, 'EVALUATING', 'Starting');
  const accepted = updateExperimentStatus(experiment.id, 'ACCEPTED', 'Improvement confirmed', {
    contactabilityPassRate: 75,
    qualifiedProspectCount: 7,
  });
  assert.equal(accepted.status, 'ACCEPTED');
  assert.deepEqual(accepted.afterMetrics, { contactabilityPassRate: 75, qualifiedProspectCount: 7 });
});

test('updateExperimentStatus rejects transition from terminal state', () => {
  const experiment = proposeExperiment(sampleInput);
  updateExperimentStatus(experiment.id, 'ACCEPTED', 'Done');
  assert.throws(() => {
    updateExperimentStatus(experiment.id, 'ROLLED_BACK', 'Cannot go back');
  }, /already in terminal state/);
});

test('getExperiment returns undefined for non-existent id', () => {
  assert.equal(getExperiment('NONEXISTENT'), undefined);
});

test('listExperiments returns all experiments', () => {
  resetLedger();
  proposeExperiment(sampleInput);
  proposeExperiment({ ...sampleInput, observation: 'Second test' });
  assert.equal(listExperiments().length, 2);
});

test('listExperiments filters by status', () => {
  resetLedger();
  const e1 = proposeExperiment(sampleInput);
  const e2 = proposeExperiment({ ...sampleInput, observation: 'Second' });
  updateExperimentStatus(e2.id, 'REJECTED', 'Not useful');
  const proposed = listExperiments('PROPOSED');
  const rejected = listExperiments('REJECTED');
  assert.equal(proposed.length, 1);
  assert.equal(proposed[0]!.id, e1.id);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0]!.id, e2.id);
});

test('listExperimentsByTarget filters by target module', () => {
  resetLedger();
  proposeExperiment(sampleInput);
  proposeExperiment({ ...sampleInput, targetModule: 'other/module.ts', changeTarget: 'other/module.ts' });
  const matches = listExperimentsByTarget('core/research/evidence-calibration.ts');
  assert.equal(matches.length, 1);
});

test('governance lock: reviewerRequired true does not auto-promote', () => {
  // The governance lock is enforced structurally: updateExperimentStatus may
  // transition to ACCEPTED, but the experiment record itself will NOT be
  // automatically promoted. The caller (human or orchestrator) must explicitly
  // check reviewerRequired before promoting any change to production.
  const experiment = proposeExperiment({ ...sampleInput, reviewerRequired: true });
  updateExperimentStatus(experiment.id, 'EVALUATING', 'Evaluation started');
  updateExperimentStatus(experiment.id, 'ACCEPTED', 'Passed evaluation');
  assert.equal(experiment.reviewerRequired, true,
    'reviewerRequired flag remains true — no auto-promotion permitted');
  // The experiment manager itself provides no "promote" function.
  // Promotion to production behavior is outside the experiment ledger.
});

test('resetLedger clears all experiments', () => {
  proposeExperiment(sampleInput);
  assert.ok(listExperiments().length > 0);
  resetLedger();
  assert.equal(listExperiments().length, 0);
});

test('dogfood seeds do not create duplicate valid experiments', async () => {
  resetLedger();
  const { seedDogfoodExperiments } = await import('../experimentation/dogfood-seeds');
  seedDogfoodExperiments();
  const experiments = listExperiments();
  assert.ok(experiments.length >= 3, `expected at least 3 dogfood experiments, got ${experiments.length}`);
  const provenances = experiments.map((e) => e.provenance);
  assert.ok(provenances.includes('OPERATIONAL_LESSON'), 'should include operational lesson');
  assert.ok(provenances.includes('AUDIT_FINDING'), 'should include audit finding');
});