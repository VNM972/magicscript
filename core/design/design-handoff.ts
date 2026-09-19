import type { JobQueue, MagicScriptJob } from '../jobs/types';
import type { ProspectRepository } from '../state/repository';
import { createDesignRequest, DESIGN_REQUEST_VERSION, V2_DESIGN_JOB_KIND, InMemoryDesignRequestStore, type DesignRequestStore, type DesignRequestV1 } from './design-request';
export { InMemoryDesignRequestStore, V2_DESIGN_JOB_KIND };
import { V2_ADMISSION_STATE, type NormalizedContactOpportunityPack } from '../admission/contact-opportunity-pack';

export interface DesignHandoffResult { request: DesignRequestV1; job: MagicScriptJob; alreadyExisted: boolean }

export async function createDesignHandoff(
  prospectId: string,
  pack: NormalizedContactOpportunityPack,
  deps: { prospects: ProspectRepository; requests: DesignRequestStore; jobs: JobQueue; now?: () => Date },
): Promise<DesignHandoffResult> {
  const prospect = await deps.prospects.getProspect(prospectId);
  if (!prospect || prospect.state !== V2_ADMISSION_STATE) throw new Error('Only admitted INGESTED V2 prospects may enter design handoff');
  const now = (deps.now ?? (() => new Date()))();
  const request = (await deps.requests.get(prospectId, DESIGN_REQUEST_VERSION)) ?? createDesignRequest(prospectId, pack, now.toISOString());
  await deps.requests.save(request);
  const existing = (await deps.jobs.list()).find((job) => job.kind === V2_DESIGN_JOB_KIND && job.prospectId === prospectId && job.payload.designRequestId === request.id);
  if (existing) return { request, job: existing, alreadyExisted: true };
  const job = await deps.jobs.enqueue({ id: `job-${prospectId}-${DESIGN_REQUEST_VERSION}`, kind: V2_DESIGN_JOB_KIND, prospectId, payload: { designRequestId: request.id, designRequestVersion: request.version, prospectId, admittedPackId: request.admission.packId }, maxAttempts: 3, runAfter: now.toISOString() });
  return { request, job, alreadyExisted: false };
}
