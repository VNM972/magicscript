import type { BuildArtifactV1 } from '../builder/contracts';
import type { DesignArtifactV1 } from '../design/design-artifact';
import type { VisualQaReportV1 } from '../visual-qa/contracts';
import { canonicalProposalKey, createProposal, type ProposalStore, type ProposalV1 } from './contracts';

export async function packageProposal(input: {
  build: BuildArtifactV1;
  design: DesignArtifactV1;
  qa: VisualQaReportV1;
  store: ProposalStore;
  now?: string;
}): Promise<{ proposal: ProposalV1; duplicate: boolean }> {
  const key = canonicalProposalKey({ buildArtifactId: input.build.id, version: 'PROPOSAL_V1' });
  const existing = await input.store.getByCanonicalKey(key);
  if (existing) return { proposal: existing, duplicate: true };
  const proposal = createProposal(input);
  await input.store.save(proposal);
  return { proposal, duplicate: false };
}
