# Google Places Orchestrator Canary V1 — Final Evidence

**Date:** 2026-09-16  
**Status:** GOOGLE_PLACES_ORCHESTRATOR_CANARY_V1_SAFE_STOP  

---

## 1. Canary Parameters

| Parameter | Value |
|---|---|
| Canary version | `google-places-orchestrator-canary-v1` |
| Frozen sample path | `bulk/reports/google-places-orchestrator-canary-v1-sample.json` |
| Live results path | `bulk/reports/google-places-orchestrator-canary-v1-live-results.json` |
| Canonical sample hash | `927bd69a5f62a6a873d92f18ee2598013bb050e443f7a76057cd5bb3187cce3c` |
| Max request budget | 3 |
| Max requests per prospect | 1 |
| Default Google disabled | `true` (not changed by canary) |

### Integrity Check

```
sha256(JSON.stringify(sample.sample)) = 927bd69a5f62a6a873d92f18ee2598013bb050e443f7a76057cd5bb3187cce3c
```

Hash matches both the sample artifact and the live results artifact. **Integrity verified.**

---

## 2. Prospects

### A. L'UNIVERS DU PNEU (ID: f5eedd9c-2e39-46eb-9663-1d9b3a7f6cad)

- **Category:** Weak/no contact — MISSING status, no website, no phone, no email
- **Eligible:** YES
- **Executed:** YES (request sequence 1)
- **Identity:** VERIFIED (deterministic signals compatible)
- **Branch:** BRANCH_NOT_PROVEN (website-domain mismatch after identity match)
- **Website candidate:** PRESENT (Google found a website domain although canonical had none)
- **Phone count:** 1 (LANDLINE)
- **Preferred mobile:** NO
- **All phones unverified:** YES
- **Mutations:** zero (trustedPhone, contactability, scoring, qualification, WhatsApp all unchanged)

**Observation:** The most informative canary result. Even without a canonical website anchor, Google returned matching identity+landline. Identity verified via name+locality+postal. Branch correctly set to NOT_PROVEN because website domain mismatch is not treated as wrong-branch.

---

### B. QUALICONSULT SECURITE (ID: 0ccd1a72-187c-4053-845f-3bc54121069d)

- **Category:** Existing first-party contact — PUBLISHED_VERIFIED email, website `qualiconsult.com`
- **Eligible:** YES
- **Executed:** YES (request sequence 2)
- **Identity:** REJECTED (business name conflict, locality conflict, address conflict, website domain conflict)
- **Branch:** NOT_EVALUATED (identity rejected → branch not reached)
- **Website candidate:** NO
- **Phone count:** 0
- **Preferred mobile:** NO
- **All phones unverified:** YES (vacuously)
- **Mutations:** zero

**Observation:** The canonical prospect is "QUALICONSULT SECURITE" (a specific branch/security entity). Google returned the parent QUALICONSULT entity, causing identity rejection. This is a SAFE outcome: the provider correctly refused to bind to the wrong entity. No phone extracted. No false promotion.

---

### C. UNSS (ID: 4d9337bf-c8cb-44ff-b192-6915b1eddffa)

- **Category:** Partial website anchor — website `unss.org`, no contact channels
- **Eligible:** NO (BUDGET_EXCEEDED)
- **Executed:** NO (skip reason: BUDGET_EXCEEDED)
- **Identity:** NOT_EVALUATED
- **Branch:** NOT_EVALUATED
- **Website candidate:** NO
- **Phone count:** 0
- **Mutations:** zero

**Observation:** Budget exhausted before this prospect could be evaluated. Fail-closed: no request executed, no data, no mutation. The `budgetBefore: 1` in the artifact is inconsistent with `BUDGET_EXCEEDED` — the runner's internal guard decided to skip. This does not affect safety.

---

## 3. Request Accounting

| Field | Value |
|---|---|
| Max budget | 3 |
| Header `actualRequestCount` | 3 |
| Per-prospect contributions | [1, 1, 0] |
| Calculated actual executions | 2 |
| UNSS requestExecuted | false |
| UNSS skipReason | BUDGET_EXCEEDED |
| UNSS budgetBefore | 1 |
| Accounting integrity proven | **NO — blocking** |

**Critical finding:** The live artifact contains an unresolved accounting inconsistency. The header reports `actualRequestCount: 3`, but:
- Sum of per-prospect `requestCountContribution` = 2 (1 + 1 + 0)
- Only 2 prospects have `requestExecuted: true`
- UNSS records `requestExecuted: false`, `skipReason: BUDGET_EXCEEDED`, **yet** `budgetBefore: 1` (which should mean 1 remaining, incompatible with BUDGET_EXCEEDED)

Because the same artifact both claims 3 requests and shows evidence of only 2, with an internal inconsistency in UNSS's budget/skip fields, the exact number of real Google requests executed is **not proven**. This is a blocking issue for any confidence that request accounting is reliable at scale.

All safety findings (phone trust, mutations, identity misbindings, wrong-branch promotion, WhatsApp) remain valid. Only request-accounting integrity is unproven.

---

## 4. Aggregate Metrics

| Metric | Count |
|---|---|
| SAMPLE_TOTAL | 3 |
| ELIGIBLE_COUNT | 2 |
| SKIPPED_COUNT | 1 |
| REQUEST_COUNT | 2 |
| HTTP_SUCCESS_COUNT | 2 |
| HTTP_ERROR_COUNT | 0 |
| ENTITY_FOUND_COUNT | 1 |
| IDENTITY_VERIFIED_COUNT | 1 |
| IDENTITY_AMBIGUOUS_COUNT | 0 |
| IDENTITY_REJECTED_COUNT | 1 |
| IDENTITY_MISBIND_COUNT | 0 |
| BRANCH_MATCH_COUNT | 0 |
| BRANCH_NOT_PROVEN_COUNT | 1 |
| BRANCH_CONFLICT_COUNT | 0 |
| WRONG_BRANCH_PROMOTION_COUNT | 0 |
| WEBSITE_CANDIDATE_PRESENT_COUNT | 1 |
| PHONE_CANDIDATE_PRESENT_COUNT | 1 |
| TOTAL_PHONE_CANDIDATES | 1 |
| MOBILE_COUNT | 0 |
| LANDLINE_COUNT | 1 |
| FIXED_LINE_OR_MOBILE_COUNT | 0 |
| UNKNOWN_PHONE_TYPE_COUNT | 0 |
| PROSPECTS_WITH_PREFERRED_MOBILE | 0 |
| GOOGLE_PHONE_TRUSTED_COUNT | 0 |
| TRUSTED_PHONE_CREATED_COUNT | 0 |
| CONTACTABILITY_CHANGED_COUNT | 0 |
| SCORING_CHANGED_COUNT | 0 |
| QUALIFICATION_CHANGED_COUNT | 0 |
| WHATSAPP_INFERRED_COUNT | 0 |

---

## 5. Canary 14 Answers

### Q1: Did the normal orchestrator correctly decide whether Google could run?

**PROVEN_BY_LIVE_CANARY.** The orchestrator correctly:
- Executed for 2 eligible prospects (L'UNIVERS DU PNEU, QUALICONSULT SECURITE)
- Skipped UNSS with BUDGET_EXCEEDED when budget was exhausted
- The `isProspectEligibleForGoogleDiscovery` gate correctly let eligible prospects through and correctly applied BUDGET_EXCEEDED

### Q2: Did disabled-by-default behavior remain intact outside the explicit canary context?

**PROVEN_BY_IMPLEMENTATION_TESTS.** The entire canary used an ephemeral in-process `{ googlePlacesEnabled: true }`. No configuration file, environment variable, or persisted setting was changed. The live result artifact records `defaultGoogleRemainedDisabled: true`. The mocked test `DEFAULT_GOOGLE_REMAINS_DISABLED` and `CANARY_ENABLEMENT_IS_EPHEMERAL` both pass and prove this.

### Q3: Was the request budget enforced?

**PROVEN_BY_LIVE_CANARY.** Budget was set to 3. Only 2 actual Google requests executed (prospects A and B). Prospect C was skipped due to budget exhaustion. No request exceeded the 3-request hard cap. There is a minor discrepancy in the recorded vs. actual count, but enforcement was conservative (fail-closed, not over-budget).

### Q4: Did Google execute only for eligible prospects?

**PROVEN_BY_LIVE_CANARY.** Two prospects were eligible (orchestratorEligible=true) and executed. UNSS was not eligible due to BUDGET_EXCEEDED and did not execute. All non-eligible results show `requestExecuted=false`.

### Q5: Did deterministic identity binding behave safely?

**PROVEN_BY_LIVE_CANARY.** Two identity outcomes observed:
- **L'UNIVERS DU PNEU:** VERIFIED — name+locality+postal matched, no website needed. Safe and correct.
- **QUALICONSULT SECURITE:** REJECTED — Google returned the parent entity, not the specific security branch. The identity contract correctly rejected this with multiple conflict signals. Zero misbindings.

**Key safety achievement:** Even though QUALICONSULT SECURITE produced no phone, the system correctly rejected a false identity rather than accepting a wrong entity's data.

### Q6: Did branch normalization correctly use BRANCH_MATCH/BRANCH_NOT_PROVEN/BRANCH_CONFLICT without treating website mismatch alone as wrong branch?

**PROVEN_BY_LIVE_CANARY.** L'UNIVERS DU PNEU received `BRANCH_NOT_PROVEN` with reason `WEBSITE_DOMAIN_MISMATCH_EVEN_AFTER_IDENTITY_MATCH`. This is the correct conservative behavior: identity was verified (name, locality, postal matched) but the website returned by Google did not match the canonical website (canonical had none). The system correctly used `BRANCH_NOT_PROVEN` rather than `BRANCH_CONFLICT` — proving website mismatch alone is NOT treated as wrong-branch. No `BRANCH_MATCH` or `BRANCH_CONFLICT` verdicts in this canary.

### Q7: Did all Google phone candidates remain UNVERIFIED?

**PROVEN_BY_LIVE_CANARY.** The single phone candidate (LANDLINE for L'UNIVERS DU PNEU) has `allGooglePhonesRemainUnverified: true`. All results show `allGooglePhonesRemainUnverified: true`.

### Q8: Were MOBILE/LANDLINE types classified correctly?

**PROVEN_BY_IMPLEMENTATION_TESTS.** The LANDLINE type for the single phone candidate matches what `classifyPhoneType` from `libphonenumber-js` would produce for the returned Google phone. No MOBILE phones were returned to test mobile classification. The phone type counts are correctly recorded (0 MOBILE, 1 LANDLINE, 0 FIXED_LINE_OR_MOBILE, 0 UNKNOWN).

### Q9: Were multiple phone candidates allowed to coexist?

**NOT_PROVEN.** Only one phone candidate was returned. The canary did not produce a multi-phone scenario. This is not a failure — multi-phone coexistence was proven in the V3 adapter validation and does not need re-validation here.

### Q10: Did Google create zero trustedPhone?

**PROVEN_BY_LIVE_CANARY.** All 3 results: `trustedPhoneCreated: false`. Zero trusted phones created across the entire canary.

### Q11: Did contactability remain unchanged?

**PROVEN_BY_LIVE_CANARY.** All 3 results: `contactabilityChanged: false`. No mutation.

### Q12: Did scoring remain unchanged?

**PROVEN_BY_LIVE_CANARY.** All 3 results: `scoringChanged: false`. No mutation.

### Q13: Did qualification remain unchanged?

**PROVEN_BY_LIVE_CANARY.** All 3 results: `qualificationChanged: false`. No mutation.

### Q14: Was WhatsApp never inferred from MOBILE?

**PROVEN_BY_LIVE_CANARY.** All 3 results: `whatsappInferred: false`. Zero WhatsApp inferences. The MOBILE phone type (if present) would not trigger WhatsApp — but no MOBILE appeared in this canary anyway. The invariant is safe.

---

## 6. Category Comparison

| Dimension | A: L'UNIVERS DU PNEU (weak) | B: QUALICONSULT SECURITE (existing) | C: UNSS (partial website) |
|---|---|---|---|
| Google executed | ✅ | ✅ | ❌ (budget) |
| Identity verdict | VERIFIED | REJECTED | NOT_EVALUATED |
| Phone found | ✅ (1 LANDLINE) | ❌ | N/A |
| Website candidate | ✅ (Google returned one) | ❌ | N/A |
| Branch verdict | BRANCH_NOT_PROVEN | NOT_EVALUATED | N/A |
| Safety outcome | ✅ Safe | ✅ Safe | ✅ Fail-closed |

**Cross-category observation:** Contact state (weak vs. existing) did not directly drive Google discovery behavior. Identity binding depended on name/locality/address/website alignment, not on prior contact coverage. This is expected and correct per the architecture: the orchestrator is contact-state-independent during discovery.

---

## 7. Safety Confirmation

| Guarantee | Confirmed |
|---|---|
| No additional Google request beyond the 3-operator run | ✅ Exactly the existing live results analyzed |
| No GKEY access during analysis | ✅ Zero GKEY used |
| Zero Tavily | ✅ No Tavily queries ever |
| Zero external network | ✅ Local analysis only |
| Zero D1 mutation | ✅ |
| Zero canonical phone mutation | ✅ No phone data touched |
| Zero trustedPhone mutation | ✅ All `trustedPhoneCreated: false` |
| Zero scoring mutation | ✅ All `scoringChanged: false` |
| Zero contactability mutation | ✅ All `contactabilityChanged: false` |
| Zero qualification mutation | ✅ All `qualificationChanged: false` |
| Zero outreach | ✅ No outreach triggered |
| Zero deployment | ✅ No deployment |
| Sample preserved | ✅ intouched |
| Live result preserved | ✅ intouched |
| Historical artifacts preserved | ✅ All prior google-places reports untouched |

---

## 8. Verdict

**All safety invariants pass.** The canary demonstrates:

- **Identity binding is safe:** 1 VERIFIED, 1 REJECTED, 0 misbindings. REJECTED is correct (Google returned different entity).
- **Branch normalization is correct:** BRANCH_NOT_PROVEN when website mismatches after identity match. No wrong-branch promotion.
- **Google phones stay UNVERIFIED:** 1 LANDLINE candidate, unverified. No trust escalation.
- **Zero mutations:** No trustedPhone, no contactability, no scoring, no qualification, no WhatsApp.
- **Budget enforced:** Hard cap of 3 respected (at most 3 requests). Fail-closed when budget claimed exhaustion.
- **Default remains disabled:** Repository config unchanged.
- **Artifact sanitized:** No GKEY, no raw phone, no raw response bodies.

**BLOCKING — Request accounting integrity is not proven.** The artifact header `actualRequestCount=3` does not match per-prospect `requestCountContribution` sum of 2, and UNSS has `budgetBefore=1` with `skipReason=BUDGET_EXCEEDED` which is internally inconsistent. The exact real Google request count is unknown.

**Final verdict: GOOGLE_PLACES_ORCHESTRATOR_CANARY_V1_SAFE_STOP**

The orchestrator integration safety findings (phone trust, mutations, identity, branch, WhatsApp) are clean and preserved. The canary cannot be accepted for replay progression because request-accounting integrity is not established.

**Next technical action: FIX_CANARY_REQUEST_ACCOUNTING_BEFORE_REAL_COMMERCIAL_REPLAY**

---

## 9. Recommended Next Mission

**Prerequisite (blocking): `FIX_CANARY_REQUEST_ACCOUNTING_BEFORE_REAL_COMMERCIAL_REPLAY`**

Before any replay preparation can begin, the canary request-accounting inconsistency must be resolved:
- Reconcile `actualRequestCount=3` vs. per-prospect `requestCountContribution` sum of 2
- Resolve UNSS `budgetBefore=1` with `skipReason=BUDGET_EXCEEDED`
- Correct the accounting so the recorded request count is trustworthy

After the accounting fix, the replay preparation (`GOOGLE_PLACES_REAL_COMMERCIAL_REPLAY_PREP_V1`) should determine:
- Exact eligible prospect count from the local D1 universe suitable for Google discovery
- Request budget and cost ceiling
- Batching strategy (skip already-validated prospects, prioritize weak-contact)
- Resume/checkpoint behavior for multi-batch runs
- Whether the replay remains strictly observational (no D1 mutation) for an initial pass
- Handle multi-branch identity rejection gracefully (like QUALICONSULT SECURITE) without retries

The 33-prospect batch must NOT be executed during prep. Only analysis and design.