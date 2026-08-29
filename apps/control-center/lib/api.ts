export interface ApiHealth {
  ok: boolean;
  service: string;
  databaseConfigured: boolean;
  autopilotEnabled: boolean;
  sendingEnabled: boolean;
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

export interface ControlCenterData {
  connected: boolean;
  health: ApiHealth | null;
  overview: Overview | null;
  escalations: Escalation[];
  runningJobs: Job[];
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
        error: 'API connected, but D1 is not configured yet.',
      };
    }

    const [overview, escalationData, jobData] = await Promise.all([
      getJson<Overview>('/api/overview'),
      getJson<{ escalations: Escalation[] }>('/api/escalations?limit=20'),
      getJson<{ jobs: Job[] }>('/api/jobs?status=RUNNING'),
    ]);

    return {
      connected: true,
      health,
      overview,
      escalations: escalationData.escalations,
      runningJobs: jobData.jobs,
    };
  } catch (error) {
    return {
      connected: false,
      health: null,
      overview: null,
      escalations: [],
      runningJobs: [],
      error: error instanceof Error ? error.message : 'Unknown backend error',
    };
  }
}
