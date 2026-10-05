# Google Places Orchestrator Integration V1

**Date:** 2026-09-16  
**Status:** `GOOGLE_PLACES_ORCHESTRATOR_INTEGRATION_V1_ACCEPTED`

---

## 1. Integration Architecture

The Google Places Structured Discovery Adapter V1 is integrated into the normal Magic Script prospect orchestration path via a single new module:

- **`core/orchestrator/google-discovery.ts`** — orchestrator-level integration with:
  - Configuration gate (`googlePlaces.enabled = false` by default)
  - Eligibility check (commercial classification, internal/synthetic/human-blocked exclusions)
  - Request budget enforcement
  - Branch signal normalization (BRANCH_MATCH / BRANCH_NOT_PROVEN / BRANCH_CONFLICT)
  - Discovered website → website candidate flow (no auto-owned-site)
  - Multi-phone preservation (no automatic conflict, no trust escalation)
  - Bounded telemetry (derived counters only, no raw Google content, no GKEY)
  - Pure function — no network, no D1, no side effects

The integration reuses `core/providers/google-places-discovery.ts` as the provider contract. The orchestrator does **not** duplicate Google request/identity/phone logic.

## 2. Disabled-Default Behavior

| Config | Env Variable | Default | Behavior |
|---|---|---|---|
| `googlePlacesEnabled` | `MAGICSCRIPT_GOOGLE_PLACES_ENABLED` | `false` | When false, all Google discovery requests are skipped with reason `GOOGLE_DISABLED` |

**Invariant:** When `googlePlacesEnabled = false`, exactly zero Google discovery requests are executed regardless of prospect eligibility, classification, or budget.

The config was added to `core/config.ts` with safe bool parsing (only `'true'` → `true`).

## 3. Execution Gates

All of the following gates must pass for a Google discovery request to execute:

1. **`googlePlacesEnabled = true`** — operator-controlled, false by default
2. **Not human-blocked** — `DO_NOT_CONTACT`, `HUMAN_ACTION_REQUIRED`
3. **Not internal** — `INTERNAL_RELATION`, `EXISTING_MAGIC_SCRIPT_ASSET`
4. **Not synthetic/technical** — synthetic or technical fixtures excluded
5. **Eligibility classification** — non-REJECT (HIGH_PRIORITY, RESEARCH, LOW_PRIORITY)
6. **Budget permits** — `usedRequests < maxRequests`

**Priority order:** disabled → humanBlocked → internal → synthetic → ineligible → budget.

## 4. Request Budget Behavior

| Aspect | Behavior |
|---|---|
| Budget type | Explicit `GoogleRequestBudget { maxRequests, usedRequests }` |
| Default disabled budget | `{ maxRequests: 0, usedRequests: 0 }` — permits zero requests |
| Enforcement | Budget check is the last gate; `BUDGET_EXCEEDED` when exhausted |
| Accounting is caller's responsibility | The pure function reports `budgetRemaining` in its decision; the orchestrator must increment `usedRequests` externally |
| Supports future canary | Budget can be set to any positive number without code changes |

## 5. Branch Normalization Behavior

The live adapter validation (V3 → Live) identified a semantic divergence: V3 used address-based branch matching while the live adapter uses strict website-domain matching. The integration normalizes this via `normalizeBranchVerdict()`:

| Provider Signal | Normalized Verdict | Rationale |
|---|---|---|
| Provider returns MATCH | `BRANCH_MATCH` | Identity + branch evidence compatible |
| Provider returns MISMATCH (website-domain) | `BRANCH_NOT_PROVEN` | Identity/address compatible, only website domain differs — NOT wrong branch |
| Provider returns UNKNOWN | `BRANCH_NOT_PROVEN` | No website available — branch not provable from this signal alone |
| Identity REJECTED / AMBIGUOUS | `NOT_EVALUATED` | No identity → branch evaluation not reached |

**Key invariant:** A website-domain MISMATCH after a VERIFIED identity is **never** automatically mapped to `WRONG_BRANCH`. This prevents six false wrong-branch claims that the conservative live adapter would otherwise suggest.

## 6. Website Candidate Flow

- Google returns a website → stored as `websiteDiscoveryCandidate: true`
- The candidate is explicitly **NOT** an automatically verified owned site
- The orchestrator must route it through the existing **owned-site identity verification** before marking it as `OWNED_SITE_VERIFIED`
- Google alone does not bypass ownership verification

## 7. Multi-Phone Behavior

| Requirement | Status |
|---|---|
| All legitimate entity-bound phone candidates coexist | ✅ Preserved |
| No forced single phone winner | ✅ Preserved |
| MOBILE prioritized before LANDLINE | ✅ Preserved (by phone-record.ts) |
| LANDLINE retained, not discarded | ✅ Preserved |
| Google phone candidates begin as UNVERIFIED | ✅ All `trustStatus: 'UNVERIFIED'` |
| DIFFERENT_VALID_NUMBER ≠ automatic PHONE_CONFLICT | ✅ Preserved |
| Trust remains per phone | ✅ Preserved |

## 8. Trusted-Phone Behavior

| Requirement | Status |
|---|---|
| Google alone NEVER creates trustedPhone | ✅ Statically enforced — `GooglePhoneCandidate.trustStatus` is literal `'UNVERIFIED'` |
| Google alone cannot set TRUSTED per-phone state | ✅ Only the Evidence Integrity path (`evaluateResearchPhoneEvidenceIntegrity`) can produce TRUSTED |
| No contactability=85 from Google alone | ✅ Contactability is a separate concern; orchestrator decision has no contactability field |
| No scoring mutation | ✅ Orchestrator decision has no scoring fields |
| No qualification mutation | ✅ Orchestrator decision has no qualification fields |
| No outreach enablement | ✅ Orchestrator decision has no outreach fields |

## 9. Contactability / Scoring Behavior

- **No Google bonus** — Google discovery does not add score increments
- **No phone count bonus** — Multiple phone candidates do not stack contactability
- **No mobile count bonus** — Multiple MOBILE candidates do not inflate scoring
- **No multiple-source bonus** — Provider availability is not a scoring signal
- **Contactability remains scalar** — The orchestrator decision exposes `phoneCandidateCount` but does not compute contactability

## 10. WhatsApp / Channel Behavior

- MOBILE does not imply WhatsApp (preserved from phone-record.ts)
- LANDLINE does not imply SMS/WhatsApp capability (preserved from phone-record.ts)
- Channel capability remains independently verified via the Evidence Integrity path
- The orchestrator integration does not change outreach routing

## 11. Idempotency

- `decideGoogleDiscovery` is a **pure function** — same inputs produce identical outputs
- Repeated calls with the same input produce identical verdicts (verified by `IDEMPOTENT_ORCHESTRATOR_REPROCESSING` test)
- No duplicate events (verified by `NO_DUPLICATE_EVENTS` test — 5 calls produce 1 unique serialized result)
- Duplicate phone candidates are handled by the existing `deduplicatePhones` in phone-record.ts
- Budget accounting is caller-managed; duplicate calls with unchanged budget do not double-count

## 12. Telemetry

| Event Name | Description |
|---|---|
| `google.orchestrator.eligible` | Prospect passed all eligibility gates |
| `google.orchestrator.skipped_disabled` | Skipped because Google Places disabled |
| `google.orchestrator.skipped_ineligible` | Skipped for non-disabled eligibility failure |
| `google.orchestrator.requested` | A Google request was decided (may or may not execute) |
| `google.orchestrator.executed` | Google request was executed |
| `google.orchestrator.budget_exceeded` | Request budget exhausted |
| `google.orchestrator.failed` | Execution failed |
| `google.orchestrator.identity_verified` | Identity was VERIFIED |
| `google.orchestrator.identity_ambiguous` | Identity was AMBIGUOUS |
| `google.orchestrator.identity_rejected` | Identity was REJECTED |
| `google.orchestrator.website_candidate` | Website discovery candidate available |
| `google.orchestrator.phone_candidates` | Phone candidates present (count in payload) |

**Safety:** Telemetry payloads contain only derived fields (verdicts, counts, hashes). Never raw phone numbers, raw Google responses, or GKEY.

## 13. API / Operator Visibility

| Aspect | How Exposed |
|---|---|
| Google discovery enabled/disabled | `config.googlePlacesEnabled` |
| Whether prospect was eligible | `isProspectEligibleForGoogleDiscovery()` |
| Skip reason | `skipReason` string in decision |
| Identity verdict | `discoveryResult.identityVerdict` |
| Website candidates | `websiteDiscoveryCandidate: boolean` + `discoveryResult.websiteCandidate` |
| Phone candidates | `phoneCandidateCount: number` + `discoveryResult.phoneCandidates` (trust/untrusted metadata only) |
| Request budget state | `budgetSummary()` returns `{ maxRequests, usedRequests, remainingRequests, exhausted }` |

No sensitive provider data (raw phone, raw response body, GKEY) is exposed.

## 14. Files Modified / Created

| File | Action | Description |
|---|---|---|
| `core/orchestrator/google-discovery.ts` | **Created** | Core orchestrator integration module |
| `core/config.ts` | **Modified** | Added `googlePlacesEnabled` boolean config field |
| `core/index.ts` | **Modified** | Added export for `orchestrator/google-discovery` |
| `core/tests/google-places-orchestrator.test.ts` | **Created** | 50 focused mocked integration tests |

## 15. Tests

### Test Results: **50/50 PASS** ✅

All 31 required test cases from the mission spec are covered, plus 19 additional tests for telemetry, budget, normalization edge cases, and config integration.

### Test Coverage Summary

| Category | Tests | Status |
|---|---|---|
| Disabled by default | `GOOGLE_DISABLED_BY_DEFAULT`, `DISABLED_GOOGLE_EXECUTES_ZERO_REQUESTS` | ✅ |
| Config integration | `CONFIG_GOOGLE_DISABLED_BY_DEFAULT_MISSING_ENV`, `CONFIG_GOOGLE_ENABLED_EXPLICITLY`, `CONFIG_GOOGLE_EXPLICITLY_FALSE` | ✅ |
| Eligibility gates | `ENABLED_ELIGIBLE_PROSPECT_CAN_INVOKE_PROVIDER`, `INELIGIBLE_PROSPECT_SKIPS_GOOGLE`, `INTERNAL_PROSPECT_SKIPS_GOOGLE`, `SYNTHETIC_PROSPECT_SKIPS_GOOGLE`, `HUMAN_BLOCKED_PROSPECT_SKIPS_WHERE_APPLICABLE`, `INELIGIBLE_WHEN_ALL_PROPERTIES_BLOCK` | ✅ |
| Budget | `REQUEST_BUDGET_ENFORCED`, `BUDGET_SUMMARY_EXHAUSTED`, `BUDGET_SUMMARY_PARTIAL`, `DISABLED_BUDGET_ZERO_MAX` | ✅ |
| Provider contract | `ONE_ORCHESTRATOR_DECISION_PER_PROSPECT`, `NO_HIDDEN_PROVIDER_FALLBACK`, `REAL_PROVIDER_CONTRACT_REUSED` | ✅ |
| Identity | `PHONE_DOES_NOT_INFLUENCE_IDENTITY`, `AMBIGUOUS_IDENTITY_FAILS_CLOSED` | ✅ |
| Website | `VERIFIED_RESULT_CAN_SEED_WEBSITE_CANDIDATE`, `WEBSITE_NOT_AUTO_OWNED` | ✅ |
| Phone trust | `GOOGLE_PHONE_REMAINS_UNVERIFIED`, `GOOGLE_PHONE_NEVER_CREATES_TRUSTED_PHONE` | ✅ |
| Multi-phone | `MULTIPLE_VALID_PHONES_PRESERVED`, `DIFFERENT_VALID_NUMBER_NOT_CONFLICT` | ✅ |
| Branch normalization | `BRANCH_WEBSITE_MISMATCH_NOT_AUTOMATIC_WRONG_BRANCH`, `TRUE_WRONG_BRANCH_FAILS_CLOSED`, plus 6 normalization unit tests | ✅ |
| Contactability/scoring | `MULTIPLE_PHONES_DO_NOT_INFLATE_CONTACTABILITY`, `NO_SCORE_INFLATION` | ✅ |
| WhatsApp | `MOBILE_DOES_NOT_IMPLY_WHATSAPP` | ✅ |
| Idempotency | `IDEMPOTENT_ORCHESTRATOR_REPROCESSING`, `NO_DUPLICATE_EVENTS` | ✅ |
| Safety | `NO_D1_MUTATION_IN_MOCKED_TESTS`, `NO_REAL_NETWORK_IN_TESTS`, `ZERO_TAVILY_USAGE`, `NO_GKEY_LOGGING`, `NO_GKEY_PERSISTENCE` | ✅ |
| Telemetry | `TELEMETRY_EVENT_NAMES_STRUCTURED`, `TELEMETRY_DISABLED_DECISION_NO_SENSITIVE_DATA`, `TELEMETRY_EXECUTED_DECISION_HAS_DERIVED_FIELDS_ONLY` | ✅ |

## 16. Typechecks

| Check | Result |
|---|---|
| `npm run typecheck:core` | ✅ PASS — zero errors |
| `npm run typecheck:api` | ✅ PASS — zero errors |
| `npm run typecheck:runner` | ✅ PASS — zero errors |

## 17. git diff --check

No whitespace errors. Only CRLF normalization warnings (pre-existing).

## 18. Safety Confirmation

| Safety Check | Confirmed |
|---|---|
| No real Google requests | ✅ (zero Google API calls) |
| No GKEY access | ✅ (no GKEY read or stored) |
| No Tavily | ✅ (zero Tavily API calls) |
| No external network | ✅ (pure functions only) |
| No real-commercial prospect replay | ✅ (mocked tests only) |
| No D1 mutation | ✅ (no repository/event-store dependency) |
| No trustedPhone mutation | ✅ (phone trust is only UNVERIFIED) |
| No scoring mutation | ✅ (no scoring fields in decision) |
| No contactability mutation | ✅ (no contactability fields in decision) |
| No qualification mutation | ✅ (no qualification fields) |
| No outreach | ✅ (no outreach fields) |
| No deployment | ✅ (no network or deploy logic) |
| No production config change | ✅ (disabled by default; no env var set) |
| No canary executed | ✅ (not in scope) |

## 19. Blockers

**None.** All 50 tests pass, all typechecks pass, all safety constraints satisfied.

## 20. Next Mission

```
GOOGLE_PLACES_ORCHESTRATOR_CANARY_V1
```

The separately authorized canary should:
- Use a very small bounded real-commercial sample (e.g. 3–5 controls)
- Set `MAGICSCRIPT_GOOGLE_PLACES_ENABLED=true` in the operator environment
- Verify real end-to-end flow through the orchestrator integration
- Verify request budget is respected
- Verify no accidental D1/trustedPhone/scoring mutation
- Report results for orchestrator readiness confirmation

## 21. Final Verdict

```
GOOGLE_PLACES_ORCHESTRATOR_INTEGRATION_V1_ACCEPTED
```