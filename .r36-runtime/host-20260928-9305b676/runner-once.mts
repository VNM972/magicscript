import { writeFile } from 'node:fs/promises';
import { runOne } from '../../apps/agent-runner/src/index.ts';

const root = process.env.R36_ROOT!;
if (process.argv.includes('--check')) {
  const response = await fetch(`${process.env.MAGICSCRIPT_API_BASE_URL}/api/runner/heartbeat`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.MAGICSCRIPT_RUNNER_TOKEN}`, 'x-magicscript-stack-id': process.env.MAGICSCRIPT_STACK_ID! },
    body: JSON.stringify({ runnerId: process.env.MAGICSCRIPT_RUNNER_ID, hostname: 'R36-HOST', status: 'IDLE', version: '0.2.0', currentJobId: null }),
  });
  const body = await response.text();
  await writeFile(`${root}/runner-capability.json`, JSON.stringify({ imported: true, canonicalRunOne: typeof runOne === 'function', heartbeatStatus: response.status, body }));
  console.log(`RUNNER_CAPABILITY_HTTP=${response.status}`);
  if (!response.ok) process.exitCode = 1;
} else {
  const worked = await runOne();
  console.log(`R36_RUN_ONE=${worked}`);
}
