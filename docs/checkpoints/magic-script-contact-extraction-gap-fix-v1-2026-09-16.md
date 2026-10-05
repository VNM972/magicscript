# Contact Extraction Gap Audit + Fix V1 — 2026-09-16

## Scope

No Tavily searches were rerun. The audit used the successful persisted Tavily acquisition artifact, latest acquisition events, latest Contact Presence events, saved URLs, and independent safe GET refetches.

## Diagnostic sample

Ten eligible prospects ending `PHONE=N/A` were selected deterministically with category/source diversity:

1. ATHENA TRADING
2. AUDITION CONSEIL
3. BERNARD'S COFFEE SHOP
4. COPROPRIETE MARITIME - STRATEGE DES MERS
5. CORAIL
6. DARTY HABITAT NATURE ET DECOUVERTES
7. DISVEA
8. ELECTRONIQUE +
9. ENVIE D AILLEURS
10. GEORGES PLAVONIL

The dataset is persisted in `.tmp-phone-gap-audit.json` and contains source URL, source type, identity status, fetch result/reason, bytes, tel counts, JSON-LD telephone counts, phone-like tokens, parser output, and identity output.

## Root cause findings

The phone parser was not broadly broken. It already extracted valid `tel:` values, JSON-LD telephone values, and visible French/Caribbean phone formats in focused tests.

The dominant demonstrated loss point was identity binding at Contact Presence time. Several fetched directory/profile pages contained phone-like values or explicit telephone evidence but were rejected because the canonical prospect location was broad (`Martinique`) while the source used a valid local city (`Le Lamentin`, `Schœlcher`, etc.). Exact business-name evidence was present, but the previous binding required the city signal to agree whenever city data existed.

Other observed losses in the ten-sample audit:

- multiple sources returned 403, 503, timeout, DNS, unsupported-content-type, or response-too-large failures;
- several social/directory pages contained noisy phone-like tokens but no accepted phone schema;
- some pages required JS or blocked direct fetch;
- wrong/ambiguous directory identity remained correctly rejected;
- no evidence supported a global phone-format parser failure.

Representative evidence: AUDITION CONSEIL's fetched owned/category page contained `tel:` links and JSON-LD telephone values including `05 96 71 61 71`, but identity was rejected because its city was `Schœlcher` while the prospect location was broad Martinique. CORAIL's Lexpace page contained exact name `CORAIL`, city `LE LAMENTIN`, and telephone-like content; it was rejected by the prior broad-city mismatch rule.

## Exact fix

Adjusted `bindIdentity` only for the proven case:

- exact business-name identity evidence may override a broad/stale city mismatch;
- domain mismatch and name mismatch remain fail-closed;
- ambiguous same-name sources are not promoted;
- no parser trust weakening and no phone fabrication.

Added focused regression tests for:

- tel href extraction;
- JSON-LD telephone extraction;
- visible phone extraction;
- exact-name/broad-city identity binding;
- random digit rejection.

## Phone format findings

Existing parser behavior correctly recognizes tested formats including `+596`, `0596`, spaces, and standard 10-digit French/Caribbean forms. It rejects arbitrary long digit sequences by requiring either a bounded international digit count or a 10-digit local number beginning with `0`. No speculative format expansion was required.

## Owned-site exploration

The acquisition layer persisted bounded candidate URLs and generated fixed owned-site paths. The independent audit confirmed that persisted acquisition source records do not prove every generated path was fetched in the original search stage. The hydration path refetched persisted identity-verified URLs through `fetchSourcePage`; no browser renderer was introduced. JS-only and blocked pages remain explicit technical gaps.

## Source quality

Persisted source taxonomy counts across commercial acquisition records:

- OWNED_WEBSITE: 22
- CONTACT_PAGE: 40
- LEGAL_PAGE: 13
- FACEBOOK: 149
- INSTAGRAM: 126
- REGISTRY: 44
- OTHER_PUBLIC_SOURCE: 565
- social/owned/directory/reference sources dominate; no source was promoted to owned website solely from third-party classification.

Successful Tavily acquisition totals remain:

- candidate sources: 959
- identity-verified sources: 276
- independent fetch successes: 386
- queries: 297

## Rehydration

Because the same ten-prospect audit demonstrated a concrete identity-binding loss and the targeted fix passed focused tests, bulk rehydration was justified using only persisted Tavily URLs. No Tavily searches were executed.

Latest current Contact Presence metrics across 33 eligible commercial prospects:

- VERIFIED phone: 3 (before 2)
- VERIFIED email: 4 (before 1)
- VERIFIED Instagram: 1 (before 0)
- VERIFIED Facebook: 4
- VERIFIED TikTok: 7 (before 0)
- VERIFIED WhatsApp: 0 (before 0)
- VERIFIED contact form: 10 (before 2)
- At least one verified route: 10
- Prospect-level UNKNOWN: 2
- Prospect-level N/A-only/REJECTED: 21

The ten-prospect before/after sample is represented in the persisted report; the targeted fix was applied and the complete eligible set was rehydrated idempotently through new `contact_presence.enriched` events.

## Research replay candidates

Research replay remains a subsequent mission. Current candidates with new material verified evidence include ACTIBURO, GIE LIEMAN GESTION, JEAN-PIERRE EUVRARD, and MICHEL BES. No score or qualification was changed here.

## Pipeline status

Contact Acquisition is persisted and projected, but the existing normal DISCOVER_CONTACT runtime path is not yet fully guaranteed to invoke the acquisition stage before legacy contact discovery. This remains the main runtime integration blocker.

## Validation

- Focused core extraction/acquisition/contactability/evidence suite: **287 passed, 0 failed**.
- `npm run typecheck:core`: PASS.
- Prior `npm run typecheck:api` and `npm run typecheck:runner`: PASS; rerun remains required after final changes.
- Control Center build: prior Next TypeScript child-process `spawn EPERM` blocker remains; no UI rewrite performed.
- No Tavily queries consumed during this mission.

## Safety

No prospect deleted. No new discovery wave. No Tavily search rerun. No outreach, email, WhatsApp, Instagram DM, form submission, phone call, deployment, threshold change, qualification override, Evidence Integrity weakening, or fabricated contact. Historical events preserved. Dirty tree preserved.

Final status: `CONTACT_EXTRACTION_GAP_FIX_V1_SAFE_STOP` pending normal pipeline wiring and final validation.
