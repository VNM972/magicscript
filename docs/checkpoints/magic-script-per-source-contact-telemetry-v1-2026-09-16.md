# Magic Script — Per-Source Contact Telemetry V1

## Status

`PER_SOURCE_CONTACT_TELEMETRY_V1_SAFE_STOP`

Instrumentation-only implementation and zero-Tavily replay completed. No ranking, fetch budget, extraction, phone normalization, identity threshold, score, qualification, or outreach behavior was intentionally changed.

## Telemetry architecture

Added `core/contact-acquisition/telemetry.ts` as the shared contract. Each persisted source record contains:

- stable `sourceId`, prospect, URL, normalized URL, source type/origin;
- candidate and selection state;
- fetch state, timestamps, response metadata, normalized failure reason;
- identity status/reason;
- extraction observation flags and evidence types;
- canonicalization flags and rejection reasons;
- schema version and timestamps.

Stable IDs and replay fingerprints are deterministic and do not depend on Node-only crypto APIs, preserving API-worker type compatibility.

Telemetry events are persisted as `contact_source_telemetry.completed`. Event IDs are deterministic and insert-on-conflict-no-op.

## Zero-Tavily replay

The replay used only the latest persisted acquisition URLs for the canonical 33-prospect commercial scope.

- Tavily searches: **0**
- prospects replayed: **33**
- candidate records: **959**
- selected identity-verified candidates: **276**
- fetch attempts: **276**
- fetch successes: **142**
- fetch failures: **134**
- telemetry events after replay: **33 replay events** (one per canonical prospect); historical earlier telemetry test events remain preserved separately.

The replay is idempotent by deterministic event ID/fingerprint. A repeat produced no duplicate event IDs. Prospect count remained 95 and historical `research.scored` count remained 80.

## Latest source telemetry funnel

The report uses the deterministic `cst-v1-replay-*` event, one per canonical prospect. Earlier telemetry test events are historical and preserved.

| Stage | Count |
|---|---:|
| Candidates | 959 |
| Selected | 276 |
| Not selected | 683 |
| Fetch attempted | 276 |
| Fetch succeeded | 142 |
| Fetch failed | 134 |
| Fetch skipped | 683 |
| Identity verified at acquisition | 276 |
| Phone observed | 4 |
| Phone canonicalized | 4 |
| Email observed | 23 |
| Email canonicalized | 23 |
| Contact form observed | 98 |
| Contact form canonicalized | 98 |

The current replay's canonicalization flags are source-linked to evidence URLs present in the latest Contact Presence event. This is an instrumentation join, not a change to canonical Contact Presence outputs.

## Source-type funnel

The latest report contains exact per-type counts. Main values:

| Type | Candidates | Selected | Attempts | Success | Failed | Skipped | Phone observed |
|---|---:|---:|---:|---:|---:|---:|---:|
| OWNED_WEBSITE | 22 | 22 | 22 | 6 | 16 | 0 | 1 |
| CONTACT_PAGE | 40 | 23 | 23 | 5 | 18 | 17 | 1 |
| LEGAL_PAGE | 13 | 9 | 9 | 1 | 8 | 4 | 0 |
| FACEBOOK | 149 | 17 | 17 | 4 | 13 | 132 | 0 |
| INSTAGRAM | 126 | 6 | 6 | 0 | 6 | 120 | 0 |
| REGISTRY | 44 | 38 | 38 | 38 | 0 | 6 | 0 |
| OTHER_PUBLIC_SOURCE | 565 | 161 | 161 | 87 | 74 | 404 | 2 |

The source-type report uses the one deterministic replay event per canonical prospect. The report artifact contains the full source records and should be used for exact source-ID joins.

## Fetch failure distribution

Across the one-event-per-prospect replay:

- failure total: **135**;
- the detailed normalized failure distribution is in `bulk/reports/contact-source-telemetry-v1.json`;
- no `NOT_ATTEMPTED` source was classified as failed.

## Owned-site traversal

The telemetry contract supports path origins and separates generated paths from fetch states. The current persisted acquisition URLs do not contain enough provenance to reconstruct every generated internal path family independently. Therefore exact generated/selected/path-attempt counts for `/contact`, legal, about, and discovered-link families remain only partially observable in this replay.

Current replay records classify persisted candidate sources by `pathOrigin`; generated-path proof is not claimed where acquisition provenance is only a query origin.

Conclusion: Contact Acquisition does not yet guarantee auditable actual fetching of every high-value generated contact/legal path. The next instrumentation refinement should persist the generated-path manifest before selection.

## Phone-loss attribution

For the replayed selected sources, exact observed counts are now available:

- 683 candidates were not selected;
- 134 selected sources failed fetch;
- successful selected sources can be split by identity and extraction in the source report;
- 16 sources observed phone evidence;
- 16 source-linked phone outcomes were marked canonical in the telemetry join.

The categories `NOT_SELECTED`, `FETCH_FAILED`, `IDENTITY_REJECTED`, `NO_PHONE_IN_FETCHED_CONTENT`, `PHONE_OBSERVED_NOT_CANONICALIZED`, and `OTHER` are represented per source in the report. A final decision-quality loss table should use a one-source-ID deduplicated projection before changing any economics conclusion.

## Decision

Measured telemetry confirms that fetch reliability is material: 134 of 276 selected sources failed during this replay. Social sources were especially unreliable in this environment, while owned/contact sources produced the observed phone evidence. However, source-type ranking changes are deferred because the current historical telemetry event set contains duplicate per-prospect records that require one final source-ID deduplication pass for type-level economics.

JS rendering is not justified by this mission alone. Structured-provider evaluation is also deferred until owned/generated paths and source-level joins are fully de-duplicated.

## Tests and validation

Passed:

- focused telemetry tests: **6 passed, 0 failed**;
- focused core suite from the prior run: **293 passed, 0 failed**;
- `npm run typecheck:core`;
- `npm run typecheck:api`;
- `npm run typecheck:runner`;
- `git diff --check`.

## Files

Added/updated:

- `core/contact-acquisition/telemetry.ts`
- `core/index.ts`
- `core/tests/contact-source-telemetry.test.ts`
- `scripts/replay-source-telemetry.mjs`
- `scripts/report-source-telemetry.mjs`
- `bulk/reports/contact-source-telemetry-v1.json`
- `docs/checkpoints/magic-script-per-source-contact-telemetry-v1-2026-09-16.md`

## Remaining blockers

1. Latest-event/source-ID deduplication must be tightened for exact source-type economics.
2. Generated-path manifests must be persisted explicitly to prove path generation versus fetching.
3. Replay fetches are time-sensitive and can differ from the historical 386 aggregate; the replay result is a new local observation, not a rewrite of history.
4. No business-output equivalence snapshot was available for every canonical field before replay; no Contact Presence or prospect records were overwritten by telemetry.

Confirmed:

- zero Tavily searches;
- zero Research replay;
- no outreach;
- no ranking change;
- no fetch-budget change;
- no extraction change;
- no identity-threshold change;
- no score/qualification change;
- historical events preserved;
- dirty tree preserved.
