/**
 * MAGIC SCRIPT — EXPERIMENT MANAGER V1
 *
 * Dogfood seeding: READ-ONLY / OBSERVATION records from real operational
 * lessons. These prove the ledger can represent real operational learning.
 *
 * No experiment outcomes are fabricated.
 */

import { proposeExperiment, type ExperimentProvenance } from './experiment-manager';

function seedLesson(input: {
  observation: string;
  hypothesis: string;
  targetModule: string;
  baselineEvidenceRefs: string[];
  proposedChangeSummary: string;
  evaluationPlan: string;
  metricNames: string[];
  beforeMetrics: Record<string, number>;
  provenance: ExperimentProvenance;
  changeTarget: string;
  reviewerRequired: boolean;
  rollbackPlan: string;
}): void {
  // Register in the global ledger
  proposeExperiment(input);
}

/**
 * Seed all canonical observational experiments.
 * Safe to call multiple times — uses the exported API, not internal state.
 */
export function seedDogfoodExperiments(): void {
  // ============================================================
  // OBSERVATION: CONTROLLED-OPS-02 — weak prospect selection / zero sources
  // ============================================================
  seedLesson({
    observation:
      'CONTROLLED-OPS-02 prospect MICHEL BES had no discoverable official website, ' +
      'no contact page, and zero accepted evidence sources. The evidence-integrity gate ' +
      'correctly produced MISSING_ACCEPTED_SOURCES. Root cause was weak prospect selection: ' +
      'the prospect had no digital surface to analyze.',
    hypothesis:
      'Strengthen the DISCOVERY stage to require at least one verifiable digital asset ' +
      '(website URL, directory listing, or social presence) before a prospect enters RESEARCHING.',
    targetModule: 'core/orchestrator/next-action.ts',
    baselineEvidenceRefs: [
      'CONTROLLED-OPS-02',
      'B-PROSPECT-SELECTION-TOO-WEAK',
      'project/PROJECT_STATE.json:checkpoints/CP-0028-CANARY2',
    ],
    proposedChangeSummary:
      'Add a minimum digital-presence gate in the DISCOVERED→RESEARCHING transition: ' +
      'reject prospects that have neither websiteUrl nor at least one accepted source.',
    evaluationPlan:
      'Run CONTROLLED-OPS-02-style prospect through the new gate; verify it is ' +
      'rejected at transition rather than at evidence-integrity. Verify a prospect with ' +
      'only a websiteUrl (no sources yet) still passes to RESEARCHING.',
    metricNames: [
      'prospects_blocked_early',
      'prospects_reaching_research',
      'evidence_integrity_pass_rate',
    ],
    beforeMetrics: {
      prospects_blocked_early: 0,
      prospects_reaching_research: 100,
      evidence_integrity_pass_rate: 33,
    },
    provenance: 'OPERATIONAL_LESSON',
    changeTarget: 'core/orchestrator/next-action.ts',
    reviewerRequired: true,
    rollbackPlan:
      'Remove the digital-presence predicate from the DISCOVERED→RESEARCHING transition.',
  });

  // ============================================================
  // OBSERVATION: CONTROLLED-OPS-03 / CORAIL — provider evidence normalization asymmetry
  // ============================================================
  seedLesson({
    observation:
      'CONTROLLED-OPS-03 (CORAIL) revealed that the Ollama/Aider research provider path ' +
      'applies normalizeResearchResult (including phone-to-source-note injection) while the ' +
      'Kimi path returns parseJsonOutput(raw) directly without normalization. This asymmetry ' +
      'means provider output semantics differ: Ollama/Aider produces source notes with ' +
      'injected phone digits; Kimi does not. Additionally, the phone-to-source-note injection ' +
      'is a circular self-attestation vulnerability: the model claim becomes its own evidence.',
    hypothesis:
      'All RUN_RESEARCH_SWARM providers should pass through the same structural normalization. ' +
      'Phone-to-source-note injection should be removed entirely and replaced with a ' +
      'deterministic derivedClaims path for phone trust.',
    targetModule: 'apps/agent-runner/src/index.ts',
    baselineEvidenceRefs: [
      'CONTROLLED-OPS-03',
      'CORAIL research output',
      'B-PROVIDER-EVIDENCE-PARITY',
    ],
    proposedChangeSummary:
      'Apply normalizeResearchResult to the Kimi RUN_RESEARCH_SWARM output path; ' +
      'remove phone-to-source-note injection from normalizeResearchResult; ' +
      'add deterministic phone claim to deriveEvidenceClaims in the API worker.',
    evaluationPlan:
      'Typecheck all modules; run evidence-integrity tests; verify CORAIL-style ' +
      'fixture does not produce trustedPhone from model-only phone.',
    metricNames: [
      'provider_paths_normalized',
      'phone_self_attestation_vulnerable_paths',
    ],
    beforeMetrics: {
      provider_paths_normalized: 0,
      phone_self_attestation_vulnerable_paths: 1,
    },
    provenance: 'AUDIT_FINDING',
    changeTarget: 'core/research/evidence-integrity.ts',
    reviewerRequired: true,
    rollbackPlan:
      'Revert the phone-to-source-note injection removal; revert evidence-integrity.ts ' +
      'to note-digit-based phone trust; remove derived phone claim from deriveEvidenceClaims.',
  });

  // ============================================================
  // OBSERVATION: CORAIL — model claim vs source evidence distinction
  // ============================================================
  seedLesson({
    observation:
      'CORAIL persisted research output contains phone="06 12 34 56 78" with ' +
      'phoneSourceUrl="https://www.corail.fr/contact". This value appears to be a ' +
      'placeholder/example number (sequential digits, common test pattern). It flowed ' +
      'into the system as a model claim. If normalizeResearchResult had executed on the ' +
      'Kimi path, this placeholder would have been injected into the source note and ' +
      'accepted as trustedPhone by the evidence-integrity gate. This demonstrates the ' +
      'fundamental invariance violation: MODEL CLAIM != SOURCE EVIDENCE.',
    hypothesis:
      'No LLM-emitted fact value should be accepted as evidence unless a deterministic ' +
      'pipeline can independently verify it. Phone trust must require derivedClaims ' +
      'rather than matching digits in an LLM-authored note.',
    targetModule: 'core/research/evidence-integrity.ts',
    baselineEvidenceRefs: [
      'CORAIL research output',
      'project/PROJECT_STATE.json:checkpoints/H-0036-EVIDENCE-SECURITY-FIX',
    ],
    proposedChangeSummary:
      'Enforce the global invariant: evaluateResearchPhoneEvidenceIntegrity must NOT ' +
      'accept phone solely because source note digits match. Require derivedClaims ' +
      'that declare phone trust as a deterministic derivation signal.',
    evaluationPlan:
      'Placeholder phone ("06 12 34 56 78") must not become trustedPhone. ' +
      'Legitimately-derived phone (via derivedClaims) must become trustedPhone.',
    metricNames: [
      'placeholder_phone_accepted_count',
      'phone_trust_rate',
    ],
    beforeMetrics: {
      placeholder_phone_accepted_count: 1,
      phone_trust_rate: 0,
    },
    provenance: 'AUDIT_FINDING',
    changeTarget: 'core/research/evidence-integrity.ts',
    reviewerRequired: true,
    rollbackPlan:
      'Restore note-digit-based phone acceptance in evaluateResearchPhoneEvidenceIntegrity.',
  });
}