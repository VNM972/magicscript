export type JobKind =
  | 'DISCOVER_PROSPECTS'
  | 'RUN_RESEARCH_SWARM'
  | 'RUN_SCORING'
  | 'DISCOVER_CONTACT'
  | 'VALIDATE_CONTACT'
  | 'GENERATE_OUTREACH'
  | 'FACT_CHECK_OUTREACH'
  | 'SEND_EMAIL'
  | 'SEND_FOLLOW_UP'
  | 'CLASSIFY_REPLY'
  | 'BUILD_PROTOTYPE'
  | 'RUN_PROTOTYPE_QA'
  | 'DEPLOY_PROTOTYPE'
  | 'SEND_DEMO_LINK'
  | 'ESCALATE_TO_HUMAN'
  | 'GENERATE_INFORMATION_RESPONSE'
  | 'FACT_CHECK_INFORMATION_RESPONSE'
  | 'SEND_INFORMATION_RESPONSE'
  | 'GENERATE_PROTOTYPE_STRATEGY';

export type JobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SENDING'
  | 'SEND_UNKNOWN'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'DEAD_LETTER';

export interface MagicScriptJob<TPayload = Record<string, unknown>> {
  id: string;
  kind: JobKind;
  prospectId?: string;
  payload: TPayload;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
  claimedBy?: string;
  claimedAt?: string;
}

export interface JobQueue {
  enqueue<TPayload>(
    job: Omit<
      MagicScriptJob<TPayload>,
      'status' | 'attempts' | 'createdAt' | 'updatedAt' | 'claimedBy' | 'claimedAt'
    >,
  ): Promise<MagicScriptJob<TPayload>>;
  next(
    now?: Date,
    claimedBy?: string,
    allowedKinds?: readonly JobKind[],
    prospectId?: string,
  ): Promise<MagicScriptJob | null>;
  markSucceeded(id: string): Promise<void>;
  markFailed(id: string, error: string, retryAfter?: Date): Promise<void>;
  releaseClaim(
    id: string,
    claimedBy: string,
    reason: string,
    runAfter?: Date,
  ): Promise<MagicScriptJob | null>;
  list(status?: JobStatus): Promise<MagicScriptJob[]>;
}
