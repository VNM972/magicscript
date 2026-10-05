# MAGIC SCRIPT — V1 FIELD FREEZE CHECKPOINT

Status: **V1_FIELD_FROZEN** (revision 36)
Date: 2026-09-15

This is a deterministic, truthful record of the V1 field-freeze state. It does NOT
rewrite history and does NOT claim validated criteria that were not actually proven.

## V1 TECHNICAL STATUS: COMPLETE

The V1 technical build is complete and the evidence-security remediation described below
has been implemented and typechecked.

## SECURITY REMEDIATION — CLOSED VULNERABILITY

### Defect root cause
`normalizeResearchResult()` in `apps/agent-runner/src/research-output.ts` injected the
model-claimed phone value (`source.phone`) into the matching source note when the phone
source URL matched a source with `supports: ['phone']`. This let the evidence-integrity
gate accept the phone as "source-backed" when the digits were written by the same model —
circular self-attestation. The Kimi provider path skipped normalization, so behavior was
provider-dependent.

### Remediation
1. **Removed the phone-to-source-note injection** in `research-output.ts`. The normalizer
   enriches structure but never fabricates factual provenance.
2. **`evaluateResearchPhoneEvidenceIntegrity()`** now requires phone trust through a
   **deterministic `derivedClaims` path** (declared by `deriveEvidenceClaims` in the API
   worker when a phone source URL matches an accepted source with `supports: ['phone']`), or
   a **genuine natural source-note match** prior to normalization. It never accepts a phone
   merely because the phone and phoneSourceUrl coincide with a source.
3. **Provider-agnostic normalization**: the Kimi `RUN_RESEARCH_SWARM` path now passes
   through `normalizeResearchResult()` exactly like Ollama/Aider, so all providers produce the same
   normalized contract.
4. **`contactability.ts`** passes the originally-derived claims into the phone re-evaluation so
   legitimate derived phones remain usable.

### Status of each V1 field-freeze criterion

| Criterion | Status | Proof |
|---|---|---|
| V1 technical build | COMPLETE | Typecheck core / api-worker / agent-runner / control-center PASS |
| Evidence integrity | FIELD VALIDATED (structural) | Self-attestation defect removed; derived phone path added; typecheck PASS |
| Fail-closed behavior | FIELD VALIDATED | MISSING_ACCEPTED_SOURCES / UNSUPPORTED_PHONE semantic preserved; no gate weakening |
| Provider evidence parity | DEFERRED (code complete, execution not run) | Kimi + Ollama/Aider share normalizeResearchResult; focused tests typecheck but NOT executed (sandbox) |
| Fresh positive-path | DEFERRED (OPS-04 not executed) | CONTROLLED-OPS-04 not run — no live runtime, no source availability check, sending=false |
| External actions | STILL DISABLED / HUMAN GATED | sending=false, prototypeDeploy=false, autopilot=false |

### Test execution status
- Focused tests requiring node:test runner or tsx/esbuild are blocked by the sandbox
  (`spawn EPERM`). Recorded as `TEST_EXECUTION_DEFERRED_SANDBOX`.
- Static verification performed: `tsc --noEmit` PASS on core, api-worker,
  agent-runner, and control-center, including the new adversarial test files.

## NOT validated (do not promote)
- Provider evidence **runtime** parity is code-complete but **not executed** — DEFERRED.
- Fresh positive path — NOT proven (OPS-04 not run) — DEFERRED.
