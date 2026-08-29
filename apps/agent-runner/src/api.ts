export interface RunnerJob {
  id: string;
  kind: string;
  prospectId?: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  maxAttempts: number;
}

export interface RunnerProspect {
  id: string;
  companyName: string;
  activity?: string;
  location?: string;
  websiteUrl?: string;
  opportunity?: string;
  score?: number;
  primaryFriction?: string;
  primaryAsset?: string;
  primaryCta?: string;
  state: string;
}

export interface RunnerContact {
  id: string;
  prospectId: string;
  email: string;
  sourceUrl?: string;
  sourceType?: string;
  confidence?: number;
  isValidated: boolean;
  isSuppressed: boolean;
}

export interface ClaimedJob {
  job: RunnerJob;
  prospect: RunnerProspect | null;
  contacts: RunnerContact[];
  outreachDraft?: {
    id: string;
    contact_id?: string;
    subject?: string;
    body_text: string;
    confidence?: number;
    status?: string;
  } | null;
  researchContext?: Record<string, unknown> | null;
  latestReply?: {
    id: string;
    raw_text: string;
    received_at: string;
    from_email?: string;
  } | null;
  threadParentMessageId?: string | null;
  prototypeContext?: {
    id: string;
    prospect_id: string;
    repo_path: string;
    runner_id?: string | null;
    status: string;
    qa_status?: string | null;
    build_manifest_json?: string | null;
    qa_findings_json?: string | null;
  } | null;
}

export class MagicScriptApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly runnerId: string,
  ) {}


  async heartbeat(input: {
    hostname: string;
    status: 'IDLE' | 'BUSY' | 'ERROR';
    version: string;
    currentJobId?: string | null;
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/runner/heartbeat`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        runnerId: this.runnerId,
        ...input,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Heartbeat failed ${response.status}: ${await response.text()}`,
      );
    }
  }

  async claim(): Promise<ClaimedJob | null> {
    const response = await fetch(`${this.baseUrl}/api/runner/jobs/claim`, {
      method: 'POST',
      headers: this.headers(),
    });

    if (response.status === 204) return null;
    if (!response.ok) {
      throw new Error(`Claim failed ${response.status}: ${await response.text()}`);
    }

    return (await response.json()) as ClaimedJob;
  }

  async succeed(jobId: string, output: unknown): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/runner/jobs/${encodeURIComponent(jobId)}/succeed`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ output }),
      },
    );

    if (!response.ok) {
      throw new Error(`Success callback failed ${response.status}: ${await response.text()}`);
    }
  }

  async inboundEmail(input: {
    inReplyToProviderMessageId: string;
    providerMessageId?: string;
    fromEmail?: string;
    rawText: string;
    receivedAt?: string;
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/runner/email/inbound`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(input),
    });

    if (response.status === 404) {
      return;
    }

    if (!response.ok) {
      throw new Error(
        `Inbound callback failed ${response.status}: ${await response.text()}`,
      );
    }
  }

  async fail(jobId: string, error: string, retryDelayMs = 30_000): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/runner/jobs/${encodeURIComponent(jobId)}/fail`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ error, retryDelayMs }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failure callback failed ${response.status}: ${await response.text()}`);
    }
  }

  private headers(): Headers {
    const headers = new Headers({
      'content-type': 'application/json',
    });
    headers.set('authorization', `Bearer ${this.token}`);
    headers.set('x-magicscript-runner-id', this.runnerId);
    return headers;
  }
}
