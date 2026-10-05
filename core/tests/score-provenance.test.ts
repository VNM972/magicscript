import assert from 'node:assert/strict';
import test from 'node:test';
import { getNextAction } from '../orchestrator/next-action';

test('high intake attractiveness remains pre-research and cannot be calibrated', () => {
  assert.equal(getNextAction('DISCOVERED'), 'RUN_RESEARCH_SWARM');
});
