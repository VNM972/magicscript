import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('keeps the public brand, prototype and Sales Room surfaces distinct', () => {
  assert.match(app, /PUBLIC_BRAND_SITE/);
  assert.match(app, /PROSPECT_PROTOTYPE/);
  assert.match(app, /PROSPECT_SALES_ROOM/);
  assert.match(app, /routeKind === 'p'/);
  assert.match(app, /routeKind === 'demo'/);
  assert.match(app, /salesRoomUrl = \(fixture\) => `\/p\//);
  assert.match(index, /data-sales-room/);
  assert.match(index, /data-surface-unavailable/);
  assert.match(index, /Réserver un échange/);
  assert.match(index, /data-room-prototype/);
  assert.match(index, /data-sales-room-message-form/);
  assert.match(index, /Envoyer un message/);
  assert.match(app, /prototypeEntryUrl = \(fixture\) => `\/demo\//);
  assert.match(app, /\/api\/public\/sales-room-availability/);
  assert.match(app, /\/api\/public\/sales-room-booking/);
  assert.match(app, /\/api\/public\/sales-room-meeting-cancel/);
  assert.match(app, /\/api\/public\/sales-room-message/);
  assert.match(app, /\/api\/public\/sales-room-event/);
  assert.match(app, /postConfiguredSalesRoomEvent/);
});

test('uses safe readable slugs and does not expose credentials in Sales Room URLs', () => {
  assert.match(app, /slug: 'snemm'/);
  assert.doesNotMatch(app, /\/p\/\$\{encodeURIComponent\(fixtureKey\)\}/);
  assert.doesNotMatch(app, /password|mot de passe|login requis/i);
});

test('records only local engagement facts and avoids delivery or read claims', () => {
  assert.match(app, /SHARE_CLICKED/);
  assert.match(app, /SALES_ROOM_RESOLUTION_FAILED/);
  assert.match(app, /magic-script:engagement-events/);
  assert.match(app, /réception ou la lecture ne sont pas suivies/);
  assert.match(app, /textContent = item\.trim\(\)/);
  assert.doesNotMatch(app, /innerHTML\s*=/);
  assert.doesNotMatch(app, /message a été reçu|message a été lu|destinataire a lu/i);
});

test('keeps factual content bounded and exposes no hard-coded commercial price', () => {
  assert.match(app, /facts:/);
  assert.match(app, /improvements:/);
  assert.match(app, /safeItems\.length === 0/);
  assert.match(index, /aucune réponse automatique/i);
  assert.doesNotMatch(index, /790|1190|1690|2290/);
  assert.doesNotMatch(app, /790|1190|1690|2290/);
});

test('renders the server-published quote and records an explicit Bon pour accord only', () => {
  assert.match(index, /data-room-quote/);
  assert.match(index, /data-quote-total/);
  assert.match(index, /data-quote-acceptance-form/);
  assert.match(index, /name="signerName"[^>]*required/);
  assert.match(index, /name="signerEmail"[^>]*required/);
  assert.match(index, /name="signerCompanyName"[^>]*required/);
  assert.match(index, /name="consentGiven"[^>]*required/);
  assert.match(index, /Aucun paiement n’est déclenché/);
  assert.match(app, /\/api\/public\/sales-room-quote\?/);
  assert.match(app, /\/api\/public\/sales-room-quote-accept/);
  assert.match(app, /outcome\.result\.quote/);
  assert.match(app, /quoteAcceptanceIdempotencyKey/);
  assert.match(app, /consentGiven:\s*true/);
  assert.match(app, /Aucun paiement n’a été déclenché/);
  assert.doesNotMatch(app, /stripe|paypal|checkout|payment_intent/i);
});

test('keeps Sales Room actions human-reviewed and mobile-safe', () => {
  assert.match(app, /data-communication-mode/);
  assert.match(app, /Aucun rendez-vous n’est simulé/);
  assert.match(app, /messageSubmit\.disabled = true/);
  assert.match(index, /required maxlength="4000"/);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*surface-prototype-card/s);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)[\s\S]*surface-quote-summary/s);
  assert.match(app, /America\/Martinique/);
});

test('keeps the root route generic and handles disabled or unknown rooms explicitly', () => {
  assert.match(app, /'PUBLIC_BRAND_SITE'/);
  assert.match(app, /salesRoomStatus: 'DISABLED'/);
  assert.match(app, /showUnavailable\('DISABLED'\)/);
  assert.match(app, /showUnavailable\(invalidRoute \? 'INVALID_ROUTE' : 'UNKNOWN_SLUG'\)/);
  assert.match(index, /href="\/"[^>]*>Découvrir Magic Script/);
});
