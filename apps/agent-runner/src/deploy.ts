import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

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
): Promise<{ code: number; output: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
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
      child.kill();
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

export async function deployPrototypeToPages(input: {
  workDir: string;
  companyName: string;
  prospectId: string;
}): Promise<PrototypeDeployResult> {
  const projectName =
    process.env.MAGICSCRIPT_PAGES_PROJECT?.trim() || 'magicscript-demos';
  const branch = slug(
    `${input.companyName}-${input.prospectId.slice(0, 8)}`,
  );

  if (process.env.MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE === 'mock') {
    return {
      deployed: true,
      deploymentUrl: `https://${branch}.pages.dev/`,
      projectName,
      branch,
      output: 'Local mock deployment; no Cloudflare request made.',
    };
  }

  if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
    throw new Error('CLOUDFLARE_API_TOKEN is required for prototype deployment');
  }

  if (!process.env.CLOUDFLARE_ACCOUNT_ID?.trim()) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is required for prototype deployment');
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

  const result = await run(command, args, input.workDir);

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
