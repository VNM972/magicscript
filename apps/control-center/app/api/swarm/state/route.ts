import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { SwarmState } from '../../../../lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
type Rule = {
  $ref?: string; type?: string | string[]; enum?: unknown[]; required?: string[];
  properties?: Record<string, Rule>; additionalProperties?: boolean; items?: Rule;
  minimum?: number; maximum?: number; minLength?: number; format?: string;
};
type Contract = Rule & { $defs: Record<string, Rule>; default: SwarmState; 'x-jobRoles': Record<string, string> };
let contractPromise: Promise<Contract> | undefined;

function loadContract(): Promise<Contract> {
  // The repository contract is deliberately shared with Python, including the empty state.
  contractPromise ??= readFile(path.resolve(process.cwd(), '../../docs/SWARM_STATE_SCHEMA.md'), 'utf8')
    .then(text => JSON.parse(text.split('<!-- SWARM_SCHEMA -->')[1].split('```json')[1].split('```')[0]) as Contract)
    .catch(error => { contractPromise = undefined; throw error; });
  return contractPromise;
}

function validate(value: unknown, rule: Rule, schema: Contract): void {
  if (rule.$ref) rule = schema.$defs[rule.$ref.split('/').at(-1)!];
  const kinds = typeof rule.type === 'string' ? [rule.type] : rule.type;
  const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (kinds && !kinds.some(t => t === kind || t === 'integer' && Number.isInteger(value))) throw Error('Invalid type');
  if (rule.enum && !rule.enum.includes(value)) throw Error('Invalid enum');
  if (typeof value === 'number' && (!Number.isFinite(value) || value < (rule.minimum ?? -Infinity) || value > (rule.maximum ?? Infinity))) throw Error('Invalid range');
  if (typeof value === 'string') {
    if (value.length < (rule.minLength ?? 0)) throw Error('Empty string');
    if (rule.format === 'date-time' && (!/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value)))) throw Error('Invalid date');
  }
  if (Array.isArray(value)) value.forEach(item => validate(item, rule.items!, schema));
  else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (rule.required?.some(key => !Object.hasOwn(record, key))) throw Error('Missing field');
    for (const [key, item] of Object.entries(record)) {
      const child = rule.properties?.[key];
      if (child) validate(item, child, schema);
      else if (rule.additionalProperties === false) throw Error('Unexpected field');
    }
  }
}

function validateReferences(state: SwarmState) {
  const ids = (items: { id: string }[]) => {
    const result = new Set(items.map(item => item.id));
    if (result.size !== items.length) throw Error('Duplicate id');
    return result;
  };
  const units = ids(state.businessUnits), agents = ids(state.agents), jobs = ids(state.jobs);
  const nodes = ids([...state.agents, ...state.gatekeepers]);
  ids(state.edges); ids(state.events);
  const link = (id: string | null, targets: Set<string>) => { if (id !== null && !targets.has(id)) throw Error('Dangling reference'); };
  for (const bu of state.businessUnits) {
    bu.agentIds.forEach(id => link(id, agents));
    const expected = state.agents.filter(a => a.businessUnitId === bu.id).map(a => a.id);
    if (expected.length !== bu.agentIds.length || new Set(bu.agentIds).size !== expected.length || expected.some(id => !bu.agentIds.includes(id))) throw Error('Invalid membership');
  }
  for (const entity of [...state.agents, ...state.gatekeepers]) {
    link(entity.businessUnitId, units); link(entity.currentJobId, jobs);
  }
  for (const job of state.jobs) {
    link(job.currentBusinessUnitId, units); link(job.currentAgentId, agents);
    job.route.forEach(id => link(id, units));
  }
  for (const edge of state.edges) {
    link(edge.source, nodes); link(edge.target, nodes);
    edge.activeJobIds.forEach(id => link(id, jobs));
  }
}

type WorkerJob = {
  id: string; kind: string; prospectId?: string | null; status: SwarmState['jobs'][number]['status'];
  claimedAt?: string | null; createdAt: string; updatedAt: string;
};
type WorkerEvent = { id: string; type: string; createdAt: string };

async function readWorker<T>(endpoint: string, signal: AbortSignal): Promise<T> {
  // Keep credentials on the server, with the same local defaults as lib/api.ts.
  const production = process.env.NODE_ENV === 'production';
  const base = (process.env.MAGICSCRIPT_API_BASE_URL || (production ? '' : 'http://127.0.0.1:8787')).replace(/\/$/, '');
  if (!base) throw Error('Worker URL missing');
  const token = process.env.MAGICSCRIPT_API_TOKEN || (production ? undefined : 'dev-api-token');
  const response = await fetch(base + endpoint, {
    cache: 'no-store', signal, headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw Error('Worker unavailable');
  return response.json() as Promise<T>;
}

async function readLocalFallback(schema: Contract): Promise<SwarmState | null> {
  try {
    const text = await readFile(path.resolve(process.cwd(), 'public/swarm-state.json'), 'utf8');
    const state = JSON.parse(text) as SwarmState;
    const writtenAt = Date.parse(state.metadata?.timestamp ?? '');
    const age = Date.now() - writtenAt;
    if (!Number.isFinite(writtenAt) || age < 0 || age >= 20_000) return null;
    state.metadata.sourceStatus = 'ready';
    validate(state, schema, schema);
    validateReferences(state);
    return state;
  } catch {
    return null;
  }
}

function projectState(schema: Contract, jobs: WorkerJob[], events: WorkerEvent[]): SwarmState {
  // Use the shared topology and role mapping, following core/swarm_state_writer.py.
  const state = structuredClone(schema.default);
  const terminal = new Set(['SUCCEEDED', 'FAILED', 'DEAD_LETTER']);
  const roles = new Map(state.agents.map(agent => [agent.id, agent]));
  const units = new Map(state.businessUnits.map(unit => [unit.id, unit]));
  const selectedJobs = [
    ...jobs.filter(job => !terminal.has(job.status)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    ...jobs.filter(job => terminal.has(job.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)).slice(0, 100),
  ];
  for (const job of selectedJobs) {
    const base = roles.get(schema['x-jobRoles'][job.kind]);
    let agent: SwarmState['agents'][number] | undefined;
    if (base && !terminal.has(job.status)) {
      agent = base;
      if (base.currentJobId !== null) {
        agent = { ...base, id: base.id + ':' + job.id, type: 'execution' };
        state.agents.push(agent);
        units.get(agent.businessUnitId)!.agentIds.push(agent.id);
      }
      Object.assign(agent, {
        currentJobId: job.id, progress: null, startedAt: job.claimedAt ? new Date(job.claimedAt).toISOString() : null,
        status: job.status === 'RUNNING' || job.status === 'SENDING' ? 'processing' : job.status === 'SEND_UNKNOWN' ? 'waiting_gatekeeper' : 'idle',
      });
    }
    const bu = base?.businessUnitId ?? null;
    state.jobs.push({ id: job.id, prospectId: job.prospectId ?? null, status: job.status,
      currentBusinessUnitId: bu, currentAgentId: agent?.id ?? null,
      progress: job.status === 'SUCCEEDED' ? 1 : null, route: bu ? [bu] : [] });
  }
  for (const unit of state.businessUnits) {
    const statuses = new Set(state.agents.filter(agent => agent.businessUnitId === unit.id).map(agent => agent.status));
    unit.status = (['error', 'waiting_gatekeeper', 'processing'] as const).find(status => statuses.has(status)) ?? 'idle';
  }
  state.events = events.slice(0, 50).map(event => ({
    id: event.id, timestamp: new Date(event.createdAt).toISOString(), type: event.type, message: event.type,
    severity: /error|failed|dead_letter|rejected/i.test(event.type) ? 'error' : /warning|invalid|unknown/i.test(event.type) ? 'warning' : 'info',
  }));
  const active = state.jobs.filter(job => job.status === 'RUNNING' || job.status === 'SENDING').length;
  state.swarm.status = active ? 'processing' : state.jobs.some(job => ['SEND_UNKNOWN', 'FAILED', 'DEAD_LETTER'].includes(job.status)) ? 'attention' : 'idle';
  state.swarm.activeJobs = active;
  state.swarm.activeAgents = state.agents.filter(agent => agent.status === 'processing').length;
  state.metadata = { timestamp: new Date().toISOString(), schemaVersion: '1.0.0', sourceStatus: 'ready' };
  return state;
}

export async function GET(request: Request) {
  try {
    const schema = await loadContract();
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(3500)]);
    // Sequential reads match the existing local D1 client path.
    const { jobs } = await readWorker<{ jobs: WorkerJob[] }>('/api/jobs', signal);
    const { events } = await readWorker<{ events: WorkerEvent[] }>('/api/events?limit=50', signal);
    if (!Array.isArray(jobs) || !Array.isArray(events)) throw Error('Invalid Worker response');
    const state = projectState(schema, jobs, events);
    validate(state, schema, schema);
    validateReferences(state);
    return Response.json(state, { headers });
  } catch {
    const schema = await loadContract().catch(() => null);
    const fallback = schema ? await readLocalFallback(schema) : null;
    if (fallback) return Response.json(fallback, { headers });
    return Response.json({ error: 'Moteur indisponible' }, { status: 503, headers });
  }
}
