import type { Prospect } from '../types/prospect';
import { resolveSwarmHub } from '../hubs/registry';
import { resolveBusinessUnitTeam, type BusinessUnitTeam } from '../hubs/team';
import {
  normalizeHandoff,
  validateHandoff,
  type HandoffConfidence,
  type HandoffPacket,
  type HandoffProvenance,
  type HandoffVerifier,
} from './handoff';

export interface BuHandoffRequest {
  id: string;
  prospect: Pick<Prospect, 'id' | 'companyName' | 'legalName' | 'activity' | 'primaryAsset'>;
  objective: string;
  context: Record<string, unknown>;
  inputs: readonly string[];
  constraints: readonly string[];
  expectedOutput: readonly string[];
  provenance: readonly HandoffProvenance[];
  confidence: HandoffConfidence;
  blockers: readonly string[];
  decisionScope: readonly string[];
  verifier: HandoffVerifier;
}

export interface BuPipelineTraceEntry {
  stage: 'ORCHESTRATOR' | 'BU' | 'MASTER_OF_WORK' | 'SPECIALIST' | 'HANDOFF' | 'VERIFIER' | 'RETURN';
  owner: string;
  status: 'OBSERVED' | 'ACCEPTED' | 'REJECTED';
  details: Record<string, unknown>;
}

export interface BuHandoffVerification {
  status: 'VERIFIED' | 'REJECTED';
  reasons: readonly string[];
  verifiedBy?: string;
  preserved?: {
    objective: boolean;
    context: boolean;
    inputs: boolean;
    constraints: boolean;
    provenance: boolean;
    confidence: boolean;
    blockers: boolean;
    nextOwner: boolean;
    decisionScope: boolean;
  };
}

export interface BuHandoffPipelineResult {
  status: 'VERIFIED' | 'REJECTED';
  requestId: string;
  hub: {
    id: string;
    businessUnit: string;
    masterOfWork: string;
  };
  specialist: BusinessUnitTeam['specialists'][number];
  handoff?: HandoffPacket;
  trace: readonly BuPipelineTraceEntry[];
  verification: BuHandoffVerification;
  finalState: {
    status: 'VERIFIED' | 'REJECTED';
    owner: string;
    handoffId?: string;
    confidence: HandoffConfidence;
    blockers: readonly string[];
    decisionScope: readonly string[];
    externalActions: readonly string[];
    commercialMutations: readonly string[];
  };
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function routeContext(
  request: BuHandoffRequest,
  hub: ReturnType<typeof resolveSwarmHub>,
  team: BusinessUnitTeam,
): Record<string, unknown> {
  if (hasOwn(request.context, 'routing')) {
    throw new Error('Context key routing is reserved by the orchestration pipeline');
  }

  return {
    ...request.context,
    routing: {
      hubId: hub.id,
      businessUnit: team.businessUnit,
      masterOfWork: team.masterOfWork,
      specialistId: team.specialists[0]?.id,
    },
  };
}

function buildSpecialistHandoff(
  request: BuHandoffRequest,
  hub: ReturnType<typeof resolveSwarmHub>,
  team: BusinessUnitTeam,
): HandoffPacket {
  const specialist = team.specialists[0];
  if (!specialist) throw new Error(`No specialist configured for hub ${hub.id}`);

  return normalizeHandoff({
    id: `${request.id}:handoff`,
    sourceAgent: specialist.id,
    nextOwner: request.verifier.id,
    objective: request.objective,
    context: routeContext(request, hub, team),
    inputs: request.inputs,
    constraints: request.constraints,
    expectedOutput: request.expectedOutput,
    verifier: request.verifier,
    provenance: request.provenance,
    confidence: request.confidence,
    blockers: request.blockers,
    decisionScope: request.decisionScope,
    hubId: hub.id,
  });
}

export function createOrchestratorJobHandoff(input: {
  id: string;
  action: string;
  prospect: Pick<Prospect, 'id' | 'companyName' | 'legalName' | 'activity' | 'primaryAsset'>;
}): HandoffPacket {
  const hub = resolveSwarmHub(input.prospect);
  const team = resolveBusinessUnitTeam(hub);
  const specialist = team.specialists[0];
  if (!specialist) throw new Error(`No specialist configured for hub ${hub.id}`);

  return normalizeHandoff({
    id: `${input.id}:handoff`,
    sourceAgent: 'orchestrator',
    nextOwner: team.masterOfWork,
    objective: `Exécuter l’action ${input.action}.`,
    context: {
      prospectId: input.prospect.id,
      action: input.action,
      businessUnit: team.businessUnit,
      masterOfWork: team.masterOfWork,
      specialistId: specialist.id,
    },
    inputs: [input.prospect.id, input.action],
    constraints: ['no-external-send', 'preserve-validated-facts'],
    expectedOutput: [`result:${input.action}`],
    verifier: {
      id: 'job-result-verifier',
      requiredChecks: ['schema-valid', 'no-external-action'],
    },
    provenance: [{ source: 'orchestrator', reference: `prospect:${input.prospect.id}` }],
    confidence: 'UNKNOWN',
    blockers: [],
    decisionScope: [`job:${input.action}`],
    hubId: hub.id,
  });
}

export function verifyBuHandoff(
  request: BuHandoffRequest,
  packet: Partial<HandoffPacket>,
): BuHandoffVerification {
  const validation = validateHandoff(packet);
  if (!validation.accepted) {
    return { status: 'REJECTED', reasons: validation.reasons };
  }

  const hub = resolveSwarmHub(request.prospect);
  const team = resolveBusinessUnitTeam(hub);
  const specialist = team.specialists[0];
  const expectedContext = routeContext(request, hub, team);
  const normalized = normalizeHandoff(packet as HandoffPacket);
  const preserved = {
    objective: normalized.objective === request.objective,
    context: sameValue(normalized.context, expectedContext),
    inputs: sameValue(normalized.inputs, request.inputs),
    constraints: sameValue(normalized.constraints, request.constraints),
    provenance: sameValue(normalized.provenance, request.provenance),
    confidence: normalized.confidence === request.confidence,
    blockers: sameValue(normalized.blockers, request.blockers),
    nextOwner: normalized.nextOwner === request.verifier.id,
    decisionScope:
      sameValue(normalized.decisionScope, request.decisionScope) &&
      normalized.decisionScope.every((item) => request.decisionScope.includes(item)),
  };

  const reasons = Object.entries(preserved)
    .filter(([, value]) => !value)
    .map(([key]) => `${key} was not preserved`);
  if (normalized.sourceAgent !== specialist?.id) reasons.push('source specialist is not the routed specialist');

  return reasons.length > 0
    ? { status: 'REJECTED', reasons, preserved }
    : { status: 'VERIFIED', reasons: [], verifiedBy: request.verifier.id, preserved };
}

export function runBuHandoffPipeline(request: BuHandoffRequest): BuHandoffPipelineResult {
  const hub = resolveSwarmHub(request.prospect);
  const team = resolveBusinessUnitTeam(hub);
  const specialist = team.specialists[0];
  if (!specialist) throw new Error(`No specialist configured for hub ${hub.id}`);

  const trace: BuPipelineTraceEntry[] = [
    {
      stage: 'ORCHESTRATOR',
      owner: 'orchestrator',
      status: 'OBSERVED',
      details: { requestId: request.id, objective: request.objective },
    },
    {
      stage: 'BU',
      owner: team.businessUnit,
      status: 'OBSERVED',
      details: { hubId: hub.id, businessUnit: team.businessUnit },
    },
    {
      stage: 'MASTER_OF_WORK',
      owner: team.masterOfWork,
      status: 'OBSERVED',
      details: { assignedSpecialist: specialist.id, scope: specialist.scope },
    },
    {
      stage: 'SPECIALIST',
      owner: specialist.id,
      status: 'OBSERVED',
      details: { scope: specialist.scope, nextOwner: request.verifier.id },
    },
  ];

  const handoff = buildSpecialistHandoff(request, hub, team);
  trace.push({
    stage: 'HANDOFF',
    owner: handoff.nextOwner,
    status: 'ACCEPTED',
    details: { handoffId: handoff.id, sourceAgent: handoff.sourceAgent },
  });

  const verification = verifyBuHandoff(request, handoff);
  trace.push({
    stage: 'VERIFIER',
    owner: request.verifier.id,
    status: verification.status === 'VERIFIED' ? 'ACCEPTED' : 'REJECTED',
    details: { reasons: verification.reasons },
  });

  const finalState: BuHandoffPipelineResult['finalState'] = {
    status: verification.status,
    owner: verification.status === 'VERIFIED' ? request.verifier.id : 'orchestrator',
    ...(verification.status === 'VERIFIED' ? { handoffId: handoff.id } : {}),
    confidence: handoff.confidence,
    blockers: handoff.blockers,
    decisionScope: handoff.decisionScope,
    externalActions: [],
    commercialMutations: [],
  };
  trace.push({
    stage: 'RETURN',
    owner: finalState.owner,
    status: verification.status === 'VERIFIED' ? 'ACCEPTED' : 'REJECTED',
    details: {
      status: finalState.status,
      confidence: finalState.confidence,
      blockers: finalState.blockers,
    },
  });

  return {
    status: verification.status,
    requestId: request.id,
    hub: { id: hub.id, businessUnit: team.businessUnit, masterOfWork: team.masterOfWork },
    specialist,
    handoff: verification.status === 'VERIFIED' ? handoff : undefined,
    trace,
    verification,
    finalState,
  };
}
