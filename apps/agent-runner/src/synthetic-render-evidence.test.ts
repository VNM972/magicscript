import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { captureLocalDesktopMobileEvidence } from './synthetic-render-evidence';

test('DESKTOP_RENDER_EVIDENCE_REAL and MOBILE_RENDER_EVIDENCE_REAL bind artifact fingerprint', async () => {
  const root = await mkdtemp(join(tmpdir(), 'synthetic-render-')); const outputRoot = join(root, 'evidence'); const fingerprint = createHash('sha256').update('rebuilt-artifact').digest('hex');
  const evidence = await captureLocalDesktopMobileEvidence({ root, outputRoot, artifactFingerprint: fingerprint });
  assert.equal(evidence.desktop.checked, true); assert.equal(evidence.mobile.checked, true); assert.equal(evidence.method, 'LOCAL_STATIC_RENDER_METADATA');
  assert.equal((evidence.desktopEvidence as { artifactFingerprint: string }).artifactFingerprint, fingerprint); assert.equal((evidence.mobileEvidence as { artifactFingerprint: string }).artifactFingerprint, fingerprint);
});
