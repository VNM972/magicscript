const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '../..');
const databasePath = path.join(root, 'apps/api-worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8d99d9a73b43bbdb8f14112bf19dd6ef1e9b7dc6151dc67a34b1807411d91355.sqlite');
const id = '26ea281c-6930-42d6-81da-553769dfd522';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baselinePath = path.join(__dirname, 'baseline.json');
function snapshot(db) {
  const prospect = db.prepare('SELECT * FROM prospects WHERE id=?').get(id);
  const { phone, state, updated_at, ...unchangedFields } = prospect;
  return { unchangedFields,
    otherProspectsHash: hash(db.prepare('SELECT * FROM prospects WHERE id != ? ORDER BY id').all(id)),
    otherContactsHash: hash(db.prepare('SELECT * FROM contacts WHERE prospect_id != ? ORDER BY id').all(id)),
    otherMessagesHash: hash(db.prepare('SELECT * FROM outreach_messages WHERE prospect_id != ? ORDER BY id').all(id)),
    otherEventsHash: hash(db.prepare('SELECT * FROM events WHERE prospect_id IS NULL OR prospect_id != ? ORDER BY id').all(id)),
    jobsHash: hash(db.prepare('SELECT * FROM jobs ORDER BY id').all()),
    slotsHash: hash(db.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all()),
    repliesHash: hash(db.prepare('SELECT * FROM replies ORDER BY id').all()),
  };
}
async function main() {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  let proof;
  try {
    if (process.argv[2] === 'baseline') {
      assert.equal(fs.existsSync(baselinePath), false);
      const prospect = db.prepare('SELECT * FROM prospects WHERE id=? AND siret=?').get(id, '44971406200097');
      assert.equal(prospect.state, 'DISCOVERED'); assert.equal(prospect.phone, null);
      for (const table of ['contacts', 'outreach_messages']) assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE prospect_id=?`).get(id).n, 0);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM events WHERE prospect_id=?').get(id).n, 1);
      const baseline = snapshot(db);
      baseline.discoveryEventHash = hash(db.prepare("SELECT * FROM events WHERE prospect_id=? AND type='discovery.prospect_created'").get(id));
      fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
      console.log('BASELINE_CONFIRMED'); return;
    }
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const { discoveryEventHash, ...expected } = baseline;
    assert.deepEqual(snapshot(db), expected);
    assert.equal(hash(db.prepare("SELECT * FROM events WHERE prospect_id=? AND type='discovery.prospect_created'").get(id)), discoveryEventHash);
    const prospect = db.prepare('SELECT id,company_name,siret,phone,state,entry_source,demo_url,demo_ready FROM prospects WHERE id=?').get(id);
    assert.equal(prospect.phone, '+596696227605'); assert.equal(prospect.state, 'WAITING_REPLY');
    const contact = db.prepare('SELECT id,email,source_type,is_validated FROM contacts WHERE prospect_id=?').all(id);
    assert.equal(contact.length, 1); assert.equal(contact[0].email, 'c.r.sorel@gmail.com');
    assert.equal(contact[0].source_type, 'OPERATOR_MANUAL'); assert.equal(contact[0].is_validated, 1);
    const messages = db.prepare('SELECT id,contact_id,kind,status,sent_at,body_text,provider_message_id,source_refs_json FROM outreach_messages WHERE prospect_id=?').all(id);
    assert.equal(messages.length, 1); assert.equal(messages[0].kind, 'INITIAL'); assert.equal(messages[0].status, 'SENT');
    assert.equal(messages[0].sent_at, '2026-10-05T13:45:00Z'); assert.equal(messages[0].provider_message_id, null);
    const event = db.prepare("SELECT actor,type,payload_json,created_at FROM events WHERE prospect_id=? AND type='outreach.sent_manual'").all(id);
    assert.equal(event.length, 1); assert.equal(event[0].actor, 'OPERATOR');
    proof = { prospect, contact: contact[0], message: messages[0], event: event[0],
      otherProspectsAndRelatedRowsUnchanged: true, discoveryEventUnchanged: true, jobsUnchanged: true,
      productionSlotsUnchanged: true, repliesUnchanged: true };
  } finally { db.close(); }
  const response = await fetch('http://127.0.0.1:8787/api/v2/deck', { headers: { authorization: 'Bearer dev-api-token' } });
  assert.equal(response.status, 200);
  const deck = await response.json(); const item = deck.items.find(item => item.prospectId === id);
  assert.equal(deck.items.length, 1); assert.equal(item.instagram, 'https://www.instagram.com/ananke_tattoo/');
  assert.equal(item.nextFollowUpDueAt, '2026-10-08T13:45:00.000Z');
  assert.equal(item.outreach.contactedAt, '2026-10-05T13:45:00Z');
  assert.equal(item.contactability.email, 'c.r.sorel@gmail.com'); assert.equal(item.contactability.mobile, '+596696227605');
  proof.deckItem = item;
  const inventoryResponse = await fetch('http://127.0.0.1:8787/api/prospects', { headers: { authorization: 'Bearer dev-api-token' } });
  assert.equal(inventoryResponse.status, 200);
  const inventory = await inventoryResponse.json();
  assert.equal(inventory.prospects.length, 86);
  assert.equal(inventory.prospects.some(prospect => prospect.state === 'DO_NOT_CONTACT'), false);
  assert.equal(inventory.prospects.find(prospect => prospect.id === id).entry_source, 'MANUAL');
  proof.inventoryCount = inventory.prospects.length;
  if (process.argv[2] === 'browser') await browserProof(proof);
  fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof, null, 2));
}
async function browserProof(proof) {
  const { findChrome, launchBrowser, CdpConnection, evaluate, waitForCondition, closeBrowser } = require('../../scripts/qa-surface.cjs');
  const browser = await launchBrowser(findChrome());
  let controller, cdp;
  try {
    controller = new CdpConnection(browser.version.webSocketDebuggerUrl);
    await controller.ready;
    const target = await controller.send('Target.createTarget', { url: 'about:blank' });
    const targets = await (await fetch(`http://127.0.0.1:${browser.debuggingPort}/json/list`)).json();
    const page = targets.find(candidate => candidate.id === target.targetId);
    assert.ok(page?.webSocketDebuggerUrl);
    cdp = new CdpConnection(page.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    const runtimeErrors = [];
    cdp.on('Runtime.exceptionThrown', event => runtimeErrors.push(event.params.exceptionDetails.text));
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1400, deviceScaleFactor: 1, mobile: false });
    const url = `http://localhost:3000/prospects/${id}`;
    await cdp.send('Page.navigate', { url });
    await waitForCondition(cdp, undefined, "document.querySelector('.prospect-facts') && document.body.innerText.includes('c.r.sorel@gmail.com')", 15000);
    await evaluate(cdp, undefined, 'document.fonts.ready.then(() => true)');
    const sheet = await evaluate(cdp, undefined, `(() => ({
      url: location.href,
      title: document.querySelector('h1')?.innerText,
      fields: Object.fromEntries(Array.from(document.querySelectorAll('.prospect-facts > div')).map(row => [row.querySelector('dt').innerText, row.querySelector('dd').innerText])),
      links: Array.from(document.querySelectorAll('.prospect-facts a, .prospect-actions a')).map(link => ({ text: link.innerText, href: link.href })),
      missing: document.querySelector('.missing-data')?.innerText,
    }))()`);
    assert.match(sheet.title, /Ananke Tattoo/); assert.match(sheet.title, /MANUAL/);
    assert.equal(sheet.fields.Email, 'c.r.sorel@gmail.com');
    assert.equal(sheet.fields.Mobile, '+596696227605');
    assert.equal(sheet.fields.Instagram, 'https://www.instagram.com/ananke_tattoo/');
    assert.match(sheet.fields['Contacté le'], /05\/10\/2026.*15:45/);
    assert.match(sheet.fields['Prochaine relance'], /08\/10\/2026.*15:45/);
    assert.ok(sheet.links.some(link => link.href === 'https://www.instagram.com/ananke_tattoo/'));
    assert.ok(sheet.links.some(link => link.href === 'https://ananke-demo.netlify.app/'));
    assert.equal(sheet.missing.includes('Coordonnées Instagram'), false);
    assert.equal(sheet.missing.includes('Prochaine relance due et étape J+3 / J+5'), false);
    assert.deepEqual(runtimeErrors, []);
    const metrics = await cdp.send('Page.getLayoutMetrics');
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: 1440, height: Math.ceil(metrics.cssContentSize.height), scale: 1 } });
    fs.writeFileSync(path.join(__dirname, 'fiche-ananke.png'), Buffer.from(screenshot.data, 'base64'));
    proof.browser = { browser: browser.version.Browser, ...sheet, runtimeErrors, screenshot: 'outputs/session-d-ter/fiche-ananke.png' };
  } finally {
    cdp?.close(); controller?.close(); await closeBrowser(browser);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
