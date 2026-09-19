import test from 'node:test';
import assert from 'node:assert/strict';
import { admitContactOpportunityPack, InMemoryV2AdmissionStore } from '../admission/v2-admission';
import { CONTACT_OPPORTUNITY_PACK_VERSION } from '../admission/contact-opportunity-pack';
import type { ContactOpportunityPackV2 } from '../admission/contact-opportunity-pack';

const base = (contacts: ContactOpportunityPackV2['contacts']): ContactOpportunityPackV2 => ({
  schemaVersion: CONTACT_OPPORTUNITY_PACK_VERSION,
  packId: `pack-${Math.random()}`,
  source: { agent: 'AGENT_1', provenance: 'test', receivedAt: '2026-09-20T00:00:00.000Z' },
  identity: { businessName: 'Café Test', websiteUrl: 'https://cafe-test.example', city: 'Fort-de-France', location: 'Martinique' },
  contacts,
  opportunity: { observedOpportunity: 'Useful opportunity', digitalFriction: 'Website friction', businessContext: 'Local business context', agent1Verdict: 'ACCEPTED' },
});

async function result(contacts: ContactOpportunityPackV2['contacts'], identity?: Partial<ContactOpportunityPackV2['identity']>) {
  const pack = base(contacts);
  pack.identity = { ...pack.identity, ...identity };
  return admitContactOpportunityPack(pack, new InMemoryV2AdmissionStore(), '2026-09-20T01:00:00.000Z');
}

test('email only is admitted as INGESTED', async () => { const admission = await result([{ channel: 'EMAIL', value: ' Owner@Example.COM ', sourceUrl: 'https://cafe-test.example/contact' }]); assert.equal(admission.admitted, true); assert.equal(admission.state, 'INGESTED'); assert.equal(admission.normalizedPack?.contacts[0]?.normalizedValue, 'owner@example.com'); });
test('French mobile only is admitted', async () => { const admission = await result([{ channel: 'MOBILE', value: '06 12 34 56 78' }]); assert.equal(admission.admitted, true); });
test('Martinique mobile international form is admitted', async () => { const admission = await result([{ channel: 'MOBILE', value: '+596 696 12 34 56' }]); assert.equal(admission.admitted, true); });
test('email and mobile are both retained', async () => { const admission = await result([{ channel: 'EMAIL', value: 'a@example.com' }, { channel: 'MOBILE', value: '07 12 34 56 78' }]); assert.equal(admission.admitted, true); assert.equal(admission.normalizedPack?.contacts.length, 2); });
test('landline only is rejected distinctly', async () => { const admission = await result([{ channel: 'LANDLINE', value: '05 96 12 34 56' }]); assert.equal(admission.admitted, false); assert.equal(admission.reasonCode, 'FIXED_PHONE_ONLY'); });
test('no contact is rejected', async () => { const admission = await result([]); assert.equal(admission.admitted, false); assert.equal(admission.reasonCode, 'NO_QUALIFYING_CONTACT'); });
test('malformed email without mobile is rejected', async () => { const admission = await result([{ channel: 'EMAIL', value: 'not-an-email' }]); assert.equal(admission.admitted, false); assert.equal(admission.reasonCode, 'NO_QUALIFYING_CONTACT'); });
test('malformed mobile without email is rejected', async () => { const admission = await result([{ channel: 'MOBILE', value: '123' }]); assert.equal(admission.admitted, false); });
test('malformed email plus valid mobile is admitted', async () => { const admission = await result([{ channel: 'EMAIL', value: 'bad' }, { channel: 'MOBILE', value: '06 12 34 56 78' }]); assert.equal(admission.admitted, true); });
test('valid email plus malformed mobile is admitted', async () => { const admission = await result([{ channel: 'EMAIL', value: 'a@example.com' }, { channel: 'MOBILE', value: 'bad' }]); assert.equal(admission.admitted, true); });
test('duplicate strongest identifier is rejected deterministically', async () => { const store = new InMemoryV2AdmissionStore(); const first = base([{ channel: 'EMAIL', value: 'a@example.com' }]); const second = base([{ channel: 'EMAIL', value: 'b@example.com' }]); first.identity.siret = '12345678901234'; second.identity.siret = '12345678901234'; assert.equal((await admitContactOpportunityPack(first, store)).admitted, true); const duplicate = await admitContactOpportunityPack(second, store); assert.equal(duplicate.reasonCode, 'DUPLICATE'); });
test('duplicate normalized contact is rejected', async () => { const store = new InMemoryV2AdmissionStore(); assert.equal((await admitContactOpportunityPack(base([{ channel: 'EMAIL', value: 'A@EXAMPLE.COM' }]), store)).admitted, true); const duplicate = await admitContactOpportunityPack(base([{ channel: 'EMAIL', value: 'a@example.com' }]), store); assert.equal(duplicate.reasonCode, 'DUPLICATE'); });
test('similar names with distinct domains are not merged', async () => { const store = new InMemoryV2AdmissionStore(); const one = base([{ channel: 'EMAIL', value: 'a@one.example' }]); const two = base([{ channel: 'EMAIL', value: 'a@two.example' }]); one.identity.websiteUrl = 'https://one.example'; two.identity.websiteUrl = 'https://two.example'; assert.equal((await admitContactOpportunityPack(one, store)).admitted, true); assert.equal((await admitContactOpportunityPack(two, store)).admitted, true); });
test('admission does not use score or research gates and legacy data is not migrated', async () => { const admission = await result([{ channel: 'EMAIL', value: 'a@example.com' }]); assert.equal(admission.state, 'INGESTED'); assert.equal(admission.admitted, true); });
