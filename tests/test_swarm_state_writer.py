"""Only temporary fixture databases are written. Canonical SQLite is never mutated."""
import copy
from contextlib import closing
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from core.swarm_state_writer import build_state, contract, validate_state, write_state


class SwarmStateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db = Path(self.tmp.name) / 'fixture.sqlite'
        self.output = Path(self.tmp.name) / 'swarm-state.json'
        with closing(sqlite3.connect(self.db)) as db, db:
            db.executescript('''
                CREATE TABLE jobs(id TEXT PRIMARY KEY, kind TEXT, prospect_id TEXT,
                  status TEXT, claimed_at TEXT, created_at TEXT, updated_at TEXT);
                CREATE TABLE events(id TEXT PRIMARY KEY, type TEXT, created_at TEXT);
            ''')

    def add_job(self, id, kind='RUN_RESEARCH_SWARM', status='RUNNING'):
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute('INSERT INTO jobs VALUES (?,?,?,?,?,?,?)',
                       (id, kind, 'prospect-test', status, '2026-10-08 12:00:00',
                        '2026-10-08 11:59:00', '2026-10-08 12:00:00'))

    def test_empty_contract_and_readonly(self):
        before = hashlib.sha256(self.db.read_bytes()).hexdigest()
        state = write_state(self.db, self.output)
        validate_state(state)
        self.assertEqual(state, json.loads(self.output.read_text(encoding='utf-8')))
        self.assertEqual(len(state['businessUnits']), 4)
        self.assertEqual(len(state['agents']), 7)
        self.assertTrue(all(a['status'] == 'idle' for a in state['agents']))
        self.assertEqual(state['swarm']['status'], 'idle')
        self.assertEqual(before, hashlib.sha256(self.db.read_bytes()).hexdigest())

    def test_real_statuses_concurrency_unknown_and_no_fake_handoffs(self):
        for id, kind, status in [('a', 'RUN_RESEARCH_SWARM', 'RUNNING'),
                                 ('b', 'RUN_RESEARCH_SWARM', 'SENDING'),
                                 ('c', 'SEND_EMAIL', 'SEND_UNKNOWN'),
                                 ('d', 'BUILD_PROTOTYPE', 'PENDING'),
                                 ('e', 'BUILD_PROTOTYPE', 'SUCCEEDED'),
                                 ('f', 'BUILD_PROTOTYPE', 'DEAD_LETTER'),
                                 ('g', 'FUTURE_KIND', 'RUNNING')]:
            self.add_job(id, kind, status)
        state = build_state(self.db)
        self.assertEqual(state['swarm']['activeJobs'], 3)
        self.assertEqual(state['swarm']['activeAgents'], 2)
        agents = {a['id']: a for a in state['agents']}
        self.assertEqual(agents['analyst:b']['currentJobId'], 'b')
        self.assertEqual(agents['publisher']['status'], 'waiting_gatekeeper')
        self.assertEqual(agents['designer']['status'], 'idle')
        jobs = {j['id']: j for j in state['jobs']}
        self.assertEqual(jobs['e']['progress'], 1)
        self.assertIsNone(jobs['a']['progress'])
        self.assertEqual(jobs['g']['route'], [])
        self.assertIsNone(jobs['g']['currentAgentId'])
        self.assertTrue(all(e['activeJobIds'] == [] for e in state['edges']))
        self.assertTrue(all(g['decision'] is None for g in state['gatekeepers']))

    def test_recent_history_bounded_but_all_active_preserved(self):
        for i in range(105):
            self.add_job('done-' + str(i), status='SUCCEEDED')
        self.add_job('active')
        with closing(sqlite3.connect(self.db)) as db, db:
            db.executemany('INSERT INTO events VALUES (?,?,?)',
                           [(str(i), 'job.failed', '2026-10-08 12:00:00') for i in range(55)])
        state = build_state(self.db)
        self.assertEqual(len(state['jobs']), 101)
        self.assertEqual(len(state['events']), 50)
        self.assertEqual(state['events'][0]['severity'], 'error')
        self.assertEqual(state['events'][0]['message'], 'job.failed')

    def test_missing_database_does_not_create_or_replace_output(self):
        self.output.write_text('previous', encoding='utf-8')
        missing = self.db.parent / 'absent.sqlite'
        with self.assertRaises(sqlite3.OperationalError):
            write_state(missing, self.output)
        self.assertFalse(missing.exists())
        self.assertEqual(self.output.read_text(), 'previous')

    def test_atomic_failure_keeps_previous_snapshot_and_cleans_temp(self):
        self.output.write_text('previous', encoding='utf-8')
        with patch('core.swarm_state_writer.os.replace', side_effect=PermissionError):
            with self.assertRaises(PermissionError):
                write_state(self.db, self.output)
        self.assertEqual(self.output.read_text(), 'previous')
        self.assertEqual(list(self.output.parent.glob('.swarm-*.tmp')), [])

    def test_schema_rejects_corruption(self):
        for mutate in [lambda s: s['metadata'].update(schemaVersion='wrong'),
                       lambda s: s['agents'][0].update(progress=2),
                       lambda s: s['agents'][0].update(status='fake'),
                       lambda s: s['agents'][0].update(businessUnitId='missing'),
                       lambda s: s['agents'].append(s['agents'][0]),
                       lambda s: s['metadata'].update(timestamp='bad-date'),
                       lambda s: s['swarm'].update(activeJobs=True),
                       lambda s: s.update(secret='not allowed')]:
            with self.subTest(mutation=mutate):
                state = copy.deepcopy(contract()['default'])
                mutate(state)
                with self.assertRaises(ValueError):
                    validate_state(state)


if __name__ == '__main__':
    unittest.main()
