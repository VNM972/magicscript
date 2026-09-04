import { jobKindPriority } from './priority';
import type { JobQueue, JobStatus, MagicScriptJob } from './types';

export class InMemoryJobQueue implements JobQueue {
  private readonly jobs = new Map<string, MagicScriptJob>();

  async enqueue<TPayload>(
    input: Omit<
      MagicScriptJob<TPayload>,
      'status' | 'attempts' | 'createdAt' | 'updatedAt' | 'claimedBy' | 'claimedAt'
    >,
  ): Promise<MagicScriptJob<TPayload>> {
    const now = new Date().toISOString();
    const job: MagicScriptJob<TPayload> = {
      ...input,
      status: 'PENDING',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(job.id, job as MagicScriptJob);
    return job;
  }

  async next(
    now = new Date(),
    claimedBy?: string,
    allowedKinds?: readonly MagicScriptJob['kind'][],
    prospectId?: string,
  ): Promise<MagicScriptJob | null> {
    const allowed = allowedKinds ? new Set(allowedKinds) : null;
    const candidate = [...this.jobs.values()]
      .filter((job) => {
        const requiredRunnerId =
          job.payload && typeof job.payload === 'object'
            ? (job.payload as Record<string, unknown>).requiredRunnerId
            : undefined;

        return (
          job.status === 'PENDING' &&
          new Date(job.runAfter) <= now &&
          (!prospectId || job.prospectId === prospectId) &&
          (!allowed || allowed.has(job.kind)) &&
          (requiredRunnerId == null ||
            (typeof requiredRunnerId === 'string' && requiredRunnerId === claimedBy))
        );
      })
      .sort((a, b) => {
        const priorityDelta = jobKindPriority(a.kind) - jobKindPriority(b.kind);
        return priorityDelta || a.createdAt.localeCompare(b.createdAt);
      })[0];

    if (!candidate) return null;

    const claimedAt = now.toISOString();
    const running: MagicScriptJob = {
      ...candidate,
      status: 'RUNNING',
      attempts: candidate.attempts + 1,
      claimedBy,
      claimedAt,
      lastError: undefined,
      updatedAt: claimedAt,
    };

    this.jobs.set(running.id, running);
    return running;
  }

  async markSucceeded(id: string): Promise<void> {
    const job = this.requireJob(id);
    this.jobs.set(id, {
      ...job,
      status: 'SUCCEEDED',
      claimedBy: undefined,
      claimedAt: undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  async markFailed(id: string, error: string, retryAfter = new Date()): Promise<void> {
    const job = this.requireJob(id);
    if (job.status === 'SUCCEEDED' || job.status === 'DEAD_LETTER' || job.status === 'SEND_UNKNOWN') {
      return;
    }
    const exhausted = job.attempts >= job.maxAttempts;

    const status: JobStatus = job.status === 'SENDING'
      ? 'SEND_UNKNOWN'
      : exhausted
        ? 'DEAD_LETTER'
        : 'PENDING';

    this.jobs.set(id, {
      ...job,
      status,
      claimedBy: status === 'PENDING' || status === 'SEND_UNKNOWN' || status === 'DEAD_LETTER'
        ? undefined
        : job.claimedBy,
      claimedAt: status === 'PENDING' || status === 'SEND_UNKNOWN' || status === 'DEAD_LETTER'
        ? undefined
        : job.claimedAt,
      runAfter: retryAfter.toISOString(),
      updatedAt: new Date().toISOString(),
      lastError: error,
    });
  }

  async releaseClaim(
    id: string,
    claimedBy: string,
    reason: string,
    runAfter = new Date(),
  ): Promise<MagicScriptJob | null> {
    const job = this.jobs.get(id);
    if (
      !job ||
      job.claimedBy !== claimedBy ||
      (job.status !== 'RUNNING' && job.status !== 'SENDING')
    ) {
      return null;
    }

    const released: MagicScriptJob = {
      ...job,
      status: job.status === 'SENDING' ? 'SEND_UNKNOWN' : 'PENDING',
      attempts:
        job.status === 'RUNNING' ? Math.max(0, job.attempts - 1) : job.attempts,
      runAfter: runAfter.toISOString(),
      lastError: reason,
      claimedBy: undefined,
      claimedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(id, released);
    return released;
  }

  async list(status?: JobStatus): Promise<MagicScriptJob[]> {
    const jobs = [...this.jobs.values()];
    return status ? jobs.filter((job) => job.status === status) : jobs;
  }

  private requireJob(id: string): MagicScriptJob {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Job not found: ${id}`);
    return job;
  }
}
