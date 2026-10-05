import type { SearchProvider } from './agent';

export interface TavilySearchProviderOptions {
  apiKey: string;
  fetchFn?: typeof fetch;
  maxQueries?: number;
}

export class TavilyBudgetExceededError extends Error {
  constructor(readonly budget: number) {
    super(`Tavily free-tier query budget exceeded (${budget})`);
    this.name = 'TavilyBudgetExceededError';
  }
}

/** Tavily BASIC search adapter. Discovery metadata is never canonical evidence. */
export class TavilySearchProvider implements SearchProvider {
  private readonly fetchFn: typeof fetch;
  private readonly budget: number;
  private used = 0;

  constructor(options: TavilySearchProviderOptions) {
    if (!options.apiKey.trim()) throw new Error('TAVILY_API_KEY is required');
    this.apiKey = options.apiKey.trim();
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.budget = Math.max(1, Math.trunc(options.maxQueries ?? 300));
  }

  private readonly apiKey: string;

  get queriesUsed(): number { return this.used; }
  get queryBudget(): number { return this.budget; }

  async search(query: string, limit: number): Promise<Array<{ url: string; title?: string; snippet?: string }>> {
    if (this.used >= this.budget) throw new TavilyBudgetExceededError(this.budget);
    this.used += 1;
    const response = await this.fetchFn('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ api_key: this.apiKey, query, search_depth: 'basic', max_results: Math.min(5, Math.max(1, Math.trunc(limit))), include_answer: false, include_raw_content: false, include_images: false }),
    });
    if (!response.ok) throw new Error(`Tavily search failed with HTTP ${response.status}`);
    const payload = await response.json() as { results?: Array<{ url?: unknown; title?: unknown; content?: unknown }> };
    return Array.isArray(payload.results) ? payload.results.flatMap((result) => typeof result.url === 'string' ? [{ url: result.url, title: typeof result.title === 'string' ? result.title : undefined, snippet: typeof result.content === 'string' ? result.content : undefined }] : []) : [];
  }
}
