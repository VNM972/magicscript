export const AGENT1_CANDIDATE_BATCH_VERSION = 'AGENT1_CANDIDATE_BATCH_V1' as const;

export type Agent1BatchOrigin = 'runtime' | 'manual';

export interface Agent1Evidence {
  url: string;
  note: string;
  supports: readonly string[];
  confidence?: number;
  observedAt?: string;
}

export interface Agent1Candidate {
  companyName: string;
  legalName?: string;
  siren?: string;
  siret?: string;
  city?: string;
  location?: string;
  sourceUrl: string;
  websiteUrl?: string;
  activity?: string;
  commercialSignal?: string;
  digitalPresence?: string;
  opportunity?: 'A' | 'B' | 'C' | 'D';
  score?: number;
  primaryFriction?: string;
  primaryAsset?: string;
  primaryCta?: string;
  prototypeRecommendation?: string;
  agent2Type?: string;
  evidence: readonly Agent1Evidence[];
}

export interface Agent1CandidateBatch {
  schemaVersion: typeof AGENT1_CANDIDATE_BATCH_VERSION;
  batchId: string;
  provenance: string;
  collectedAt: string;
  origin: Agent1BatchOrigin;
  candidates: readonly Agent1Candidate[];
}

export interface Agent1BatchValidation {
  accepted: boolean;
  reasons: readonly string[];
}

const httpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const date = (value: unknown): value is string =>
  text(value) && !Number.isNaN(Date.parse(value));

export function validateAgent1CandidateBatch(value: unknown): Agent1BatchValidation {
  const reasons: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { accepted: false, reasons: ['batch must be an object'] };
  }
  const batch = value as Record<string, unknown>;
  if (batch.schemaVersion !== AGENT1_CANDIDATE_BATCH_VERSION) reasons.push(`schemaVersion must be ${AGENT1_CANDIDATE_BATCH_VERSION}`);
  if (!text(batch.batchId)) reasons.push('batchId is required');
  if (!text(batch.provenance)) reasons.push('provenance is required');
  if (!date(batch.collectedAt)) reasons.push('collectedAt must be an ISO date');
  if (batch.origin !== 'runtime' && batch.origin !== 'manual') reasons.push('origin must be runtime or manual');
  if (!Array.isArray(batch.candidates) || batch.candidates.length === 0) {
    reasons.push('candidates must be a non-empty array');
  } else if (batch.candidates.length > 50) {
    reasons.push('candidates must contain at most 50 entries');
  } else {
    batch.candidates.forEach((raw, index) => {
      const prefix = `candidates[${index}]`;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        reasons.push(`${prefix} must be an object`);
        return;
      }
      const candidate = raw as Record<string, unknown>;
      if (!text(candidate.companyName)) reasons.push(`${prefix}.companyName is required`);
      if (!httpUrl(candidate.sourceUrl)) reasons.push(`${prefix}.sourceUrl must be HTTP(S)`);
      if (candidate.siren !== undefined && (!text(candidate.siren) || !/^\d{9}$/.test(candidate.siren))) reasons.push(`${prefix}.siren must be 9 digits when supplied`);
      if (candidate.siret !== undefined && (!text(candidate.siret) || !/^\d{14}$/.test(candidate.siret))) reasons.push(`${prefix}.siret must be 14 digits when supplied`);
      if (text(candidate.siren) && text(candidate.siret) && !candidate.siret.startsWith(candidate.siren)) reasons.push(`${prefix}.siret must start with siren`);
      if (candidate.websiteUrl !== undefined && !httpUrl(candidate.websiteUrl)) reasons.push(`${prefix}.websiteUrl must be HTTP(S)`);
      if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0 || candidate.evidence.length > 20) {
        reasons.push(`${prefix}.evidence must contain 1-20 entries`);
      } else {
        candidate.evidence.forEach((entry, evidenceIndex) => {
          const ep = `${prefix}.evidence[${evidenceIndex}]`;
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { reasons.push(`${ep} must be an object`); return; }
          const evidence = entry as Record<string, unknown>;
          if (!httpUrl(evidence.url)) reasons.push(`${ep}.url must be HTTP(S)`);
          if (!text(evidence.note)) reasons.push(`${ep}.note is required`);
          if (!Array.isArray(evidence.supports) || evidence.supports.length === 0 || evidence.supports.length > 20 || !evidence.supports.every(text)) reasons.push(`${ep}.supports must be a non-empty text array`);
          if (evidence.confidence !== undefined && (typeof evidence.confidence !== 'number' || evidence.confidence < 0 || evidence.confidence > 100)) reasons.push(`${ep}.confidence must be between 0 and 100`);
          if (evidence.observedAt !== undefined && !date(evidence.observedAt)) reasons.push(`${ep}.observedAt must be an ISO date`);
        });
      }
      if (candidate.score !== undefined && (typeof candidate.score !== 'number' || !Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 100)) reasons.push(`${prefix}.score must be between 0 and 100`);
      if (candidate.opportunity !== undefined && !['A', 'B', 'C', 'D'].includes(String(candidate.opportunity))) reasons.push(`${prefix}.opportunity must be A, B, C or D`);
    });
  }
  return { accepted: reasons.length === 0, reasons };
}
