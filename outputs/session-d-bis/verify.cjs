const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '../..');
const dbPath = path.join(root, 'apps/api-worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8d99d9a73b43bbdb8f14112bf19dd6ef1e9b7dc6151dc67a34b1807411d91355.sqlite');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const snapshotPath = path.join(__dirname, 'baseline.json');
function snapshot() {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const columns = db.prepare('PRAGMA table_info(prospects)').all().map(row => row.name)
      .filter(name => !['entry_source', 'demo_url', 'demo_ready'].includes(name));
    const rows = db.prepare(`SELECT ${columns.join(', ')} FROM prospects ORDER BY id`).all();
    return { columns, rows: rows.length, nonExcluded: rows.filter(row => row.state !== 'DO_NOT_CONTACT').length,
      excluded: rows.filter(row => row.state === 'DO_NOT_CONTACT').length, originalColumnsHash: hash(rows),
      excludedHash: hash(rows.filter(row => row.state === 'DO_NOT_CONTACT')),
      productionSlotsHash: hash(db.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all()),
      anankeId: rows.find(row => row.siret === '44971406200097')?.id };
  } finally { db.close(); }
}
async function main() {
  if (process.argv[2] === 'baseline') {
    assert.equal(fs.existsSync(snapshotPath), false, 'Do not replace the baseline');
    const baseline = snapshot(); assert.equal(baseline.nonExcluded, 86); assert.equal(baseline.excluded, 22);
    fs.writeFileSync(snapshotPath, JSON.stringify(baseline, null, 2) + '\n'); console.log(baseline); return;
  }
  const baseline = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  assert.deepEqual(snapshot(), baseline, 'Every original prospect field and production slot must stay unchanged');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const sqlProof = db.prepare("SELECT id, company_name, entry_source, demo_url, demo_ready FROM prospects WHERE siret = '44971406200097'").get();
  assert.equal(sqlProof.entry_source, 'MANUAL'); assert.equal(sqlProof.demo_ready, 1);
  assert.equal(sqlProof.demo_url, 'https://ananke-demo.netlify.app');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM prospects WHERE id != ? AND (entry_source != 'V2_PIPELINE' OR demo_ready != 0 OR demo_url IS NOT NULL)").get(baseline.anankeId).n, 0);
  db.close();
  const headers = { authorization: 'Bearer dev-api-token' };
  const get = async route => { const response = await fetch(`http://127.0.0.1:8787${route}`, { headers }); assert.equal(response.status, 200); return response.json(); };
  const [deck, prospects, all] = await Promise.all([get('/api/v2/deck'), get('/api/prospects'), get('/api/prospects?include=all')]);
  assert.equal(prospects.prospects.length, 86); assert.equal(all.prospects.length, 108);
  assert.equal(prospects.prospects.some(row => row.state === 'DO_NOT_CONTACT'), false);
  const inventoryAnanke = prospects.prospects.find(row => row.id === baseline.anankeId);
  assert.equal(inventoryAnanke.entry_source, 'MANUAL'); assert.equal(inventoryAnanke.demo_ready, true);
  assert.equal(inventoryAnanke.demo_url, sqlProof.demo_url);
  assert.equal(deck.items.length, 1); assert.equal(deck.items[0].prospectId, baseline.anankeId);
  assert.equal(deck.items[0].demo_ready, true); assert.equal(deck.items[0].activeSlot, false);
  const result = { sqlProof, originalProspectFieldsUnchanged: true, excludedRowsUnchanged: true,
    productionSlotsUnchanged: true, nonExcludedApiCount: prospects.prospects.length,
    includeAllApiCount: all.prospects.length, inventoryAnanke: { id: inventoryAnanke.id,
      entry_source: inventoryAnanke.entry_source, demo_url: inventoryAnanke.demo_url, demo_ready: inventoryAnanke.demo_ready },
    inventoryStageCounts: prospects.prospects.reduce((counts, row) => {
      const key = row.commercialPipeline.commercialStage; counts[key] = (counts[key] || 0) + 1; return counts;
    }, {}), deck };
  if (process.argv[2] === 'browser') await browserProof(result, baseline.anankeId);
  fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
async function browserProof(result, anankeId) {
  const qa = require('../../scripts/qa-surface.cjs');
  const origin = 'http://127.0.0.1:3000';
  const errors = []; let browser; let cdp;
  try {
    browser = await qa.launchBrowser(qa.findChrome());
    cdp = new qa.CdpConnection(browser.version.webSocketDebuggerUrl); await cdp.ready;
    const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const pages = await (await fetch(`http://127.0.0.1:${browser.debuggingPort}/json/list`)).json();
    cdp.close(); cdp = new qa.CdpConnection(pages.find(page => page.id === target.targetId).webSocketDebuggerUrl); await cdp.ready;
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    cdp.on('Runtime.exceptionThrown', event => errors.push(event.params.exceptionDetails.text));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    const evaluate = expression => qa.evaluate(cdp, undefined, expression);
    const wait = expression => qa.waitForCondition(cdp, undefined, expression, 30000);
    const navigate = async route => { await cdp.send('Page.navigate', { url: origin + route }); await wait('document.readyState === "complete"'); };
    const screenshot = async name => {
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(path.join(__dirname, name), Buffer.from(shot.data, 'base64'));
    };
    await navigate('/prospects');
    await wait('document.querySelectorAll(".prospects-rows .prospect-row").length === 86');
    assert.match(await evaluate('document.querySelector(".prospects-summary").innerText'), /86 prospects/);
    const anankeSelector = `.prospects-rows a[href="/prospects/${anankeId}"]`;
    const inventoryRow = await evaluate(`document.querySelector(${JSON.stringify(anankeSelector)}).closest('.prospect-row').innerText`);
    assert.match(inventoryRow, /Ananke Tattoo/); assert.match(inventoryRow, /MANUAL/);
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(anankeSelector)}).closest('.prospect-row').querySelector('a[target="_blank"]').href`), 'https://ananke-demo.netlify.app/');
    const rowBottom = await evaluate(`document.querySelector(${JSON.stringify(anankeSelector)}).closest('.prospect-row').getBoundingClientRect().bottom`);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: Math.max(1100, Math.ceil(rowBottom + 30)), deviceScaleFactor: 1, mobile: false });
    await screenshot('prospects-ananke.png');
    const stages = ['A_CONTACTER', 'ENVOYES', 'EN_ATTENTE', 'RDV', 'DEVIS', 'RELANCES', 'GAGNES', 'PERDUS', 'ARCHIVES'];
    assert.equal(await evaluate('document.querySelectorAll(".pipeline-filters a").length'), 9);
    for (const stage of stages) {
      await evaluate(`document.querySelector('a[href="/prospects?stage=${stage}"]').click()`);
      const expected = result.inventoryStageCounts[stage] || 0;
      await wait(`location.search === '?stage=${stage}' && document.querySelectorAll('.prospects-rows .prospect-row').length === ${expected} && document.querySelector('.pipeline-filters a[aria-current="true"]') !== null`);
    }
    await navigate('/');
    await wait('document.querySelectorAll(".prospect-row").length === 1');
    assert.match(await evaluate('document.querySelector(".prospect-row").innerText'), /Ananke Tattoo[\s\S]*MANUAL/);
    await evaluate('document.querySelector(".pipeline-section").scrollIntoView({block:"start"})');
    await screenshot('deck-ananke.png');
    await evaluate(`document.querySelector('a[href="/prospects/${anankeId}"]').click()`);
    await wait(`location.pathname === '/prospects/${anankeId}' && document.querySelector('.prospect-facts') !== null`);
    assert.match(await evaluate('document.querySelector(".prospect-sheet").innerText'), /Source[\s\S]*MANUAL/);
    assert.equal(await evaluate('document.querySelector(".prospect-actions a").href'), 'https://ananke-demo.netlify.app/');
    await screenshot('prospect-ananke.png');
    // A non-deck prospect must also have a working inventory sheet.
    await navigate('/prospects'); await wait('document.querySelectorAll(".prospects-rows .prospect-row").length === 86');
    const otherPath = await evaluate(`[...document.querySelectorAll('.prospects-rows h2 a')].find(a => !a.href.endsWith('${anankeId}')).getAttribute('href')`);
    await evaluate(`document.querySelector('a[href="${otherPath}"]').click()`);
    await wait(`location.pathname === '${otherPath}' && document.querySelector('.prospect-facts') !== null`);
    assert.deepEqual(errors, []);
    result.browser = { origin, chrome: browser.version.Browser, inventoryRows: 86, commercialFiltersVerified: stages,
      centralDeckRows: 1, manualBadge: true, demoLink: 'https://ananke-demo.netlify.app/',
      clickedProspectSheet: true, nonDeckProspectSheet: true, runtimeErrors: errors,
      screenshots: ['prospects-ananke.png', 'deck-ananke.png', 'prospect-ananke.png'] };
  } finally { cdp?.close(); await qa.closeBrowser(browser); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
