'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  HEALTH_PATH,
  localPathToRoute,
  localPathToUrl,
  openLocalPreview,
  resolvePreviewPath,
  startPreviewServer,
  toLocalPreviewUrl,
} = require('./local-preview-server.cjs');

const root = path.join(os.tmpdir(), 'magic-script-local-preview-test');

function request(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ statusCode: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  });
}

test.before(() => {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>local preview</h1>');
  fs.writeFileSync(path.join(root, 'asset.txt'), 'asset');
});

test.after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('converts a local path to a loopback URL', () => {
  const localPath = path.join(root, 'index.html');
  assert.equal(localPathToRoute(root, localPath), '/index.html');
  assert.equal(localPathToUrl(root, localPath, 43123), 'http://127.0.0.1:43123/index.html');
  assert.equal(toLocalPreviewUrl({ port: 43123, pathname: '/p/fixture-snemm-v2' }), 'http://127.0.0.1:43123/p/fixture-snemm-v2');
});

test('automatic browser opening accepts loopback only', () => {
  const calls = [];
  const fakeSpawn = (command, args, options) => {
    calls.push({ command, args, options });
    return { unref() {} };
  };
  openLocalPreview('http://127.0.0.1:43123/', fakeSpawn);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.at(-1), 'http://127.0.0.1:43123/');
  assert.throws(() => openLocalPreview('https://example.com/', fakeSpawn), /loopback/);
});

test('refuses path traversal and paths outside the preview root', () => {
  assert.throws(() => resolvePreviewPath(root, '/../secret.txt'), { code: 'PATH_TRAVERSAL' });
  assert.throws(() => resolvePreviewPath(root, '/%2e%2e/secret.txt'), { code: 'PATH_TRAVERSAL' });
  assert.throws(() => localPathToRoute(root, path.join(root, '..', 'secret.txt')), { code: 'PATH_OUTSIDE_PREVIEW' });
});

test('returns HTTP 404 for an absent file', async () => {
  const preview = await startPreviewServer({ root, preferredPort: 0 });
  try {
    const response = await request(`${preview.url}/missing.txt`);
    assert.equal(response.statusCode, 404);
  } finally {
    await preview.close();
  }
});

test('moves to a free port when the preferred port is unavailable', async () => {
  const blocker = http.createServer((_request, response) => response.end('blocked'));
  await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
  const blockedPort = blocker.address().port;
  const preview = await startPreviewServer({ root, preferredPort: blockedPort });
  try {
    assert.notEqual(preview.port, blockedPort);
    assert.equal((await request(preview.healthUrl)).statusCode, 200);
  } finally {
    await preview.close();
    await new Promise((resolve, reject) => blocker.close((error) => (error ? reject(error) : resolve())));
  }
});

test('resolves prototype and Sales Room routes and reports ready only after HTTP health 200', async () => {
  const preview = await startPreviewServer({ root, preferredPort: 0 });
  try {
    const health = await request(preview.healthUrl);
    const personalized = await request(`${preview.url}/p/fixture-snemm-v2`);
    const prototype = await request(`${preview.url}/demo/snemm`);
    assert.equal(health.statusCode, 200);
    assert.equal(JSON.parse(health.body).ok, true);
    assert.equal(personalized.statusCode, 200);
    assert.equal(prototype.statusCode, 200);
    assert.match(personalized.body, /local preview/);
    assert.equal((await request(`${preview.url}/p/app.js`)).statusCode, 404);
    assert.equal(preview.healthUrl.endsWith(HEALTH_PATH), true);
  } finally {
    await preview.close();
  }
});

test('cleanup closes the server and releases its port', async () => {
  const preview = await startPreviewServer({ root, preferredPort: 0 });
  const port = preview.port;
  await preview.close();
  await assert.rejects(request(`http://127.0.0.1:${port}${HEALTH_PATH}`));
});
