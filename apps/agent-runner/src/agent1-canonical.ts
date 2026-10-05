import {
  AGENT1_CANDIDATE_BATCH_VERSION,
  validateAgent1CandidateBatch,
  type Agent1CandidateBatch,
} from '@magicscript/core';

export function toCanonicalAgent1Batch(
  output: unknown,
  input: { batchId: string; provenance: string; collectedAt?: string },
): Agent1CandidateBatch {
  const raw = output && typeof output === 'object' && !Array.isArray(output)
    ? output as Record<string, unknown>
    : {};
  const sourceCandidates = Array.isArray(raw.candidates)
    ? raw.candidates
    : Array.isArray(raw.prospects)
      ? raw.prospects
      : [];
  const candidates = sourceCandidates.map((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate;
    const value = candidate as Record<string, unknown>;
    const sourceUrl = typeof value.sourceUrl === 'string' ? value.sourceUrl : '';
    const evidence = Array.isArray(value.evidence) && value.evidence.length > 0
      ? value.evidence
      : sourceUrl
        ? [{ url: sourceUrl, note: 'Agent 1 public discovery source; verification remains required by Research.', supports: ['companyName'] }]
        : [];
    return { ...value, evidence };
  });
  const batch: Agent1CandidateBatch = {
    schemaVersion: AGENT1_CANDIDATE_BATCH_VERSION,
    batchId: input.batchId,
    provenance: input.provenance,
    collectedAt: input.collectedAt ?? new Date().toISOString(),
    origin: 'runtime',
    candidates: candidates as Agent1CandidateBatch['candidates'],
  };
  const validation = validateAgent1CandidateBatch(batch);
  if (!validation.accepted) {
    throw new Error(`Agent 1 canonical batch invalid: ${validation.reasons.join('; ')}`);
  }
  return batch;
}
