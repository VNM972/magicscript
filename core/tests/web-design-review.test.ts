import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canPromoteWithWebDesignReview,
  webDesignReviewBlockReason,
  webDesignReviewStatus,
} from '../prototypes/web-design-review';

test('allows PASS_WITH_NOTES only when the review has no blockers', () => {
  const review = {
    webDesignReview: {
      status: 'PASS_WITH_NOTES',
      owner: 'BU Web Design',
      verifier: 'web-design-v1',
      checks: ['mobile', 'desktop', 'cta', 'factuality'],
      notes: ['Minor copy note'],
    },
  };

  assert.equal(webDesignReviewStatus(review), 'PASS_WITH_NOTES');
  assert.equal(canPromoteWithWebDesignReview(review), true);
});

test('keeps missing, blocked and waiting reviews fail-closed', () => {
  assert.equal(webDesignReviewStatus({}), 'UNKNOWN');
  assert.equal(canPromoteWithWebDesignReview({}), false);
  assert.match(webDesignReviewBlockReason({}), /missing or malformed/);
  assert.equal(
    canPromoteWithWebDesignReview({
      webDesignReview: {
        status: 'BLOCKED',
        owner: 'BU Web Design',
        verifier: 'web-design-v1',
      },
    }),
    false,
  );
  assert.equal(
    canPromoteWithWebDesignReview({
      webDesignReview: {
        status: 'PASS',
        owner: 'BU Web Design',
        verifier: 'web-design-v1',
        blockers: ['logo missing'],
      },
    }),
    false,
  );
});
