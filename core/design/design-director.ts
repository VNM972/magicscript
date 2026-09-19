import type { JobQueue, MagicScriptJob } from '../jobs/types';
import { executeVerticalDesigner, type DesignArtifactStore, type DesignArtifactV1 } from './design-artifact';
import type { DesignRequestV1 } from './design-request';
import { buildDeterministicReview, createCorrectionRequest, directorPrompt, validateDesignReview, MAX_DESIGN_REVISIONS, type DesignCorrectionRequestV1, type DesignReviewStore, type DesignReviewV1 } from './design-review';

export interface DesignDirectorDeps { reviews: DesignReviewStore; corrections: { get(id: string): Promise<DesignCorrectionRequestV1 | null>; save(value: DesignCorrectionRequestV1): Promise<void> }; artifacts: DesignArtifactStore; jobs?: JobQueue; now?: () => Date; generateReview?: (prompt: string) => Promise<unknown>; model?: { provider: string; model: string } }
export interface DesignReviewResult { review: DesignReviewV1; correction?: DesignCorrectionRequestV1; terminalStatus: 'APPROVED' | 'CORRECTION_REQUIRED' | 'REVIEW_LIMIT_REACHED' }

export async function executeDesignDirector(input: { request: DesignRequestV1; artifact: DesignArtifactV1; deps: DesignDirectorDeps }): Promise<DesignReviewResult> {
  const { request, artifact, deps } = input;
  const existing = await deps.reviews.get(request.id, artifact.revision);
  if (existing) return { review: existing, terminalStatus: existing.decision === 'APPROVE' ? 'APPROVED' : artifact.revision >= MAX_DESIGN_REVISIONS ? 'REVIEW_LIMIT_REACHED' : 'CORRECTION_REQUIRED' };
  const now = (deps.now ?? (() => new Date()))().toISOString();
  const candidate = deps.generateReview ? await deps.generateReview(directorPrompt(request, artifact)) : null;
  const review = candidate ? validateDesignReview(candidate, request, artifact) : buildDeterministicReview(request, artifact, now, deps.model);
  await deps.reviews.save(review);
  if (review.decision === 'APPROVE') {
    await deps.artifacts.save({ ...artifact, status: 'APPROVED' });
    return { review, terminalStatus: 'APPROVED' };
  }
  if (artifact.revision >= MAX_DESIGN_REVISIONS) {
    await deps.artifacts.save({ ...artifact, status: 'REVIEW_LIMIT_REACHED' });
    return { review, terminalStatus: 'REVIEW_LIMIT_REACHED' };
  }
  await deps.artifacts.save({ ...artifact, status: 'CORRECTION_REQUIRED' });
  const correction = createCorrectionRequest(review, artifact.revision);
  const prior = await deps.corrections.get(correction.id);
  const canonical = prior ?? correction;
  if (!prior) await deps.corrections.save(correction);
  if (deps.jobs) await deps.jobs.enqueue({ id: `job-${request.prospectId}-design-revision-r${artifact.revision + 1}`, kind: 'V2_DESIGN_REVISION', prospectId: request.prospectId, payload: { designRequestId: request.id, correctionRequestId: canonical.id, previousArtifactId: artifact.id, revision: artifact.revision + 1 }, maxAttempts: 3, runAfter: now });
  return { review, correction: canonical, terminalStatus: 'CORRECTION_REQUIRED' };
}

export async function executeDesignRevision(input: { request: DesignRequestV1; previousArtifact: DesignArtifactV1; correction: DesignCorrectionRequestV1; deps: Pick<DesignDirectorDeps, 'artifacts' | 'now' | 'model'>; generate?: (prompt: string) => Promise<unknown> }): Promise<DesignArtifactV1> {
  return executeVerticalDesigner({ request: input.request, previousArtifact: input.previousArtifact, correction: input.correction, revision: input.correction.targetArtifactRevision + 1, artifacts: input.deps.artifacts, now: input.deps.now, model: input.deps.model, generate: input.generate });
}

export function reviewJobFor(artifact: DesignArtifactV1, now = new Date().toISOString()): Omit<MagicScriptJob, 'status' | 'attempts' | 'createdAt' | 'updatedAt' | 'claimedBy' | 'claimedAt'> { return { id: `job-${artifact.prospectId}-design-review-r${artifact.revision}`, kind: 'V2_DESIGN_REVIEW', prospectId: artifact.prospectId, payload: { designRequestId: artifact.designRequestId, artifactId: artifact.id, artifactRevision: artifact.revision }, maxAttempts: 3, runAfter: now }; }
