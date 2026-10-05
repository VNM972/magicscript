import test from 'node:test';
import assert from 'node:assert/strict';

import { computeEvidenceCaps, calibrateScoreInputs } from '../research/evidence-calibration';
import { scoreProspect } from '../scoring/prospect-score';

const FULL_RAW = {
  digitalGap: 95,
  commercialStrength: 95,
  contactability: 95,
  localFit: 95,
  prototypeLeverage: 95,
  confidence: 95,
};

test('weak evidence caps all dimensions so extreme model scores cannot pass', () => {
  const caps = computeEvidenceCaps({
    rawScores: FULL_RAW,
    supportedClaims: [],
    hasTrustedPhone: false,
    hasTrustedWebsite: false,
    acceptedSourceCount: 0,
    hasNavigationBlocks: false,
    isEligible: false,
    hasSupportedActivity: false,
  });
  assert.equal(caps.commercialStrength, 0);
  assert.equal(caps.contactability, 0);
  assert.equal(caps.localFit, 0);
  assert.equal(caps.digitalGap, 0);
  assert.equal(caps.prototypeLeverage, 0);
  assert.equal(caps.confidence, 0);

  const calibrated = calibrateScoreInputs(FULL_RAW, caps);
  const scoring = scoreProspect(calibrated);
  // With no evidence whatever, a model dumping 95 everywhere gets a zero score
  assert.equal(scoring.score, 0);
  assert.equal(scoring.band, 'LOW');
});

test('model cannot achieve high qualification with only a trusted website and no commercial/local evidence', () => {
  const caps = computeEvidenceCaps({
    rawScores: FULL_RAW,
    supportedClaims: ['website'],
    hasTrustedPhone: false,
    hasTrustedWebsite: true,
    acceptedSourceCount: 1,
    hasNavigationBlocks: false,
    isEligible: false,
    hasSupportedActivity: false,
  });
  const calibrated = calibrateScoreInputs(FULL_RAW, caps);
  // digitalGap moderate, prototypeLeverage moderate, but commercial/contact/local = 0
  assert.equal(calibrated.commercialStrength, 0);
  assert.equal(calibrated.contactability, 0);
  assert.equal(calibrated.localFit, 0);
  const scoring = scoreProspect(calibrated);
  assert.ok(scoring.score < 85, `score ${scoring.score} must stay below PRIORITY band (85)`);
});

test('full legitimate evidence allows high but capped score and preserves positive-path reachability', () => {
  const caps = computeEvidenceCaps({
    rawScores: FULL_RAW,
    supportedClaims: ['digitalGap', 'commercialStrength', 'contactability', 'localFit', 'prototypeLeverage'],
    hasTrustedPhone: true,
    hasTrustedWebsite: true,
    acceptedSourceCount: 3,
    hasNavigationBlocks: true,
    isEligible: true,
    hasSupportedActivity: true,
  });
  const calibrated = calibrateScoreInputs(FULL_RAW, caps);
  // Even a model claiming 95 across the board is capped to responsible values,
  // but the prospect remains genuinely high-value and reachable.
  assert.ok(calibrated.digitalGap > 0);
  assert.ok(calibrated.prototypeLeverage > 0);
  assert.ok(calibrated.contactability > 0);
  assert.ok(calibrated.commercialStrength > 0);
  assert.ok(calibrated.localFit > 0);
  const scoring = scoreProspect(calibrated);
  assert.ok(scoring.score >= 65, `score ${scoring.score} must clear the 65 qualifier with full evidence`);
});

test('UNDER_CONSTRUCTION / REBUILDING grant digitalGap and prototypeLeverage but NOT commercialStrength or localFit', () => {
  for (const siteStatus of ['UNDER_CONSTRUCTION', 'REBUILDING']) {
    const caps = computeEvidenceCaps({
      rawScores: FULL_RAW,
      supportedClaims: ['digitalGap', 'prototypeLeverage'],
      hasTrustedPhone: false,
      hasTrustedWebsite: true,
      acceptedSourceCount: 2,
      hasNavigationBlocks: true,
      isEligible: false,
      hasSupportedActivity: false,
      siteStatus,
    });
    assert.ok(caps.digitalGap > 0, `${siteStatus} should grant digitalGap cap`);
    assert.ok(caps.prototypeLeverage > 0, `${siteStatus} should grant prototypeLeverage cap`);
    assert.equal(caps.commercialStrength, 0, `${siteStatus} must NOT grant commercialStrength`);
    assert.equal(caps.localFit, 0, `${siteStatus} must NOT grant localFit`);
  }
});

test('PARKED and DOMAIN_FOR_SALE must NOT grant rebuild-intent digitalGap/prototypeLeverage caps', () => {
  for (const siteStatus of ['PARKED', 'DOMAIN_FOR_SALE', 'UNREACHABLE']) {
    // Parked/for-sale/unreachable domains have no functioning site, so
    // hasTrustedWebsite is false — no digitalGap or prototypeLeverage at all.
    const caps = computeEvidenceCaps({
      rawScores: FULL_RAW,
      supportedClaims: [],
      hasTrustedPhone: false,
      hasTrustedWebsite: false,
      acceptedSourceCount: 0,
      hasNavigationBlocks: false,
      isEligible: false,
      hasSupportedActivity: false,
      siteStatus,
    });
    assert.equal(caps.digitalGap, 0, `${siteStatus} must NOT grant digitalGap cap`);
    assert.equal(caps.prototypeLeverage, 0, `${siteStatus} must NOT grant prototypeLeverage cap`);
    assert.equal(caps.commercialStrength, 0);
    assert.equal(caps.localFit, 0);
  }
});

test('capped score never exceeds the raw score', () => {
  const caps = computeEvidenceCaps({
    rawScores: { digitalGap: 30, commercialStrength: 40, contactability: 50, localFit: 60, prototypeLeverage: 70, confidence: 20 },
    supportedClaims: ['digitalGap', 'commercialStrength', 'contactability', 'localFit', 'prototypeLeverage'],
    hasTrustedPhone: true,
    hasTrustedWebsite: true,
    acceptedSourceCount: 3,
    hasNavigationBlocks: true,
    isEligible: true,
    hasSupportedActivity: true,
  });
  const calibrated = calibrateScoreInputs({ digitalGap: 30, commercialStrength: 40, contactability: 50, localFit: 60, prototypeLeverage: 70, confidence: 20 }, caps);
  // min(raw, cap) never exceeds raw
  assert.equal(calibrated.digitalGap, 30);
  assert.equal(calibrated.commercialStrength, 40);
  assert.equal(calibrated.contactability, 50);
});

test('CALIBRATION_LAYER_CAPS_CONTACTABILITY_AT_85_WHEN_TRUSTED_PHONE_EXISTS — min(raw, cap) respects cap', () => {
  // The calibration layer itself does NOT rehydrate; it only applies min(raw, cap).
  // Rehydration (setting raw to cap value when trustedPhone exists) happens in processResearchResult.
  // This test verifies the calibration layer correctly caps at 85 when hasTrustedPhone=true.
  const caps = computeEvidenceCaps({
    rawScores: { digitalGap: 70, commercialStrength: 75, contactability: 95, localFit: 70, prototypeLeverage: 65, confidence: 80 },
    supportedClaims: ['digitalGap', 'commercialStrength', 'contactability', 'localFit', 'prototypeLeverage'],
    hasTrustedPhone: true,
    hasTrustedWebsite: true,
    acceptedSourceCount: 3,
    hasNavigationBlocks: true,
    isEligible: true,
    hasSupportedActivity: true,
  });
  assert.equal(caps.contactability, 85, 'cap must be 85 when hasTrustedPhone=true');
  
  // If raw score >= cap, calibrated = cap
  const calibratedHigh = calibrateScoreInputs({ digitalGap: 70, commercialStrength: 75, contactability: 100, localFit: 70, prototypeLeverage: 65, confidence: 80 }, caps);
  assert.equal(calibratedHigh.contactability, 85, 'calibrated contactability must not exceed cap');
  
  // If raw score < cap, calibrated = raw (but rehydration in processResearchResult sets raw = 85)
  const calibratedLow = calibrateScoreInputs({ digitalGap: 70, commercialStrength: 75, contactability: 50, localFit: 70, prototypeLeverage: 65, confidence: 80 }, caps);
  assert.equal(calibratedLow.contactability, 50, 'calibrated contactability = raw when raw < cap');
});

test('CALIBRATION_LAYER_NO_TRUSTED_PHONE_CAP_ZERO — without trustedPhone, cap is 0', () => {
  const caps = computeEvidenceCaps({
    rawScores: FULL_RAW,
    supportedClaims: ['digitalGap', 'commercialStrength', 'localFit', 'prototypeLeverage', 'contactability'],
    hasTrustedPhone: false,
    hasTrustedWebsite: true,
    acceptedSourceCount: 3,
    hasNavigationBlocks: true,
    isEligible: true,
    hasSupportedActivity: true,
  });
  assert.equal(caps.contactability, 0, 'cap must be 0 without trustedPhone');
  const calibrated = calibrateScoreInputs(FULL_RAW, caps);
  assert.equal(calibrated.contactability, 0, 'calibrated contactability must be 0 when cap is 0');
});

test('NO_TRUSTED_CONTACT_EVIDENCE_ZERO — without trustedPhone, contactability stays 0 even with supported claim', () => {
  const caps = computeEvidenceCaps({
    rawScores: FULL_RAW,
    supportedClaims: ['digitalGap', 'commercialStrength', 'localFit', 'prototypeLeverage', 'contactability'], // claim supported but no trustedPhone
    hasTrustedPhone: false,
    hasTrustedWebsite: true,
    acceptedSourceCount: 3,
    hasNavigationBlocks: true,
    isEligible: true,
    hasSupportedActivity: true,
  });
  // Even if contactability claim is in supportedClaims, cap is 0 without trustedPhone
  assert.equal(caps.contactability, 0, 'contactability cap must be 0 without trustedPhone');
  const calibrated = calibrateScoreInputs(FULL_RAW, caps);
  assert.equal(calibrated.contactability, 0, 'calibrated contactability must be 0 without trustedPhone');
});

test('CONTACTABILITY_CAP_STILL_APPLIES — calibrated contactability cannot exceed evidence cap', () => {
  const caps = computeEvidenceCaps({
    rawScores: FULL_RAW,
    supportedClaims: ['digitalGap', 'commercialStrength', 'contactability', 'localFit', 'prototypeLeverage'],
    hasTrustedPhone: true,
    hasTrustedWebsite: true,
    acceptedSourceCount: 3,
    hasNavigationBlocks: true,
    isEligible: true,
    hasSupportedActivity: true,
  });
  // Cap is 85. If someone passed 100, min(100, 85) = 85
  const calibrated = calibrateScoreInputs({ ...FULL_RAW, contactability: 100 }, caps);
  assert.equal(calibrated.contactability, 85, 'calibrated contactability must not exceed cap');
});

test('EVIDENCE_INTEGRITY_FAIL_STILL_ZEROES_SCORING — failed evidence integrity forces all scores to 0 including contactability', () => {
  const caps = computeEvidenceCaps({
    rawScores: FULL_RAW,
    supportedClaims: ['digitalGap', 'commercialStrength', 'contactability', 'localFit', 'prototypeLeverage'],
    hasTrustedPhone: true,
    hasTrustedWebsite: true,
    acceptedSourceCount: 3,
    hasNavigationBlocks: true,
    isEligible: true,
    hasSupportedActivity: true,
  });
  // Simulate failed evidence integrity: calibration uses zero scores
  const zeroScores = { digitalGap: 0, commercialStrength: 0, contactability: 0, localFit: 0, prototypeLeverage: 0, confidence: 0 };
  const calibrated = calibrateScoreInputs(zeroScores, caps);
  assert.equal(calibrated.contactability, 0, 'contactability must be 0 when evidence integrity fails');
  const scoring = scoreProspect(calibrated);
  assert.equal(scoring.score, 0);
  assert.equal(scoring.band, 'LOW');
});

test('FULL_PIPELINE_WITH_REHYDRATION_REACHES_HIGH_BAND — when trustedPhone exists and all dims at cap, score = 83', () => {
  // This simulates the full pipeline: rehydration sets contactability=85, then calibration caps at evidence caps
  const caps = computeEvidenceCaps({
    rawScores: FULL_RAW,
    supportedClaims: ['digitalGap', 'commercialStrength', 'contactability', 'localFit', 'prototypeLeverage'],
    hasTrustedPhone: true,
    hasTrustedWebsite: true,
    acceptedSourceCount: 3,
    hasNavigationBlocks: true,
    isEligible: true,
    hasSupportedActivity: true,
  });
  // Caps with full evidence: digitalGap=80, commercialStrength=85, contactability=85, localFit=80, prototypeLeverage=80, confidence=90
  // Simulate rehydration: contactability set to cap value (85) before calibration
  const calibrated = calibrateScoreInputs({ ...FULL_RAW, contactability: 85 }, caps);
  const scoring = scoreProspect(calibrated);
  // Score = 80*0.25 + 85*0.20 + 85*0.15 + 80*0.10 + 80*0.20 + 90*0.10 = 20 + 17 + 12.75 + 8 + 16 + 9 = 82.75 → 83
  // This reaches HIGH band (>=70) but not PRIORITY (>=85)
  assert.equal(scoring.score, 83, 'full score with all dims at their caps should reach HIGH band');
  assert.equal(scoring.band, 'HIGH');
  // Verify contactability contributes 13 points (15% of 85)
  assert.ok(scoring.score >= 65, 'must clear 65 qualifier');
});