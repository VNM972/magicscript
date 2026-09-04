'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');

const { startPreviewServer } = require('./local-preview-server.cjs');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const PREVIEW_ROOT = path.join(REPOSITORY_ROOT, 'sites', 'magicscript-v2', 'public');
const DEFAULT_FIXTURE = 'snemm';
const VIEWPORTS = {
  desktop: { name: 'desktop', width: 1280, height: 720 },
  mobile: { name: 'mobile', width: 390, height: 844 },
};

function usage() {
  return [
    'Usage: node scripts/qa-surface.cjs [options]',
    '',
    'Options:',
    '  --route <path>              Route to test, for example /p/snemm',
    '  --surface <name>            public | prototype | sales-room | all',
    '  --fixture <slug>            Fixture slug (default: snemm)',
    '  --viewport <name>           desktop | mobile | both (default: both)',
    '  --output-dir <directory>   Screenshot/report directory',
    '  --port <number>             Preferred local preview port (default: 4173)',
    '  --chrome <path>             Chrome/Chromium executable override',
    '  --json                      Emit only the machine-readable report',
    '  --help                      Show this help',
  ].join('\n');
}

function parseArgs(argv) {
  const args = {
    fixture: DEFAULT_FIXTURE,
    viewport: 'both',
    surface: null,
    preferredPort: 4173,
    outputDir: path.join(os.tmpdir(), 'magicscript-surface-qa'),
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--help') args.help = true;
    else if (value === '--route') args.route = argv[++index];
    else if (value === '--surface') args.surface = argv[++index];
    else if (value === '--fixture') args.fixture = argv[++index];
    else if (value === '--viewport') args.viewport = argv[++index];
    else if (value === '--output-dir') args.outputDir = path.resolve(argv[++index]);
    else if (value === '--port') args.preferredPort = Number(argv[++index]);
    else if (value === '--chrome') args.chrome = path.resolve(argv[++index]);
    else if (value === '--json') args.json = true;
    else throw new Error(`Unknown option: ${value}`);
  }

  if (!['desktop', 'mobile', 'both'].includes(args.viewport)) {
    throw new Error('--viewport must be desktop, mobile, or both');
  }
  if (args.surface && !['public', 'prototype', 'sales-room', 'all'].includes(args.surface)) {
    throw new Error('--surface must be public, prototype, sales-room, or all');
  }
  if (!Number.isInteger(args.preferredPort) || args.preferredPort < 0 || args.preferredPort > 65535) {
    throw new Error('--port must be a valid TCP port');
  }
  if (!args.fixture || !/^[a-z0-9][a-z0-9-]*$/i.test(args.fixture)) {
    throw new Error('--fixture must be a URL-safe slug');
  }
  if (args.route && (!args.route.startsWith('/') || args.route.includes('..'))) {
    throw new Error('--route must be an absolute local path without traversal');
  }
  return args;
}

function routesFor(args) {
  if (args.route) return [{ name: 'custom', route: args.route }];
  if (args.surface === 'public') return [{ name: 'public', route: '/' }];
  if (args.surface === 'prototype') return [{ name: 'prototype', route: `/demo/${args.fixture}` }];
  if (args.surface === 'sales-room') return [{ name: 'sales-room', route: `/p/${args.fixture}` }];
  return [
    { name: 'public', route: '/' },
    { name: 'prototype', route: `/demo/${args.fixture}` },
    { name: 'sales-room', route: `/p/${args.fixture}` },
  ];
}

function viewportsFor(name) {
  if (name === 'desktop') return [VIEWPORTS.desktop];
  if (name === 'mobile') return [VIEWPORTS.mobile];
  return [VIEWPORTS.desktop, VIEWPORTS.mobile];
}

function getJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        let json;
        try { json = JSON.parse(body); } catch {}
        resolve({ statusCode: response.statusCode, body, json });
      });
    });
    request.on('timeout', () => request.destroy(new Error(`Timed out: ${url}`)));
    request.on('error', reject);
  });
}

async function waitForHttp(url, timeoutMs = 5000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await getJson(url, Math.min(1000, timeoutMs));
      if (response.statusCode === 200) return response;
      lastError = new Error(`HTTP ${response.statusCode}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`HTTP readiness failed for ${url}: ${lastError?.message || 'timeout'}`);
}

async function waitForConditionHttp(url, predicate, timeoutMs = 5000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await getJson(url, Math.min(1000, timeoutMs));
      if (response.statusCode === 200 && predicate(response.json)) return response.json;
      lastError = new Error(`HTTP ${response.statusCode} or condition not met`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`HTTP condition failed for ${url}: ${lastError?.message || 'timeout'}`);
}

async function waitForFile(filename, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = fs.readFileSync(filename, 'utf8').trim();
      if (value) return value;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${filename}`);
}

function findChrome(override) {
  const candidates = [
    override,
    process.env.MAGICSCRIPT_CHROME_PATH,
    process.env.CHROME_PATH,
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean);
  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  if (!executable) throw new Error('No local Chrome/Chromium executable found');
  return executable;
}

async function launchBrowser(executable) {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magicscript-qa-profile-'));
  const child = spawn(executable, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--in-process-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-allow-origins=*',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDir}`,
    '--window-size=1280,844',
    'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    const activePort = await waitForFile(path.join(profileDir, 'DevToolsActivePort'));
    const debuggingPort = Number(activePort.split(/\r?\n/, 1)[0]);
    if (!Number.isInteger(debuggingPort) || debuggingPort < 1 || debuggingPort > 65535) {
      throw new Error(`Invalid DevTools port: ${activePort}`);
    }
    const version = await waitForHttp(`http://127.0.0.1:${debuggingPort}/json/version`);
    return {
      child,
      profileDir,
      debuggingPort,
      version: version.json,
      stderr: () => stderr.slice(-2000),
    };
  } catch (error) {
    if (!child.killed) child.kill();
    fs.rmSync(profileDir, { recursive: true, force: true });
    throw new Error(`${error.message}; browser stderr: ${stderr.slice(-1000)}`);
  }
}

async function waitForProcessExit(child, timeoutMs = 2000) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function removeOwnedDirectory(directory) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'ENOTEMPTY'].includes(error.code) || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

async function closeBrowser(browser) {
  if (!browser) return;
  let controller;
  try {
    controller = new CdpConnection(browser.version.webSocketDebuggerUrl);
    await controller.ready;
    await controller.send('Browser.close');
  } catch {}
  if (controller) controller.close();
  if (!browser.child.killed) browser.child.kill();
  await waitForProcessExit(browser.child);
  await removeOwnedDirectory(browser.profileDir);
}

class CdpConnection {
  constructor(url) {
    this.debug = process.env.MAGICSCRIPT_QA_DEBUG === '1';
    this.socket = new WebSocket(url, { origin: 'http://127.0.0.1' });
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('error', () => reject(new Error('CDP WebSocket connection failed')));
    });
    this.socket.on('message', (data) => this.handleMessage(data));
    this.socket.on('close', (code, reason) => {
      const detail = code ? ` (code ${code}${reason ? `: ${reason}` : ''})` : '';
      for (const { reject } of this.pending.values()) reject(new Error(`CDP connection closed${detail}`));
      this.pending.clear();
    });
  }

  on(method, handler) {
    const handlers = this.listeners.get(method) || new Set();
    handlers.add(handler);
    this.listeners.set(method, handlers);
    return () => handlers.delete(handler);
  }

  async handleMessage(raw) {
    if (typeof raw !== 'string') {
      if (typeof raw?.text === 'function') raw = await raw.text();
      else if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
      else raw = String(raw);
    }
    let message;
    try { message = JSON.parse(raw); } catch { return; }
    if (this.debug) console.error(`[qa:cdp] receive ${message.method || `response:${message.id}`}`);
    if (message.id && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${message.error.message} (${message.error.code})`));
      else pending.resolve(message.result);
      return;
    }
    const handlers = this.listeners.get(message.method) || [];
    for (const handler of handlers) handler(message);
  }

  async send(method, params = {}, sessionId) {
    await this.ready;
    const id = this.nextId++;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    if (this.debug) console.error(`[qa:cdp] send ${method}${sessionId ? ` session=${sessionId}` : ''}`);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for CDP command ${method}`));
      }, 10000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); },
      });
      this.socket.send(JSON.stringify(message));
    });
  }

  async waitFor(method, predicate = () => true, timeoutMs = 8000) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const unsubscribe = this.on(method, (event) => {
        try {
          if (!predicate(event)) return;
          clearTimeout(timer);
          unsubscribe();
          resolve(event);
        } catch (error) {
          clearTimeout(timer);
          unsubscribe();
          reject(error);
        }
      });
    });
  }

  close() {
    try { this.socket.close(); } catch {}
  }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: false,
  }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  }
  return result.result?.value;
}

async function waitForCondition(cdp, sessionId, expression, timeoutMs = 8000) {
  const startedAt = Date.now();
  let lastValue;
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await evaluate(cdp, sessionId, expression);
    if (lastValue) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for condition: ${String(expression).slice(0, 160)}`);
}

function truncate(value, max = 300) {
  return String(value || '').replace(/\s+/g, ' ').slice(0, max);
}

function expectations(surface) {
  if (surface === 'sales-room') {
    return {
      markers: ['voir le prototype', 'réserver un échange', 'envoyer un message', 'partager'],
      selector: 'form',
      noPrice: true,
    };
  }
  if (surface === 'prototype') return { markers: ['snemm', 'voir votre proposition'] };
  return { markers: ['magic script'] };
}

async function auditPage(cdp, sessionId, target, viewport, baseUrl, outputDir) {
  const routeUrl = `${baseUrl}${target.route}`;
  const beforeEvents = { consoleErrors: [], exceptions: [], logErrors: [], networkErrors: [] };
  const subscriptions = [
    cdp.on('Runtime.consoleAPICalled', (event) => {
      if (event.sessionId !== sessionId || event.params?.type !== 'error') return;
      beforeEvents.consoleErrors.push(truncate(event.params.args?.map((arg) => arg.value ?? arg.description ?? '').join(' ')));
    }),
    cdp.on('Runtime.exceptionThrown', (event) => {
      if (event.sessionId !== sessionId) return;
      beforeEvents.exceptions.push(truncate(event.params?.exceptionDetails?.text || 'uncaught exception'));
    }),
    cdp.on('Log.entryAdded', (event) => {
      if (event.sessionId !== sessionId || event.params?.entry?.level !== 'error') return;
      beforeEvents.logErrors.push(truncate(event.params.entry.text));
    }),
    cdp.on('Network.responseReceived', (event) => {
      if (event.sessionId !== sessionId || event.params?.response?.status < 400) return;
      beforeEvents.networkErrors.push(`${event.params.response.status} ${truncate(event.params.response.url, 500)}`);
    }),
    cdp.on('Network.loadingFailed', (event) => {
      if (event.sessionId !== sessionId) return;
      beforeEvents.networkErrors.push(`${event.params.errorText} ${truncate(event.params.url, 500)}`);
    }),
  ];

  let loadEvent = 'not-observed';
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    }, sessionId);
    const loadPromise = cdp.waitFor('Page.loadEventFired', (event) => event.sessionId === sessionId, 8000);
    await cdp.send('Page.navigate', { url: routeUrl }, sessionId);
    await loadPromise;
    loadEvent = 'observed';
  } catch (error) {
    loadEvent = `not-observed: ${error.message}`;
  }

  await waitForCondition(cdp, sessionId, 'document.readyState === "complete" && !!document.body && document.body.innerText.trim().length > 0');
  await waitForCondition(cdp, sessionId, `(() => {
    const visibleReveals = [...document.querySelectorAll('.reveal')].filter((node) => {
      const rect = node.getBoundingClientRect();
      return getComputedStyle(node).display !== 'none' && rect.bottom > 0 && rect.top < window.innerHeight;
    });
    return visibleReveals.every((node) => node.classList.contains('visible') && Number.parseFloat(getComputedStyle(node).opacity) >= 0.95);
  })()`, 3000);
  const expected = expectations(target.name);
  const inspection = await waitForCondition(cdp, sessionId, `(() => {
    const text = document.body?.innerText || '';
    const normalized = text.toLocaleLowerCase();
    const visible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const controls = [...document.querySelectorAll('a, button, input, textarea, form')]
      .filter((element) => !element.matches('[aria-hidden="true"]'));
    const controlGeometry = controls.map((element) => {
      const rect = element.getBoundingClientRect();
      return { tag: element.tagName, text: (element.innerText || element.getAttribute('aria-label') || element.getAttribute('placeholder') || '').trim().slice(0, 120), visible: visible(element), left: rect.left, right: rect.right, width: rect.width };
    });
    const required = ${JSON.stringify(expected.markers)};
    const markerResults = Object.fromEntries(required.map((marker) => [marker, normalized.includes(marker)]));
    const salesRoom = ${JSON.stringify(target.name === 'sales-room')};
    const pricePattern = /(?:\\b(?:590|990|1490)\\s*€?|\\b(?:prix|tarif|forfait|mensualité)\\b)/i;
    return {
      readyState: document.readyState,
      href: location.href,
      title: document.title,
      bodyTextLength: text.trim().length,
      markerResults,
      formVisible: visible(document.querySelector('form')),
      contentVisible: text.trim().length >= 40,
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - window.innerWidth,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      controls: controlGeometry,
      priceDetected: salesRoom && pricePattern.test(text),
      salesRoomAttribute: document.body?.dataset?.salesRoom || null,
    };
  })()`);

  const requiredMarkersPass = Object.values(inspection.markerResults).every(Boolean);
  const controlsNotClipped = inspection.controls.every((control) => !control.visible || (control.left >= -1 && control.right <= inspection.viewport.width + 1));
  const noRedirect = new URL(inspection.href).pathname === target.route;
  const consoleClean = beforeEvents.consoleErrors.length === 0 && beforeEvents.exceptions.length === 0 && beforeEvents.logErrors.length === 0;
  const checks = {
    http200: true,
    pageLoaded: inspection.readyState === 'complete' && inspection.contentVisible,
    viewport: inspection.viewport.width === viewport.width && inspection.viewport.height === viewport.height,
    noFatalJavaScript: beforeEvents.exceptions.length === 0,
    noCriticalConsoleError: consoleClean,
    noHorizontalOverflow: inspection.horizontalOverflow <= 1,
    mainContentVisible: inspection.contentVisible,
    requiredContentVisible: requiredMarkersPass,
    buttonsNotClipped: controlsNotClipped,
    noUnexpectedRedirect: noRedirect,
    noPriceVisible: !inspection.priceDetected,
  };

  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  const filename = `${target.name}-${viewport.name}.png`;
  const screenshotPath = path.join(outputDir, filename);
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

  for (const unsubscribe of subscriptions) unsubscribe();
  return {
    surface: target.name,
    route: target.route,
    url: routeUrl,
    viewport: { name: viewport.name, width: viewport.width, height: viewport.height },
    loadEvent,
    checks,
    inspection,
    errors: beforeEvents,
    screenshot: screenshotPath,
    pass: Object.values(checks).every(Boolean),
  };
}

async function run(args) {
  fs.mkdirSync(args.outputDir, { recursive: true });
  const preview = await startPreviewServer({ root: PREVIEW_ROOT, preferredPort: args.preferredPort });
  let browser;
  let cdp;
  let browserCdp;
  try {
    const health = await waitForHttp(preview.healthUrl);
    const rootCheck = await getJson(preview.url);
    const executable = findChrome(args.chrome);
    browser = await launchBrowser(executable);
    browserCdp = new CdpConnection(browser.version.webSocketDebuggerUrl);
    await browserCdp.ready;
    const target = await browserCdp.send('Target.createTarget', { url: 'about:blank' });
    const targetsResponse = await waitForConditionHttp(`http://127.0.0.1:${browser.debuggingPort}/json/list`, (targets) => targets.some((candidate) => candidate.id === target.targetId && candidate.webSocketDebuggerUrl));
    const page = targetsResponse.find((candidate) => candidate.id === target.targetId);
    if (!page) throw new Error('Chrome did not expose the created page target');
    browserCdp.close();
    browserCdp = undefined;
    cdp = new CdpConnection(page.webSocketDebuggerUrl);
    await cdp.ready;
    const sessionId = undefined;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');

    const results = [];
    for (const surface of routesFor(args)) {
      for (const viewport of viewportsFor(args.viewport)) {
        results.push(await auditPage(cdp, sessionId, surface, viewport, preview.url, args.outputDir));
      }
    }

    const report = {
      status: results.every((result) => result.pass) ? 'PASS' : 'FAIL',
      harness: {
        browser: path.basename(executable),
        browserVersion: browser.version.Browser || 'unknown',
        previewRoot: preview.root,
        bind: '127.0.0.1',
        previewUrl: preview.url,
        healthUrl: preview.healthUrl,
        healthStatus: health.statusCode,
        rootStatus: rootCheck.statusCode,
        noFileProtocol: true,
      },
      results,
    };
    const reportPath = path.join(args.outputDir, 'report.json');
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return { report, reportPath };
  } finally {
    if (browserCdp) browserCdp.close();
    if (cdp) {
      try { await cdp.send('Page.close'); } catch {}
      cdp.close();
    }
    await closeBrowser(browser);
    await preview.close();
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      return;
    }
    const result = await run(args);
    if (args.json) console.log(JSON.stringify(result.report));
    else {
      console.log(`QA_SURFACE_STATUS=${result.report.status}`);
      console.log(`QA_SURFACE_REPORT=${result.reportPath}`);
      for (const item of result.report.results) {
        console.log(`QA_SURFACE_RESULT=${item.surface}/${item.viewport.name}:${item.pass ? 'PASS' : 'FAIL'}`);
        console.log(`QA_SURFACE_SCREENSHOT=${item.screenshot}`);
      }
    }
    if (result.report.status !== 'PASS') process.exitCode = 1;
  } catch (error) {
    console.error(`QA_SURFACE_ERROR=${error.stack || error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  VIEWPORTS,
  CdpConnection,
  closeBrowser,
  evaluate,
  findChrome,
  launchBrowser,
  parseArgs,
  routesFor,
  run,
  viewportsFor,
  waitForCondition,
};
