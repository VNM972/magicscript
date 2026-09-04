const { spawn } = require('node:child_process');
const { dirname, resolve } = require('node:path');

const scriptDir = dirname(__filename);
const preload = resolve(scriptDir, 'tsx-preload.cjs');
const tsxCli = resolve(scriptDir, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs');

process.env.NODE_OPTIONS = [
  process.env.NODE_OPTIONS,
  `--require=${preload}`,
]
  .filter(Boolean)
  .join(' ');

const child = spawn(process.execPath, [tsxCli, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
