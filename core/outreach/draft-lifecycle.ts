import type { CommercialQualityGateResult } from './commercial-quality-gate';

export type DraftQualityStatus = 'READY' | 'NEEDS_CORRECTION' | 'BLOCKED' | 'ABSTAIN';

export interface DraftQualityBinding {
  gateVersion: string;
  status: DraftQualityStatus;
  decision: CommercialQualityGateResult['decision'];
  score: number | null;
  blockers: string[];
  warnings: string[];
  attempt: number;
  revision: number;
  fingerprint: string;

}

export function qualityStatus(decision: CommercialQualityGateResult['decision']): DraftQualityStatus {
  if (decision === 'READY_FOR_OPERATOR') return 'READY';
  if (decision === 'REGENERATE') return 'NEEDS_CORRECTION';
  if (decision === 'BLOCKED') return 'BLOCKED';
  return 'ABSTAIN';
}

export function bindQualityToRevision(input: {
  gate: CommercialQualityGateResult;
  revision: number;
  fingerprint: string;
  attempt: number;
}): DraftQualityBinding {
  if (!Number.isInteger(input.revision) || input.revision < 1) throw new Error('quality revision must be positive');
  if (!input.fingerprint.trim()) throw new Error('quality fingerprint is required');
  if (input.gate.contentIdentity.revision !== input.revision || input.gate.contentIdentity.fingerprint !== input.fingerprint) {
    throw new Error('quality result does not belong to exact draft revision');
  }
  return {
    gateVersion: input.gate.qualityGateVersion,
    status: qualityStatus(input.gate.decision),
    decision: input.gate.decision,
    score: input.gate.decision === 'ABSTAIN' ? null : input.gate.totalScore,
    blockers: [...input.gate.blockers].slice(0, 3),
    warnings: [...input.gate.warnings].slice(0, 3),
    attempt: input.attempt,
    revision: input.revision,
    fingerprint: input.fingerprint,
  };
}

export function canApproveCurrentRevision(input: {
  status: DraftQualityStatus;
  qualityRevision: number | null;
  qualityFingerprint: string | null;
  revision: number;
  fingerprint: string;
  existingApprovalRevision?: number | null;
  existingApprovalFingerprint?: string | null;
}): boolean {
  return input.status === 'READY'
    && input.qualityRevision === input.revision
    && input.qualityFingerprint === input.fingerprint
    && (input.existingApprovalRevision == null || input.existingApprovalRevision === input.revision)
    && (input.existingApprovalFingerprint == null || input.existingApprovalFingerprint === input.fingerprint);
}

export function canSendApprovedEmail(input: {
  channel: 'EMAIL' | 'MOBILE';
  status: DraftQualityStatus;
  qualityRevision: number | null;
  qualityFingerprint: string | null;
  revision: number;
  fingerprint: string;
  approvedRevision: number | null;
  approvedFingerprint: string | null;
}): boolean {
  return input.channel === 'EMAIL'
    && canApproveCurrentRevision(input)
    && input.approvedRevision === input.revision
    && input.approvedFingerprint === input.fingerprint;
}
