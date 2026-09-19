import type { Escalation, Job, LiveEvent, ProspectSummary, PrototypeSummary, BuSummaryItem, BuTerritory } from './api';

const UNKNOWN = 'UNKNOWN';

function latest<T extends { createdAt?: string; updatedAt?: string }>(items: T[]): T | undefined {
  return [...items].sort((a, b) => Date.parse(b.updatedAt ?? b.createdAt ?? '') - Date.parse(a.updatedAt ?? a.createdAt ?? ''))[0];
}

function item(territory: BuTerritory, fields: Partial<BuSummaryItem>): BuSummaryItem {
  return { territory, status: UNKNOWN, decision: UNKNOWN, provenance: UNKNOWN, timestamp: null, summary: UNKNOWN, blockers: [], identifiers: [], ...fields };
}

export function projectProspectBuSummaries(input: {
  prospect: ProspectSummary;
  jobs: Job[];
  events: LiveEvent[];
  prototypes: PrototypeSummary[];
  escalations: Escalation[];
}): BuSummaryItem[] {
  const { prospect } = input;
  const jobs = input.jobs.filter((job) => job.prospectId === prospect.id);
  const events = input.events.filter((event) => event.prospectId === prospect.id);
  const prototypes = input.prototypes.filter((prototype) => prototype.prospect_id === prospect.id);
  const escalations = input.escalations.filter((escalation) => escalation.prospect_id === prospect.id);
  const researchEvent = latest(events.filter((event) => event.type === 'research.scored'));
  const discoveryEvent = latest(events.filter((event) => event.type === 'discovery.prospect_created'));
  const orchestratorEvent = latest(events.filter((event) => event.type.startsWith('orchestrator.')));
  const strategy = latest(jobs.filter((job) => job.kind === 'GENERATE_PROTOTYPE_STRATEGY'));
  const build = latest(jobs.filter((job) => job.kind === 'BUILD_PROTOTYPE'));
  const qa = latest(jobs.filter((job) => job.kind === 'RUN_PROTOTYPE_QA'));
  const creativeJob = latest(jobs.filter((job) => job.kind === 'CREATIVE_WEB_DESIGN_SYNTHETIC'));
  const creativeTrace = creativeJob?.syntheticCreativeTrace;
  const prototype = prototypes[0];
  const escalation = escalations[0];
  const researchPayload = researchEvent?.payload ?? {};
  const integrity = researchPayload.evidenceIntegrity as Record<string, unknown> | undefined;
  const acceptedClaims = Array.isArray(integrity?.supportedClaims) ? integrity.supportedClaims.length : null;
  const reasons = Array.isArray(integrity?.reasons) ? integrity.reasons.map(String) : [];
  const resultSummary = (job: Job | undefined): string => job?.result && typeof job.result === 'object' ? String((job.result as Record<string, unknown>).summary ?? UNKNOWN) : UNKNOWN;
  return [
    item('AGENT_1', { status: discoveryEvent ? 'AVAILABLE' : UNKNOWN, decision: discoveryEvent ? 'IDENTITY_RECORDED' : UNKNOWN, provenance: discoveryEvent ? 'discovery.prospect_created' : UNKNOWN, timestamp: discoveryEvent?.createdAt ?? null, summary: discoveryEvent ? `Eligibility ${prospect.commercialEligibility ?? UNKNOWN}; intake score ${prospect.score ?? UNKNOWN}.` : UNKNOWN, identifiers: discoveryEvent ? [discoveryEvent.id] : [] }),
    item('RESEARCH', { status: researchEvent ? 'AVAILABLE' : UNKNOWN, decision: researchEvent ? `CALIBRATED_RESEARCH · ${prospect.score ?? UNKNOWN}` : UNKNOWN, provenance: researchEvent ? 'research.scored' : UNKNOWN, timestamp: researchEvent?.createdAt ?? null, summary: researchEvent ? `Evidence Integrity ${integrity?.passed === true ? 'PASSED' : 'FAILED'}; ${acceptedClaims ?? UNKNOWN} accepted claims.` : UNKNOWN, blockers: reasons, identifiers: researchEvent ? [researchEvent.id] : [] }),
    item('ORCHESTRATOR', { status: escalation ? 'HUMAN_REQUIRED' : prospect.state, decision: orchestratorEvent?.payload?.nextAction ? String(orchestratorEvent.payload.nextAction) : UNKNOWN, provenance: orchestratorEvent?.type ?? 'prospect.state', timestamp: orchestratorEvent?.createdAt ?? escalation?.created_at ?? null, summary: escalation?.summary ?? `Lifecycle ${prospect.state}; next action ${UNKNOWN}.`, blockers: escalation ? [escalation.summary] : [], identifiers: escalation ? [escalation.id] : [] }),
    item('AGENT_2', { status: strategy || build ? 'AVAILABLE' : UNKNOWN, decision: strategy ? strategy.status : UNKNOWN, provenance: strategy ? `job:${strategy.kind}` : UNKNOWN, timestamp: strategy?.updatedAt ?? build?.updatedAt ?? null, summary: strategy ? resultSummary(strategy) : UNKNOWN, blockers: build?.lastError ? [build.lastError] : [], identifiers: [strategy?.id, build?.id].filter((value): value is string => Boolean(value)) }),
    item('WEB_DESIGN', { status: creativeTrace?.creativeVerdict ?? prototype?.web_design_status ?? UNKNOWN, decision: creativeTrace?.technicalJobStatus ?? prototype?.web_design_status ?? UNKNOWN, provenance: creativeTrace ? `job:${creativeJob?.id}` : prototype?.id ? `prototype:${prototype.id}` : UNKNOWN, timestamp: creativeJob?.updatedAt ?? prototype?.updated_at ?? null, summary: creativeTrace ? `INTERNAL DESIGN VALIDATION · fixture ${creativeTrace.fixtureId} · QA_PREFLIGHT ${creativeTrace.qaPreflight.passed ? 'PASS' : 'BLOCKED'} · iteration ${creativeTrace.iterationCount}/3 · QA_FINAL ${creativeTrace.qaFinal.passed ? 'PASS' : 'BLOCKED'}.` : prototype ? `Review ${prototype.web_design_status ?? UNKNOWN}; creative evidence ${UNKNOWN}.` : UNKNOWN, blockers: creativeTrace?.blockers ?? [], identifiers: [creativeJob?.id, prototype?.id].filter((value): value is string => Boolean(value)) }),
    item('QA', { status: prototype?.qa_status ?? qa?.status ?? UNKNOWN, decision: prototype?.qa_status ?? UNKNOWN, provenance: qa ? `job:${qa.kind}` : UNKNOWN, timestamp: qa?.updatedAt ?? prototype?.updated_at ?? null, summary: prototype ? `Technical build ${prototype.qa_status ?? UNKNOWN}; findings ${UNKNOWN}.` : UNKNOWN, blockers: qa?.lastError ? [qa.lastError] : [], identifiers: [qa?.id, prototype?.id].filter((value): value is string => Boolean(value)) }),
    item('COMMERCIAL', { status: prospect.state, decision: ['DISQUALIFIED', 'SAS_PENDING'].includes(prospect.state) ? 'NOT_AUTHORIZED' : UNKNOWN, provenance: prospect.scoreSource ?? UNKNOWN, timestamp: prospect.updatedAt ?? null, summary: ['DISQUALIFIED', 'SAS_PENDING'].includes(prospect.state) ? 'Commercial action is not authorized.' : UNKNOWN, blockers: [], identifiers: [] }),
  ];
}
