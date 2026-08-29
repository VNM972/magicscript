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
    subject?: string;
    body_text: string;
    confidence?: number;
  } | null;
}

export class MagicScriptApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

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
    return headers;
  }
}
