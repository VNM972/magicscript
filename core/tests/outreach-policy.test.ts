import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_AUTOMATIC_OUTREACH_DRAFT_ATTEMPTS,
  isDeploymentLinkFactCheckReason,
  shouldEscalateOutreachFactCheck,
  shouldAcceptFactCheckWithVerifiedDeploymentLink,
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

test('outreach fact-check trusts the persisted exact deployment link', () => {
  const url = 'https://demo.example.pages.dev/';
  const body = `See the demonstration here: ${url}`;

  assert.equal(
    shouldAcceptFactCheckWithVerifiedDeploymentLink(true, [], body, url),
    true,
  );
  assert.equal(
    shouldAcceptFactCheckWithVerifiedDeploymentLink(true, [], 'No link', url),
    false,
  );
});

test('outreach fact-check repairs a link-only local-model false negative', () => {
  const url = 'https://demo.example.pages.dev/';
  const body = `See the demonstration here: ${url}`;
  const reason = 'The email does not contain the deployed prototype link.';

  assert.equal(isDeploymentLinkFactCheckReason(reason), true);
  assert.equal(
    shouldAcceptFactCheckWithVerifiedDeploymentLink(false, [reason], body, url),
    true,
  );
  assert.equal(
    shouldAcceptFactCheckWithVerifiedDeploymentLink(
      false,
      [reason, 'The subject is unsupported.'],
      body,
      url,
    ),
    false,
  );
});
