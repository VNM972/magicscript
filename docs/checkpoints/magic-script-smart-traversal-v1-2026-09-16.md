# Magic Script — Traversal Failure Attribution + Smart Path Fix V1

## Status

`SMART_TRAVERSAL_V1_SAFE_STOP`

## Exact failure matrix

Latest existing owned-site traversal event:

| Path origin | Generated | Attempted | Succeeded | Failed |
|---|---:|---:|---:|---:|
| HOMEPAGE | 22 | 22 | 6 | 16 |
| GENERATED_CONTACT_PATH | 110 | 110 | 13 | 97 |
| GENERATED_LEGAL_PATH | 68 | 68 | 9 | 59 |
| DISCOVERED_LINK | 3 | 3 | 3 | 0 |
| GENERATED_ABOUT_PATH | 0 | 0 | 0 | 0 |
| OTHER | 0 | 0 | 0 | 0 |
| **Total** | **203** | **203** | **31** | **172** |

Failure strings in the existing event are raw fetcher reasons. Exact normalized attribution is:

- generated contact paths: 21 HTTP 404s, plus DNS/network/503/size failures;
- generated legal paths: 14 HTTP 404s, plus DNS/network failures;
- homepage: no 404s; failures are DNS/network, 503, or response-too-large;
- discovered links: 0 failures.

The remaining raw failure reasons are preserved in `bulk/reports/owned-traversal-attribution-v1.json`; they are not collapsed into “fetcher failure.” In particular, many failures are DNS failures caused by unavailable domains, and generated paths include genuine 404s.

## Path-family yield

| Path origin | Success rate | Phone observations | Email observations | Forms |
|---|---:|---:|---:|---:|
| HOMEPAGE | 27.3% | 1 | 1 | 1 |
| GENERATED_CONTACT_PATH | 11.8% | 2 | 2 | 2 |
| GENERATED_LEGAL_PATH | 13.2% | 2 | 2 | 0 |
| DISCOVERED_LINK | 100% | 1 | 1 | 1 |

The discovered-link sample is small: 3 links. It materially outperformed guessed paths, but is not large enough to establish population economics alone.

## Generated path quality

Generated contact/legal paths were attempted for all owned sites in the prior replay. They produced:

- 35 successes out of 178 generated contact/legal attempts;
- 35 failures out of 178 were not all 404s;
- at least 35 explicit 404s were observed across contact/legal families;
- useful contact evidence occurred on only a small subset of successful generated pages.

Generated paths are therefore wasteful when fetched indiscriminately, particularly for domains that already fail DNS or whose real navigation uses nonstandard paths.

## Discovered-link quality

- discovered same-origin high-confidence links: 3;
- attempts: 3;
- successes: 3;
- failures: 0;
- phone: 1;
- email: 1;
- contact form: 1.

The discovered-link result supports discovered-first ordering, with the qualification that the observed sample is only three links.

## Homepage quality

Across 22 owned sites:

- homepage attempts: 22;
- homepage successes: 6;
- homepage failures: 16;
- same-origin contact/legal links discovered from successful homepages: 3;
- discovered links fetched: 3;
- discovered links successful: 3.

Homepage failure is a major upstream limiter. When the homepage succeeds, the current bounded parser can discover same-origin contact/legal/about links. It does not crawl beyond the bounded link set.

## Correction implemented

The normal Contact Acquisition traversal order is now:

1. homepage;
2. bounded same-origin discovered contact/legal/about links;
3. generated fallback paths;
4. deduplication and the existing bounded source cap.

Generated paths remain fallback candidates and are not treated as fetched merely because they were generated.

The normal acquisition result now exposes `ownedPathManifest` so future events can retain generated-path provenance. The existing runtime source result remains otherwise unchanged; no global ranking or Tavily behavior changed.

## Targeted replay

The existing 22 owned-site prospects were replayed with zero Tavily queries:

- entries: 203;
- attempts: 203;
- successes: 31;
- failures: 172;
- discovered links: 3;
- discovered-link successes: 3.

Because only three discovered links existed and homepage failures limited discovery, the aggregate totals did not improve in this replay. The correction changes ordering and fallback semantics for future runs; it does not fabricate additional discovered links or turn unavailable domains into successes.

## Decision

- `TRAVERSAL_STRATEGY_GAP`: confirmed for indiscriminate guessed-path fetching;
- `FETCH_RELIABILITY_GAP`: also present for homepage/domain failures;
- `CONTENT_AVAILABILITY_GAP`: possible on successful pages without contact evidence;
- `EXTRACTION_GAP`: not supported by this evidence;
- JS renderer: not justified;
- structured provider: not justified.

The smallest next mission is to wire `ownedPathManifest` persistence into the durable acquisition event payload and compare discovered-first versus fallback attempts using joinable source IDs. Do not expand crawling or alter global source ranking yet.

## Tests and validation

Passed:

- focused Contact Acquisition/traversal/fetcher/telemetry tests: **23 passed, 0 failed**;
- `npm run typecheck:core`;
- `npm run typecheck:api`;
- `npm run typecheck:runner`;
- `git diff --check`.

## Files

- `core/contact-acquisition/agent.ts`
- `core/tests/contact-acquisition.test.ts`
- `scripts/replay-owned-site-traversal.mjs`
- `scripts/analyze-owned-traversal.mjs`
- `bulk/reports/owned-traversal-attribution-v1.json`
- `docs/checkpoints/magic-script-smart-traversal-v1-2026-09-16.md`

## Safety

- zero Tavily searches;
- no Research replay;
- no parser weakening;
- no identity weakening;
- no Evidence Integrity weakening;
- no renderer;
- no structured provider;
- no outreach;
- historical events preserved;
- dirty tree preserved.
