import { strict as assert } from 'node:assert';
import test from 'node:test';
import { TavilyBudgetExceededError, TavilySearchProvider } from '../contact-acquisition/tavily';

test('Tavily uses BASIC and bounded result count without logging key', async () => {
  let request: Request | undefined;
  const provider = new TavilySearchProvider({ apiKey: 'secret-key', maxQueries: 1, fetchFn: async (input, init) => { request = new Request(input, init); return new Response(JSON.stringify({ results: [{ url: 'https://example.fr', title: 'Example', content: 'public result' }] }), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  const results = await provider.search('Example contact', 20);
  assert.equal(results.length, 1);
  const body = await request!.clone().json() as Record<string, unknown>;
  assert.equal(body.search_depth, 'basic');
  assert.equal(body.max_results, 5);
  assert.equal(body.include_raw_content, false);
  assert.equal(body.include_answer, false);
  assert.equal(body.api_key, 'secret-key');
});

test('Tavily free-tier budget fails closed', async () => {
  const provider = new TavilySearchProvider({ apiKey: 'secret-key', maxQueries: 1, fetchFn: async () => new Response(JSON.stringify({ results: [] }), { status: 200 }) });
  await provider.search('one', 5);
  await assert.rejects(() => provider.search('two', 5), TavilyBudgetExceededError);
});
