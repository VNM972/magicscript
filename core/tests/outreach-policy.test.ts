import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_AUTOMATIC_OUTREACH_DRAFT_ATTEMPTS,
  shouldEscalateOutreachFactCheck,
} from '../orchestrator/outreach-policy';

test('outreach fact-check allows exactly one automatic regeneration', () => {
  assert.equal(MAX_AUTOMATIC_OUTREACH_DRAFT_ATTEMPTS, 2);
  assert.equal(shouldEscalateOutreachFactCheck(0), false);
  assert.equal(shouldEscalateOutreachFactCheck(1), false);
});

test('outreach fact-check escalates on the second rejected draft', () => {
  assert.equal(shouldEscalateOutreachFactCheck(2), true);
  assert.equal(shouldEscalateOutreachFactCheck(3), true);
});
