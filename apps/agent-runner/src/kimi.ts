import { spawn } from 'node:child_process';

export interface KimiRunOptions {
  executable: string;
  cwd: string;
  prompt: string;
  timeoutMs?: number;
  swarmMaxConcurrency?: number;
}

export async function runKimi(options: KimiRunOptions): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 15 * 60_000;

  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      options.executable,
      [
        '--prompt',
        options.prompt,
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
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    const timeout = setTimeout(() => {
      child.kill();
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
}

export function parseJsonOutput(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const firstObject = text.indexOf('{');
  const lastObject = text.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) {
    return JSON.parse(text.slice(firstObject, lastObject + 1));
  }

  throw new Error('No JSON object found in Kimi output');
}
