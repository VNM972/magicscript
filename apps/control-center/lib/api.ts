export interface ApiHealth {
  ok: boolean;
  service: string;
  databaseConfigured: boolean;
  autopilotEnabled: boolean;
  sendingEnabled: boolean;
  emailProvider: string;
  testEmailMode: boolean;
  testRecipientConfigured: boolean;
  prototypeDeployEnabled: boolean;
}

export interface Overview {
  prospects: number;
  qualified: number;
  emailsSent: number;
  replies: number;
  hotLeads: number;
  prototypes: number;
  actionsRequired: number;
}

export interface Escalation {
  id: string;
  prospect_id: string;
  category: string;
  summary: string;
  status: string;
  created_at: string;
}

export interface Job {
  id: string;
  kind: string;
  prospectId?: string;
  status: string;
  attempts: number;
  runAfter: string;
  createdAt: string;
  updatedAt: string;
}

export interface Runner {
  runner_id: string;
  hostname?: string;
  status: string;
  version?: string;
  current_job_id?: string | null;
  started_at: string;
  last_seen_at: string;
}

export interface ProviderUsage {
  period: string;
  rechercheEntreprises: {
    configured: boolean;
    authRequired: boolean;
    monetaryCost: number;
    documentedRateLimitPerSecond: number;
    purpose: string;
  };
  sirene: {
    configured: boolean;
    cost: string;
    purpose: string;
  };
  hunter: {
    configured: boolean;
    used: number;
    budget: number;
    remainingInternalBudget: number;
    purpose?: string;
  };
}

export interface OutreachStatus {
  sendingEnabled: boolean;
  provider: string;
  daily: {
    limit: number;
    sent: number;
    inFlight: number;
    available: number;
  };
  maxFollowups: number;
  followup1Days: number;
  followup2Days: number;
  waitingReply: number;
  followupDue: number;
}

export interface PrototypeSummary {
  id: string;
  prospect_id: string;
  company_name: string;
  status: string;
  qa_status?: string | null;
  deployment_url?: string | null;
  runner_id?: string | null;
  updated_at: string;
}

export interface LiveEvent {
  id: string;
  prospectId?: string;
  actor: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ProspectSummary {
  id: string;
  companyName: string;
  state: string;
  score?: number;
  activity?: string;
  location?: string;
  updatedAt: string;
}

export interface Readiness {
  dryRunReady: boolean;
  checks: {
    database: boolean;
    autopilot: boolean;
    runnerOnline: boolean;
    safeTransport: boolean;
    publicDiscovery: boolean;
    noDeadLetters: boolean;
  };
  runner: {
    runner_id: string;
    status: string;
    last_seen_at: string;
  } | null;
  prospects: number;
  timestamp: string;
}

export interface ControlCenterData {
  connected: boolean;
  health: ApiHealth | null;
  overview: Overview | null;
  escalations: Escalation[];
  runningJobs: Job[];
  runners: Runner[];
  providerUsage: ProviderUsage | null;
  outreachStatus: OutreachStatus | null;
  prototypes: PrototypeSummary[];
  recentEvents: LiveEvent[];
  prospects: ProspectSummary[];
  readiness: Readiness | null;
  error?: string;
}

const baseUrl = process.env.MAGICSCRIPT_API_BASE_URL?.replace(/\/$/, '');
const apiToken = process.env.MAGICSCRIPT_API_TOKEN;

async function getJson<T>(path: string): Promise<T> {
  if (!baseUrl) {
    throw new Error('MAGICSCRIPT_API_BASE_URL is not configured');
  }

  const headers = new Headers();
  if (apiToken) {
    headers.set('authorization', `Bearer ${apiToken}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export async function getControlCenterData(): Promise<ControlCenterData> {
  try {
    const health = await getJson<ApiHealth>('/health');

    if (!health.databaseConfigured) {
      return {
        connected: true,
        health,
        overview: null,
        escalations: [],
        runningJobs: [],
        runners: [],
        providerUsage: null,
        outreachStatus: null,
        prototypes: [],
        recentEvents: [],
        prospects: [],
        readiness: null,
        error: 'API connected, but D1 is not configured yet.',
      };
    }

    const [
      overview,
      escalationData,
      jobData,
      runnerData,
      providerUsage,
      outreachStatus,
      prototypeData,
      eventData,
      prospectData,
      readiness,
    ] = await Promise.all([
      getJson<Overview>('/api/overview'),
      getJson<{ escalations: Escalation[] }>('/api/escalations?limit=20'),
      getJson<{ jobs: Job[] }>('/api/jobs?status=RUNNING'),
      getJson<{ runners: Runner[] }>('/api/runners'),
      getJson<ProviderUsage>('/api/providers/usage'),
      getJson<OutreachStatus>('/api/outreach/status'),
      getJson<{ prototypes: PrototypeSummary[] }>('/api/prototypes'),
      getJson<{ events: LiveEvent[] }>('/api/events?limit=20'),
      getJson<{ prospects: ProspectSummary[] }>('/api/prospects'),
      getJson<Readiness>('/api/readiness'),
    ]);

    return {
      connected: true,
      health,
      overview,
      escalations: escalationData.escalations,
      runningJobs: jobData.jobs,
      runners: runnerData.runners,
      providerUsage,
      outreachStatus,
      prototypes: prototypeData.prototypes,
      recentEvents: eventData.events,
      prospects: prospectData.prospects,
      readiness,
    };
  } catch (error) {
    return {
      connected: false,
      health: null,
      overview: null,
      escalations: [],
      runningJobs: [],
      runners: [],
      providerUsage: null,
      outreachStatus: null,
      prototypes: [],
      recentEvents: [],
      prospects: [],
      readiness: null,
      error: error instanceof Error ? error.message : 'Unknown backend error',
    };
  }
}
