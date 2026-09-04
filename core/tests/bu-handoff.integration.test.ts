import assert from 'node:assert/strict';
import test from 'node:test';

import { loadConfig } from '../config';
import { InMemoryEventStore } from '../events/event-store';
import { InMemoryJobQueue } from '../jobs/in-memory-queue';
import { OrchestratorEngine } from '../orchestrator/engine';
import {
  verifyBuHandoff,
  type BuHandoffRequest,
} from '../orchestrator/bu-handoff-pipeline';
import { validateHandoff } from '../orchestrator/handoff';
import { InMemoryProspectRepository } from '../state/repository';

test('runs an isolated orchestrator to BU to specialist handoff and verifier flow', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();
  const prospect = {
    id: 'synthetic-bu-e2e-001',
    companyName: 'Entreprise BTP synthétique',
    activity: 'Bâtiment et travaux publics',
    primaryAsset: 'Équipe locale et réalisations publiques',
    state: 'DISCOVERED' as const,
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };
  await prospects.saveProspect(prospect);

  let sequence = 0;
  const engine = new OrchestratorEngine({
    config: loadConfig({ MAGICSCRIPT_AUTOPILOT_ENABLED: 'true' }),
    prospects,
    events,
    jobs,
    idFactory: () => `synthetic-${++sequence}`,
    now: () => new Date('2026-09-02T12:00:00.000Z'),
  });

  const plan = await engine.planProspect(prospect.id);
  assert.equal(plan.nextAction, 'RUN_RESEARCH_SWARM');
  const queued = await jobs.list('PENDING');
  assert.equal(queued.length, 1);
  assert.equal(queued[0]?.payload.businessUnit, 'BU BTP');
  assert.equal(queued[0]?.payload.masterOfWork, 'MO BTP');
  assert.equal(queued[0]?.payload.specialistId, 'specialist-btp-research');
  const queuedHandoff = queued[0]?.payload.handoff;
  assert.equal((queuedHandoff as { nextOwner: string }).nextOwner, 'MO BTP');
  assert.equal(validateHandoff(queuedHandoff as Record<string, unknown>).accepted, true);

  const request: Omit<BuHandoffRequest, 'prospect'> = {
    id: 'synthetic-bu-e2e-001',
    objective: 'Préparer un brief de prototype fondé sur des faits vérifiables.',
    context: {
      sourceLanguage: 'fr',
      requestedBy: 'synthetic-orchestrator-fixture',
      factPolicy: 'unknown-remains-unknown',
    },
    inputs: ['research-result:synthetic-001', 'prospect:synthetic-bu-e2e-001'],
    constraints: ['no-real-contact', 'no-real-email', 'no-commercial-mutation'],
    expectedOutput: ['structured-prototype-brief'],
    provenance: [
      { source: 'synthetic-research-fixture', reference: 'fixture://research-001' },
      { source: 'synthetic-prospect-fixture', reference: 'fixture://prospect-001' },
    ],
    confidence: 'UNKNOWN',
    blockers: ['official-legal-detail-not-verified'],
    decisionScope: ['research-to-prototype-brief'],
    verifier: {
      id: 'synthetic-handoff-verifier',
      requiredChecks: ['fields-preserved', 'scope-preserved', 'no-external-action'],
    },
  };

  const result = await engine.runBuHandoff(prospect.id, request);
  assert.equal(result.status, 'VERIFIED');
  assert.deepEqual(
    result.trace.map((entry) => entry.stage),
    ['ORCHESTRATOR', 'BU', 'MASTER_OF_WORK', 'SPECIALIST', 'HANDOFF', 'VERIFIER', 'RETURN'],
  );
  assert.equal(result.hub.id, 'BTP');
  assert.equal(result.hub.businessUnit, 'BU BTP');
  assert.equal(result.hub.masterOfWork, 'MO BTP');
  assert.equal(result.specialist.id, 'specialist-btp-research');
  assert.ok(result.handoff?.nextOwner);
  assert.equal(result.handoff?.sourceAgent, result.specialist.id);
  assert.equal(result.handoff?.confidence, 'UNKNOWN');
  assert.deepEqual(result.handoff?.blockers, request.blockers);
  assert.deepEqual(result.handoff?.decisionScope, request.decisionScope);
  assert.equal(result.verification.verifiedBy, 'synthetic-handoff-verifier');
  assert.deepEqual(result.finalState.externalActions, []);
  assert.deepEqual(result.finalState.commercialMutations, []);

  const invalid = verifyBuHandoff(
    { ...request, prospect },
    { ...result.handoff, nextOwner: '' },
  );
  assert.equal(invalid.status, 'REJECTED');
  assert.ok(invalid.reasons.includes('next owner is required'));

  const recorded = await events.listByProspect(prospect.id);
  assert.equal(recorded.at(-1)?.type, 'orchestrator.bu_handoff_verified');
  assert.equal((await jobs.list()).length, 1);
});
