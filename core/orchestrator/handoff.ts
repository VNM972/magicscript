export type HandoffConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface HandoffProvenance {
  source: string;
  reference: string;
}

export interface HandoffVerifier {
  id: string;
  requiredChecks: readonly string[];
}

export interface HandoffPacket {
  id: string;
  sourceAgent: string;
  nextOwner: string;
  objective: string;
  context: Record<string, unknown>;
  inputs: readonly string[];
  constraints: readonly string[];
  expectedOutput: readonly string[];
  verifier: HandoffVerifier;
  provenance: readonly HandoffProvenance[];
  confidence: HandoffConfidence;
  blockers: readonly string[];
  decisionScope: readonly string[];
  hubId?: string;
}

export interface HandoffValidation {
  accepted: boolean;
  reasons: readonly string[];
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasTextArray(value: unknown, requireOne = false): value is readonly string[] {
  return Array.isArray(value) && (!requireOne || value.length > 0) && value.every(hasText);
}

/**
 * Validates the minimum information needed for a deterministic agent handoff.
 * UNKNOWN confidence is valid and remains visible; it is never upgraded here.
 */
export function validateHandoff(packet: Partial<HandoffPacket>): HandoffValidation {
  const reasons: string[] = [];

  if (!hasText(packet.id)) reasons.push('handoff id is required');
  if (!hasText(packet.sourceAgent)) reasons.push('source agent is required');
  if (!hasText(packet.nextOwner)) reasons.push('next owner is required');
  if (!hasText(packet.objective)) reasons.push('objective is required');
  if (!packet.context || typeof packet.context !== 'object' || Array.isArray(packet.context)) {
    reasons.push('context object is required');
  }
  if (!hasTextArray(packet.inputs)) reasons.push('inputs must be a text array');
  if (!hasTextArray(packet.constraints)) reasons.push('constraints must be a text array');
  if (!hasTextArray(packet.expectedOutput, true)) reasons.push('expected output is required');
  if (!packet.verifier || !hasText(packet.verifier.id)) reasons.push('verifier id is required');
  if (!packet.verifier || !hasTextArray(packet.verifier.requiredChecks, true)) {
    reasons.push('verifier checks are required');
  }
  if (!Array.isArray(packet.provenance) || packet.provenance.length === 0) {
    reasons.push('provenance is required');
  } else if (!packet.provenance.every((entry) => hasText(entry?.source) && hasText(entry?.reference))) {
    reasons.push('provenance entries require source and reference');
  }
  if (!['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(packet.confidence ?? '')) {
    reasons.push('confidence must be explicit');
  }
  if (!hasTextArray(packet.blockers)) reasons.push('blockers must be a text array');
  if (!hasTextArray(packet.decisionScope, true)) reasons.push('decision scope is required');

  return { accepted: reasons.length === 0, reasons };
}

export function normalizeHandoff(packet: HandoffPacket): HandoffPacket {
  const validation = validateHandoff(packet);
  if (!validation.accepted) {
    throw new Error(`Invalid handoff: ${validation.reasons.join('; ')}`);
  }

  return {
    ...packet,
    id: packet.id.trim(),
    sourceAgent: packet.sourceAgent.trim(),
    nextOwner: packet.nextOwner.trim(),
    objective: packet.objective.trim(),
    inputs: [...new Set(packet.inputs.map((value) => value.trim()))],
    constraints: [...new Set(packet.constraints.map((value) => value.trim()))],
    expectedOutput: [...new Set(packet.expectedOutput.map((value) => value.trim()))],
    verifier: {
      id: packet.verifier.id.trim(),
      requiredChecks: [...new Set(packet.verifier.requiredChecks.map((value) => value.trim()))],
    },
    provenance: packet.provenance.map((entry) => ({
      source: entry.source.trim(),
      reference: entry.reference.trim(),
    })),
    blockers: [...new Set(packet.blockers.map((value) => value.trim()))],
    decisionScope: [...new Set(packet.decisionScope.map((value) => value.trim()))],
    ...(packet.hubId === undefined ? {} : { hubId: packet.hubId.trim() }),
  };
}
