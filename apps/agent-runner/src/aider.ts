import { spawn } from 'node:child_process';
import { unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { stopProcessTree } from './process';

export interface AiderRunOptions {
  executable: string;
  cwd: string;
  model: string;
  prompt: string;
  timeoutMs?: number;
  contextTokens?: number;
  mapTokens?: number;
  outputTokens?: number;
  files?: string[];
  ollamaBaseUrl?: string;
}

export async function runAider(options: AiderRunOptions): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const contextTokens = options.contextTokens ?? 8192;
  const mapTokens = options.mapTokens ?? 1024;
  const outputTokens = options.outputTokens ?? 3072;
  const modelSettingsFile = join(
    dirname(options.cwd),
    `.aider.model.settings-${process.pid}.yml`,
  );
  await writeFile(
    modelSettingsFile,
    [
      `- name: ollama_chat/${options.model}`,
      '  extra_params:',
      `    num_ctx: ${contextTokens}`,
      '    temperature: 0',
      `    num_predict: ${outputTokens}`,
      '',
    ].join('\n'),
    'utf8',
  );

  return new Promise<string>((resolve, reject) => {
    const fileArgs = (options.files ?? []).flatMap((file) => ['--file', file]);
    const child = spawn(
      options.executable,
      [
        '--model',
        `ollama_chat/${options.model}`,
        ...fileArgs,
        '--message',
        options.prompt,
        '--no-auto-commits',
        '--no-gitignore',
        '--no-git',
        '--subtree-only',
        '--no-detect-urls',
        '--no-show-model-warnings',
        '--no-stream',
        '--yes-always',
        '--edit-format',
        'diff',
        '--model-settings-file',
        modelSettingsFile,
        '--map-tokens',
        String(mapTokens),
      ],
      {
        cwd: options.cwd,
        env: {
          ...process.env,
          OLLAMA_API_BASE:
            options.ollamaBaseUrl || process.env.OLLAMA_API_BASE || 'http://127.0.0.1:11434',
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let output = '';
    const append = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (output.length > 120_000) output = output.slice(-120_000);
    };

    child.stdout.on('data', append);
    child.stderr.on('data', append);

    const timer = setTimeout(() => {
      stopProcessTree(child.pid ?? 0);
      reject(new Error(`Aider timed out after ${timeoutMs}ms (model=${options.model})`));
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      void unlink(modelSettingsFile).catch(() => undefined);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      void unlink(modelSettingsFile).catch(() => undefined);
      if (code !== 0) {
        reject(new Error(`Aider exited with code ${String(code)}\n${output.slice(-5000)}`));
        return;
      }
      resolve(output.trim() || 'Aider completed without a textual summary.');
    });
  });
}
