import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runSyntheticFixtureMatrix } from '../apps/agent-runner/src/synthetic-creative-matrix';

async function main(): Promise<void> {
  const outputRoot = join(process.cwd(), 'artifacts', 'synthetic-creative');
  const results = await runSyntheticFixtureMatrix();
  await mkdir(outputRoot, { recursive: true });
  const manifest = results.map(({ fixtureId, result, fileChanged, recoveredAfterFailure }) => ({ fixtureId, jobId: `synthetic-parent-${fixtureId}`, fileChanged, recoveredAfterFailure, result }));
  await writeFile(join(outputRoot, 'matrix-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  for (const entry of manifest) await writeFile(join(outputRoot, `${entry.fixtureId}.job-result.json`), `${JSON.stringify(entry.result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputRoot, fixtures: manifest.map((entry) => ({ fixtureId: entry.fixtureId, technicalJobStatus: entry.result.technicalJobStatus, creativeVerdict: entry.result.creativeVerdict, iterations: entry.result.iterations.length })) }, null, 2));
}
void main();
