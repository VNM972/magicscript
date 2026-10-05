#!/usr/bin/env node
// Usage: node scripts/import-agent1-batch.mjs scripts/examples/agent1-ananke-sample.json
// Input: { provenance, candidates: [{ companyName, sourceUrl, evidence: [{ url, note, supports }] }], batchId?, collectedAt? }.
// Optional canonical candidate/evidence fields are preserved; other raw fields are omitted.
// Discovery additionally requires genuine matching SIREN/SIRET and a city to create a prospect.
// TODO: injecter les vrais SIREN/SIRET depuis annuaire-entreprises avant utilisation en production
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AGENT1_CANDIDATE_BATCH_VERSION, validateAgent1CandidateBatch } from '../core/types/agent1-batch.ts';

export const AGENT1_BATCH_ENDPOINT = 'http://127.0.0.1:8787/api/agent1/batches';

const candidateFields = [
  'companyName', 'legalName', 'siren', 'siret', 'city', 'location', 'sourceUrl',
  'websiteUrl', 'activity', 'commercialSignal', 'digitalPresence', 'opportunity',
  'score', 'primaryFriction', 'primaryAsset', 'primaryCta', 'prototypeRecommendation', 'agent2Type',
];
const evidenceFields = ['url', 'note', 'supports', 'confidence', 'observedAt'];
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function cleanFields(value, fields) {
  return Object.fromEntries(fields.flatMap((field) => {
    const raw = value[field];
    if (raw === undefined || raw === null) return [];
    if (typeof raw === 'string') return raw.trim() ? [[field, raw.trim()]] : [];
    return [[field, raw]];
  }));
}

export function toAgent1Batch(input, now = new Date().toISOString()) {
  if (!record(input)) throw new Error('Input must be a JSON object.');
  const candidates = Array.isArray(input.candidates) ? input.candidates.map((raw) => {
    if (!record(raw)) return raw;
    const candidate = cleanFields(raw, candidateFields);
    candidate.evidence = Array.isArray(raw.evidence) ? raw.evidence.map((rawEvidence) => {
      if (!record(rawEvidence)) return rawEvidence;
      const evidence = cleanFields(rawEvidence, evidenceFields);
      if (Array.isArray(evidence.supports)) {
        evidence.supports = evidence.supports.map((value) => typeof value === 'string' ? value.trim() : value);
      }
      return evidence;
    }) : raw.evidence;
    return candidate;
  }) : input.candidates;
  const provenance = typeof input.provenance === 'string' ? input.provenance.trim() : input.provenance;
  // Do not include the generated timestamp: an unchanged file must retain its generated batch ID.
  const generatedId = `external-agent1-${createHash('sha256').update(JSON.stringify({ provenance, candidates, collectedAt: input.collectedAt ?? null })).digest('hex').slice(0, 24)}`;
  const batch = {
    schemaVersion: AGENT1_CANDIDATE_BATCH_VERSION,
    batchId: input.batchId === undefined ? generatedId : typeof input.batchId === 'string' ? input.batchId.trim() : input.batchId,
    provenance,
    collectedAt: input.collectedAt === undefined ? now : input.collectedAt,
    origin: 'manual',
    candidates,
  };
  const validation = validateAgent1CandidateBatch(batch);
  if (!validation.accepted) throw new Error(`Invalid batch:\n${validation.reasons.join('\n')}`);
  return batch;
}

export async function importAgent1Batch(filePath, { fetchImpl = globalThis.fetch, log = console.log } = {}) {
  const input = JSON.parse((await readFile(filePath, 'utf8')).replace(/^\uFEFF/, ''));
  const batch = toAgent1Batch(input);
  const response = await fetchImpl(AGENT1_BATCH_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: 'Bearer dev-api-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  log(`HTTP status: ${response.status}`);
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error('API response is not valid JSON.'); }
  const allExcluded = Array.isArray(payload?.decisions) && payload.decisions.length > 0 && payload.decisions.every((decision) => decision.decision === 'EXCLUDED');
  const outcome = response.ok && payload?.ok === true
    ? payload.duplicate === true ? 'duplicate' : allExcluded ? 'rejected' : 'accepted'
    : 'rejected';
  const createdCount = outcome === 'duplicate' ? 0 : Array.isArray(payload?.created) ? payload.created.length : 0;
  log(`Result: ${outcome}`);
  log(JSON.stringify(payload, null, 2));
  log(`Prospects created: ${createdCount}`);
  return { status: response.status, outcome, createdCount, payload };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/import-agent1-batch.mjs <input.json>');
    const result = await importAgent1Batch(resolve(process.argv[2]));
    if (result.outcome === 'rejected') process.exitCode = 1;
  } catch (error) {
    console.error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
