import type { SendReservationStatus } from './email/send-idempotency';
import type { BuildArtifactV1 } from '../../../core/builder/contracts';
import type { BuildCorrectionRequestV1, VisualQaReportV1 } from '../../../core/visual-qa/contracts';
import type { DesignRequestV1 } from '../../../core/design/design-request';
import type { DesignArtifactV1 } from '../../../core/design/design-artifact';
import type { ActiveProductionSlot } from '../../../core/persistence/d1-production-slot-store';

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
  siren?: string;
  siret?: string;
  activity?: string;
  location?: string;
  websiteUrl?: string;
  phone?: string;
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
  /** Rich Agent 1 intake context; kept separate from the canonical Prospect fields. */
  agent1Context?: Record<string, unknown> | null;
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
  prototypeConversion?: {
    salesRoomUrl: string | null;
    salesRoomSlug: string | null;
    ctaTarget: 'SALES_ROOM';
  } | null;
  prototypeStrategy?: Record<string, unknown> | null;
  designRequest?: Record<string, unknown> | null;
  designArtifact?: Record<string, unknown> | null;
  designCorrection?: Record<string, unknown> | null;
  buildCorrectionContext?: {
    correctionRequest: BuildCorrectionRequestV1;
    targetBuild: BuildArtifactV1;
    qaReport: VisualQaReportV1;
    designRequest: DesignRequestV1;
    approvedDesignArtifact: DesignArtifactV1;
    existingCorrectedBuild?: BuildArtifactV1 | null;
    productionSlot: ActiveProductionSlot;
  } | null;
}

export interface FakeTransportAttempt {
  provider: 'fake';
  outcome: 'SUCCESS' | 'FAILURE';
  recipient: string;
  subject: string;
  body: string;
  proposalLink: string;
  draftId: string;
  revision: number;
  fingerprint: string;
  idempotencyKey: string;
  sendCount: 1;
}

export class MagicScriptApi {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly runnerId: string,
    private readonly stackId?: string,
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

  async ingestAgent1Batch(batch: unknown): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/agent1/batches`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(batch),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Agent 1 canonical ingestion failed ${response.status}: ${JSON.stringify(body)}`);
    }
    return body;
  }

  async beginSend(jobId: string, messageId: string): Promise<SendReservationStatus> {
    const response = await fetch(
      `${this.baseUrl}/api/runner/jobs/${encodeURIComponent(jobId)}/send-start`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ messageId }),
      },
    );

    const body = (await response.json().catch(() => ({}))) as {
      status?: SendReservationStatus;
    };

    if (response.status === 409 && body.status) {
      return body.status;
    }

    if (!response.ok) {
      throw new Error(`Send reservation failed ${response.status}`);
    }

    if (body.status !== 'STARTED') {
      throw new Error('Send reservation returned an invalid status');
    }

    return body.status;
  }

  async recordFakeTransportAttempt(
    jobId: string,
    attempt: FakeTransportAttempt,
  ): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/runner/jobs/${encodeURIComponent(jobId)}/fake-transport-attempt`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(attempt),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Fake transport evidence failed ${response.status}: ${await response.text()}`,
      );
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

  async bounce(input: {
    inReplyToProviderMessageId: string;
    recipient?: string;
    reason?: string;
    receivedAt?: string;
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/runner/email/bounce`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(input),
    });

    if (response.status === 404) {
      return;
    }

    if (!response.ok) {
      throw new Error(
        `Bounce callback failed ${response.status}: ${await response.text()}`,
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
    if (this.stackId) {
      headers.set('x-magicscript-stack-id', this.stackId);
    }
    return headers;
  }
}
