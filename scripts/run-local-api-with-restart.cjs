'use strict';

const { spawn } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const apiWorkDir = path.join(repoRoot, 'apps', 'api-worker');
const wrangler = path.join(repoRoot, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const wranglerArgs = process.argv.slice(2);

let child = null;
let stopping = false;
let consecutiveFailures = 0;
let startedAt = 0;

function stopChild(signal = 'SIGTERM') {
  if (!child || child.killed) return;
  try {
    child.kill(signal);
  } catch {
    // The lifecycle taskkill fallback handles Windows process-tree shutdown.
  }
}

function requestStop() {
  if (stopping) return;
  stopping = true;
  stopChild();
  setTimeout(() => stopChild('SIGKILL'), 2000).unref();
}

function startWrangler() {
  if (stopping) return;

  startedAt = Date.now();
  child = spawn(process.execPath, [wrangler, ...wranglerArgs], {
    cwd: apiWorkDir,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });

  child.once('error', (error) => {
    console.error(`[api-supervisor] Wrangler spawn failed: ${error.message}`);
  });

  child.once('exit', (code, signal) => {
    child = null;
    if (stopping) {
      process.exitCode = code ?? 0;
      return;
    }

    const ranForMs = Date.now() - startedAt;
    if (ranForMs >= 30_000) consecutiveFailures = 0;
    consecutiveFailures += 1;
    const delayMs = Math.min(30_000, 1000 * (2 ** Math.min(consecutiveFailures - 1, 5)));
    console.error(
      `[api-supervisor] Wrangler exited (code=${code ?? 'null'}, signal=${signal ?? 'none'}); ` +
        `restart ${consecutiveFailures} in ${delayMs}ms`,
    );
    setTimeout(startWrangler, delayMs);
  });
}

process.once('SIGINT', requestStop);
process.once('SIGTERM', requestStop);
process.once('exit', () => stopChild());

startWrangler();
