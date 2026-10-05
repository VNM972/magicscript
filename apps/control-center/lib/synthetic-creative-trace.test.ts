import test from 'node:test';
import assert from 'node:assert/strict';
import { projectSyntheticCreativeTrace, type Job } from './api';

function job(status: string, result: unknown): Job { return { id: 'job-synthetic-1', kind: 'CREATIVE_WEB_DESIGN_SYNTHETIC', status, attempts: 1, runAfter: '', createdAt: '', updatedAt: '', result }; }
const result = { kind: 'CREATIVE_WEB_DESIGN_SYNTHETIC', synthetic: true, fixtureId: 'synthetic-ugly', technicalJobStatus: 'SUCCEEDED', creativeVerdict: 'EXHAUSTED', iterations: [{ filesChanged: ['app/globals.css'], buildResult: { status: 'PASSED' } }], qaPreflight: { passed: true, blockers: [] }, qaFinal: { passed: true, blockers: [] }, after: { renderEvidence: { desktop: { checked: true }, mobile: { checked: true }, method: 'LOCAL_BROWSER' } }, blockers: [], externalActions: [] };

test('Control Center keeps technical status distinct from creative verdict', () => { const trace = projectSyntheticCreativeTrace(job('SUCCEEDED', result)); assert.ok(trace); assert.equal(trace.technicalJobStatus, 'SUCCEEDED'); assert.equal(trace.creativeVerdict, 'EXHAUSTED'); assert.equal(trace.iterationCount, 1); assert.deepEqual(trace.renderEvidence, { desktop: true, mobile: true, method: 'LOCAL_BROWSER' }); });
test('Control Center returns UNKNOWN for missing malformed synthetic result', () => { assert.equal(projectSyntheticCreativeTrace(job('RUNNING', null)), undefined); assert.equal(projectSyntheticCreativeTrace({ ...job('FAILED', result), result: { ...result, synthetic: false } }), undefined); });
