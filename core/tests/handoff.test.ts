import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHandoff, validateHandoff, type HandoffPacket } from '../orchestrator/handoff';

const validPacket: HandoffPacket = {
  id: 'handoff-001',
  sourceAgent: 'research-agent',
  nextOwner: 'prototype-master-btp',
  objective: 'Prepare a grounded prototype brief.',
  context: { prospectId: 'synthetic-btp-001', hubId: 'BTP' },
  inputs: ['research-result-001', 'prospect-synthetic-btp-001'],
  constraints: ['no-invented-claims', 'no-external-send'],
  expectedOutput: ['structured-prototype-brief'],
  verifier: { id: 'prototype-brief-check', requiredChecks: ['sources-present', 'cta-grounded'] },
  provenance: [{ source: 'research-agent', reference: 'event:research-result-001' }],
  confidence: 'MEDIUM',
  blockers: [],
  decisionScope: ['research-to-prototype-brief'],
  hubId: 'BTP',
};

test('accepts and normalizes a complete handoff without changing its confidence', () => {
  const normalized = normalizeHandoff({
    ...validPacket,
    inputs: ['research-result-001', 'research-result-001'],
    confidence: 'UNKNOWN',
  });

  assert.equal(validateHandoff(normalized).accepted, true);
  assert.deepEqual(normalized.inputs, ['research-result-001']);
  assert.equal(normalized.confidence, 'UNKNOWN');
});

test('rejects a handoff that cannot be routed or verified', () => {
  const result = validateHandoff({
    id: 'handoff-incomplete',
    sourceAgent: 'research-agent',
    objective: 'Incomplete synthetic packet',
    context: {},
    inputs: [],
    constraints: [],
    expectedOutput: [],
    verifier: { id: '', requiredChecks: [] },
    provenance: [],
    confidence: undefined,
    blockers: [],
    decisionScope: [],
  });

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('next owner is required'));
  assert.ok(result.reasons.includes('expected output is required'));
  assert.ok(result.reasons.includes('provenance is required'));
  assert.ok(result.reasons.includes('confidence must be explicit'));
  assert.ok(result.reasons.includes('decision scope is required'));
});
