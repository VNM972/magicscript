import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface PrototypeBuildCheck {
  passed: boolean;
  output: string;
  filesCreated: number;
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 10 * 60_000,
): Promise<{ code: number; output: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let output = '';
    const append = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (output.length > 120_000) {
        output = output.slice(-120_000);
      }
    };

    child.stdout.on('data', append);
    child.stderr.on('data', append);

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out: ${command} ${args.join(' ')}`));
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolvePromise({ code: code ?? 1, output });
    });
  });
}

async function countProjectFiles(root: string): Promise<number> {
  let count = 0;

  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === '.git'
      ) {
        continue;
      }

      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile()) {
        count += 1;
      }
    }
  }

  const info = await stat(root);
  if (!info.isDirectory()) return 0;
  await walk(root);
  return count;
}

export async function verifyPrototypeBuild(
  cwd: string,
): Promise<PrototypeBuildCheck> {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  const install = await runCommand(
    npm,
    ['install', '--no-audit', '--no-fund'],
    cwd,
    12 * 60_000,
  );

  if (install.code !== 0) {
    return {
      passed: false,
      output: `npm install failed\n${install.output}`.slice(-120_000),
      filesCreated: await countProjectFiles(cwd),
    };
  }

  const build = await runCommand(npm, ['run', 'build'], cwd, 12 * 60_000);

  return {
    passed: build.code === 0,
    output: `${install.output}\n\n--- BUILD ---\n${build.output}`.slice(-120_000),
    filesCreated: await countProjectFiles(cwd),
  };
}
