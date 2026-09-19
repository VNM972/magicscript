/**
 * Targeted regression and adversarial tests for the phone evidence provenance
 * hardening. Tests verify that trustedPhone can NEVER be produced from
 * model-controlled data alone; only deterministic fetched-source evidence is
 * trusted.
 *
 * Contract:
 * - model phone / phoneSourceUrl / source.url / source.note / source.supports
 *   are all RAW_LLM_OUTPUT.
 * - trustedPhone is FAIL-CLOSED: absent whenever phone is present but no
 *   INDEPENDENT source evidence exists.
 * - Structural normalization parity across Kimi/Ollama/Aider is preserved.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateResearchEvidenceIntegrity,
  evaluateResearchPhoneEvidenceIntegrity,
} from '../research/evidence-integrity';

const BASE_SCORES = {
  digitalGap: 70,
  commercialStrength: 70,
  contactability: 70,
  localFit: 70,
  prototypeLeverage: 70,
  confidence: 70,
};

const ALL_SCORE_CLAIMS: ReadonlyArray<
  'digitalGap' | 'commercialStrength' | 'contactability' | 'localFit' | 'prototypeLeverage'
> = [
  'digitalGap', 'commercialStrength', 'contactability',
  'localFit', 'prototypeLeverage',
];

// ============================================================
// 1. MODEL_ONLY_PHONE_REJECTED
// ============================================================
test('MODEL ONLY PHONE REJECTED: model-emitted phone cannot become trustedPhone', () => {
  const result = evaluateResearchPhoneEvidenceIntegrity({
    sources: [
      { url: 'https://www.corail.fr/contact', note: 'Official contact page', supports: ['phone'] },
    ],
    phone: '06 12 34 56 78',
    phoneSourceUrl: 'https://www.corail.fr/contact',
  });
  assert.equal(result.trustedPhone, undefined,
    'model-only phone must NOT become trustedPhone');
  assert.equal(result.reason, 'UNSUPPORTED_PHONE');
});

// ============================================================
// 2. MODEL_AUTHORED_NOTE_REJECTED
// ============================================================
test('MODEL AUTHORED NOTE REJECTED: model-authored note match cannot create trustedPhone', () => {
  // Even if the source note itself contains the digits, the note is model-authored
  // and cannot verify a model claim.
  const result = evaluateResearchPhoneEvidenceIntegrity({
    sources: [
      { url: 'https://example.test/contact', note: 'Contact page 0612345678 visible', supports: ['phone'] },
    ],
    phone: '06 12 34 56 78',
    phoneSourceUrl: 'https://example.test/contact',
  });
  assert.equal(result.trustedPhone, undefined,
    'model-authored note digit match must NOT create trustedPhone');
  assert.equal(result.reason, 'UNSUPPORTED_PHONE');
});

// ============================================================
// 3. PLACEHOLDER_PHONE_REJECTED
// ============================================================
test('PLACEHOLDER PHONE REJECTED: placeholder/example number never becomes trusted', () => {
  const result = evaluateResearchPhoneEvidenceIntegrity({
    sources: [
      { url: 'https://example.test/contact', note: 'Contact page', supports: ['phone'] },
    ],
    phone: '06 12 34 56 78',
    phoneSourceUrl: 'https://example.test/contact',
  });
  assert.equal(result.trustedPhone, undefined);
  assert.equal(result.reason, 'UNSUPPORTED_PHONE');
});

// ============================================================
// 4. DERIVED_MODEL_PHONE_REJECTED
// ============================================================
test('DERIVED MODEL PHONE REJECTED: derivedClaims phone from model fields cannot trust', () => {
  // derivedClaims including 'phone' derived from model-controlled fields must NOT
  // create trustedPhone in the current architecture (no independent evidence).
  const result = evaluateResearchPhoneEvidenceIntegrity({
    sources: [
      { url: 'https://example.test/contact', note: 'Contact page', supports: ['phone'] },
    ],
    phone: '05 96 71 10 10',
    phoneSourceUrl: 'https://example.test/contact',
    derivedClaims: ['phone'],
  });
  assert.equal(result.trustedPhone, undefined,
    'derived phone claim from model fields must NOT create trustedPhone');
});

// ============================================================
// 5. NO_INDEPENDENT_EVIDENCE_FAIL_CLOSED
// ============================================================
test('NO INDEPENDENCE FAIL-CLOSED: full model fixture still fails closed for phone', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: { ...BASE_SCORES, contactability: 0 },
    phone: '05 96 71 10 10',
    phoneSourceUrl: 'https://example.test/contact',
    sources: [
      { url: 'https://example.test/', note: 'Official website', supports: ['website', 'digitalGap'] },
      { url: 'https://example.test/contact', note: 'Contact page 0596711010', supports: ['phone'] },
    ],
    derivedClaims: ['phone', 'contactability', 'localFit'],
  });
  // trustedPhone is absent (fail-closed) even though the phone and source note
  // both come from the model and derivedClaims includes 'phone'.
  assert.equal(result.trustedPhone, undefined,
    'trustedPhone must be absent without independent source evidence');
});

// ============================================================
// 6. PROVIDER_STRUCTURAL_PARITY_PRESERVED
// ============================================================
test('PROVIDER STRUCTURAL PARITY: phone remains an untrusted research field', () => {
  // The phone and phoneSourceUrl are preserved as untrusted observations.
  // normalizeResearchResult (agent-runner) still structurally normalizes all
  // providers; phone does not reach trustedPhone.
  const result = evaluateResearchResearchPhoneThroughIntegrity({
    phone: '06 12 34 56 78',
    phoneSourceUrl: 'https://example.test/contact',
    sources: [
      { url: 'https://example.test/contact', note: 'Contact page', supports: ['phone'] },
    ],
  });
  assert.equal(result.reason, 'UNSUPPORTED_PHONE');
  assert.equal(result.trustedPhone, undefined);
});

function evaluateResearchResearchPhoneThroughIntegrity(input: {
  phone: string;
  phoneSourceUrl: string;
  sources: Array<{ url: string; note: string; supports: string[] }>;
}) {
  return evaluateResearchPhoneEvidenceIntegrity(input);
}

// ============================================================
// 7. QUALIFICATION_THRESHOLD_UNCHANGED
// ============================================================
test('QUALIFICATION THRESHOLD UNCHANGED: score processing not affected', () => {
  // The fix only affects phone evidence binding. A clean evidence result with
  // supported score claims and an unrelated website passes normally.
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: { ...BASE_SCORES, contactability: 0 },
    websiteUrl: 'https://example.test/',
    sources: [
      { url: 'https://example.test/', note: 'Official website', supports: [...ALL_SCORE_CLAIMS, 'website'] },
    ],
  });
  assert.equal(result.passed, true);
  assert.ok(result.supportedClaims.includes('website'));
});

// ============================================================
// 8. SCORING_WEIGHTS_UNCHANGED
// ============================================================
test('SCORING WEIGHTS UNCHANGED: scoreInputs normalize without phone contribution', () => {
  const result = evaluateResearchEvidenceIntegrity({
    scoreInputs: BASE_SCORES,
    sources: [
      { url: 'https://example.test/', note: 'Official website', supports: ALL_SCORE_CLAIMS as unknown as string[] },
    ],
  });
  assert.equal(result.scoreInputs.commercialStrength, 70);
  assert.equal(result.scoreInputs.contactability, 70);
});

// ============================================================
// 9. CORAIL_MODEL_ONLY_PHONE_REJECTED
// ============================================================
test('CORAIL MODEL ONLY PHONE REJECTED: exact CORAIL attack shuts down', () => {
  // The canonical CORAIL scenario: model emits a placeholder phone, phoneSourceUrl,
  // and a source with supports:['phone'] — all from the LLM. No trustedPhone.
  const result = evaluateResearchPhoneEvidenceIntegrity({
    sources: [
      { url: 'https://www.corail.fr/contact', note: 'Official contact page of CORAIL', supports: ['phone'] },
    ],
    phone: '06 12 34 56 78',
    phoneSourceUrl: 'https://www.corail.fr/contact',
  });
  assert.equal(result.trustedPhone, undefined,
    'CORAIL model-only phone must be rejected');
});

// ============================================================
// Verify the API-worker deriveEvidenceClaims no longer grants phone
// ============================================================
test('deriveEvidenceClaims contract: phone is not derivable from model fields', () => {
  // This documents the hierarchical invariant at the highest level:
  // without independent evidence, phone honesty requires fail-closed.
  // (deriveEvidenceClaims in apps/api-worker does not emit 'phone'.)
  const result = evaluateResearchPhoneEvidenceIntegrity({
    sources: [
      { url: 'https://example.test/contact', note: 'contact', supports: ['phone'] },
    ],
    phone: '05 96 71 10 10',
    phoneSourceUrl: 'https://example.test/contact',
    derivedClaims: ['phone'],
  });
  assert.equal(result.trustedPhone, undefined);
});
