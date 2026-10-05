import test from 'node:test';
import assert from 'node:assert/strict';
import { runSyntheticFixtureMatrix } from './synthetic-creative-matrix';

test('FULL_MATRIX_EXECUTES with required bounded outcomes', async () => {
  const results = await runSyntheticFixtureMatrix();
  assert.equal(results.length, 8);
  const byId = new Map(results.map((item) => [item.fixtureId, item]));
  assert.equal(byId.get('ugly')?.fileChanged, true);
  assert.equal(byId.get('ugly')?.result.iterations.length, 1);
  assert.equal(byId.get('already-good')?.fileChanged, false);
  assert.equal(byId.get('dense-content')?.result.iterations.length, 1);
  assert.equal(byId.get('broken-mobile')?.result.creativeVerdict, 'BLOCKED');
  assert.equal(byId.get('protected-facts')?.result.creativeVerdict, 'BLOCKED');
  assert.equal(byId.get('protected-contract')?.result.creativeVerdict, 'BLOCKED');
  assert.equal(byId.get('impossible')?.result.creativeVerdict, 'EXHAUSTED');
  assert.equal(byId.get('impossible')?.result.iterations.length, 3);
  assert.equal(byId.get('build-failure')?.result.creativeVerdict, 'BLOCKED');
  assert.equal(byId.get('build-failure')?.recoveredAfterFailure, true);
});
