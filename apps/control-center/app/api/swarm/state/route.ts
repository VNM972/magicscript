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
type Contract = Rule & { $defs: Record<string, Rule>; default: SwarmState };
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

export async function GET() {
  try {
    const schema = await loadContract();
    let state: SwarmState;
    try {
      state = JSON.parse(await readFile(path.join(process.cwd(), 'public/swarm-state.json'), 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      state = structuredClone(schema.default);
      state.metadata.timestamp = new Date().toISOString();
    }
    validate(state, schema, schema);
    validateReferences(state);
    const age = Date.now() - Date.parse(state.metadata.timestamp);
    if (age > 20_000 || age < -5_000) throw Error('Stale snapshot');
    return Response.json(state, { headers });
  } catch {
    return Response.json({ error: 'Moteur indisponible' }, { status: 503, headers });
  }
}
