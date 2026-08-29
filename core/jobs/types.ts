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
  | 'ESCALATE_TO_HUMAN';

export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'DEAD_LETTER';

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
}

export interface JobQueue {
  enqueue<TPayload>(
    job: Omit<MagicScriptJob<TPayload>, 'status' | 'attempts' | 'createdAt' | 'updatedAt'>,
  ): Promise<MagicScriptJob<TPayload>>;
  next(now?: Date): Promise<MagicScriptJob | null>;
  markSucceeded(id: string): Promise<void>;
  markFailed(id: string, error: string, retryAfter?: Date): Promise<void>;
  list(status?: JobStatus): Promise<MagicScriptJob[]>;
}
