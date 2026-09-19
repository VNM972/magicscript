import type { BuildArtifactV1 } from '../builder/contracts';
import type { DesignArtifactV1 } from '../design/design-artifact';
import type { VisualQaReportV1 } from '../visual-qa/contracts';

export const PROPOSAL_VERSION = 'PROPOSAL_V1' as const;
export type ProposalStatus = 'PROPOSAL_READY';
export type ProposalEventType = 'PROPOSAL_VIEWED' | 'RETURN_VISIT' | 'SHARE_CLICKED';

export interface ProposalV1 {
  id: string;
  version: typeof PROPOSAL_VERSION;
  prospectId: string;
  designRequestId: string;
  approvedDesignArtifactId: string;
  approvedDesignRevision: number;
  buildArtifactId: string;
  buildRevision: number;
  visualQaReportId: string;
  token: string;
  entryPath: string;
  status: ProposalStatus;
  createdAt: string;
  booking: { availabilityPath: string; bookingPath: string };
  tracking: { sessionCookie: string; events: readonly ProposalEventType[] };
}

export interface ProposalPackageInput {
  build: BuildArtifactV1;
  design: DesignArtifactV1;
  qa: VisualQaReportV1;
  now?: string;
}

export interface ProposalStore {
  get(id: string): Promise<ProposalV1 | null>;
  getByToken(token: string): Promise<ProposalV1 | null>;
  getByCanonicalKey(key: string): Promise<ProposalV1 | null>;
  save(proposal: ProposalV1): Promise<void>;
  list?(): Promise<ProposalV1[]>;
}

export class InMemoryProposalStore implements ProposalStore {
  private readonly values = new Map<string, ProposalV1>();
  async get(id: string) { return this.values.get(id) ?? null; }
  async getByToken(token: string) { return [...this.values.values()].find((x) => x.token === token) ?? null; }
  async getByCanonicalKey(key: string) { return [...this.values.values()].find((x) => canonicalProposalKey(x) === key) ?? null; }
  async save(value: ProposalV1) { this.values.set(value.id, value); }
  async list() { return [...this.values.values()]; }
}

export function canonicalProposalKey(input: Pick<ProposalV1, 'buildArtifactId' | 'version'>): string {
  return `${input.buildArtifactId}:${input.version}`;
}

function stableToken(value: string): string {
  let hash = 2166136261;
  for (const character of value) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  let second = 0x9e3779b9;
  for (const character of value.split('').reverse()) { second ^= character.charCodeAt(0); second = Math.imul(second, 2654435761); }
  return `${(hash >>> 0).toString(36).padStart(7, '0')}${(second >>> 0).toString(36).padStart(7, '0')}`;
}

export function proposalToken(buildId: string, prospectId: string): string {
  return stableToken(`${PROPOSAL_VERSION}:${buildId}:${prospectId}`);
}

export function proposalId(buildId: string): string { return `proposal-${buildId}-${PROPOSAL_VERSION}`; }

export function validateProposalInputs(input: ProposalPackageInput): void {
  const { build, design, qa } = input;
  if (build.version !== 'BUILD_ARTIFACT_V1' || build.status !== 'SUCCEEDED') throw new Error('Proposal requires a successful BUILD_ARTIFACT_V1');
  if (design.version !== 'DESIGN_ARTIFACT_V1' || design.status !== 'APPROVED') throw new Error('Proposal requires an approved DESIGN_ARTIFACT_V1');
  if (qa.version !== 'VISUAL_QA_REPORT_V1' || qa.decision !== 'PASS') throw new Error('Proposal requires VISUAL_QA PASS');
  if (build.approvedDesignArtifactId !== design.id || build.designRequestId !== design.designRequestId || build.prospectId !== design.prospectId) throw new Error('Build/design provenance does not match');
  if (qa.buildArtifactId !== build.id || qa.designArtifactId !== design.id || qa.designRequestId !== design.designRequestId || qa.prospectId !== build.prospectId) throw new Error('Visual QA provenance does not match');
  if (qa.designArtifactRevision !== design.revision || qa.buildRevision !== build.approvedRevision) throw new Error('Visual QA revision does not match approved build');
  if (!build.outputPath || !build.metadata.entryFile) throw new Error('Approved build serving reference is missing');
}

export function createProposal(input: ProposalPackageInput): ProposalV1 {
  validateProposalInputs(input);
  const { build, design, qa } = input;
  const createdAt = input.now ?? new Date().toISOString();
  const token = proposalToken(build.id, build.prospectId);
  return {
    id: proposalId(build.id), version: PROPOSAL_VERSION, prospectId: build.prospectId,
    designRequestId: design.designRequestId, approvedDesignArtifactId: design.id,
    approvedDesignRevision: design.revision, buildArtifactId: build.id,
    buildRevision: build.approvedRevision, visualQaReportId: qa.id, token,
    entryPath: `/p/${token}`, status: 'PROPOSAL_READY', createdAt,
    booking: { availabilityPath: `/api/public/proposals/${token}/availability`, bookingPath: `/api/public/proposals/${token}/booking` },
    tracking: { sessionCookie: `ms_proposal_${token}`, events: ['PROPOSAL_VIEWED', 'RETURN_VISIT', 'SHARE_CLICKED'] },
  };
}
