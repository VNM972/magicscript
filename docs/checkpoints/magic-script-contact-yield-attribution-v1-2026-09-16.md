# Magic Script Contact-Yield Attribution V1 — 2026-09-16

## Scope and safety

Read-mostly attribution audit. No Tavily searches, no provider calls, no extraction logic changes, no renderer, no Research replay, and no outreach. Existing dirty tree was preserved. Independent refetches were limited to already-persisted URLs used by the previous phone-gap dataset; this mission added no network fetch requirement to the persisted funnel computation.

## Exact observed funnel

- Canonical eligible real-commercial scope: **33** after applying the existing special-entity exclusion policy. A raw metadata query returns 37 non-null commercial-eligibility rows before exclusions; those four special rows are not part of this study.
- Persisted candidate sources: **959**.
- Persisted identity-verified sources: **276**.
- Tavily artifact: 297 queries, 959 sources, 386 independent fetch successes, 276 identity-verified sources.
- Fetch selected/attempted/succeeded/skipped globally: **not separately observable from persisted acquisition events**. The source records retain candidate and identity fields, but the latest event payload does not retain a per-source fetch attempt/result ledger for the full 959-source population.

Therefore `959 - 386` must not be reported as fetch failures. The only exact global statement is 959 candidates, 386 reported independent fetch successes, and 276 identity-verified sources; selection and attempted denominators are not observable.

## Source type counts

Persisted source counts:

| Type | Candidates | Selected | Attempted | Success | Failed | Skipped | Identity verified |
|---|---:|---:|---:|---:|---:|---:|---:|
| OWNED_WEBSITE | 22 | 22 | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | 22 |
| CONTACT_PAGE | 40 | 40 | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | 23 |
| LEGAL_PAGE | 13 | 13 | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | 9 |
| FACEBOOK | 149 | 149 | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | 17 |
| INSTAGRAM | 126 | 126 | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | 6 |
| TIKTOK | 0 | 0 | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | 0 |
| WHATSAPP | 0 | 0 | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | 0 |
| REGISTRY | 44 | 44 | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | 38 |
| OTHER_PUBLIC_SOURCE | 565 | 565 | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | NOT_OBSERVABLE | 161 |

The persisted acquisition source record has `fetchStatus: NOT_FETCHED` for candidates in the acquisition event. The separate 386 success number is an aggregate replay artifact, not a per-source joinable fetch ledger. This is the key telemetry gap.

## Fetch failure evidence

The ten-prospect phone-gap refetch sample recorded these actual failure classes, but they cannot be promoted to a 959-source global failure distribution:

- HTTP 403: 20
- RESPONSE_TOO_LARGE: 10
- HTTP 429: 2
- HTTP 503: 1
- timeout: 1
- DNS failure: 2
- unsupported `text/xml`: 1
- generic fetch/network failure: 4

These are sample observations only. Unattempted persisted candidates are not classified as failures.

## Owned-site traversal proof

The acquisition event records candidate URLs and source classifications, but does not distinguish generated, selected, attempted, succeeded, failed, skipped, or not-generated owned-site path states. Therefore exact `/contact`, `/contactez-nous`, `/nous-contacter`, legal, `/about`, and `/a-propos` traversal counts are **NOT_OBSERVABLE** from current persisted telemetry.

Known exact observables:

- OWNED_SITES_TOTAL: 22
- owned-site sources with any persisted candidate record: 22
- contact/legal path candidates present by classification: CONTACT_PAGE 40, LEGAL_PAGE 13
- actual path fetch attempts and successes: NOT_OBSERVABLE

Generating a URL is not counted as a fetch.

## OTHER_PUBLIC_SOURCE analytical decomposition

Deterministic URL-pattern subclassification of the 565 `OTHER_PUBLIC_SOURCE` candidates:

- OTHER_UNKNOWN: 429
- REGISTRY_OR_LEGAL_REFERENCE: 60
- ARTICLE_OR_MEDIA: 43
- MAP_OR_LOCATION_PAGE: 15
- PDF_OR_DOCUMENT: 14
- BOOKING_PLATFORM: 4

This is analytical only; canonical source taxonomy was not changed.

## Contact-yield attribution

Canonical current metrics remain:

- VERIFIED phone: 3
- VERIFIED email: 4
- VERIFIED Instagram: 1
- VERIFIED Facebook: 4
- VERIFIED TikTok: 7
- VERIFIED WhatsApp: 0
- VERIFIED contact form: 10

The latest Contact Presence event contains aggregate extracted evidence but does not retain a complete source-type join for every fetched source. Consequently source-type phone/email/contact-form observation and canonicalization denominators are only partially observable. The report records the persisted data limitation rather than inventing per-type yields.

The previously audited ten-prospect sample proves that fetched pages can contain phone-like values while being rejected by identity binding, blocked, oversized, JS-dependent, or noisy. It also showed exact-name/broad-city binding loss, which has since been narrowly fixed in the prior mission.

## High-value no-phone sample

The current report's top 20 no-phone rows, ranked from persisted identity-verified source coverage, are:

SARL SOREIDOM; JACQUES ALLALI; JEAN-PIERRE EUVRARD; POINT MAT BRICO; SASU-YOUYOU-MARKET; CORAIL; ELECTRONIQUE +; LE COMPTOIR MEDICAL; VESPA ANTILLES; ATHENA TRADING; MART'AUDIO; ENVIE D AILLEURS; GUY HOQUET L'IMMOBILIER; SAVOIE; L'UNIVERS DU PNEU; PASS' TRAVEL; DISVEA; GRAZIELLA EUGENIE; DARTY HABITAT NATURE ET DECOUVERTES; GEORGES PLAVONIL.

The detailed source-level evidence for the ten-prospect forensic subset is in `.tmp-phone-gap-audit.json`; no JS-rendered DOM claim is made.

## Attribution decision

Confirmed:

- **Telemetry/selection attribution gap:** current events do not preserve per-source fetch selection/attempt/result, so exact economics cannot be fully attributed.
- **FETCH_RELIABILITY_GAP:** supported in the ten-source sample by 403, 429, 503, timeout, DNS, size, content-type, and network failures.
- **IDENTITY_GAP:** previously demonstrated for exact-name sources with broad-vs-local city mismatch; narrowly fixed in the prior mission.
- **STRUCTURED_PROVIDER_GAP:** remains possible for accessible pages without contact data, but cannot be quantified before complete per-source fetch telemetry.
- **EXTRACTION_GAP:** not established as dominant; parser tests and sample evidence do not support that conclusion.
- **TRAVERSAL_GAP:** cannot be proven or disproven from current event telemetry because generated/attempted path states are absent.
- **SOURCE_RANKING_GAP:** cannot be quantified because fetch-attempt denominators and per-source extraction joins are absent.
- **JS_RENDERING_GAP_SUSPECTED:** present only as an individual-source possibility; no meaningful population estimate is justified.

## Two-stage ranking recommendation

A two-stage identity gate followed by contact-yield ranking is architecturally justified, but implementation should wait for telemetry. The smallest useful next mission is instrumentation-only:

1. persist per-source candidate/selected/attempted/fetch result/failure/content-type/final URL;
2. persist identity result and extraction evidence source IDs;
3. persist bounded owned-path generation and attempt states;
4. compute source-class yields from joinable records;
5. only then adjust ranking or budget.

No ranking or budget change was made here.

## Validation

No code/runtime logic was modified by this audit. No focused tests were required. Existing prior validation remains the applicable evidence. `git diff --check` was not changed by the audit.

## Remaining unknowns

- exact 959-source selected and attempted counts;
- exact fetch failures by source type across all sources;
- exact owned-path fetch states;
- per-source extraction-to-canonical joins;
- population-level JS-shell rate;
- source ranking opportunity cost.

The attribution report was corrected to use the canonical 33-prospect scope rather than the raw 37-row metadata query.

Final status: `CONTACT_YIELD_ATTRIBUTION_V1_SAFE_STOP`.
