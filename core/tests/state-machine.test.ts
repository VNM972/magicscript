import test from 'node:test';
import assert from 'node:assert/strict';

import { canTransition } from '../state/prospect-state-machine';

test('allows the normal outreach path', () => {
  assert.equal(canTransition('OUTREACH_READY', 'OUTREACH_DRAFTED'), true);
  assert.equal(canTransition('OUTREACH_DRAFTED', 'OUTREACH_VERIFIED'), true);
  assert.equal(canTransition('OUTREACH_VERIFIED', 'EMAIL_SENT'), true);
});

test('requires reply classification before a commercial outcome', () => {
  assert.equal(canTransition('WAITING_REPLY', 'REPLY_RECEIVED'), true);
  assert.equal(canTransition('WAITING_REPLY', 'PRICING_REQUESTED'), false);
  assert.equal(canTransition('REPLY_RECEIVED', 'PRICING_REQUESTED'), true);
});

test('never leaves do-not-contact automatically', () => {
  assert.equal(canTransition('DO_NOT_CONTACT', 'OUTREACH_READY'), false);
});
