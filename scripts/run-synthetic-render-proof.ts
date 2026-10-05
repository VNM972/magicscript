import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { captureLocalDesktopMobileEvidence } from '../apps/agent-runner/src/synthetic-render-evidence';

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'synthetic-render-proof-'));
  const outputRoot = join(process.cwd(), 'artifacts', 'synthetic-creative', 'render-evidence');
  await mkdir(outputRoot, { recursive: true });
  const artifactFingerprint = createHash('sha256').update('synthetic-rebuilt-artifact-ugly').digest('hex');
  const evidence = await captureLocalDesktopMobileEvidence({ root, outputRoot, artifactFingerprint });
  await writeFile(join(outputRoot, 'render-manifest.json'), `${JSON.stringify({ fixtureId: 'synthetic-ugly', artifactFingerprint, evidence }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ fixtureId: 'synthetic-ugly', artifactFingerprint, desktop: evidence.desktop, mobile: evidence.mobile }, null, 2));
}
void main();
