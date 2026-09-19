import { spawn } from 'node:child_process';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { stopProcessTree } from './process';
import { ensurePrototypeScaffold } from './prototype-scaffold';

export interface PrototypeBuildCheck {
  passed: boolean;
  output: string;
  filesCreated: number;
  staticOutputReady: boolean;
  outputDir?: string;
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 10 * 60_000,
  environmentOverrides: NodeJS.ProcessEnv = {},
): Promise<{ code: number; output: string }> {
  const environment = { ...process.env, ...environmentOverrides };
  if (command === 'npm' || command === 'npm.cmd') {
    const cacheDir = environment.NPM_CONFIG_CACHE?.trim() ||
      resolve(cwd, '..', '..', 'npm-cache');
    await mkdir(cacheDir, { recursive: true });
    environment.NPM_CONFIG_CACHE = cacheDir;
    environment.npm_config_cache = cacheDir;
  }

  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Node 24 on Windows can raise spawn EINVAL when invoking .cmd shims
      // (such as npm.cmd) directly. Use the Windows command shell only there.
      shell: process.platform === 'win32',
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
      stopProcessTree(child.pid ?? 0);
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
  companyName?: string,
): Promise<PrototypeBuildCheck> {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const scaffold = await ensurePrototypeScaffold(cwd, companyName);

  const repositoryNodeModules = resolve(cwd, '..', '..', '..', '..', 'node_modules');
  const sharedNextBin = join(repositoryNodeModules, '.bin');
  const sharedNext = join(repositoryNodeModules, 'next');
  const localNodeModules = join(cwd, 'node_modules');
  let sharedDependenciesAvailable = false;
  let localDependenciesAvailable = false;
  try {
    sharedDependenciesAvailable = (await stat(sharedNext)).isDirectory();
  } catch {
    sharedDependenciesAvailable = false;
  }
  try {
    localDependenciesAvailable = (await stat(join(localNodeModules, 'next'))).isDirectory();
  } catch {
    localDependenciesAvailable = false;
  }

  const buildEnvironment = sharedDependenciesAvailable
    ? {
        NODE_PATH: repositoryNodeModules,
        PATH: `${sharedNextBin}${delimiter}${process.env.PATH ?? ''}`,
      }
    : {};

  let install = { code: 0, output: '' };
  if (localDependenciesAvailable) {
    install.output = 'Prototype-local node_modules already available; npm install skipped.';
  } else if (sharedDependenciesAvailable) {
    install.output =
      'Reusing repository node_modules from D: for the deterministic prototype build; npm install skipped.';
  } else {
    install = await runCommand(
      npm,
      ['install', '--no-audit', '--no-fund', '--prefer-offline'],
      cwd,
      3 * 60_000,
    );
  }

  if (install.code !== 0) {
    return {
      passed: false,
      output: `${scaffold.repaired ? `Scaffold repaired: ${scaffold.files.join(', ')}\n` : ''}npm install failed\n${install.output}`.slice(-120_000),
      filesCreated: await countProjectFiles(cwd),
      staticOutputReady: false,
    };
  }

  const build = await runCommand(
    npm,
    ['run', 'build'],
    cwd,
    12 * 60_000,
    buildEnvironment,
  );
  const outputDir = join(cwd, 'out');

  let staticOutputReady = false;
  try {
    staticOutputReady = (await stat(outputDir)).isDirectory();
  } catch {
    staticOutputReady = false;
  }

  const deployCheck = staticOutputReady
    ? '\n\n--- STATIC OUTPUT ---\nout/ is ready for Cloudflare Pages.'
    : '\n\n--- STATIC OUTPUT ---\nout/ is missing. Configure the prototype for static export.';

  return {
    passed: build.code === 0 && staticOutputReady,
    output: `${scaffold.repaired ? `Scaffold repaired: ${scaffold.files.join(', ')}\n\n` : ''}${install.output}\n\n--- BUILD ---\n${build.output}${deployCheck}`.slice(-120_000),
    filesCreated: await countProjectFiles(cwd),
    staticOutputReady,
    outputDir: staticOutputReady ? outputDir : undefined,
  };
}
