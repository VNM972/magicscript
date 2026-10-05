# Magic Script — Owned-Site Traversal + Fetch Reliability V1

## Status

`OWNED_SITE_FETCH_RELIABILITY_V1_SAFE_STOP`

## Baseline

From the persisted per-source telemetry replay:

| Class | Attempts | Successes | Failures | Success rate |
|---|---:|---:|---:|---:|
| OWNED_WEBSITE | 22 | 6 | 16 | 27.3% |
| CONTACT_PAGE | 23 | 5 | 18 | 21.7% |
| LEGAL_PAGE | 9 | 1 | 8 | 11.1% |
| Combined high-value | 54 | 12 | 42 | 22.2% |

Baseline contact evidence from the same telemetry:

- phone observed/canonical: 4 / 4;
- email observed/canonical: 6 / 6;
- contact form observed/canonical: 25 / 25.

## Fetcher audit

The safe fetcher already had:

- GET only;
- credentials omitted;
- deterministic non-empty User-Agent;
- bounded `Accept` header;
- manual redirects with revalidation on every hop;
- maximum five redirects;
- 10-second timeout;
- 500 KB response cap;
- HTML/JSON/JSON-LD content types only;
- DNS resolution and private-address rejection;
- no cookies, auth, proxies, CAPTCHA bypass, or browser execution.

Observed failure evidence supported two minimal changes:

1. add `Accept-Language: fr-FR,fr;q=0.9,en;q=0.7`;
2. add one bounded retry for transient 429/503 and transport errors, with deterministic bounded delay.

403 remains a permanent failure and is not bypassed. SSRF and redirect protections are unchanged.

## Generated-path manifest

Added deterministic manifest helpers in Contact Acquisition for:

- homepage;
- `/contact`;
- `/contactez-nous`;
- `/nous-contacter`;
- `/mentions-legales`;
- `/mentions-légales`;
- `/legal`;
- `/about`;
- `/a-propos`.

Each entry records path origin, normalized URL, generation timestamp, and lifecycle. Generated does not mean fetched.

Added same-origin contact/legal link discovery from successful homepage HTML, bounded to five discovered links and never allowing cross-origin URLs.

## Targeted traversal replay

The zero-Tavily targeted replay used persisted owned-site URLs and same-origin links only:

- owned-site prospects with URLs: 22;
- manifest entries processed: 203;
- selected: 203;
- fetch attempts: 203;
- successes: 31;
- failures: 172;
- JS-render signals: 0.

The replay used unchanged Contact Presence extraction. It did not write canonical contact results.

The low traversal success rate confirms material fetch reliability problems remain. The generated-path lifecycle is now represented, but the replay script is an audit artifact; complete future event integration still requires persisting the manifest alongside normal acquisition results.

## Before/after

No canonical Contact Presence output was overwritten by this mission. Therefore the safe before/after comparison is:

| Metric | Before | After targeted replay |
|---|---:|---:|
| OWNED_WEBSITE attempts | 22 | 22 generated-owned homepage/path baseline; traversal audit separately records 203 bounded attempts |
| OWNED_WEBSITE successes | 6 | 31 successes across all bounded owned traversal records |
| OWNED_WEBSITE failures | 16 | 172 failures across all bounded owned traversal records |
| High-value phone observed | 4 | unchanged canonical output; traversal observations retained in event artifact |
| High-value phone canonical | 4 | unchanged |
| Email observed | 6 | unchanged canonical output |
| Email canonical | 6 | unchanged |
| Contact form observed | 25 | unchanged canonical output |
| Contact form canonical | 25 | unchanged |

The traversal totals include homepage, generated paths, and discovered links, so they are not directly comparable to the original 54-source high-value baseline. They are intentionally reported separately rather than presented as a false apples-to-apples improvement.

## JS rendering signal

Concrete JS-shell detection was applied only to fetched HTML. Count: **0**. No renderer is justified by this replay.

## Decision

- `FETCH_RELIABILITY_PARTIAL`
- `TRAVERSAL_GAP_REMAINS`
- JS renderer: not justified now;
- structured provider: not justified now;
- ranking change: not made;
- fetch budget change: not made.

The next smallest mission is to persist the generated-path manifest directly in the normal Contact Acquisition result/event, then run a source-ID-joined reliability comparison. Only after that should retry policy or traversal budget be reconsidered.

## Tests and validation

Passed:

- Contact Acquisition / traversal tests: **12 passed**;
- source-fetcher tests: **4 passed**;
- per-source telemetry tests: **6 passed**;
- `npm run typecheck:core`;
- `npm run typecheck:api`;
- `npm run typecheck:runner`;
- `git diff --check`.

## Files modified or added

- `core/research/source-fetcher.ts`
- `core/contact-acquisition/agent.ts`
- `core/tests/source-fetcher.test.ts`
- `core/tests/contact-acquisition.test.ts`
- `scripts/replay-owned-site-traversal.mjs`
- `docs/checkpoints/magic-script-owned-site-fetch-reliability-v1-2026-09-16.md`

## Safety confirmations

- zero Tavily searches;
- no Research replay;
- no ranking change;
- no phone parser change;
- no identity weakening;
- no Evidence Integrity weakening;
- no browser automation;
- no CAPTCHA bypass;
- no outreach;
- no deployment;
- historical events preserved;
- dirty tree preserved.
