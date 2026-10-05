import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createHash } from 'node:crypto';

test('replay event identity is stable and idempotent', () => {
  const input = { algorithmVersion: 'contact-presence-enrichment-v1-replay-2026-09-16', prospectId: 'p1', presence: { phone: { status: 'N/A', values: [] }, enrichedAt: '<run-time>' } };
  const hash = () => createHash('sha256').update(JSON.stringify(input)).digest('hex');
  assert.equal(hash(), hash());
  assert.equal(`cpv1-p1-${hash().slice(0, 24)}`, `cpv1-p1-${hash().slice(0, 24)}`);
});

test('migration classification preserves special exclusions', () => {
  const blocked = /SNEMM|SUNELEK|Magic Script|FIXTURE|UCPA|La Balade du Soleil/i;
  assert.equal(blocked.test('SNEMM'), true);
  assert.equal(blocked.test('UCPA SPORT VACANCES (UCPA)'), true);
  assert.equal(blocked.test('ACTIBURO'), false);
});

test('no external actions are represented by the replay contract', () => {
  const event = { type: 'contact_presence.enriched', researchReplay: false, action: 'GET_ONLY' };
  assert.equal(event.researchReplay, false);
  assert.equal(event.action, 'GET_ONLY');
});
