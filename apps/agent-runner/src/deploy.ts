import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { stopProcessTree } from './process';

export interface PrototypeDeployResult {
  deployed: boolean;
  deploymentUrl: string;
  projectName: string;
  branch: string;
  output: string;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'prototype';
}

async function run(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs = 10 * 60_000,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{ code: number; output: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: environment,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const append = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (output.length > 100_000) output = output.slice(-100_000);
    };

    child.stdout.on('data', append);
    child.stderr.on('data', append);

    const timer = setTimeout(() => {
      stopProcessTree(child.pid ?? 0);
      reject(new Error('Cloudflare Pages deployment timed out'));
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

export type PrototypeDeployMode = 'mock' | 'cloudflare';

export const APPROVED_MAGIC_SCRIPT_PAGES_PROJECT = 'magicscript-demos';

export function resolvePrototypeDeployMode(
  value = process.env.MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE,
): PrototypeDeployMode {
  const mode = value?.trim().toLowerCase() || 'mock';
  if (mode !== 'mock' && mode !== 'cloudflare') {
    throw new Error(
      'MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE must be mock or cloudflare',
    );
  }
  return mode;
}

async function readLocalCloudflareConfig(workDir: string): Promise<{
  accountId?: string;
  pagesProject?: string;
}> {
  const configPath = join(workDir, '.magicscript', 'cloudflare.local.json');
  try {
    const parsed = JSON.parse(await readFile(configPath, 'utf8')) as {
      accountId?: unknown;
      pagesProject?: unknown;
    };
    return {
      accountId:
        typeof parsed.accountId === 'string' ? parsed.accountId.trim() : undefined,
      pagesProject:
        typeof parsed.pagesProject === 'string'
          ? parsed.pagesProject.trim()
          : undefined,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error(
      `Invalid local Cloudflare configuration: ${configPath}`,
    );
  }
}

async function resolveWranglerEnvironment(
  baseEnvironment: NodeJS.ProcessEnv = process.env,
): Promise<NodeJS.ProcessEnv> {
  const environment = { ...baseEnvironment };
  if (environment.CLOUDFLARE_API_TOKEN?.trim()) return environment;

  // The local lifecycle keeps logs and runtime state on D:. Wrangler's
  // existing OAuth profile may still live in the user's Windows profile on
  // C:, so use that profile only for the Cloudflare CLI subprocess. Do not
  // copy, print, or persist the credential.
  const profileRoot = environment.USERPROFILE?.trim();
  const authConfigHome = environment.MAGICSCRIPT_WRANGLER_AUTH_CONFIG_HOME?.trim()
    || (profileRoot ? join(profileRoot, 'AppData', 'Roaming', 'xdg.config') : '');
  const authConfig = authConfigHome
    ? join(authConfigHome, '.wrangler', 'config', 'default.toml')
    : '';

  if (authConfig && (await stat(authConfig).catch(() => null))) {
    environment.XDG_CONFIG_HOME = authConfigHome;
  }

  return environment;
}

export async function deployPrototypeToPages(input: {
  workDir: string;
  companyName: string;
  prospectId: string;
}): Promise<PrototypeDeployResult> {
  const deployMode = resolvePrototypeDeployMode();
  const projectName = APPROVED_MAGIC_SCRIPT_PAGES_PROJECT;
  const branch = slug(
    `${input.companyName}-${input.prospectId.slice(0, 8)}`,
  );

  if (deployMode === 'mock') {
    if (process.env.MAGICSCRIPT_PAGES_PROJECT?.trim() && process.env.MAGICSCRIPT_PAGES_PROJECT.trim() !== APPROVED_MAGIC_SCRIPT_PAGES_PROJECT) {
      throw new Error(
        `Prototype deployment target is not approved: ${process.env.MAGICSCRIPT_PAGES_PROJECT.trim()}`,
      );
    }
    return {
      deployed: true,
      deploymentUrl: `https://${branch}.pages.dev/`,
      projectName,
      branch,
      output: 'Local mock deployment; no Cloudflare request made.',
    };
  }

  const localCloudflareConfig = await readLocalCloudflareConfig(input.workDir);
  const configuredProject =
    process.env.MAGICSCRIPT_PAGES_PROJECT?.trim() || localCloudflareConfig.pagesProject;
  if (configuredProject && configuredProject !== APPROVED_MAGIC_SCRIPT_PAGES_PROJECT) {
    throw new Error(
      `Prototype deployment target is not approved: ${configuredProject}`,
    );
  }

  const apiTokenConfigured = Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim());
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || localCloudflareConfig.accountId;
  const accountIdConfigured = Boolean(accountId);
  const deploymentEnvironment = accountId
    ? { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId }
    : { ...process.env };

  if (!apiTokenConfigured) {
    const wranglerEnvironment = await resolveWranglerEnvironment(
      deploymentEnvironment,
    );
    const auth = await run(
      process.platform === 'win32' ? process.env.ComSpec?.trim() || 'cmd.exe' : 'npx',
      process.platform === 'win32'
        ? ['/d', '/s', '/c', 'npx.cmd', 'wrangler', 'whoami']
        : ['wrangler', 'whoami'],
      input.workDir,
      60_000,
      wranglerEnvironment,
    );

    if (auth.code !== 0) {
      throw new Error(
        `Cloudflare API token is missing and Wrangler OAuth is unavailable: ${auth.output.slice(-3000)}`,
      );
    }
  }

  if (!accountIdConfigured) {
    throw new Error(
      'CLOUDFLARE_ACCOUNT_ID is required for prototype deployment. Configure it once with scripts/configure-cloudflare-local.ps1; the local file stores no API token.',
    );
  }

  const outputDir = join(input.workDir, 'out');

  const info = await stat(outputDir).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error('Prototype has no static out/ directory to deploy');
  }

  const deployArgs = [
    'wrangler',
    'pages',
    'deploy',
    'out',
    '--project-name',
    projectName,
    '--branch',
    branch,
    '--commit-message',
    'Magic Script automated prototype',
  ];

  // Node 24 no longer executes Windows .cmd shims directly via spawn().
  // Route npx.cmd through cmd.exe explicitly, without shell:true.
  const command =
    process.platform === 'win32'
      ? process.env.ComSpec?.trim() || 'cmd.exe'
      : 'npx';
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx.cmd', ...deployArgs]
      : deployArgs;

  const result = await run(
    command,
    args,
    input.workDir,
    10 * 60_000,
    await resolveWranglerEnvironment(deploymentEnvironment),
  );

  if (result.code !== 0) {
    throw new Error(
      `Cloudflare Pages deploy failed: ${result.output.slice(-5000)}`,
    );
  }

  const urls =
    result.output.match(/https:\/\/[a-zA-Z0-9.-]+\.pages\.dev\/?/g) ?? [];
  const deploymentUrl = urls[urls.length - 1];

  if (!deploymentUrl) {
    throw new Error(
      `Cloudflare deploy succeeded but no pages.dev URL was found: ${result.output.slice(-3000)}`,
    );
  }

  return {
    deployed: true,
    deploymentUrl,
    projectName,
    branch,
    output: result.output.slice(-20_000),
  };
}
