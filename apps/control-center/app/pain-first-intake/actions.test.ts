import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { transformSync } from 'esbuild';
import { extractSuppliedFirstPartyIdentity } from '../../../../core/research/website-seed';
import { inspectPainFirstCandidate } from './actions';
import { mapManualPainFirstSubmission } from './submission';
import { acceptPainFirstSearchCandidate } from '../../../../core/research/pain-first-staging';
import type { PainFirstSearchCandidate } from '../../../../core/research/pain-first-staging';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const cases = [
  ['confirmed', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['mismatch', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MISMATCH'],
  ['siret', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['siren', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['partial', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['conflict', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['enrich', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['enrich-absent', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['enrich-contact', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['enrich-ambiguous', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['enrich-redirect', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['enrich-failure', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['enrich-client-error', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['enrich-server-error', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['enrich-timeout', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['enrich-unsupported', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['enrich-conflict', 'SUCCESS', 'PAIN_SIGNAL_CONFIRMED', 'MATCH'],
  ['no-pain', 'SUCCESS', 'NO_PAIN_SIGNAL'],
  ['unknown', 'SUCCESS', 'PAIN_UNKNOWN'],
  ['redirect', 'REDIRECT', 'FETCH_FAILED'],
  ['client-error', 'CLIENT_ERROR', 'FETCH_FAILED'],
  ['server-error', 'SERVER_ERROR', 'FETCH_FAILED'],
  ['network-error', 'NETWORK_ERROR', 'FETCH_FAILED'],
  ['timeout', 'TIMEOUT', 'FETCH_FAILED'],
  ['unsupported', 'UNSUPPORTED', 'FETCH_FAILED'],
] as const;

// Test-only native boundary: no system DNS, socket or public HTTP request.
// The same preload is used by Next, so browser proof exercises the real action
// and the unchanged R58Z live inspector through R42 staging.
const fixtureNetwork = String.raw`
const dns = require('node:dns/promises');
const https = require('node:https');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { syncBuiltinESMExports } = require('node:module');
const originals = { lookup: dns.lookup, httpsRequest: https.request, httpRequest: http.request };
dns.lookup = async (host) => {
  log({ kind: 'dns', host });
  if (!host.endsWith('.invalid')) throw new Error('NON_FIXTURE_DNS_BLOCKED');
  return [{ address: '93.184.216.34', family: 4 }];
};
https.request = (options, onResponse) => {
  const host = options.hostname;
  const secondPage = options.path !== '/';
  log({ kind: 'request', host, method: options.method, ...(secondPage ? { path: options.path } : {}) });
  if (!host.endsWith('.invalid')) throw new Error('NON_FIXTURE_REQUEST_BLOCKED');
  const name = host.split('.')[0];
  const req = new EventEmitter();
  req.end = () => {
    setTimeout(() => {
      if (name === 'network-error' || name === 'timeout' || secondPage && ['enrich-failure', 'enrich-timeout'].includes(name)) {
        const error = new Error('PRIVATE_SOCKET_DIAGNOSTIC');
        if (name === 'timeout' || name === 'enrich-timeout') error.name = 'AbortError';
        req.emit('error', error); req.emit('close'); return;
      }
      const title = name === 'mismatch' ? 'Site en cours de refonte' :
        name === 'no-pain' ? 'Bienvenue' : 'Site en construction';
      const operator = { '@type': name === 'siren' ? 'Organization' : 'LocalBusiness', name: 'Café Fixture',
        address: { addressLocality: 'Fort-de-France', postalCode: '97200', streetAddress: '12 Rue des Hibiscus' } };
      const identity = secondPage ? { ...operator, siret: '12345678200002',
          ...(name === 'enrich-conflict' ? { name: 'Other Operator' } : {}) } :
        name === 'siret' ? { ...operator, siret: '12345678200002' } :
        name === 'siren' ? { ...operator, siren: '123456782' } :
        name === 'partial' || name.startsWith('enrich') && name !== 'enrich-absent' ? { '@type': 'Organization', name: 'Café Fixture' } :
        name === 'conflict' ? { ...operator, siret: '12345678200003' } : null;
      const html = name === 'unknown' ? '' :
        '<title>' + title + '</title><h1>' + title + '</h1><p>PRIVATE_HTML_SENTINEL</p>' +
        (identity ? '<script type="application/ld+json">' + JSON.stringify({ ...identity, description: 'PRIVATE_JSONLD_SENTINEL' }) + '</script>' : '') +
        (!secondPage && (name.startsWith('enrich') || name === 'siret' || name === 'conflict') ?
          (name === 'enrich-contact' ? '<a href="/contact">Contact</a>' : '<a href="/legal?private=sentinel">Mentions légales</a><a href="/contact">Contact</a>') +
          (name === 'enrich-ambiguous' ? '<a href="/other">Informations légales</a>' : '') : '');
      const message = Readable.from([Buffer.from(html)]);
      message.statusCode = secondPage && name === 'enrich-redirect' ? 302 :
        secondPage && name === 'enrich-client-error' ? 404 : secondPage && name === 'enrich-server-error' ? 503 :
        ({ redirect: 302, 'client-error': 404, 'server-error': 503 })[name] || 200;
      message.headers = { 'content-type': name === 'unsupported' || secondPage && name === 'enrich-unsupported' ? 'application/pdf' : 'text/html' };
      onResponse(message); req.emit('close');
    }, 400);
  };
  return req;
};
http.request = (...args) => {
  const target = args[0];
  const host = typeof target === 'string' ? new URL(target).hostname : target.hostname || target.host;
  if (host === '127.0.0.1' || host === 'localhost') return originals.httpRequest(...args);
  log({ kind: 'blocked-http', host });
  throw new Error('NON_LOCAL_HTTP_BLOCKED');
};
syncBuiltinESMExports();
return () => { dns.lookup = originals.lookup; https.request = originals.httpsRequest;
  http.request = originals.httpRequest; syncBuiltinESMExports(); };
`;

function candidate(name = 'confirmed'): PainFirstSearchCandidate {
  return JSON.parse(JSON.stringify(mapManualPainFirstSubmission({
    SITE_UNDER_CONSTRUCTION: `https://${name}.invalid/`,
  }, '2026-10-01T12:00:00.000Z').candidates[0]));
}

function expectedIdentity(name: string) {
  const initialIdentityState = name === 'conflict' ? 'IDENTITY_CONFLICT' : name === 'siret' || name === 'siren' ? 'IDENTITY_STRONG' :
    name === 'partial' || name.startsWith('enrich') && name !== 'enrich-absent' ? 'IDENTITY_PARTIAL' : 'IDENTITY_ABSENT';
  const enriched = name.startsWith('enrich');
  const failureClass = ({ 'enrich-redirect': 'REDIRECT', 'enrich-failure': 'NETWORK_ERROR',
    'enrich-client-error': 'CLIENT_ERROR', 'enrich-server-error': 'SERVER_ERROR',
    'enrich-timeout': 'TIMEOUT', 'enrich-unsupported': 'UNSUPPORTED' } as Record<string, string>)[name];
  const enrichmentOutcome = name === 'enrich-ambiguous' ? 'AMBIGUOUS_LINK' :
    failureClass ? 'FETCH_FAILED' : enriched ? 'SUCCESS' :
    initialIdentityState === 'IDENTITY_STRONG' || initialIdentityState === 'IDENTITY_CONFLICT' ? 'NOT_NEEDED' : 'NO_ELIGIBLE_LINK';
  const base = { initialIdentityState, enrichmentOutcome,
    ...(enriched && name !== 'enrich-ambiguous' ? { identityPageTransportClass: failureClass ?? 'SUCCESS' } : {}),
    ...(enriched && name !== 'enrich-ambiguous' ? { identityPage: name === 'enrich-contact' ? '/contact' : '/legal' } : {}) };
  if (name === 'conflict' || name === 'enrich-conflict') return { ...base, identityState: 'IDENTITY_CONFLICT' };
  if (name === 'partial' || name === 'enrich-ambiguous' || failureClass)
    return { ...base, identityState: 'IDENTITY_PARTIAL', operatorName: 'Café Fixture' };
  if (name === 'siret' || name === 'siren' || enriched) return { ...base, identityState: 'IDENTITY_STRONG',
    siren: '123456782', ...(name !== 'siren' ? { siret: '12345678200002' } : {}),
    operatorName: 'Café Fixture', municipality: 'Fort-de-France', postcode: '97200', street: 'Rue des Hibiscus', streetNumber: '12' };
  return { ...base, identityState: 'IDENTITY_ABSENT' };
}

function expectedNetwork(name: string) {
  const first = [{ kind: 'dns', host: `${name}.invalid` }, { kind: 'request', host: `${name}.invalid`, method: 'GET' }];
  return name.startsWith('enrich') && name !== 'enrich-ambiguous' ? [...first,
    { kind: 'dns', host: `${name}.invalid` }, { kind: 'request', host: `${name}.invalid`, method: 'GET',
      path: name === 'enrich-contact' ? '/contact' : '/legal?private=sentinel' }] : first;
}

test('R60Z exact supplied observation, one inspector, identity invocation gate and bounded allowlist', async () => {
  // Instrument the actual action without adding an injectable production action or parser.
  const compiled = transformSync(readFileSync(join(root, 'apps/control-center/app/pain-first-intake/actions.ts'), 'utf8'),
    { loader: 'ts', format: 'cjs' }).code;
  const html = '<script type="application/ld+json">' + JSON.stringify({ '@type': 'Organization',
    name: 'N'.repeat(700), siren: '123456782', description: 'PRIVATE_JSONLD_SENTINEL' }) + '</script>';
  for (const [state, transport, condition, expectedCalls] of [
    ['PAIN_SIGNAL_CONFIRMED', 'SUCCESS', 'SITE_UNDER_CONSTRUCTION', 1],
    ['PAIN_SIGNAL_CONFIRMED', 'SUCCESS', 'SITE_REBUILDING', 1],
    ['PAIN_SIGNAL_CONFIRMED', 'SUCCESS', 'UNSUPPORTED', 0],
    ['NO_PAIN_SIGNAL', 'SUCCESS', undefined, 0], ['PAIN_UNKNOWN', 'SUCCESS', undefined, 0],
    ...['REDIRECT', 'CLIENT_ERROR', 'SERVER_ERROR', 'NETWORK_ERROR', 'TIMEOUT', 'UNSUPPORTED']
      .map((transport) => ['FETCH_FAILED', transport, undefined, 0]),
  ]) {
    let inspections = 0; let extractions = 0;
    const observation = { schemaVersion: 1, httpResultClass: transport, suppliedHtml: html };
    const inspection = { observation, pageState: transport === 'SUCCESS' ? 'PAGE_OBSERVED' : 'FETCH_FAILED',
      staging: { state, authority: 'NON_AUTHORITATIVE', observedConditionClass: condition } };
    const module: any = { exports: {} };
    new Function('require', 'module', 'exports', compiled)((path: string) => {
      if (path.endsWith('/pain-first-staging')) return { acceptPainFirstSearchCandidate };
      if (path.endsWith('/pain-first-homepage-transport')) return {
        createPainFirstLiveHomepageInspector: () => async () => { inspections++; return inspection; },
        createPainFirstLiveIdentityEnricher: () => async (_accepted: unknown, supplied: unknown, initial: unknown) => {
          assert.equal(supplied, inspection); return { outcome: 'NOT_NEEDED', finalIdentity: initial }; } };
      if (path.endsWith('/website-seed')) return { extractSuppliedFirstPartyIdentity: (supplied: string) => {
        extractions++; assert.equal(supplied, observation.suppliedHtml);
        return extractSuppliedFirstPartyIdentity(supplied);
      } };
      throw new Error(`UNAUTHORIZED_DEPENDENCY:${path}`);
    }, module, module.exports);
    const result = await module.exports.inspectPainFirstCandidate(candidate());
    assert.equal(inspections, 1); assert.equal(extractions, expectedCalls);
    assert.equal(result.staging.state, state);
    assert.equal(result.staging.authority, 'NON_AUTHORITATIVE');
    assert.deepEqual(inspection, { observation, pageState: transport === 'SUCCESS' ? 'PAGE_OBSERVED' : 'FETCH_FAILED',
      staging: { state, authority: 'NON_AUTHORITATIVE', observedConditionClass: condition } });
    if (expectedCalls) {
      assert.deepEqual(result.identity, { identityState: 'IDENTITY_STRONG', initialIdentityState: 'IDENTITY_STRONG',
        enrichmentOutcome: 'NOT_NEEDED', siren: '123456782', operatorName: 'N'.repeat(512) });
    } else assert.equal('identity' in result, false);
    assert.doesNotMatch(JSON.stringify(result), /suppliedHtml|PRIVATE_|application\/ld\+json|description/);
  }
});

test('server rejects malformed, rejected, forged and serialized capabilities before any transport', async () => {
  const calls: unknown[] = [];
  const restore = new Function('require', 'log', fixtureNetwork)(require, (call: unknown) => calls.push(call));
  try {
    const input = candidate();
    const capability = acceptPainFirstSearchCandidate(input);
    for (const invalid of [null, [], {}, [input, input], 'https://confirmed.invalid/',
      { ...input, resultUrl: 'http://127.0.0.1/' }, { ...input, authority: 'VERIFIED' },
      { ...input, resultPosition: 11 }, { ...input, queryPlanId: 'forged' },
      { ...input, providerClass: 123 }, { ...input, resultTitle: 123 },
      { ...input, acquiredAt: 'invalid' }, { ...input, accepted: true },
      JSON.parse(JSON.stringify(capability))]) {
      assert.deepEqual(await inspectPainFirstCandidate(invalid as PainFirstSearchCandidate),
        { state: 'INVALID', reason: 'URL_REJECTED' });
    }
    assert.equal(calls.length, 0);
  } finally { restore(); }
});

for (const [name, transport, staging, consistency] of cases) {
  test(`serialized ${name}: server-local acceptance, bounded R58Z requests, ${transport}/${staging}`, async () => {
    const calls: { kind: string; host: string; method?: string }[] = [];
    const restore = new Function('require', 'log', fixtureNetwork)(require, (call: typeof calls[number]) => calls.push(call));
    try {
      const result = await inspectPainFirstCandidate(candidate(name));
      assert.equal(result.state, 'INSPECTED');
      if (result.state !== 'INSPECTED') return;
      assert.deepEqual(calls, expectedNetwork(name));
      assert.equal(result.observation.httpResultClass, transport);
      assert.equal(result.pageState, transport === 'SUCCESS' ? 'PAGE_OBSERVED' : 'FETCH_FAILED');
      assert.equal(result.staging.state, staging);
      assert.equal(result.staging.authority, 'NON_AUTHORITATIVE');
      assert.equal(result.staging.conditionConsistency, consistency);
      assert.deepEqual(Object.keys(result).sort(), [...(consistency ? ['identity'] : []), 'observation', 'pageState', 'staging', 'state']);
      assert.deepEqual(result.identity, consistency ? expectedIdentity(name) : undefined);
      assert.ok(Object.keys(result.observation).every((key) => ['httpResultClass', 'boundedTitle', 'boundedH1'].includes(key)));
      assert.ok(Object.keys(result.staging).every((key) => ['state', 'authority', 'queryConditionClass',
        'observedConditionClass', 'conditionConsistency'].includes(key)));
      assert.doesNotMatch(JSON.stringify(result), /suppliedHtml|PRIVATE_|application\/ld\+json|description|httpStatus|statusCode|93\.184|socket|dns|selectedIp|proxy|stack|TLS|prospect|research|VERIFIED/);
      if (consistency) {
        assert.equal(result.staging.queryConditionClass, 'SITE_UNDER_CONSTRUCTION');
        assert.equal(result.staging.observedConditionClass, consistency === 'MATCH' ? 'SITE_UNDER_CONSTRUCTION' : 'SITE_REBUILDING');
        assert.equal(result.observation.boundedTitle, consistency === 'MATCH' ? 'Site en construction' : 'Site en cours de refonte');
        assert.deepEqual(result.observation.boundedH1, [result.observation.boundedTitle]);
      }
    } finally { restore(); }
  });
}

test('action and browser keep the canonical path without lifecycle writes or direct prospect fetch', () => {
  const action = readFileSync(join(root, 'apps/control-center/app/pain-first-intake/actions.ts'), 'utf8');
  const page = readFileSync(join(root, 'apps/control-center/app/pain-first-intake/page.tsx'), 'utf8');
  const transport = readFileSync(join(root, 'core/research/pain-first-homepage-transport.ts'), 'utf8');
  assert.match(action, /^'use server';/);
  assert.match(action, /acceptPainFirstSearchCandidate\(candidate\)/);
  assert.equal(action.match(/createPainFirstLiveHomepageInspector\(\)\(accepted\)/g)?.length, 1);
  assert.match(transport, /stagePainFirstSuppliedPage\(candidate, observation, \{ stopAfterPainSignal: true \}\)/);
  for (const source of [action, page]) {
    assert.doesNotMatch(source, /\bfetch\s*\(|api-worker|callApi\(|Inspect All|setInterval|setTimeout/);
    assert.doesNotMatch(source, /(?:from|import\()\s*['"][^'"]*(?:persistence|provider|admission|outreach|prospect|registry)/);
    assert.doesNotMatch(source, /\.prepare\(|\.execute\(|\.batch\(|research\.scored|DigitalPainObservation|scheduleResearch/);
  }
});

test('Chrome/CDP: accepted-only explicit click, pending guard, one action and bounded result for every class',
  { skip: process.env.R59Z_CHROME_PROOF !== '1', timeout: 180_000 }, async () => {
  const qa = require(join(root, 'scripts/qa-surface.cjs'));
  const evidenceDir = mkdtempSync(join(tmpdir(), 'magicscript-r59z-'));
  // Run the actual app source in an isolated workspace: Next may generate config
  // and build files here, never in the user's dirty checkout or existing .next.
  const isolated = join(evidenceDir, 'workspace');
  const isolatedApp = join(isolated, 'apps/control-center');
  mkdirSync(isolatedApp, { recursive: true });
  cpSync(join(root, 'apps/control-center'), isolatedApp, { recursive: true,
    filter: (path) => !basename(path).startsWith('.next') && !basename(path).startsWith('.env') && basename(path) !== 'node_modules' });
  cpSync(join(root, 'core'), join(isolated, 'core'), { recursive: true, filter: (path) => basename(path) !== 'node_modules' });
  cpSync(join(root, 'package.json'), join(isolated, 'package.json'));
  symlinkSync(join(root, 'node_modules'), join(isolated, 'node_modules'), 'junction');
  const logFile = join(evidenceDir, 'fixture-network.jsonl');
  const preload = join(evidenceDir, 'fixture-network.cjs');
  writeFileSync(logFile, '');
  writeFileSync(preload, `new Function('require', 'log', ${JSON.stringify(fixtureNetwork)})(require, (event) => require('node:fs').appendFileSync(${JSON.stringify(logFile)}, JSON.stringify(event) + '\\n'));`);
  const port = await new Promise<number>((resolvePort) => {
    const socket = createServer();
    socket.listen(0, '127.0.0.1', () => { const address = socket.address();
      assert.ok(address && typeof address !== 'string'); socket.close(() => resolvePort(address.port)); });
  });
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['--require', preload, join(root, 'node_modules/next/dist/bin/next'),
    'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: isolatedApp, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: '', NEXT_TELEMETRY_DISABLED: '1', NEXT_DIST_DIR: '.next-r60zb-proof' },
  });
  let serverOutput = '';
  server.stdout?.on('data', (chunk) => { serverOutput += chunk; });
  server.stderr?.on('data', (chunk) => { serverOutput += chunk; });
  let browser: any;
  let cdp: any;
  const logs = () => readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await fetch(`${base}/pain-first-intake`)).status === 200; } catch {}
      if (ready || server.exitCode !== null) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(ready, serverOutput.slice(-3000));
    browser = await qa.launchBrowser(qa.findChrome());
    cdp = new qa.CdpConnection(browser.version.webSocketDebuggerUrl);
    await cdp.ready;
    const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const attached = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const session = attached.sessionId;
    await cdp.send('Page.enable', {}, session);
    await cdp.send('Runtime.enable', {}, session);
    await cdp.send('Network.enable', {}, session);
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, session);
    const unexpected: string[] = [];
    cdp.on('Fetch.requestPaused', (event: any) => {
      if (event.sessionId !== session) return;
      const allowed = event.params.request.url.startsWith(base + '/');
      if (!allowed) unexpected.push(event.params.request.url);
      void cdp.send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', {
        requestId: event.params.requestId, ...(allowed ? {} : { errorReason: 'BlockedByClient' }),
      }, session);
    });
    const actions: any[] = [];
    const actionIds = new Set<string>();
    const bodies: Promise<string>[] = [];
    cdp.on('Network.requestWillBeSent', (event: any) => {
      if (event.sessionId === session && Object.keys(event.params.request.headers).some((key) => key.toLowerCase() === 'next-action')) {
        actions.push(event.params.request); actionIds.add(event.params.requestId);
      }
    });
    cdp.on('Network.loadingFinished', (event: any) => {
      if (event.sessionId === session && actionIds.has(event.params.requestId)) {
        bodies.push(cdp.send('Network.getResponseBody', { requestId: event.params.requestId }, session).then((value: any) => value.body));
      }
    });
    const evaluate = (expression: string) => qa.evaluate(cdp, session, expression);
    const wait = (expression: string) => qa.waitForCondition(cdp, session, expression, 15_000);
    await cdp.send('Page.navigate', { url: `${base}/pain-first-intake` }, session);
    await wait(`document.querySelector('textarea') && document.readyState === 'complete'`);
    // Hydration must be complete before manipulating the controlled form.
    await wait(`Object.keys(document.querySelector('textarea')).some(key => key.startsWith('__reactProps'))`);
    const proofs: unknown[] = [];
    for (const [name, transport, staging, consistency] of cases) {
      const actionStart = actions.length;
      const logStart = logs().length;
      await evaluate(`(() => { const input = document.getElementById('SITE_UNDER_CONSTRUCTION');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input,
          ${JSON.stringify(`https://${name}.invalid/\nhttps://untouched.invalid/\nhttp://127.0.0.1/`)});
        input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
      await evaluate(`document.querySelector('button[type=submit]').click()`);
      await wait(`document.querySelector('[aria-label="Résultat de validation"] h2')?.textContent === 'ACCEPTED : 2 · REJECTED : 1'`);
      const before = await evaluate(`(() => { const section = document.querySelector('[aria-label="Résultat de validation"]');
        const lists = section.querySelectorAll('ul'); return {
          acceptedButtons: lists[0].querySelectorAll('button').length,
          rejectedButtons: lists[1].querySelectorAll('button').length,
          inspectAll: [...document.querySelectorAll('button')].some(b => /Inspect All/i.test(b.textContent)),
          visible: lists[0].querySelector('button').getBoundingClientRect().width > 0 }; })()`);
      assert.deepEqual(before, { acceptedButtons: 2, rejectedButtons: 0, inspectAll: false, visible: true });
      assert.equal(actions.length, actionStart);
      assert.equal(logs().length, logStart);
      await evaluate(`(() => { const button = document.querySelector('[aria-label="Résultat de validation"] ul button');
        button.scrollIntoView(); button.click(); button.click(); })()`);
      await wait(`document.querySelector('[aria-label="Résultat de validation"] ul button').disabled &&
        document.querySelector('[aria-label="Résultat d’inspection"]').textContent.includes('Inspection en cours')`);
      await wait(`document.querySelector('[aria-label="Résultat d’inspection"] dl')?.textContent.includes(${JSON.stringify(transport)})`);
      const displayed = await evaluate(`(() => { const lists = document.querySelector('[aria-label="Résultat de validation"]').querySelectorAll('ul');
        return { text: lists[0].querySelector('[aria-label="Résultat d’inspection"]').innerText,
          identityTransport: [...lists[0].querySelectorAll('dt')].find(dt => dt.textContent === 'Transport page d’identité')?.nextElementSibling?.textContent,
          nextEmpty: lists[0].querySelectorAll('[aria-label="Résultat d’inspection"]')[1].innerText === '',
          nextEnabled: !lists[0].querySelectorAll('button')[1].disabled,
          htmlAbsent: !document.body.innerText.includes('PRIVATE_HTML_SENTINEL') }; })()`);
      assert.ok(displayed.text.includes(transport)); assert.ok(displayed.text.includes(staging));
      assert.ok(displayed.text.includes('NON_AUTHORITATIVE'));
      if (consistency) {
        assert.ok(displayed.text.includes(consistency));
        assert.ok(displayed.text.includes('Identité'));
        assert.ok(displayed.text.includes('Identité initiale'));
        assert.ok(displayed.text.includes('Enrichissement de l’identité'));
        assert.ok(displayed.text.includes('Identité finale'));
        assert.ok(displayed.text.includes('NON_CANONICAL · CANDIDATE FACTS'));
        for (const value of Object.values(expectedIdentity(name))) assert.ok(displayed.text.includes(value));
        assert.equal(displayed.identityTransport, (expectedIdentity(name) as { identityPageTransportClass?: string }).identityPageTransportClass);
        assert.ok(displayed.text.includes('Titre')); assert.ok(displayed.text.includes('H1'));
        assert.ok(displayed.text.includes(consistency === 'MATCH' ? 'Site en construction' : 'Site en cours de refonte'));
      } else { assert.ok(!displayed.text.includes('Identité')); assert.equal(displayed.identityTransport, undefined); }
      assert.doesNotMatch(displayed.text, /PRIVATE_|application\/ld\+json|private=sentinel|HTTP status|statusCode|93\.184|selectedIp|dnsAnswers|proxyEnv|socket|TLS/);
      assert.ok(displayed.nextEmpty && displayed.nextEnabled && displayed.htmlAbsent);
      await new Promise((r) => setTimeout(r, 450));
      assert.equal(actions.length, actionStart + 1);
      const payload = JSON.parse(actions[actionStart].postData);
      assert.equal(payload.length, 1);
      assert.deepEqual(Object.keys(payload[0]).sort(), Object.keys(candidate(name)).sort());
      assert.equal(payload[0].resultUrl, `https://${name}.invalid/`);
      assert.equal(payload[0].authority, 'NONE'); assert.equal('accepted' in payload[0], false);
      assert.deepEqual(logs().slice(logStart), expectedNetwork(name));
      proofs.push({ name, ...before, ...displayed, actions: 1, requests: expectedNetwork(name).length / 2 });
      if (name === 'confirmed' || name === 'enrich') {
        const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' }, session);
        writeFileSync(join(evidenceDir, `${name}.png`), Buffer.from(screenshot.data, 'base64'));
      }
    }
    assert.deepEqual(unexpected, []);
    const responses = await Promise.all(bodies);
    assert.equal(responses.length, cases.length);
    for (const body of responses) assert.doesNotMatch(body, /suppliedHtml|PRIVATE_|application\/ld\+json|httpStatus|statusCode|private=sentinel|93\.184|selectedIp|dnsAnswers|proxyEnv|socket|TLS/);
    writeFileSync(join(evidenceDir, 'chrome-proof.json'), JSON.stringify({ pass: true, proofs,
      liveExternalProspectFetches: 0, actionResponses: responses.length }, null, 2));
    console.log(`R59Z_CHROME_CDP=PASS evidence=${evidenceDir}`);
  } finally {
    if (cdp) cdp.close();
    if (browser) await qa.closeBrowser(browser);
    if (server.exitCode === null) server.kill();
    await new Promise<void>((done) => {
      if (server.exitCode !== null) { done(); return; }
      server.once('exit', () => done());
    });
  }
});
