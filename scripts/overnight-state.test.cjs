'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  assertRuntimeStatePath,
  readOvernightState,
  writeOvernightStateAtomic,
} = require('./overnight-state.cjs');

test('writes and reads the runtime state atomically under the guarded path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'magicscript-overnight-'));
  const statePath = path.join(root, '.magicscript', 'overnight', 'current.json');
  const state = { schemaVersion: 1, sessionId: 'test-session', next: 'WP-01' };

  try {
    writeOvernightStateAtomic(statePath, state);
    assert.deepEqual(readOvernightState(statePath), state);
    assert.equal(fs.readdirSync(path.dirname(statePath)).some((name) => name.endsWith('.tmp')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rejects paths outside the runtime current state location', () => {
  assert.throws(() => assertRuntimeStatePath(path.join(os.tmpdir(), 'current.json')), /must be/);
  assert.throws(() => assertRuntimeStatePath(path.join(os.tmpdir(), '.magicscript', 'overnight', 'other.json')), /must be/);
});
