export interface OllamaRunOptions {
  baseUrl: string;
  model: string;
  prompt: string;
  timeoutMs?: number;
  numPredict?: number;
  contextTokens?: number;
  retryAttempts?: number;
  schema?: Record<string, unknown>;
}

export async function runOllama(options: OllamaRunOptions): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const maxAttempts = Math.max(1, Math.min(options.retryAttempts ?? 2, 3));
  const endpoint = `${options.baseUrl.replace(/\/$/, '')}/api/generate`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: options.model,
          prompt: options.prompt,
          stream: false,
          // All non-build local agent jobs are parsed as JSON by the runner.
          // Ask Ollama to constrain the response at the transport level so a
          // valid model answer cannot be lost to markdown/prose formatting.
          format: options.schema ?? 'json',
          options: {
            num_predict: options.numPredict ?? 8192,
            num_ctx: options.contextTokens ?? 8192,
            temperature: 0,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        const error = new Error(`Ollama returned HTTP ${response.status}: ${body}`);
        if (!isTransientOllamaError(error, response.status) || attempt === maxAttempts) {
          throw error;
        }
        await retryDelay(attempt);
        continue;
      }

      const body = (await response.json()) as { response?: unknown; error?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) {
        throw new Error(`Ollama error: ${body.error}`);
      }
      if (typeof body.response !== 'string' || !body.response.trim()) {
        throw new Error('Ollama returned no response');
      }

      return body.response.trim();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Ollama timed out after ${timeoutMs}ms (model=${options.model}, context=${options.contextTokens ?? 8192})`,
        );
      }
      if (!isTransientOllamaError(error) || attempt === maxAttempts) throw error;
      await retryDelay(attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(`Ollama request failed after ${maxAttempts} attempts (model=${options.model})`);
}

function isTransientOllamaError(error: unknown, status?: number): boolean {
  if (status !== undefined) return [408, 429, 500, 502, 503, 504].includes(status);
  return error instanceof TypeError && /fetch failed|network|socket/i.test(error.message);
}

async function retryDelay(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 5000)));
}
