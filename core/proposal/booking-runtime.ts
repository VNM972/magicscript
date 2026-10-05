import type { ProposalV1 } from './contracts';

export interface ProposalBookingAuthority {
  proposal: ProposalV1;
  token: string;
  proposalId: string;
  prospectId: string;
}

/** Resolves only a self-consistent, prospect-facing Proposal booking authority. */
export function resolveProposalBookingAuthority(
  proposal: ProposalV1 | null | undefined,
  token: string,
): ProposalBookingAuthority | null {
  if (!proposal || typeof token !== 'string' || !token.trim()) return null;
  if (proposal.version !== 'PROPOSAL_V1' || proposal.status !== 'PROPOSAL_READY') return null;
  if (proposal.token !== token || !proposal.id || !proposal.prospectId) return null;
  if (proposal.entryPath !== `/p/${token}`) return null;
  if (proposal.booking?.availabilityPath !== `/api/public/proposals/${token}/availability`) return null;
  if (proposal.booking?.bookingPath !== `/api/public/proposals/${token}/booking`) return null;
  return { proposal, token, proposalId: proposal.id, prospectId: proposal.prospectId };
}
