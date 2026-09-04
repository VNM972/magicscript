'use strict';

const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const {
  CdpConnection,
  closeBrowser,
  evaluate,
  findChrome,
  launchBrowser,
  waitForCondition,
} = require('./qa-surface.cjs');

const ROOT = path.resolve(__dirname, '..');
const API_PORT = 8787;
const CC_PORT = 3007;
const OUTPUT = path.join(ROOT, '.magicscript', 'qa', 'wp07-browser-final');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

fs.mkdirSync(OUTPUT, { recursive: true });

function resolveToken() {
  if (process.env.MAGICSCRIPT_API_TOKEN) {
    return process.env.MAGICSCRIPT_API_TOKEN;
  }

  for (const file of [
    path.join(ROOT, 'apps', 'api-worker', 'wrangler.local.jsonc'),
    path.join(ROOT, 'apps', 'api-worker', '.dev.vars'),
    path.join(ROOT, '.dev.vars'),
    path.join(ROOT, 'apps', 'control-center', '.env.local'),
  ]) {
    if (!fs.existsSync(file)) continue;

    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(
      /["']?MAGICSCRIPT_API_TOKEN["']?\s*[:=]\s*["']([^"']+)["']/
    );

    if (match?.[1]) return match[1].trim();
  }

  throw new Error('MAGICSCRIPT_API_TOKEN could not be resolved');
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: '127.0.0.1',
      port,
    });

    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(300);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function waitHttp(url, options = {}, timeoutMs = 30000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch {}

    await sleep(200);
  }

  throw new Error(`HTTP readiness timeout: ${url}`);
}

async function waitJson(url, predicate, timeoutMs = 10000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (predicate(data)) return data;
      }
    } catch {}

    await sleep(50);
  }

  throw new Error(`JSON readiness timeout: ${url}`);
}

function killTree(child) {
  if (!child?.pid) return;

  spawnSync(
    'taskkill',
    ['/PID', String(child.pid), '/T', '/F'],
    {
      windowsHide: true,
      stdio: 'ignore',
    },
  );
}

const prospects = {
  ok: true,
  prospects: [
    {
      id: 'wp07-qa-go',
      companyName: 'WP07 Browser GO',
      activity: 'QA fixture',
      location: 'Local',
      opportunity: 'A',
      state: 'INTERESTED',
      score: 90,
      engagement: {
        score_total: 100,
        activity_score: 60,
        intent_score: 40,
        trend: 'RISING',
        top_contributors: [
          {
            signal: 'MEETING_BOOKED',
            contribution: 40,
          },
        ],
        last_meaningful_event: 'MEETING_BOOKED',
        computed_at: '2026-09-04T10:00:00.000Z',
      },
      prototypeCostGate: {
        id: 'wp07-gate-go',
        prospectId: 'wp07-qa-go',
        decision: 'GO',
        authorization: 'FULL',
        policyScore: 82,
        computeClass: 'MEDIUM',
        estimatedExternalCost: {
          kind: 'UNKNOWN',
          reason: 'No priced external provider evidence supplied',
        },
        reasonCodes: ['STRONG_COMMERCIAL_SIGNAL'],
        evaluatedAt: '2026-09-04T10:05:00.000Z',
        reevaluateAt: null,
      },
    },
    {
      id: 'wp07-qa-light',
      companyName: 'WP07 Browser LIGHT',
      activity: 'QA fixture',
      location: 'Local',
      opportunity: 'B',
      state: 'INTERESTED',
      score: 60,
      engagement: {
        score_total: 90,
        activity_score: 55,
        intent_score: 35,
        trend: 'RISING',
        top_contributors: [
          {
            signal: 'MEETING_REQUESTED',
            contribution: 35,
          },
        ],
        last_meaningful_event: 'MEETING_REQUESTED',
        computed_at: '2026-09-04T10:01:00.000Z',
      },
      prototypeCostGate: {
        id: 'wp07-gate-light',
        prospectId: 'wp07-qa-light',
        decision: 'LIGHT',
        authorization: 'LIGHT',
        policyScore: 58,
        computeClass: 'HIGH',
        estimatedExternalCost: {
          kind: 'UNKNOWN',
          reason: 'No priced external provider evidence supplied',
        },
        reasonCodes: ['MEDIUM_COMMERCIAL_SIGNAL'],
        evaluatedAt: '2026-09-04T10:06:00.000Z',
        reevaluateAt: null,
      },
    },
    {
      id: 'wp07-qa-nogo',
      companyName: 'WP07 Browser NO-GO',
      activity: 'QA fixture',
      location: 'Local',
      opportunity: 'D',
      state: 'INTERESTED',
      score: 20,
      engagement: {
        score_total: 80,
        activity_score: 50,
        intent_score: 30,
        trend: 'STABLE',
        top_contributors: [
          {
            signal: 'MESSAGE_SENT',
            contribution: 30,
          },
        ],
        last_meaningful_event: 'MESSAGE_SENT',
        computed_at: '2026-09-04T10:02:00.000Z',
      },
      prototypeCostGate: {
        id: 'wp07-gate-nogo',
        prospectId: 'wp07-qa-nogo',
        decision: 'NO-GO',
        authorization: 'NONE',
        policyScore: 30,
        computeClass: 'HIGH',
        estimatedExternalCost: {
          kind: 'UNKNOWN',
          reason: 'No priced external provider evidence supplied',
        },
        reasonCodes: ['WEAK_COMMERCIAL_SIGNAL'],
        evaluatedAt: '2026-09-04T10:07:00.000Z',
        reevaluateAt: '2026-10-04T10:07:00.000Z',
      },
    },
  ],
};

(async () => {
  const token = resolveToken();

  if (await portOpen(API_PORT)) {
    throw new Error('8787 already occupied');
  }

  if (await portOpen(CC_PORT)) {
    throw new Error('3007 already occupied');
  }

  let api;
  let control;
  let proxy;
  let browser;
  let browserController;
  let page;

  try {
    api = spawn(
      'cmd.exe',
      ['/d', '/s', '/c', 'npm run dev:api:local'],
      {
        cwd: ROOT,
        windowsHide: true,
        env: {
          ...process.env,
          MAGICSCRIPT_API_TOKEN: token,
          MAGICSCRIPT_EMAIL_PROVIDER: 'dry-run',
          MAGICSCRIPT_SENDING_ENABLED: 'false',
        },
        stdio: 'ignore',
      },
    );

    await waitHttp(
      `http://127.0.0.1:${API_PORT}/api/overview`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    proxy = http.createServer(async (req, res) => {
      try {
        const requestUrl = new URL(
          req.url || '/',
          'http://127.0.0.1',
        );

        if (requestUrl.pathname === '/api/prospects') {
          const body = JSON.stringify(prospects);

          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'content-length': Buffer.byteLength(body),
            'cache-control': 'no-store',
          });

          res.end(body);
          return;
        }

        const upstream = await fetch(
          `http://127.0.0.1:${API_PORT}${req.url || '/'}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const body = Buffer.from(
          await upstream.arrayBuffer(),
        );

        res.writeHead(upstream.status, {
          'content-type':
            upstream.headers.get('content-type') ||
            'application/json; charset=utf-8',
          'cache-control': 'no-store',
        });

        res.end(body);
      } catch (error) {
        const body = JSON.stringify({
          ok: false,
          error: error.message,
        });

        res.writeHead(502, {
          'content-type': 'application/json; charset=utf-8',
        });

        res.end(body);
      }
    });

    await new Promise((resolve, reject) => {
      proxy.once('error', reject);

      proxy.listen(
        0,
        '127.0.0.1',
        resolve,
      );
    });

    const proxyPort = proxy.address().port;

    control = spawn(
      'cmd.exe',
      [
        '/d',
        '/s',
        '/c',
        `npx next start -H 127.0.0.1 -p ${CC_PORT}`,
      ],
      {
        cwd: path.join(ROOT, 'apps', 'control-center'),
        windowsHide: true,
        env: {
          ...process.env,
          MAGICSCRIPT_API_BASE_URL:
            `http://127.0.0.1:${proxyPort}`,
          MAGICSCRIPT_API_TOKEN: token,
          NEXT_TELEMETRY_DISABLED: '1',
        },
        stdio: 'ignore',
      },
    );

    await waitHttp(
      `http://127.0.0.1:${CC_PORT}`,
    );

    browser = await launchBrowser(
      findChrome(),
    );

    browserController = new CdpConnection(
      browser.version.webSocketDebuggerUrl,
    );

    await browserController.ready;

    const created = await browserController.send(
      'Target.createTarget',
      {
        url: 'about:blank',
      },
    );

    const targets = await waitJson(
      `http://127.0.0.1:${browser.debuggingPort}/json/list`,
      (items) =>
        items.some(
          (item) =>
            item.id === created.targetId &&
            item.webSocketDebuggerUrl,
        ),
    );

    const target = targets.find(
      (item) => item.id === created.targetId,
    );

    browserController.close();
    browserController = undefined;

    page = new CdpConnection(
      target.webSocketDebuggerUrl,
    );

    await page.ready;

    await page.send('Page.enable');
    await page.send('Runtime.enable');
    await page.send('Log.enable');
    await page.send('Network.enable');

    let capture;
    const requestUrls = new Map();

    page.on('Network.requestWillBeSent', (event) => {
      requestUrls.set(
        event.params.requestId,
        event.params.request?.url || '',
      );
    });

    page.on('Runtime.exceptionThrown', (event) => {
      if (!capture) return;

      capture.runtime.push(
        String(
          event.params.exceptionDetails?.text ||
          'exception',
        ).slice(0, 1000),
      );
    });

    page.on('Runtime.consoleAPICalled', (event) => {
      if (
        !capture ||
        event.params.type !== 'error'
      ) {
        return;
      }

      capture.console.push(
        (event.params.args || [])
          .map(
            (arg) =>
              arg.value ??
              arg.description ??
              '',
          )
          .join(' ')
          .slice(0, 1500),
      );
    });

    page.on('Log.entryAdded', (event) => {
      if (
        !capture ||
        event.params.entry?.level !== 'error'
      ) {
        return;
      }

      capture.logs.push(
        String(
          event.params.entry.text || '',
        ).slice(0, 1500),
      );
    });

    page.on('Network.responseReceived', (event) => {
      const response = event.params.response;

      if (
        !capture ||
        Number(response?.status || 0) < 400
      ) {
        return;
      }

      const failure = {
        status: response.status,
        url: response.url || '',
      };

      if (
        failure.status === 404 &&
        failure.url.endsWith('/favicon.ico')
      ) {
        capture.benign.push(failure);
      } else {
        capture.network.push(failure);
      }
    });

    page.on('Network.loadingFailed', (event) => {
      if (!capture) return;

      const failure = {
        errorText:
          event.params.errorText || '',
        canceled:
          Boolean(event.params.canceled),
        url:
          requestUrls.get(event.params.requestId) || '',
      };

      if (
        failure.errorText === 'net::ERR_ABORTED' &&
        (
          failure.canceled ||
          !failure.url
        )
      ) {
        capture.benign.push(failure);
      } else {
        capture.network.push(failure);
      }
    });

    const results = [];

    for (const viewport of [
      {
        name: 'desktop',
        width: 1280,
        height: 720,
      },
      {
        name: 'mobile',
        width: 390,
        height: 844,
      },
    ]) {
      capture = {
        runtime: [],
        console: [],
        logs: [],
        network: [],
        benign: [],
      };

      await page.send(
        'Emulation.setDeviceMetricsOverride',
        {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: false,
          screenWidth: viewport.width,
          screenHeight: viewport.height,
        },
      );

      await page.send(
        'Page.navigate',
        {
          url: `http://127.0.0.1:${CC_PORT}`,
        },
      );

      await waitForCondition(
        page,
        undefined,
        `document.readyState === 'complete' &&
         document.body?.textContent.includes('WP07 Browser GO') &&
         document.body?.textContent.includes('WP07 Browser LIGHT') &&
         document.body?.textContent.includes('WP07 Browser NO-GO')`,
        12000,
      );

      const opened = await evaluate(
        page,
        undefined,
        `(() => {
          const rows = [...document.querySelectorAll('.pipelineRow')];

          for (const name of [
            'WP07 Browser GO',
            'WP07 Browser LIGHT',
            'WP07 Browser NO-GO'
          ]) {
            const row = rows.find(
              (item) => item.textContent.includes(name)
            );

            if (row) {
              row.scrollIntoView({
                block: 'center',
                inline: 'nearest',
              });
            }

            const details =
              row?.querySelector('details');

            const summary =
              details?.querySelector('summary');

            if (!details || !summary) return false;

            if (!details.open) {
              summary.click();
            }
          }

          return true;
        })()`,
      );

      if (!opened) {
        const domProof = await evaluate(
          page,
          undefined,
          `(() => [...document.querySelectorAll('.pipelineRow')].map((row) => ({
            text: row.textContent,
            hasDetails: Boolean(row.querySelector('details')),
            hasCostGateBadge: row.textContent.includes('PROTO '),
            hasMissingGateLabel: row.textContent.includes('Cost Gate non évalué')
          })))()`,
        );

        console.error(
          `WP07_DOM_PROOF_${viewport.name.toUpperCase()}=${JSON.stringify(domProof)}`
        );

        throw new Error(
          `Cost Gate details unavailable on ${viewport.name}`,
        );
      }

      await sleep(150);

      await page.send(
        'Runtime.evaluate',
        {
          expression:
            'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
          awaitPromise: true,
          returnByValue: true,
        },
      );

      const inspection = await evaluate(
        page,
        undefined,
        `(() => {
          const rows = [...document.querySelectorAll('.pipelineRow')];

          const get = (name) => {
            const row = rows.find(
              (item) => item.textContent.includes(name)
            );

            if (!row) return null;

            return {
              text: row.textContent,
              open:
                Boolean(
                  row.querySelector('details')?.open
                ),
            };
          };

          const offenders = [...document.querySelectorAll('*')]
            .map((element) => {
              const rect = element.getBoundingClientRect();

              return {
                tag: element.tagName,
                className:
                  typeof element.className === 'string'
                    ? element.className
                    : '',
                text: (element.textContent || '').trim().slice(0, 120),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              };
            })
            .filter(
              (item) =>
                item.right > window.innerWidth + 1 ||
                item.left < -1
            )
            .slice(0, 20);

          const processNav = document.querySelector('.processNav');
          const processNavStyle = processNav
            ? getComputedStyle(processNav)
            : null;

          return {
            viewportWidth: window.innerWidth,
            media650: window.matchMedia('(max-width: 650px)').matches,
            processNav: processNavStyle
              ? {
                  display: processNavStyle.display,
                  gridTemplateColumns: processNavStyle.gridTemplateColumns,
                  overflowX: processNavStyle.overflowX,
                  width: processNavStyle.width,
                  minWidth: processNavStyle.minWidth
                }
              : null,
            overflow:
              Math.max(
                document.documentElement.scrollWidth,
                document.body?.scrollWidth || 0
              ) - window.innerWidth,
            offenders,
            go: get('WP07 Browser GO'),
            light: get('WP07 Browser LIGHT'),
            nogo: get('WP07 Browser NO-GO'),
          };
        })()`,
      );

      if (inspection.overflow > 1) {
        console.log(
          `WP07_OVERFLOW_${viewport.name.toUpperCase()}=${inspection.overflow}`
        );

        console.log(
          `WP07_VIEWPORT_${viewport.name.toUpperCase()}=${inspection.viewportWidth}`
        );

        console.log(
          `WP07_MEDIA650_${viewport.name.toUpperCase()}=${inspection.media650}`
        );

        console.log(
          `WP07_PROCESS_NAV_${viewport.name.toUpperCase()}=${JSON.stringify(inspection.processNav)}`
        );

        if (viewport.name === 'mobile') {
          const gridProof = await evaluate(
            page,
            undefined,
            `(() => {
              const navs = [...document.querySelectorAll('.processNav')];

              return navs.map((nav, navIndex) => {
                const navRect = nav.getBoundingClientRect();
                const style = getComputedStyle(nav);

                return {
                  navIndex,
                  childCount: nav.children.length,
                  clientWidth: nav.clientWidth,
                  scrollWidth: nav.scrollWidth,
                  rect: {
                    left: Math.round(navRect.left),
                    right: Math.round(navRect.right),
                    width: Math.round(navRect.width)
                  },
                  gridTemplateColumns: style.gridTemplateColumns,
                  gridTemplateRows: style.gridTemplateRows,
                  gridAutoFlow: style.gridAutoFlow,
                  gridAutoColumns: style.gridAutoColumns,
                  gridAutoRows: style.gridAutoRows,
                  children: [...nav.children].map((child, index) => {
                    const rect = child.getBoundingClientRect();
                    const childStyle = getComputedStyle(child);

                    return {
                      index: index + 1,
                      left: Math.round(rect.left),
                      top: Math.round(rect.top),
                      right: Math.round(rect.right),
                      bottom: Math.round(rect.bottom),
                      width: Math.round(rect.width),
                      position: childStyle.position,
                      gridColumnStart: childStyle.gridColumnStart,
                      gridColumnEnd: childStyle.gridColumnEnd,
                      gridRowStart: childStyle.gridRowStart,
                      gridRowEnd: childStyle.gridRowEnd
                    };
                  })
                };
              });
            })()`
          );

          console.log(
            `WP07_GRID_PROOF_MOBILE=${JSON.stringify(gridProof)}`
          );
        }

        console.log(
          `WP07_OVERFLOW_OFFENDERS_${viewport.name.toUpperCase()}=${JSON.stringify(inspection.offenders)}`
        );
      }

      const favicon404 = capture.benign.some(
        (item) =>
          item.status === 404 &&
          item.url?.endsWith('/favicon.ico'),
      );

      const consoleErrors =
        capture.console.filter(
          (message) =>
            !(
              favicon404 &&
              message.startsWith(
                'Failed to load resource:'
              )
            ),
        );

      const logErrors =
        capture.logs.filter(
          (message) =>
            !(
              favicon404 &&
              message.startsWith(
                'Failed to load resource:'
              )
            ),
        );

      const checks = {
        noHorizontalOverflow:
          inspection.overflow <= 1,

        go:
          inspection.go?.open === true &&
          inspection.go.text.includes('PROTO GO') &&
          inspection.go.text.includes('Autorisation : FULL') &&
          inspection.go.text.includes('Score politique : 82/100') &&
          inspection.go.text.includes('Charge : MEDIUM') &&
          inspection.go.text.includes('Coût externe : UNKNOWN'),

        light:
          inspection.light?.open === true &&
          inspection.light.text.includes('PROTO LIGHT') &&
          inspection.light.text.includes('Autorisation : LIGHT') &&
          inspection.light.text.includes('Score politique : 58/100') &&
          inspection.light.text.includes('Charge : HIGH'),

        noGo:
          inspection.nogo?.open === true &&
          inspection.nogo.text.includes('PROTO NO-GO') &&
          inspection.nogo.text.includes('Autorisation : NONE') &&
          inspection.nogo.text.includes('Score politique : 30/100') &&
          inspection.nogo.text.includes('Charge : HIGH') &&
          inspection.nogo.text.includes('Réévaluation : 2026-10-04'),

        noRuntimeExceptions:
          capture.runtime.length === 0,

        noConsoleErrors:
          consoleErrors.length === 0 &&
          logErrors.length === 0,

        noCriticalNetworkFailures:
          capture.network.length === 0,
      };

      const screenshot = await page.send(
        'Page.captureScreenshot',
        {
          format: 'png',
          captureBeyondViewport: false,
        },
      );

      const screenshotPath = path.join(
        OUTPUT,
        `control-center-${viewport.name}.png`,
      );

      fs.writeFileSync(
        screenshotPath,
        Buffer.from(
          screenshot.data,
          'base64',
        ),
      );

      const failures =
        Object.entries(checks)
          .filter(([, pass]) => !pass)
          .map(([name]) => name);

      results.push({
        viewport,
        checks,
        failures,
        runtimeExceptions:
          capture.runtime,
        consoleErrors,
        logErrors,
        networkFailures:
          capture.network,
        benignNetworkFailures:
          capture.benign,
        screenshot:
          screenshotPath,
        pass:
          failures.length === 0,
      });
    }

    const report = {
      status:
        results.every((result) => result.pass)
          ? 'PASS'
          : 'FAIL',
      results,
    };

    fs.writeFileSync(
      path.join(OUTPUT, 'report.json'),
      JSON.stringify(report, null, 2) + '\n',
      'utf8',
    );

    console.log(
      `WP07_BROWSER_QA_STATUS=${report.status}`,
    );

    for (const result of results) {
      const name =
        result.viewport.name.toUpperCase();

      console.log(
        `WP07_${name}=${result.pass ? 'PASS' : 'FAIL'}`,
      );

      console.log(
        `WP07_APPLICATION_FAILURES_${name}=${result.failures.length}`,
      );

      console.log(
        `WP07_RUNTIME_EXCEPTIONS_${name}=${result.runtimeExceptions.length}`,
      );

      console.log(
        `WP07_CONSOLE_ERRORS_${name}=${result.consoleErrors.length + result.logErrors.length}`,
      );

      console.log(
        `WP07_NETWORK_FAILURES_${name}=${result.networkFailures.length}`,
      );

      console.log(
        `WP07_BENIGN_NETWORK_FAILURES_${name}=${result.benignNetworkFailures.length}`,
      );

      console.log(
        `WP07_SCREENSHOT_${name}=${result.screenshot}`,
      );
    }

    if (report.status !== 'PASS') {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      `WP07_BROWSER_QA_ERROR=${error.stack || error.message}`,
    );

    process.exitCode = 1;
  } finally {
    if (browserController) {
      browserController.close();
    }

    if (page) {
      try {
        await page.send('Page.close');
      } catch {}

      page.close();
    }

    await closeBrowser(browser);

    if (proxy) {
      await new Promise((resolve) =>
        proxy.close(resolve)
      ).catch(() => {});
    }

    killTree(control);
    killTree(api);

    await sleep(600);

    console.log(
      `WP07_PORT_8787_LISTENING=${await portOpen(API_PORT)}`,
    );

    console.log(
      `WP07_PORT_3007_LISTENING=${await portOpen(CC_PORT)}`,
    );
  }
})();
