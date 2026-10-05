import test from 'node:test';
import assert from 'node:assert/strict';

import { loadConfig } from '../config';
import { InMemoryEventStore } from '../events/event-store';
import { InMemoryJobQueue } from '../jobs/in-memory-queue';
import { OrchestratorEngine } from '../orchestrator/engine';
import { InMemoryProspectRepository } from '../state/repository';
import { getNextAction } from '../orchestrator/next-action';

test('keeps SAS_PENDING prospects outside autopilot and commercial qualification', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'sas-pending-1',
    companyName: 'Prospect SAS rÃ©el',
    state: 'SAS_PENDING',
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({ MAGICSCRIPT_AUTOPILOT_ENABLED: 'true' }),
    prospects,
    events,
    jobs,
    idFactory: () => 'sas-pending-job',
    now: () => new Date('2026-09-03T12:00:00.000Z'),
  });

  assert.equal(getNextAction('SAS_PENDING'), 'STOP');
  const plan = await engine.planProspect('sas-pending-1');
  assert.equal(plan.nextAction, 'STOP');
  assert.equal(plan.queuedJobId, undefined);
  assert.equal((await jobs.list('PENDING')).length, 0);
});

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
  assert.equal(plan.humanRequired, true);
  assert.equal(plan.reason, 'Sending disabled');
});

test('commercial sending requires explicit operator provenance even when enabled', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'operator-send-required',
    companyName: 'Operator Send Test',
    state: 'OUTREACH_VERIFIED',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
      MAGICSCRIPT_SENDING_ENABLED: 'true',
      MAGICSCRIPT_EMAIL_PROVIDER: 'dry-run',
    }),
    prospects,
    events,
    jobs,
    idFactory: () => 'operator-send-guard',
    now: () => new Date('2026-08-29T12:00:00.000Z'),
  });

  const automaticPlan = await engine.planProspect('operator-send-required');
  assert.equal(automaticPlan.queuedJobId, undefined);
  assert.equal(automaticPlan.humanRequired, true);
  assert.equal(automaticPlan.reason, 'Commercial sending requires explicit operator action');

  const operatorPlan = await engine.planProspect('operator-send-required', 'operator-send');
  assert.equal(operatorPlan.queuedJobId, 'operator-send-guard');
  assert.equal(operatorPlan.humanRequired, false);
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
    prototypeCostGate: async () => 'FULL',
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


test('prototype work fails closed when Cost Gate evaluation is missing', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p-prototype-missing-gate',
    companyName: 'Prototype Missing Gate',
    state: 'PROTOTYPE_REQUIRED',
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
    }),
    prospects,
    events,
    jobs,
    idFactory: () => 'must-not-be-used',
    now: () => new Date('2026-09-04T12:00:00.000Z'),
  });

  const plan =
    await engine.planProspect('p-prototype-missing-gate');

  assert.equal(
    plan.nextAction,
    'GENERATE_PROTOTYPE_STRATEGY',
  );
  assert.equal(plan.queuedJobId, undefined);
  assert.equal(
    plan.reason,
    'Prototype Cost Gate evaluation required',
  );
  assert.equal((await jobs.list('PENDING')).length, 0);
});

test('prototype work fails closed when Cost Gate authorization is NONE', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p-prototype-none',
    companyName: 'Prototype NONE',
    state: 'PROTOTYPE_REQUIRED',
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
    }),
    prospects,
    events,
    jobs,
    prototypeCostGate: async () => 'NONE',
    idFactory: () => 'must-not-be-used',
    now: () => new Date('2026-09-04T12:00:00.000Z'),
  });

  const plan =
    await engine.planProspect('p-prototype-none');

  assert.equal(plan.queuedJobId, undefined);
  assert.equal(
    plan.reason,
    'Prototype Cost Gate blocked prototype work',
  );
  assert.equal((await jobs.list('PENDING')).length, 0);
});

test('LIGHT authorization allows strategy and is preserved in job payload', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p-prototype-light-strategy',
    companyName: 'Prototype LIGHT Strategy',
    state: 'PROTOTYPE_REQUIRED',
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
    }),
    prospects,
    events,
    jobs,
    prototypeCostGate: async () => 'LIGHT',
    idFactory: () => 'prototype-light-strategy-job',
    now: () => new Date('2026-09-04T12:00:00.000Z'),
  });

  const plan =
    await engine.planProspect('p-prototype-light-strategy');

  assert.ok(plan.queuedJobId);

  const pending = await jobs.list('PENDING');

  assert.equal(pending.length, 1);
  assert.equal(
    pending[0]?.kind,
    'GENERATE_PROTOTYPE_STRATEGY',
  );
  assert.equal(
    pending[0]?.payload.prototypeAuthorization,
    'LIGHT',
  );
});

test('LIGHT authorization allows prototype build and is preserved in job payload', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p-prototype-light-build',
    companyName: 'Prototype LIGHT Build',
    state: 'PROTOTYPE_STRATEGY_GENERATED',
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
    }),
    prospects,
    events,
    jobs,
    prototypeCostGate: async () => 'LIGHT',
    idFactory: () => 'prototype-light-build-job',
    now: () => new Date('2026-09-04T12:00:00.000Z'),
  });

  const plan =
    await engine.planProspect('p-prototype-light-build');

  assert.equal(plan.nextAction, 'BUILD_PROTOTYPE');
  assert.ok(plan.queuedJobId);

  const pending = await jobs.list('PENDING');

  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.kind, 'BUILD_PROTOTYPE');
  assert.equal(
    pending[0]?.payload.prototypeAuthorization,
    'LIGHT',
  );
});

test('FULL authorization allows prototype build and is preserved in payload', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'p-prototype-full-build',
    companyName: 'Prototype FULL Build',
    state: 'PROTOTYPE_STRATEGY_GENERATED',
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-04T10:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'true',
    }),
    prospects,
    events,
    jobs,
    prototypeCostGate: async () => 'FULL',
    idFactory: () => 'prototype-full-build-job',
    now: () => new Date('2026-09-04T12:00:00.000Z'),
  });

  const plan =
    await engine.planProspect('p-prototype-full-build');

  assert.ok(plan.queuedJobId);

  const pending = await jobs.list('PENDING');

  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.kind, 'BUILD_PROTOTYPE');
  assert.equal(
    pending[0]?.payload.prototypeAuthorization,
    'FULL',
  );
});


test('internal processing queues research without global autopilot', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'h2-discovered',
    companyName: 'H2 Retail Prospect',
    state: 'DISCOVERED',
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
      MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'true',
      MAGICSCRIPT_SENDING_ENABLED: 'false',
      MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
    }),
    prospects,
    events,
    jobs,
    idFactory: () => 'h2-research-job',
    now: () => new Date('2026-09-10T12:05:00.000Z'),
  });

  const plan = await engine.planProspect('h2-discovered');

  assert.equal(plan.nextAction, 'RUN_RESEARCH_SWARM');
  assert.ok(plan.queuedJobId);

  const pending = await jobs.list('PENDING');
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.kind, 'RUN_RESEARCH_SWARM');
});

test('internal processing queues contact discovery after qualification without global autopilot', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'h2-qualified',
    companyName: 'H2 Qualified Prospect',
    state: 'QUALIFIED',
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
      MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'true',
      MAGICSCRIPT_SENDING_ENABLED: 'false',
      MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
    }),
    prospects,
    events,
    jobs,
    idFactory: () => 'h2-contact-job',
    now: () => new Date('2026-09-10T12:05:00.000Z'),
  });

  const plan = await engine.planProspect('h2-qualified');

  assert.equal(plan.nextAction, 'DISCOVER_CONTACT');
  assert.ok(plan.queuedJobId);

  const pending = await jobs.list('PENDING');
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.kind, 'DISCOVER_CONTACT');
});

test('internal processing does not unlock outreach automation', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'h2-outreach',
    companyName: 'H2 Outreach Prospect',
    state: 'OUTREACH_READY',
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
      MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'true',
      MAGICSCRIPT_SENDING_ENABLED: 'false',
      MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
    }),
    prospects,
    events,
    jobs,
    idFactory: () => 'must-not-be-used-h2-outreach',
    now: () => new Date('2026-09-10T12:05:00.000Z'),
  });

  const plan = await engine.planProspect('h2-outreach');

  assert.equal(plan.nextAction, 'GENERATE_OUTREACH');
  assert.equal(plan.queuedJobId, undefined);
  assert.equal((await jobs.list('PENDING')).length, 0);
});

test('internal processing does not unlock prototype automation', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();

  await prospects.saveProspect({
    id: 'h2-prototype',
    companyName: 'H2 Prototype Prospect',
    state: 'PROTOTYPE_REQUIRED',
    createdAt: '2026-09-10T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({
      MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
      MAGICSCRIPT_INTERNAL_PROCESSING_ENABLED: 'true',
      MAGICSCRIPT_SENDING_ENABLED: 'false',
      MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED: 'false',
    }),
    prospects,
    events,
    jobs,
    idFactory: () => 'must-not-be-used-h2-prototype',
    now: () => new Date('2026-09-10T12:05:00.000Z'),
  });

  const plan = await engine.planProspect('h2-prototype');

  assert.equal(plan.nextAction, 'GENERATE_PROTOTYPE_STRATEGY');
  assert.equal(plan.queuedJobId, undefined);
  assert.equal((await jobs.list('PENDING')).length, 0);
});

test('planProspect passes provenance to enqueued job payload when supplied', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();
  let id = 100;

  await prospects.saveProspect({
    id: 'provenance-1',
    companyName: 'Provenance Test',
    state: 'DISCOVERED',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({ MAGICSCRIPT_AUTOPILOT_ENABLED: 'true' }),
    prospects, events, jobs,
    idFactory: () => `prov-id-${++id}`,
    now: () => new Date('2026-08-29T12:00:00.000Z'),
  });

  const plan = await engine.planProspect('provenance-1', 'PILOT-01');
  assert.equal(plan.nextAction, 'RUN_RESEARCH_SWARM');
  const pending = await jobs.list('PENDING');
  const job = pending.find((j) => j.prospectId === 'provenance-1');
  assert.ok(job, 'expected a job for the prospect');
  assert.ok(job.payload, 'expected job payload');
  assert.equal((job.payload as Record<string, unknown>).provenance, 'PILOT-01');
});

test('planProspect omits provenance from payload when not supplied', async () => {
  const prospects = new InMemoryProspectRepository();
  const events = new InMemoryEventStore();
  const jobs = new InMemoryJobQueue();
  let id = 200;

  await prospects.saveProspect({
    id: 'provenance-2',
    companyName: 'No Provenance',
    state: 'DISCOVERED',
    createdAt: '2026-08-29T00:00:00.000Z',
    updatedAt: '2026-08-29T00:00:00.000Z',
  });

  const engine = new OrchestratorEngine({
    config: loadConfig({ MAGICSCRIPT_AUTOPILOT_ENABLED: 'true' }),
    prospects, events, jobs,
    idFactory: () => `prov-id-${++id}`,
    now: () => new Date('2026-08-29T12:00:00.000Z'),
  });

  const plan = await engine.planProspect('provenance-2');
  assert.equal(plan.nextAction, 'RUN_RESEARCH_SWARM');
  const pending = await jobs.list('PENDING');
  const job = pending.find((j) => j.prospectId === 'provenance-2');
  assert.ok(job, 'expected a job for the prospect');
  const payload = job.payload as Record<string, unknown>;
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'provenance'), false,
    'payload must not contain provenance when not supplied');
});

test('internal processing remains fail-closed by default', () => {
  const config = loadConfig({
    MAGICSCRIPT_AUTOPILOT_ENABLED: 'false',
  });

  assert.equal(config.autopilotEnabled, false);
  assert.equal(config.internalProcessingEnabled, false);
  assert.equal(config.sendingEnabled, false);
  assert.equal(config.prototypeDeployEnabled, false);
});
