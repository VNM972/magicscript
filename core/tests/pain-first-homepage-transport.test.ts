import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import type { LookupAddress } from 'node:dns';
import { Duplex, Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { checkServerIdentity } from 'node:tls';
import { createPainFirstBoundHomepageTransport } from '../research/pain-first-homepage-network';
import type { PainFirstNetworkDependencies, PainFirstConnectionOptions as RequestOptions } from '../research/pain-first-homepage-network';
import { acceptPainFirstSearchCandidate, painFirstQueryPlans } from '../research/pain-first-staging';
import type { AcceptedPainFirstSearchCandidate, PainFirstSearchCandidate } from '../research/pain-first-staging';
import { intakeManualPainFirstUrls } from '../research/manual-pain-first-intake';
import { createPainFirstOfflineHomepageInspector, createPainFirstLiveHomepageInspector, PAIN_FIRST_LIVE_TRANSPORT_STATUS,
  PAIN_FIRST_MAX_BODY_BYTES } from '../research/pain-first-homepage-transport';
import type { PainFirstFixtureTransport } from '../research/pain-first-homepage-transport';

const candidate = (overrides: Partial<PainFirstSearchCandidate> = {}): PainFirstSearchCandidate => ({
  schemaVersion: 1, queryPlanId: painFirstQueryPlans()[0].planId, conditionClass: 'SITE_UNDER_CONSTRUCTION',
  providerClass: 'MANUAL_OPERATOR', providerRunId: 'offline-r58z', resultPosition: 1,
  resultUrl: 'https://fixture.invalid/', acquiredAt: '2026-10-01T12:00:00.000Z', authority: 'NONE', ...overrides,
});
const accepted = (input = candidate()): AcceptedPainFirstSearchCandidate => {
  const result = acceptPainFirstSearchCandidate(input);
  assert.equal(result.state, 'URL_ACCEPTED');
  if (result.state !== 'URL_ACCEPTED') throw new Error('fixture rejected');
  return result;
};
const htmlResponse = (html = '<title>Site en construction</title>', headers: Record<string, string> = {}) =>
  new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers } });
const inspectHtml = (html: string) => createPainFirstOfflineHomepageInspector(async () => htmlResponse(html))(accepted());

test('01 manual accepted candidate connects to the supplied-page adapter', async () => {
  const manual = intakeManualPainFirstUrls([{ conditionClass: 'SITE_UNDER_CONSTRUCTION',
    urlsText: 'https://fixture.invalid/' }], candidate().acquiredAt);
  const result = await createPainFirstOfflineHomepageInspector(async () => htmlResponse())(accepted(manual.candidates[0]));
  assert.equal(result.pageState, 'PAGE_OBSERVED');
  assert.equal(result.staging.state, 'PAIN_SIGNAL_CONFIRMED');
});

test('02 rejected, raw, copied, serialized and forged candidates never invoke transport', async () => {
  let calls = 0;
  const inspect = createPainFirstOfflineHomepageInspector(async () => { calls++; return htmlResponse(); });
  const valid = accepted();
  for (const input of ['https://fixture.invalid/', candidate(),
    acceptPainFirstSearchCandidate(candidate({ resultUrl: 'http://127.0.0.1/' })),
    { ...valid }, JSON.parse(JSON.stringify(valid)),
    { state: 'URL_ACCEPTED', homepageUrl: 'http://127.0.0.1/' }])
    await assert.rejects(inspect(input as AcceptedPainFirstSearchCandidate), /VALIDATED_CANDIDATE_REQUIRED/);
  assert.equal(calls, 0);
});

test('03-06 exactly one GET, no HEAD, retry, redirect follow, cookies or auth', async () => {
  const calls: [string, RequestInit][] = [];
  const result = await createPainFirstOfflineHomepageInspector(async (url, init) => {
    calls.push([url, init]); return new Response(null, { status: 503 });
  })(accepted());
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://fixture.invalid/');
  assert.equal(calls[0][1].method, 'GET');
  assert.equal(calls[0][1].redirect, 'manual');
  assert.equal(calls[0][1].credentials, 'omit');
  assert.deepEqual(Object.keys(calls[0][1].headers!).sort(), ['Accept', 'User-Agent']);
  assert.equal(result.observation.httpResultClass, 'SERVER_ERROR');
});

for (const [status, expected] of [[200, 'SUCCESS'], [201, 'SUCCESS'], [301, 'REDIRECT'], [302, 'REDIRECT'],
  [307, 'REDIRECT'], [404, 'CLIENT_ERROR'], [429, 'CLIENT_ERROR'], [500, 'SERVER_ERROR'], [503, 'SERVER_ERROR']] as const)
  test(`07-10 HTTP ${status} maps to ${expected}, one call`, async () => {
    let calls = 0;
    const a = accepted();
    const result = await createPainFirstOfflineHomepageInspector(async () => {
      calls++; return new Response('<title>Site en construction</title>', { status,
        headers: { 'Content-Type': 'text/html', Location: 'http://127.0.0.1/private' } });
    })(a);
    assert.equal(calls, 1);
    assert.equal(result.observation.httpResultClass, expected);
    assert.equal(result.observation.requestedUrl, a.homepageUrl);
    assert.equal(result.observation.finalUrl, undefined);
    if (expected !== 'SUCCESS') {
      assert.equal(result.observation.suppliedHtml, undefined);
      assert.equal(result.staging.state, 'FETCH_FAILED');
    }
  });

test('11 network failure never retries or reaches positive R42', async () => {
  let calls = 0;
  const result = await createPainFirstOfflineHomepageInspector(async () => { calls++; throw new Error('offline error'); })(accepted());
  assert.equal(calls, 1);
  assert.equal(result.observation.httpResultClass, 'NETWORK_ERROR');
  assert.equal(result.staging.state, 'FETCH_FAILED');
});

test('12 deadline aborts even an uncooperative pending fixture transport', async () => {
  let signal: AbortSignal | undefined;
  let calls = 0;
  const result = await createPainFirstOfflineHomepageInspector(async (_url, init) => {
    calls++; signal = init.signal!; return new Promise<Response>(() => undefined);
  }, { timeoutMs: 10 })(accepted());
  assert.equal(calls, 1); assert.equal(signal?.aborted, true);
  assert.equal(result.observation.httpResultClass, 'TIMEOUT');
  assert.equal(result.staging.state, 'FETCH_FAILED');
});

test('12 deadline also cancels a stalled streamed response body', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
    headers: { 'Content-Type': 'text/html' },
  });
  const result = await createPainFirstOfflineHomepageInspector(async () => response, { timeoutMs: 10 })(accepted());
  assert.equal(cancelled, true);
  assert.equal(result.observation.httpResultClass, 'TIMEOUT');
  assert.equal(result.observation.suppliedHtml, undefined);
  assert.equal(result.staging.state, 'FETCH_FAILED');
});

test('12 standard transport AbortError maps to TIMEOUT without retry', async () => {
  let calls = 0;
  const result = await createPainFirstOfflineHomepageInspector(async () => {
    calls++; const error = new Error('deadline'); error.name = 'AbortError'; throw error;
  })(accepted());
  assert.equal(calls, 1);
  assert.equal(result.observation.httpResultClass, 'TIMEOUT');
});

for (const mime of ['image/png', 'video/mp4', 'audio/mpeg', 'application/pdf', 'application/octet-stream',
  'application/zip', 'application/json', 'text/plain', 'text/html-extra', ''])
  test(`13 unsupported MIME ${mime} is cancelled without reading or parsing`, async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
      headers: { 'Content-Type': mime },
    });
    const result = await createPainFirstOfflineHomepageInspector(async () => response)(accepted());
    assert.equal(cancelled, true);
    assert.equal(result.observation.httpResultClass, 'UNSUPPORTED');
    assert.equal(result.observation.boundedTitle, undefined);
    assert.equal(result.staging.state, 'FETCH_FAILED');
  });

test('14 Content-Length over limit fails before body read', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
    headers: { 'Content-Type': 'text/html', 'Content-Length': String(PAIN_FIRST_MAX_BODY_BYTES + 1) },
  });
  const result = await createPainFirstOfflineHomepageInspector(async () => response)(accepted());
  assert.equal(cancelled, true);
  assert.equal(result.observation.httpResultClass, 'UNSUPPORTED');
  assert.equal(result.observation.suppliedHtml, undefined);
});

test('14 streamed overflow discards all partial canonical HTML and cancels', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('<title>Site en construction</title>'));
      controller.enqueue(new Uint8Array(PAIN_FIRST_MAX_BODY_BYTES));
    }, cancel() { cancelled = true; },
  }), { headers: { 'Content-Type': 'text/html' } });
  const result = await createPainFirstOfflineHomepageInspector(async () => response)(accepted());
  assert.equal(cancelled, true);
  assert.equal(result.observation.httpResultClass, 'UNSUPPORTED');
  assert.equal(result.observation.suppliedHtml, undefined);
  assert.equal(result.staging.state, 'FETCH_FAILED');
});

test('14 exact byte limit succeeds and multibyte bytes count toward the limit', async () => {
  assert.equal((await inspectHtml(' '.repeat(PAIN_FIRST_MAX_BODY_BYTES))).observation.httpResultClass, 'SUCCESS');
  assert.equal((await inspectHtml('é'.repeat(PAIN_FIRST_MAX_BODY_BYTES / 2 + 1))).observation.httpResultClass, 'UNSUPPORTED');
});

for (const bytes of [new Uint8Array([0, 1, 2, 60, 104, 49, 62]), new Uint8Array([255, 254, 60, 0])])
  test(`15 binary declared as HTML is not parsed: ${bytes[0]}`, async () => {
    const result = await createPainFirstOfflineHomepageInspector(async () => new Response(bytes, {
      headers: { 'Content-Type': 'text/html' },
    }))(accepted());
    assert.equal(result.observation.httpResultClass, 'UNSUPPORTED');
    assert.equal(result.observation.boundedTitle, undefined);
    assert.equal(result.observation.suppliedHtml, undefined);
  });

test('16-19 title/H1 extraction, entities and missing title or H1', async () => {
  const both = await inspectHtml('<TITLE>Caf&#233; &amp; bar</TITLE><H1>Site <b>en</b>&nbsp;construction</H1>');
  assert.equal(both.observation.boundedTitle, 'Café & bar');
  assert.deepEqual(both.observation.boundedH1, ['Site en construction']);
  const h1 = await inspectHtml('<h1>Site en construction</h1>');
  assert.equal(h1.observation.boundedTitle, undefined);
  assert.equal(h1.staging.state, 'PAIN_SIGNAL_CONFIRMED');
  assert.deepEqual((await inspectHtml('<title>Site en construction</title>')).observation.boundedH1, []);
  assert.equal((await inspectHtml('<html></html>')).staging.state, 'PAIN_UNKNOWN');
});

test('20 bounded JSON-LD stays run-local; R58Z stops before identity extraction', async () => {
  const html = '<title>Site en construction</title><script type="application/ld+json">' +
    '{"@type":"CafeOrCoffeeShop","name":"Offline fixture","siret":"12345678200002"}</script>';
  const result = await inspectHtml(html);
  assert.equal(result.observation.suppliedHtml, html);
  assert.equal(result.staging.state, 'PAIN_SIGNAL_CONFIRMED');
  assert.equal('identity' in result.staging, false);
});

test('21-22 scripts, comments, iframes and subresources neither execute nor fetch nor provide headings', async () => {
  let calls = 0;
  const html = '<script>throw new Error("executed"); const x="<h1>Site en construction</h1>";</script>' +
    '<!-- <title>Site en construction</title> --><iframe><h1>Site en construction</h1></iframe>' +
    '<template><h1>Site en construction</h1></template><img src="/asset"><link rel="stylesheet" href="/css">' +
    '<title>Bienvenue</title>';
  const result = await createPainFirstOfflineHomepageInspector(async () => { calls++; return htmlResponse(html); })(accepted());
  assert.equal(calls, 1);
  assert.deepEqual(result.observation.boundedH1, []);
  assert.equal(result.staging.state, 'NO_PAIN_SIGNAL');
});

for (const [tag, phrase] of [['title', 'Site en construction'], ['h1', 'Site en construction'],
  ['title', 'Site en cours de refonte'], ['h1', 'Site en cours de refonte']])
  test(`23-26 R42 positive binding for ${tag} ${phrase}`, async () => {
    const result = await inspectHtml(`<${tag}>${phrase}</${tag}>`);
    assert.equal(result.staging.state, 'PAIN_SIGNAL_CONFIRMED');
    assert.equal(result.staging.authority, 'NON_AUTHORITATIVE');
  });

test('27 no canonical notice gives NO_PAIN_SIGNAL', async () =>
  assert.equal((await inspectHtml('<title>Bienvenue</title>')).staging.state, 'NO_PAIN_SIGNAL'));
test('28 ambiguous/conflicting notices give PAIN_UNKNOWN', async () => {
  assert.equal((await inspectHtml('')).staging.state, 'PAIN_UNKNOWN');
  assert.equal((await inspectHtml('<title>Site en construction</title><h1>Site en cours de refonte</h1>')).staging.state, 'PAIN_UNKNOWN');
});
test('29 condition mismatch preserves factual observed condition and audit', async () => {
  const { staging } = await inspectHtml('<title>Site en cours de refonte</title>');
  assert.deepEqual(staging, { state: 'PAIN_SIGNAL_CONFIRMED', authority: 'NON_AUTHORITATIVE',
    queryConditionClass: 'SITE_UNDER_CONSTRUCTION', observedConditionClass: 'SITE_REBUILDING', conditionConsistency: 'MISMATCH' });
});

test('30 failed body read never transitions positively', async () => {
  const response = new Response(new ReadableStream({ start(controller) { controller.error(new Error('broken body')); } }),
    { headers: { 'Content-Type': 'text/html' } });
  const result = await createPainFirstOfflineHomepageInspector(async () => response)(accepted());
  assert.equal(result.observation.httpResultClass, 'NETWORK_ERROR');
  assert.equal(result.pageState, 'FETCH_FAILED');
  assert.deepEqual(result.staging, { state: 'FETCH_FAILED', authority: 'NON_AUTHORITATIVE' });
});

test('31-36 no downstream authority, prospect or persistence path', async () => {
  const result = await inspectHtml('<title>Site en construction</title>');
  assert.deepEqual(Object.keys(result).sort(), ['observation', 'pageState', 'staging']);
  for (const field of ['observations', 'websiteStatus', 'research', 'admission', 'prospect', 'snapshotDigest'])
    assert.equal(field in result.staging, false);
  const source = readFileSync(new URL('../research/pain-first-homepage-transport.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:from|import\()\s*['"][^'"]*(?:persistence|provider|admission|outreach|prospect|registry)/);
  assert.doesNotMatch(source, /\b(?:fetch|noticeType|extractDigitalPainEvidence|registryRequestFromIdentity)\s*\(/);
  assert.equal(PAIN_FIRST_LIVE_TRANSPORT_STATUS, 'SAFE_BINDING_IMPLEMENTED');
});

test('same accepted candidate and re-acceptance cannot cause a second request, including concurrent calls', async () => {
  let calls = 0;
  const inspect = createPainFirstOfflineHomepageInspector(async () => { calls++; return htmlResponse(); });
  const a = accepted();
  const first = inspect(a);
  await assert.rejects(inspect(a), /CANDIDATE_REQUEST_BUDGET_EXHAUSTED/);
  await first;
  await assert.rejects(inspect(accepted()), /CANDIDATE_REQUEST_BUDGET_EXHAUSTED/);
  assert.equal(calls, 1);
});

test('query cap is three explicit inspections; other accepted candidates are not auto-fetched', async () => {
  let calls = 0;
  const inspect = createPainFirstOfflineHomepageInspector(async () => { calls++; return htmlResponse(); });
  const inputs = [1, 2, 3, 4].map((resultPosition) => accepted(candidate({ resultPosition,
    resultUrl: `https://fixture-${resultPosition}.invalid/` })));
  assert.equal(calls, 0);
  for (const input of inputs.slice(0, 3)) await inspect(input);
  await assert.rejects(inspect(inputs[3]), /QUERY_REQUEST_BUDGET_EXHAUSTED/);
  assert.equal(calls, 3);
});

test('a consumed acceptance cannot be reused through a different inspector', async () => {
  let calls = 0;
  const fixture: PainFirstFixtureTransport = async () => { calls++; return htmlResponse(); };
  const a = accepted();
  await createPainFirstOfflineHomepageInspector(fixture)(a);
  await assert.rejects(createPainFirstOfflineHomepageInspector(fixture)(a), /CANDIDATE_REQUEST_BUDGET_EXHAUSTED/);
  assert.equal(calls, 1);
});

test('failed inspections still consume candidate budget', async () => {
  let calls = 0;
  const inspect = createPainFirstOfflineHomepageInspector(async () => { calls++; throw new Error('offline'); });
  await inspect(accepted());
  await assert.rejects(inspect(accepted()), /CANDIDATE_REQUEST_BUDGET_EXHAUSTED/);
  assert.equal(calls, 1);
});

test('acceptance is immutable and binds a snapshot, not mutable caller metadata', async () => {
  const input = candidate();
  const a = accepted(input);
  assert.throws(() => { (a as { homepageUrl: string }).homepageUrl = 'http://127.0.0.1/'; });
  input.resultUrl = 'http://127.0.0.1/'; input.conditionClass = 'SITE_REBUILDING';
  const result = await createPainFirstOfflineHomepageInspector(async (url) => {
    assert.equal(url, 'https://fixture.invalid/'); return htmlResponse();
  })(a);
  assert.equal('queryConditionClass' in result.staging && result.staging.queryConditionClass, 'SITE_UNDER_CONSTRUCTION');
});

test('no default live transport and invalid timeout are refused', () => {
  assert.throws(() => createPainFirstOfflineHomepageInspector(undefined as unknown as PainFirstFixtureTransport), /OFFLINE_TRANSPORT_REQUIRED/);
  for (const timeoutMs of [0, -1, Infinity, 10_001])
    assert.throws(() => createPainFirstOfflineHomepageInspector(async () => htmlResponse(), { timeoutMs }), /INVALID_TIMEOUT/);
});

for (const html of ['<title>' + 'a'.repeat(513) + '</title>', '<h1>' + 'a'.repeat(513) + '</h1>',
  '<h1>Bienvenue</h1>'.repeat(4) + '<h1>Site en construction</h1>',
  '<title>Site en construction</title><script>unterminated', '<title>Site en construction'])
  test(`unsupported extraction bounds/malformed HTML fails closed: ${html.length}`, async () => {
    const result = await inspectHtml(html);
    assert.equal(result.observation.httpResultClass, 'UNSUPPORTED');
    assert.equal(result.staging.state, 'FETCH_FAILED');
    assert.equal(result.observation.suppliedHtml, undefined);
  });

test('downloads and unsupported charset never become HTML evidence', async () => {
  const cases: Record<string, string>[] = [{ 'Content-Disposition': 'attachment; filename=page.html' },
    { 'Content-Type': 'text/html; charset=iso-8859-1' }];
  for (const headers of cases) {
    const result = await createPainFirstOfflineHomepageInspector(async () => htmlResponse(undefined, headers))(accepted());
    assert.equal(result.observation.httpResultClass, 'UNSUPPORTED');
  }
});

// R58ZB: injected resolver and native-request connector fixtures only. No fixture
// may open a real socket or invoke system DNS, even for a public-looking address.
const publicV4: LookupAddress = { address: '93.184.216.34', family: 4 };
const publicV6: LookupAddress = { address: '2606:4700:4700::1111', family: 6 };
function pinnedAddress(options: RequestOptions): LookupAddress {
  let result: LookupAddress | undefined;
  options.lookup!('fixture.invalid', { family: options.family }, (error, address, family) => {
    assert.equal(error, null); assert.equal(typeof address, 'string');
    result = { address: address as string, family: family! };
  });
  assert.ok(result);
  return result;
}
function networkFixture(settings: { answers?: readonly LookupAddress[]; resolverFailure?: boolean;
  connectFailure?: boolean; status?: number; html?: string; headers?: Record<string, string> } = {}) {
  const calls: RequestOptions[] = [];
  const destinations: LookupAddress[] = [];
  let resolverCalls = 0;
  const request: NonNullable<PainFirstNetworkDependencies['httpRequest']> = (options, onResponse) => {
    calls.push(options); destinations.push(pinnedAddress(options));
    const req = new EventEmitter() as ClientRequest;
    req.end = (() => {
      queueMicrotask(() => {
        if (settings.connectFailure) { req.emit('error', new Error('fixture connection failure')); req.emit('close'); return; }
        const message = Readable.from([Buffer.from(settings.html ?? '<title>Site en construction</title>')]) as IncomingMessage;
        message.statusCode = settings.status ?? 200;
        message.headers = { 'content-type': 'text/html', ...settings.headers };
        message.once('close', () => req.emit('close'));
        onResponse(message);
      });
      return req;
    }) as ClientRequest['end'];
    return req;
  };
  const dependencies: PainFirstNetworkDependencies = {
    resolveHost: async (hostname, options) => {
      resolverCalls++; assert.equal(hostname, 'fixture.invalid');
      assert.deepEqual(options, { all: true, verbatim: true });
      if (settings.resolverFailure) throw new Error('fixture DNS failure');
      return settings.answers ?? [publicV4];
    }, httpRequest: request, httpsRequest: request,
  };
  return { dependencies, calls, destinations, resolverCalls: () => resolverCalls };
}
const liveAccepted = (url = 'https://fixture.invalid/') => accepted(candidate({ resultUrl: url }));

for (const url of ['http://fixture.invalid/', 'http://fixture.invalid:80/',
  'https://fixture.invalid/', 'https://fixture.invalid:443/'])
  test(`R58ZB standard port accepted: ${url}`, async () => {
    const f = networkFixture();
    const result = await createPainFirstLiveHomepageInspector(f.dependencies)(liveAccepted(url));
    assert.equal(result.pageState, 'PAGE_OBSERVED');
    assert.equal(f.resolverCalls(), 1); assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].port, url.startsWith('https:') ? 443 : 80);
  });

for (const url of ['http://fixture.invalid:8080/', 'https://fixture.invalid:8443/',
  'http://fixture.invalid:443/', 'https://fixture.invalid:80/'])
  test(`R58ZB nonstandard port rejected before DNS and connector: ${url}`, async () => {
    const f = networkFixture(); const a = liveAccepted(url);
    // R55 still accepts the syntactically public staging candidate and keeps its port.
    assert.equal(a.homepageUrl, url);
    const result = await createPainFirstLiveHomepageInspector(f.dependencies)(a);
    assert.equal(result.observation.httpResultClass, 'UNSUPPORTED');
    assert.equal(result.pageState, 'FETCH_FAILED');
    assert.equal(f.resolverCalls(), 0); assert.equal(f.calls.length, 0);
  });

for (const answer of [publicV4, publicV6])
  test(`R58ZB public IPv${answer.family} selects exact validated IP`, async () => {
    const f = networkFixture({ answers: [answer] });
    assert.equal((await createPainFirstLiveHomepageInspector(f.dependencies)(liveAccepted())).pageState, 'PAGE_OBSERVED');
    assert.deepEqual(f.destinations, [answer]); assert.equal(f.calls[0].family, answer.family);
    assert.equal(f.calls[0].autoSelectFamily, false);
  });

for (const address of ['10.0.0.1', '172.16.0.1', '192.168.1.1', '127.0.0.1', '169.254.1.1', '0.0.0.0',
  '100.64.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '240.0.0.1', '::', '::1', 'fc00::1', 'fe80::1',
  'ff02::1', '::ffff:10.0.0.1', '::ffff:a00:1', '2001:db8::1', '2002:a00:1::1', '2606:4700::1%eth0'])
  test(`R58ZB forbidden DNS address rejected: ${address}`, async () => {
    const f = networkFixture({ answers: [{ address, family: address.includes(':') ? 6 : 4 }] });
    const result = await createPainFirstLiveHomepageInspector(f.dependencies)(liveAccepted());
    assert.equal(result.observation.httpResultClass, 'UNSUPPORTED');
    assert.equal(f.resolverCalls(), 1); assert.equal(f.calls.length, 0);
  });

for (const answers of [[publicV4, { address: '10.0.0.1', family: 4 }],
  [{ address: '10.0.0.1', family: 4 }, publicV4], [], [{ address: publicV4.address, family: 6 }],
  [{ address: publicV6.address, family: 4 }], [{ address: 'invalid', family: 4 }],
  [{ address: publicV4.address, family: 0 }], [publicV4, undefined], null])
  test(`R58ZB mixed, empty or malformed DNS state fails closed: ${JSON.stringify(answers)}`, async () => {
    const f = networkFixture({ answers: answers as unknown as readonly LookupAddress[] });
    // Null must reach the transport rather than be replaced by fixture defaults.
    if (answers === null) f.dependencies.resolveHost = async () => null as unknown as readonly LookupAddress[];
    const result = await createPainFirstLiveHomepageInspector(f.dependencies)(liveAccepted());
    assert.equal(result.observation.httpResultClass, 'UNSUPPORTED'); assert.equal(f.calls.length, 0);
  });

test('R58ZB resolver failure cannot connect or reach R42 positive', async () => {
  const f = networkFixture({ resolverFailure: true });
  const result = await createPainFirstLiveHomepageInspector(f.dependencies)(liveAccepted());
  assert.equal(result.observation.httpResultClass, 'NETWORK_ERROR');
  assert.equal(result.staging.state, 'FETCH_FAILED'); assert.equal(f.calls.length, 0); assert.equal(f.resolverCalls(), 1);
});

test('R58ZB first verbatim address only; failed connect has no DNS/address/port/scheme retry', async () => {
  const f = networkFixture({ answers: [publicV6, publicV4], connectFailure: true });
  const result = await createPainFirstLiveHomepageInspector(f.dependencies)(liveAccepted());
  assert.equal(result.observation.httpResultClass, 'NETWORK_ERROR');
  assert.equal(f.resolverCalls(), 1); assert.equal(f.calls.length, 1);
  assert.deepEqual(f.destinations, [publicV6]); assert.equal(f.calls[0].port, 443);
});

test('R58ZB DNS rebinding and mutable resolver answers cannot replace the selected public IP', async () => {
  const f = networkFixture(); let resolutions = 0;
  const answer = { ...publicV4 };
  f.dependencies.resolveHost = async () => (++resolutions === 1 ? [answer, publicV6] : [{ address: '10.0.0.1', family: 4 }]);
  const original = f.dependencies.httpsRequest!;
  f.dependencies.httpsRequest = (options, response) => {
    answer.address = '10.0.0.1';
    assert.deepEqual(pinnedAddress(options), publicV4);
    assert.deepEqual(pinnedAddress(options), publicV4);
    return original(options, response);
  };
  const result = await createPainFirstLiveHomepageInspector(f.dependencies)(liveAccepted());
  assert.equal(result.pageState, 'PAGE_OBSERVED'); assert.equal(resolutions, 1);
  assert.deepEqual(f.destinations, [publicV4]);
});

for (const scheme of ['http', 'https'])
  test(`R58ZB native ${scheme} request keeps hostname, Host, TLS identity and ignores ambient proxies`, async () => {
    const keys = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'NODE_USE_ENV_PROXY',
      'NODE_TLS_REJECT_UNAUTHORIZED'];
    const saved = keys.map((key) => process.env[key]);
    let physicalConnections = 0; let resolutions = 0; let wire = '';
    const destinations: LookupAddress[] = [];
    const oldHttp = http.globalAgent.createConnection; const oldHttps = https.globalAgent.createConnection;
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('GLOBAL_FETCH_DISPATCHER_USED'); };
    http.globalAgent.createConnection = https.globalAgent.createConnection = () => { throw new Error('GLOBAL_PROXY_AGENT_USED'); };
    for (const key of keys) process.env[key] = key === 'NODE_USE_ENV_PROXY' ? '1' :
      key === 'NODE_TLS_REJECT_UNAUTHORIZED' ? '0' : 'http://127.0.0.1:9';
    try {
      const nativeRequest: NonNullable<PainFirstNetworkDependencies['httpRequest']> = (options, response) => {
        assert.equal(options.hostname, 'fixture.invalid'); assert.equal(options.port, scheme === 'https' ? 443 : 80);
        assert.equal(options.method, 'GET'); assert.equal(options.autoSelectFamily, false);
        const agent = options.agent as http.Agent;
        assert.notEqual(agent, http.globalAgent); assert.notEqual(agent, https.globalAgent);
        assert.deepEqual((agent as http.Agent & { options: http.AgentOptions }).options.proxyEnv, {});
        agent.createConnection = ((connectionOptions: RequestOptions) => {
          physicalConnections++; destinations.push(pinnedAddress(connectionOptions));
          assert.equal(connectionOptions.host, 'fixture.invalid');
          assert.equal(connectionOptions.port, scheme === 'https' ? 443 : 80);
          if (scheme === 'https') {
            assert.equal(connectionOptions.servername, 'fixture.invalid');
            assert.equal(connectionOptions.rejectUnauthorized, true);
            assert.equal(connectionOptions.checkServerIdentity, checkServerIdentity);
            assert.ok(connectionOptions.checkServerIdentity!('fixture.invalid', {
              subjectaltname: 'DNS:other.invalid', subject: {},
            } as Parameters<typeof checkServerIdentity>[1]));
          }
          let replied = false;
          return new Duplex({ read() {}, write(chunk, _encoding, callback) {
            wire += chunk.toString(); callback();
            if (!replied && wire.includes('\r\n\r\n')) {
              replied = true;
              queueMicrotask(() => {
                const body = '<title>Site en construction</title>';
                this.push(`HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
                this.push(null);
              });
            }
          } });
        }) as http.Agent['createConnection'];
        // Real native ClientRequest/Agent/HTTP parser; only socket creation is a fixture.
        return (scheme === 'https' ? https.request : http.request)(options, response);
      };
      const result = await createPainFirstLiveHomepageInspector({
        resolveHost: async () => { resolutions++; return [publicV4, publicV6]; },
        httpRequest: nativeRequest, httpsRequest: nativeRequest,
      })(liveAccepted(`${scheme}://fixture.invalid/index.html`));
      assert.equal(result.pageState, 'PAGE_OBSERVED'); assert.equal(result.staging.state, 'PAIN_SIGNAL_CONFIRMED');
      assert.equal(physicalConnections, 1); assert.equal(resolutions, 1); assert.deepEqual(destinations, [publicV4]);
      assert.match(wire, /^GET \/index\.html HTTP\/1\.1\r\n/); assert.match(wire, /\r\nHost: fixture\.invalid\r\n/i);
      assert.doesNotMatch(wire, /(?:Proxy-Authorization|Cookie|Authorization):/i);
    } finally {
      globalThis.fetch = oldFetch;
      http.globalAgent.createConnection = oldHttp; https.globalAgent.createConnection = oldHttps;
      keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
    }
  });

test('R58ZB native connector preserves path/query without IP URL rewrite', async () => {
  const f = networkFixture();
  await createPainFirstBoundHomepageTransport(f.dependencies)('https://fixture.invalid/index.html?x=1%202', { headers: { Accept: 'text/html' } });
  assert.equal(f.calls[0].path, '/index.html?x=1%202'); assert.equal(f.calls[0].hostname, 'fixture.invalid');
});

for (const status of [301, 302, 307, 308])
  test(`R58ZB redirect ${status} stops at one request and never resolves Location`, async () => {
    const f = networkFixture({ status, headers: { location: 'http://127.0.0.1:8080/private' } });
    const result = await createPainFirstLiveHomepageInspector(f.dependencies)(liveAccepted());
    assert.equal(result.observation.httpResultClass, 'REDIRECT'); assert.equal(result.observation.finalUrl, undefined);
    assert.equal(result.staging.state, 'FETCH_FAILED'); assert.equal(f.calls.length, 1); assert.equal(f.resolverCalls(), 1);
  });

test('R58ZB live SUCCESS still binds R42 without pain, website, research, prospect or persistence authority', async () => {
  const f = networkFixture();
  const result = await createPainFirstLiveHomepageInspector(f.dependencies)(liveAccepted());
  assert.equal(result.pageState, 'PAGE_OBSERVED');
  assert.deepEqual(result.staging, { state: 'PAIN_SIGNAL_CONFIRMED', authority: 'NON_AUTHORITATIVE',
    queryConditionClass: 'SITE_UNDER_CONSTRUCTION', observedConditionClass: 'SITE_UNDER_CONSTRUCTION', conditionConsistency: 'MATCH' });
  for (const field of ['DigitalPainObservation', 'observations', 'websiteStatus', 'research', 'prospect', 'identity', 'admission'])
    assert.equal(field in result.staging, false);
  const source = readFileSync(new URL('../research/pain-first-homepage-network.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:from|import\()\s*['"][^'"]*(?:persistence|provider|admission|outreach|prospect|registry)/);
  assert.doesNotMatch(source, /\bfetch\s*\(|rejectUnauthorized\s*:\s*false|setGlobalDispatcher|research\.scored/);
});

test('R58ZB deadline while DNS is pending cannot open a late connection', async () => {
  const f = networkFixture(); let complete!: (answers: readonly LookupAddress[]) => void;
  f.dependencies.resolveHost = () => new Promise((resolve) => { complete = resolve; });
  const result = await createPainFirstLiveHomepageInspector({ ...f.dependencies, timeoutMs: 10 })(liveAccepted());
  assert.equal(result.observation.httpResultClass, 'TIMEOUT'); complete([publicV4]);
  await new Promise<void>((resolve) => setImmediate(resolve)); assert.equal(f.calls.length, 0);
});
