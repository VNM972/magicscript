import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePrototypeDeployMode } from './deploy';

test('prototype deployment defaults to mock when mode is empty', () => {
  assert.equal(resolvePrototypeDeployMode(''), 'mock');
});

test('prototype deployment requires the explicit cloudflare mode for real deploys', () => {
  assert.equal(resolvePrototypeDeployMode('cloudflare'), 'cloudflare');
});

test('prototype deployment rejects unknown modes', () => {
  assert.throws(
    () => resolvePrototypeDeployMode('enabled'),
    /must be mock or cloudflare/,
  );
});
