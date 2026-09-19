import { spawn } from 'node:child_process';
import { unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { stopProcessTree } from './process';

export interface KimiRunOptions {
  executable: string;
  cwd: string;
  prompt: string;
  timeoutMs?: number;
  swarmMaxConcurrency?: number;
}

export async function runKimi(options: KimiRunOptions): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 15 * 60_000;
  const promptFile =
    options.prompt.length > 12_000
      ? join(options.cwd, `.magicscript-kimi-prompt-${process.pid}.txt`)
      : null;

  if (promptFile) {
    await writeFile(promptFile, options.prompt, 'utf8');
  }

  const promptArgument = promptFile
    ? `Read ${basename(promptFile)} in the current working directory and follow it exactly. Return only the requested final answer.`
    : options.prompt;

  try {
    return await new Promise<string>((resolve, reject) => {
    const child = spawn(
      options.executable,
      [
        '--prompt',
        promptArgument,
        '--output-format',
        'text',
      ],
      {
        cwd: options.cwd,
        env: {
          ...process.env,
          KIMI_CODE_AGENT_SWARM_MAX_CONCURRENCY: String(
            options.swarmMaxConcurrency ?? 8,
          ),
          KIMI_LOOP_MAX_STEPS_PER_TURN: '60',
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 120_000) stdout = stdout.slice(-120_000);
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      if (stderr.length > 40_000) stderr = stderr.slice(-40_000);
    });

    const timeout = setTimeout(() => {
      stopProcessTree(child.pid ?? 0);
      reject(new Error(`Kimi timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(
          new Error(
            `Kimi exited with code ${String(code)}\n${stderr.trim().slice(-4000)}`,
          ),
        );
        return;
      }

      const output = stdout.trim();
      if (!output) {
        reject(new Error(`Kimi returned no output. stderr: ${stderr.trim().slice(-2000)}`));
        return;
      }

      resolve(output);
    });
    });
  } finally {
    if (promptFile) {
      await unlink(promptFile).catch(() => undefined);
    }
  }
}

export function parseJsonOutput(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidates = fenced?.[1]
    ? [fenced[1].trim(), ...balancedJsonCandidates(text)]
    : balancedJsonCandidates(text);

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw new Error(`No valid JSON found in agent output: ${lastError.message}`);
  }

  throw new Error('No JSON object or array found in agent output');
}

function balancedJsonCandidates(text: string): string[] {
  const candidates: string[] = [];

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{' && text[start] !== '[') continue;

    const stack: string[] = [];
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === '\\') {
          escaped = true;
        } else if (character === '"') {
          inString = false;
        }
        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === '{' || character === '[') {
        stack.push(character);
        continue;
      }

      if (character !== '}' && character !== ']') continue;

      const expected = character === '}' ? '{' : '[';
      if (stack.pop() !== expected) break;

      if (stack.length === 0) {
        candidates.push(text.slice(start, index + 1).trim());
        break;
      }
    }
  }

  return candidates;
}
