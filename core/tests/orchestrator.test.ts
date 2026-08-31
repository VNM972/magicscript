import test from 'node:test';
import assert from 'node:assert/strict';

import { loadConfig } from '../config';
import { InMemoryEventStore } from '../events/event-store';
import { InMemoryJobQueue } from '../jobs/in-memory-queue';
import { OrchestratorEngine } from '../orchestrator/engine';
import { InMemoryProspectRepository } from '../state/repository';

test('autopilot queues research for a discovered prospect', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p1',
    companyName: 'Prospect Test',
    state: 'DISCOVERED',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });

  let id = 0;
  const engine = new OrchestratorEngine({
    config: loadConfig({ MAGICSCRIPT_AUTOPILOT_ENABLED: 'true' }),
    prospects,
    events,
    jobs,
    idFactory: () => `id-${++id}`,
    now: () => new Date('2026-08-29T12:00:00.000Z'),
  });

  const plan = await engine.planProspect('p1');

  assert.equal(plan.nextAction, 'RUN_RESEARCH_SWARM');
  assert.equal(plan.humanRequired, false);
  assert.ok(plan.queuedJobId);

  const pending = await jobs.list('PENDING');
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.kind, 'RUN_RESEARCH_SWARM');
});

test('sending switch blocks email jobs', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p2',
    companyName: 'Prospect Test 2',
    state: 'OUTREACH_VERIFIED',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
      MAGICSCRIPT_SENDING_ENABLED: 'false',
    }),
    prospects,
    events,
    jobs,
    idFactory: () => 'fixed-id',
    now: () => new Date('2026-08-29T12:00:00.000Z'),
  });

  const plan = await engine.planProspect('p2');

  assert.equal(plan.nextAction, 'SEND_EMAIL');
  assert.equal(plan.queuedJobId, undefined);
  assert.equal(plan.reason, 'Sending disabled');
});

test('deployment switch blocks prototype deploy jobs', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p3',
    companyName: 'Prototype Prospect',
    state: 'PROTOTYPE_READY',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
      MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
    }),
    prospects,
    events,
    jobs,
    idFactory: () => 'deploy-blocked',
    now: () => new Date('2026-08-29T12:00:00.000Z'),
  });

  const plan = await engine.planProspect('p3');

  assert.equal(plan.nextAction, 'DEPLOY_PROTOTYPE');
  assert.equal(plan.queuedJobId, undefined);
  assert.equal(plan.reason, 'Prototype deployment disabled');
});

test('enabled deployment queues a prototype deploy job', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p4',
    companyName: 'Prototype Prospect Ready',
    state: 'PROTOTYPE_READY',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });

  let id = 0;
  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
      MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'true',
    }),
    prospects,
    events,
    jobs,
    idFactory: () => `deploy-${++id}`,
    now: () => new Date('2026-08-29T12:00:00.000Z'),
  });

  const plan = await engine.planProspect('p4');

  assert.equal(plan.nextAction, 'DEPLOY_PROTOTYPE');
  assert.ok(plan.queuedJobId);

  const pending = await jobs.list('PENDING');
  assert.equal(pending[0]?.kind, 'DEPLOY_PROTOTYPE');
});

test('demo link sending obeys the outbound safety switch', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p5',
    companyName: 'Demo Ready Prospect',
    state: 'DEMO_REPLY_READY',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
      MAGICSCRIPT_SENDING_ENABLED: 'false',
    }),
    prospects,
    events,
    jobs,
    idFactory: () => 'demo-blocked',
    now: () => new Date('2026-08-29T12:00:00.000Z'),
  });

  const plan = await engine.planProspect('p5');

  assert.equal(plan.nextAction, 'SEND_DEMO_LINK');
  assert.equal(plan.queuedJobId, undefined);
  assert.equal(plan.reason, 'Sending disabled');
});

test('successful human escalation is not requeued on reconcile', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p-human',
    companyName: 'Human Review Prospect',
    state: 'HUMAN_ACTION_REQUIRED',
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  });

  let id = 0;
  const engine = new OrchestratorEngine({
    config: loadConfig({ MAGICSCRIPT_AUTOPILOT_ENABLED: 'true' }),
    prospects,
    events,
    jobs,
    idFactory: () => `human-${++id}`,
    now: () => new Date('2026-08-31T12:00:00.000Z'),
  });

  const firstPlan = await engine.planProspect('p-human');
  await jobs.next(new Date('2026-08-31T12:00:00.000Z'), 'test-runner');
  await jobs.markSucceeded(firstPlan.queuedJobId!);

  const secondPlan = await engine.planProspect('p-human');
  const allEscalations = (await jobs.list()).filter(
    (job) => job.kind === 'ESCALATE_TO_HUMAN',
  );

  assert.equal(secondPlan.queuedJobId, firstPlan.queuedJobId);
  assert.equal(allEscalations.length, 1);
});


test('prototype-required prospect queues a strategy job before build', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p-prototype-strategy',
    companyName: 'Prototype Strategy Test',
    state: 'PROTOTYPE_REQUIRED',
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  });

  let id = 0;
  const engine = new OrchestratorEngine({
    config: loadConfig({ MAGICSCRIPT_AUTOPILOT_ENABLED: 'true' }),
    prospects,
    events,
    jobs,
    idFactory: () => `prototype-strategy-${++id}`,
    now: () => new Date('2026-08-31T12:00:00.000Z'),
  });

  const plan = await engine.planProspect('p-prototype-strategy');

  assert.equal(plan.nextAction, 'GENERATE_PROTOTYPE_STRATEGY');
  assert.ok(plan.queuedJobId);

  const pending = await jobs.list('PENDING');
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.kind, 'GENERATE_PROTOTYPE_STRATEGY');
});
