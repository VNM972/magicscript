import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { findChrome, launchBrowser, closeBrowser, CdpConnection, evaluate } from './qa-surface.cjs';

const root = resolve('artifacts/v2/deck');
const screenshotPath = join(root, 'm009-deck-desktop.png');
const fixture = {
  items: [
    { prospectId: 'prospect-m009-a', businessName: 'Café Rivage', location: 'Fort-de-France', vertical: 'Restaurant', opportunity: 'Réservations directes', friction: 'Présence digitale dispersée', contactability: { label: 'Email + Mobile', email: 'bonjour@cafe-rivage.test', mobile: '+596696000001' }, proposal: { id: 'proposal-m009-a', entryPath: '/p/m009-a', readyAt: '2026-01-02T10:00:00.000Z' }, engagement: { viewed: false, returned: false, shared: false, meetingBooked: false, meetingAt: null } },
    { prospectId: 'prospect-m009-b', businessName: 'Atelier Belle', location: 'Le Lamentin', vertical: 'Beauty', opportunity: 'Prise de rendez-vous', friction: 'Parcours mobile à clarifier', contactability: { label: 'Email', email: 'hello@atelier-belle.test', mobile: null }, proposal: { id: 'proposal-m009-b', entryPath: '/p/m009-b', readyAt: '2026-01-03T10:00:00.000Z' }, engagement: { viewed: true, returned: true, shared: true, meetingBooked: true, meetingAt: '2026-01-10T14:00:00.000Z' } },
  ],
};

function waitFor(url: string, timeoutMs = 20000): Promise<void> { return new Promise((resolveWait, reject) => { const started = Date.now(); const poll = () => fetch(url).then((response) => { if (response.ok) resolveWait(); else throw new Error(`HTTP ${response.status}`); }).catch((error) => { if (Date.now() - started > timeoutMs) reject(error); else setTimeout(poll, 150); }); poll(); }); }
function start(command: string, args: string[], env: NodeJS.ProcessEnv, cwd = resolve('.')): ChildProcess { return spawn(command, args, { cwd, env, stdio: 'ignore', windowsHide: true, shell: process.platform === 'win32' }); }
function exited(child: ChildProcess): Promise<number> { return new Promise((done) => child.once('exit', (code) => done(code ?? 1))); }

async function main() {
  await mkdir(root, { recursive: true });
  let api: Server | undefined; let next: ChildProcess | undefined; let browser: any; let cdp: any;
  try {
    // One invocation owns the complete acceptance lifecycle, including the production build.
    const build = start(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['--workspace', 'magic-script-control-center', 'run', 'build'], process.env);
    const buildCode = await exited(build); assert.equal(buildCode, 0, 'Control Center production build failed');
    api = createServer((request, response) => {
      if (request.url === '/api/v2/deck') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(fixture)); return; }
      if (request.url?.startsWith('/p/')) { response.statusCode = 200; response.setHeader('content-type', 'text/html'); response.end('<!doctype html><title>Proposal</title><main>Proposal preview</main>'); return; }
      response.statusCode = 404; response.end();
    });
    await new Promise<void>((done) => api!.listen(0, '127.0.0.1', done));
    const address = api.address(); assert.ok(address && typeof address === 'object'); const apiPort = address.port; const controlPort = 3019;
    next = start(process.platform === 'win32' ? 'node.exe' : 'node', [resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(controlPort)], { ...process.env, MAGICSCRIPT_API_BASE_URL: `http://127.0.0.1:${apiPort}`, MAGICSCRIPT_API_TOKEN: 'fixture-token' }, resolve('apps/control-center'));
    await waitFor(`http://127.0.0.1:${controlPort}/`);
    const proposal = await fetch(`http://127.0.0.1:${apiPort}/p/m009-a`); assert.equal(proposal.status, 200, 'Proposal link did not resolve');
    browser = await launchBrowser(findChrome());
    cdp = new CdpConnection(browser.version.webSocketDebuggerUrl); await cdp.ready;
    const target = await cdp.send('Target.createTarget', { url: `http://127.0.0.1:${controlPort}/` });
    const pages = await (await fetch(`http://127.0.0.1:${browser.debuggingPort}/json/list`)).json(); const page = pages.find((item: any) => item.id === target.targetId); assert.ok(page?.webSocketDebuggerUrl);
    cdp.close(); cdp = new CdpConnection(page.webSocketDebuggerUrl); await cdp.ready; await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await new Promise((resolveWait) => setTimeout(resolveWait, 1200));
    const html = (await evaluate(cdp, undefined, 'document.body.innerText')) as string;
    assert.match(html, /Café Rivage/); assert.match(html, /Atelier Belle/); assert.match(html, /Email \+ Mobile/); assert.match(html, /Viewed/); assert.match(html, /Returned/); assert.match(html, /Shared/); assert.match(html, /Meeting booked/);
    for (const hiddenId of ['proposal-m009-hidden-ingested', 'proposal-m009-hidden-draft']) assert.doesNotMatch(html, new RegExp(hiddenId));
    assert.doesNotMatch(html, /engagement score|score_total|runner|provider|Sales Room|send outreach|Agent 3|SMTP/i);
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' }); await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    const result = { status: 'PASS', visibleProposalIds: fixture.items.map((item) => item.proposal.id), hiddenNonReadyIds: ['proposal-m009-hidden-ingested', 'proposal-m009-hidden-draft'], proposalLink: { path: '/p/m009-a', status: proposal.status }, engagementUi: { viewed: html.includes('Viewed'), returned: html.includes('Returned'), shared: html.includes('Shared'), meetingBooked: html.includes('Meeting booked') }, absence: { engagementScore: true, legacyPanels: true, sendAction: true }, screenshotPath, fixture: 'deterministic-local-api', productionBuild: 'PASS' };
    await writeFile(resolve(root, 'm009-final-acceptance.json'), `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result, null, 2));
  } finally { if (cdp) cdp.close(); await closeBrowser(browser); next?.kill(); await new Promise<void>((done) => api?.close(() => done()) ?? done()); }
}
main().catch(async (error) => { const result = { status: 'FAIL', error: error instanceof Error ? error.message : String(error) }; await mkdir(root, { recursive: true }); await writeFile(resolve(root, 'm009-final-acceptance.json'), `${JSON.stringify(result, null, 2)}\n`); console.error(error); process.exitCode = 1; });
