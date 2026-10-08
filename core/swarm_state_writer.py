"""Passive, read-only projection of canonical D1 SQLite. Contract lives in docs."""
from __future__ import annotations

import copy
import json
import math
import os
from pathlib import Path
import sqlite3
import tempfile
from contextlib import closing
from datetime import datetime, timezone
from functools import lru_cache

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / 'apps/api-worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8d99d9a73b43bbdb8f14112bf19dd6ef1e9b7dc6151dc67a34b1807411d91355.sqlite'
DEFAULT_OUTPUT = ROOT / 'apps/control-center/public/swarm-state.json'
TERMINAL = ('SUCCEEDED', 'FAILED', 'DEAD_LETTER')


@lru_cache(maxsize=1)
def contract() -> dict:
    text = (ROOT / 'docs/SWARM_STATE_SCHEMA.md').read_text(encoding='utf-8')
    return json.loads(text.split('<!-- SWARM_SCHEMA -->', 1)[1].split('```json', 1)[1].split('```', 1)[0])


def timestamp(value: str | None = None) -> str:
    dt = datetime.fromisoformat(value.replace('Z', '+00:00')) if value else datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)  # SQLite CURRENT_TIMESTAMP is UTC.
    return dt.astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def validate_state(state: dict) -> None:
    """Validate the schema keywords used by our versioned contract, without dependencies."""
    schema = contract()

    def check(value, rule, path='$'):
        if '$ref' in rule:
            rule = schema['$defs'][rule['$ref'].split('/')[-1]]
        types = rule.get('type', [])
        if isinstance(types, str):
            types = [types]
        matches = {'null': value is None, 'object': isinstance(value, dict),
                   'array': isinstance(value, list), 'string': isinstance(value, str),
                   'number': type(value) in (int, float) and math.isfinite(value),
                   'integer': type(value) is int}
        if types and not any(matches.get(t, False) for t in types):
            raise ValueError(f'{path}: invalid type')
        if 'enum' in rule and value not in rule['enum']:
            raise ValueError(f'{path}: invalid enum')
        if isinstance(value, dict):
            props = rule.get('properties', {})
            if set(rule.get('required', [])) - value.keys():
                raise ValueError(f'{path}: missing fields')
            if rule.get('additionalProperties') is False and value.keys() - props.keys():
                raise ValueError(f'{path}: unexpected fields')
            for key, item in value.items():
                if key in props:
                    check(item, props[key], path + '.' + key)
        if isinstance(value, list):
            for index, item in enumerate(value):
                check(item, rule['items'], f'{path}[{index}]')
        if isinstance(value, str):
            if len(value) < rule.get('minLength', 0):
                raise ValueError(f'{path}: empty string')
            if rule.get('format') == 'date-time':
                dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                if 'T' not in value or dt.tzinfo is None:
                    raise ValueError(f'{path}: expected RFC 3339')
        if type(value) in (float, int) and (value < rule.get('minimum', -math.inf) or value > rule.get('maximum', math.inf)):
            raise ValueError(f'{path}: out of range')

    check(state, schema)
    sets = {}
    for name in ('businessUnits', 'agents', 'gatekeepers', 'edges', 'jobs', 'events'):
        sets[name] = {v['id'] for v in state[name]}
        if len(sets[name]) != len(state[name]):
            raise ValueError('duplicate ' + name + ' id')
    nodes = sets['agents'] | sets['gatekeepers']
    if sets['agents'] & sets['gatekeepers']:
        raise ValueError('ambiguous node id')

    def link(value, targets):
        if value is not None and value not in targets:
            raise ValueError('dangling reference')

    for bu in state['businessUnits']:
        for agent_id in bu['agentIds']:
            link(agent_id, sets['agents'])
        expected = {a['id'] for a in state['agents'] if a['businessUnitId'] == bu['id']}
        if expected != set(bu['agentIds']) or len(bu['agentIds']) != len(expected):
            raise ValueError('inconsistent BU membership')
    for entity in state['agents'] + state['gatekeepers']:
        link(entity['businessUnitId'], sets['businessUnits'])
        link(entity['currentJobId'], sets['jobs'])
    for job in state['jobs']:
        link(job['currentBusinessUnitId'], sets['businessUnits'])
        link(job['currentAgentId'], sets['agents'])
        for unit in job['route']:
            link(unit, sets['businessUnits'])
    for edge in state['edges']:
        link(edge['source'], nodes)
        link(edge['target'], nodes)
        for job_id in edge['activeJobIds']:
            link(job_id, sets['jobs'])


def build_state(db_path: Path | str = DEFAULT_DB) -> dict:
    state = copy.deepcopy(contract()['default'])
    # URI mode=ro refuses to create missing databases; BEGIN binds both tables to one snapshot.
    with closing(sqlite3.connect(Path(db_path).resolve().as_uri() + '?mode=ro', uri=True, timeout=2)) as db:
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA query_only=ON')
        db.execute('BEGIN')
        jobs = db.execute("SELECT id, kind, prospect_id, status, claimed_at FROM jobs WHERE status NOT IN ('SUCCEEDED','FAILED','DEAD_LETTER') ORDER BY created_at, id").fetchall()
        jobs += db.execute("SELECT id, kind, prospect_id, status, claimed_at FROM jobs WHERE status IN ('SUCCEEDED','FAILED','DEAD_LETTER') ORDER BY updated_at DESC, id LIMIT 100").fetchall()
        events = db.execute('SELECT id, type, created_at FROM events ORDER BY created_at DESC, id LIMIT 50').fetchall()
        state['metadata'].update(timestamp=timestamp(), sourceStatus='ready')
    roles = {a['id']: a for a in state['agents']}
    units = {b['id']: b for b in state['businessUnits']}
    for row in jobs:
        base = roles.get(contract()['x-jobRoles'].get(row['kind']))
        agent = None
        if base and row['status'] not in TERMINAL:
            agent = base
            if base['currentJobId'] is not None:
                agent = dict(base, id=base['id'] + ':' + row['id'], type='execution')
                state['agents'].append(agent)
                units[agent['businessUnitId']]['agentIds'].append(agent['id'])
            agent.update(currentJobId=row['id'], progress=None,
                         startedAt=timestamp(row['claimed_at']) if row['claimed_at'] else None,
                         status='processing' if row['status'] in ('RUNNING', 'SENDING') else 'waiting_gatekeeper' if row['status'] == 'SEND_UNKNOWN' else 'idle')
        bu_id = base['businessUnitId'] if base else None
        state['jobs'].append(dict(id=row['id'], prospectId=row['prospect_id'], status=row['status'],
                                  currentBusinessUnitId=bu_id, currentAgentId=agent['id'] if agent else None,
                                  progress=1 if row['status'] == 'SUCCEEDED' else None, route=[bu_id] if bu_id else []))
    for bu in state['businessUnits']:
        statuses = {a['status'] for a in state['agents'] if a['businessUnitId'] == bu['id']}
        bu['status'] = next((s for s in ('error', 'waiting_gatekeeper', 'processing') if s in statuses), 'idle')
    for row in events:
        kind = row['type'].lower()
        severity = 'error' if any(s in kind for s in ('error', 'failed', 'dead_letter', 'rejected')) else 'warning' if any(s in kind for s in ('warning', 'invalid', 'unknown')) else 'info'
        state['events'].append(dict(id=row['id'], timestamp=timestamp(row['created_at']), type=row['type'], severity=severity, message=row['type']))
    active = sum(j['status'] in ('RUNNING', 'SENDING') for j in state['jobs'])
    attention = any(j['status'] in ('SEND_UNKNOWN', 'FAILED', 'DEAD_LETTER') for j in state['jobs'])
    state['swarm'].update(status='processing' if active else 'attention' if attention else 'idle', activeJobs=active,
                          activeAgents=sum(a['status'] == 'processing' for a in state['agents']))
    validate_state(state)
    return state


def write_state(db_path: Path | str = DEFAULT_DB, output: Path | str = DEFAULT_OUTPUT) -> dict:
    state = build_state(db_path)
    destination = Path(output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=destination.parent, prefix='.swarm-', suffix='.tmp', delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(state, stream, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, destination)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return state
