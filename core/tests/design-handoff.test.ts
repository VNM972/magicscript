import test from 'node:test';
import assert from 'node:assert/strict';
import { admitContactOpportunityPack, InMemoryV2AdmissionStore } from '../admission/v2-admission';
import { CONTACT_OPPORTUNITY_PACK_VERSION, normalizePack } from '../admission/contact-opportunity-pack';
import { createDesignHandoff, InMemoryDesignRequestStore, V2_DESIGN_JOB_KIND } from '../design/design-handoff';
import { InMemoryJobQueue } from '../jobs/in-memory-queue';
import { InMemoryProspectRepository } from '../state/repository';
import type { ContactOpportunityPackV2 } from '../admission/contact-opportunity-pack';

const pack = (name: string, context = 'Local café'): ContactOpportunityPackV2 => ({ schemaVersion: CONTACT_OPPORTUNITY_PACK_VERSION, packId: `pack-${name}`, source: { agent: 'AGENT_1', provenance: 'test', receivedAt: '2026-09-20T00:00:00.000Z' }, identity: { businessName: name, websiteUrl: `https://${name.toLowerCase()}.example`, city: 'Fort-de-France' }, contacts: [{ channel: 'EMAIL', value: `${name.toLowerCase()}@example.com` }], opportunity: { observedOpportunity: 'Clear opportunity', digitalFriction: 'Website friction', businessContext: context, agent1Verdict: 'ADMITTED' }, evidence: [{ url: `https://${name.toLowerCase()}.example`, note: 'Observed source', supports: ['website'] }] });

async function admitted(name: string) {
  const prospects = new InMemoryProspectRepository();
  const admissionStore = new InMemoryV2AdmissionStore(prospects);
  const input = pack(name);
  const admission = await admitContactOpportunityPack(input, admissionStore, '2026-09-20T01:00:00.000Z');
  assert.equal(admission.admitted, true);
  const requests = new InMemoryDesignRequestStore();
  const jobs = new InMemoryJobQueue();
  return { admissionStore, input, admission, prospects, requests, jobs };
}

test('admitted prospect creates minimal design request and explicit V2 job', async () => {
  const fixture = await admitted('CafeOne');
  const result = await createDesignHandoff(fixture.admission.canonicalProspectId!, fixture.admission.normalizedPack!, { prospects: fixture.prospects, requests: fixture.requests, jobs: fixture.jobs });
  assert.equal(result.request.prospectId, fixture.admission.canonicalProspectId);
  assert.equal(result.request.opportunity.digitalFriction, 'Website friction');
  assert.equal(result.request.designInput.businessVertical, 'RESTAURANT');
  assert.equal(result.request.identity.businessName, 'CafeOne');
  assert.equal('contacts' in result.request, false);
  assert.equal(result.job.kind, V2_DESIGN_JOB_KIND);
});

test('handoff is idempotent and distinct prospects remain distinct', async () => {
  const one = await admitted('One');
  const two = await admitted('Two');
  const first = await createDesignHandoff(one.admission.canonicalProspectId!, one.admission.normalizedPack!, { prospects: one.prospects, requests: one.requests, jobs: one.jobs });
  const repeat = await createDesignHandoff(one.admission.canonicalProspectId!, one.admission.normalizedPack!, { prospects: one.prospects, requests: one.requests, jobs: one.jobs });
  assert.equal(repeat.alreadyExisted, true);
  assert.equal((await one.jobs.list()).length, 1);
  const second = await createDesignHandoff(two.admission.canonicalProspectId!, two.admission.normalizedPack!, { prospects: two.prospects, requests: two.requests, jobs: two.jobs });
  assert.notEqual(first.request.id, second.request.id);
});

test('non-admitted or legacy prospect cannot enter handoff', async () => {
  const prospects = new InMemoryProspectRepository();
  const requests = new InMemoryDesignRequestStore();
  const jobs = new InMemoryJobQueue();
  await assert.rejects(() => createDesignHandoff('missing', normalizePack(pack('Missing')), { prospects, requests, jobs }));
  await prospects.saveProspect({ id: 'v1', companyName: 'Legacy', state: 'DISCOVERED', createdAt: '2026-09-20T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z' });
  await assert.rejects(() => createDesignHandoff('v1', normalizePack(pack('Legacy')), { prospects, requests, jobs }));
});
