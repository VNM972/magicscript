import type { ResearchScoreKey, ResearchEvidenceClaim } from './evidence-integrity';

export interface EvidenceCalibrationInput {
  /** The raw LLM-produced score inputs (clamped [0,100]). */
  rawScores: Record<ResearchScoreKey, number>;
  /** Which score claims are source-supported (via source annotations or deterministic derivation). */
  supportedClaims: readonly ResearchEvidenceClaim[];
  /** Whether a trusted phone was verified through the official contact page. */
  hasTrustedPhone: boolean;
  /** Whether the official website URL was verified. */
  hasTrustedWebsite: boolean;
  /** How many accepted, non-rejected sources contribute to this prospect. */
  acceptedSourceCount: number;
  /** The site status observed by the research swarm, if any. */
  siteStatus?: string;
  /** Whether source navigation blocks (multiple pages) were observed. */
  hasNavigationBlocks: boolean;
  /** Whether the prospect passed discovery eligibility (non-REJECT). */
  isEligible: boolean;
  /** Whether a source supports the activity claim. */
  hasSupportedActivity: boolean;
}

export interface EvidenceCalibrationCaps {
  digitalGap: number;
  commercialStrength: number;
  contactability: number;
  localFit: number;
  prototypeLeverage: number;
  confidence: number;
}

/**
 * Deterministic evidence-based cap for each score dimension.
 *
 * Each cap is derived entirely from source-backed factual features that are
 * auditable and explainable. The model may emit any value [0,100], but the
 * capped value min(raw, cap) is what reaches scoreProspect.
 *
 * Design principles:
 * - A claim that is NOT supportable at all gets cap 0 (already handled by
 *   evidence-integrity gate, but the cap reinforces it).
 * - A claim with weak evidence gets a moderate cap (e.g. 55).
 * - A claim with strong, multi-fact evidence gets a high but responsible cap.
 * - No dimension can reach 100 without very strong factual evidence.
 * - UNDER_CONSTRUCTION / REBUILDING are treated as explicit high-evidence signals
 *   for digitalGap and prototypeLeverage only.
 */
export function computeEvidenceCaps(input: EvidenceCalibrationInput): EvidenceCalibrationCaps {
  const caps: EvidenceCalibrationCaps = {
    digitalGap: computeDigitalGapCap(input),
    commercialStrength: computeCommercialStrengthCap(input),
    contactability: computeContactabilityCap(input),
    localFit: computeLocalFitCap(input),
    prototypeLeverage: computePrototypeLeverageCap(input),
    confidence: computeConfidenceCap(input),
  };
  return caps;
}

function computeDigitalGapCap(input: EvidenceCalibrationInput): number {
  // UNDER_CONSTRUCTION or REBUILDING: explicit, observable digital gap → high cap
  if (input.siteStatus === 'UNDER_CONSTRUCTION' || input.siteStatus === 'REBUILDING') {
    return 90;
  }
  // Trusted website + navigation blocks + eligibility → real business, moderate-high gap
  if (input.hasTrustedWebsite && input.isEligible && input.hasNavigationBlocks) {
    return 80;
  }
  // Trusted website + eligible → real business, moderate gap
  if (input.hasTrustedWebsite && input.isEligible) {
    return 70;
  }
  // Trusted website only → potential gap
  if (input.hasTrustedWebsite) {
    return 60;
  }
  // Only accepted sources → minimal observed evidence
  if (input.acceptedSourceCount > 0) {
    return 40;
  }
  return 0;
}

function computeCommercialStrengthCap(input: EvidenceCalibrationInput): number {
  // Source-backed activity claim + trusted website + eligibility →
  // the business is an active, local commercial entity.
  if (input.hasSupportedActivity && input.hasTrustedWebsite && input.isEligible) {
    // Further strength from navigation blocks (multi-page) + multiple sources
    if (input.hasNavigationBlocks && input.acceptedSourceCount >= 2) {
      return 85;
    }
    return 70;
  }
  // Some evidence but not the full picture
  if (input.hasSupportedActivity || (input.hasTrustedWebsite && input.isEligible)) {
    return 50;
  }
  return 0;
}

function computeContactabilityCap(input: EvidenceCalibrationInput): number {
  // Verified official phone → strong contactability signal
  if (input.hasTrustedPhone) {
    return 85;
  }
  // Google maps-type directory is medium signal. We have none of that yet,
  // so without a verified phone the cap remains moderate.
  return 0;
}

function computeLocalFitCap(input: EvidenceCalibrationInput): number {
  // Eligible (passed discovery) + trusted website → confirmed local business
  // serving the target market.
  if (input.isEligible && input.hasTrustedWebsite) {
    // Navigation blocks suggest a local business actively updating its site
    if (input.hasNavigationBlocks) {
      return 80;
    }
    return 70;
  }
  // Eligible alone
  if (input.isEligible) {
    return 60;
  }
  return 0;
}

function computePrototypeLeverageCap(input: EvidenceCalibrationInput): number {
  // UNDER_CONSTRUCTION / REBUILDING: explicit need for a new site
  if (input.siteStatus === 'UNDER_CONSTRUCTION' || input.siteStatus === 'REBUILDING') {
    return 90;
  }
  // Trusted website + navigation blocks + eligibility → real business site
  // that the prototype can improve upon.
  if (input.hasTrustedWebsite && input.isEligible && input.hasNavigationBlocks) {
    return 80;
  }
  // Trusted website + eligibility → potential for prototype leverage
  if (input.hasTrustedWebsite && input.isEligible) {
    return 65;
  }
  // Trusted website only
  if (input.hasTrustedWebsite) {
    return 50;
  }
  return 0;
}

function computeConfidenceCap(input: EvidenceCalibrationInput): number {
  // Strong signals across multiple dimensions
  let evidenceCount = 0;
  if (input.hasTrustedPhone) evidenceCount++;
  if (input.hasTrustedWebsite) evidenceCount++;
  if (input.hasNavigationBlocks) evidenceCount++;
  if (input.hasSupportedActivity) evidenceCount++;
  if (input.isEligible) evidenceCount++;

  if (evidenceCount >= 4) return 90;
  if (evidenceCount >= 3) return 80;
  if (evidenceCount >= 2) return 70;
  if (evidenceCount >= 1) return 55;
  return 0;
}

/**
 * Apply evidence-based caps to raw scores.
 * Returns new score inputs where each dimension = min(rawScore, cap).
 */
export function calibrateScoreInputs(
  rawScores: Record<ResearchScoreKey, number>,
  caps: EvidenceCalibrationCaps,
): Record<ResearchScoreKey, number> {
  return {
    digitalGap: Math.round(Math.min(rawScores.digitalGap ?? 0, caps.digitalGap)),
    commercialStrength: Math.round(Math.min(rawScores.commercialStrength ?? 0, caps.commercialStrength)),
    contactability: Math.round(Math.min(rawScores.contactability ?? 0, caps.contactability)),
    localFit: Math.round(Math.min(rawScores.localFit ?? 0, caps.localFit)),
    prototypeLeverage: Math.round(Math.min(rawScores.prototypeLeverage ?? 0, caps.prototypeLeverage)),
    confidence: Math.round(Math.min(rawScores.confidence ?? 0, caps.confidence)),
  };
}