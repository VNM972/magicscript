export interface ProspectScoreInput {
  digitalGap: number;
  commercialStrength: number;
  contactability: number;
  localFit: number;
  prototypeLeverage: number;
  confidence: number;
}

export type ProspectScoreBand = 'LOW' | 'MEDIUM' | 'HIGH' | 'PRIORITY';

export interface ProspectScoreResult {
  score: number;
  band: ProspectScoreBand;
  autoPrototypeEligible: boolean;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function scoreProspect(input: ProspectScoreInput): ProspectScoreResult {
  const weighted =
    clamp(input.digitalGap) * 0.25 +
    clamp(input.commercialStrength) * 0.2 +
    clamp(input.contactability) * 0.15 +
    clamp(input.localFit) * 0.1 +
    clamp(input.prototypeLeverage) * 0.2 +
    clamp(input.confidence) * 0.1;

  const score = Math.round(weighted);

  const band: ProspectScoreBand =
    score >= 85 ? 'PRIORITY' :
    score >= 70 ? 'HIGH' :
    score >= 50 ? 'MEDIUM' :
    'LOW';

  return {
    score,
    band,
    autoPrototypeEligible:
      score >= 85 &&
      clamp(input.confidence) >= 75 &&
      clamp(input.prototypeLeverage) >= 70,
  };
}
