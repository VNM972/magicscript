# Google Places Production Validation V1 — Offline Forensic Root Cause

## Scope

Read-only forensic analysis only. No Google, Tavily, GKEY, database, D1, canonical, outreach, deployment, or external request was performed. V1/V2 sample artifacts and the sanitized external result were not modified.

## Hash findings

`2422c0...` is SHA-256 over UTF-8 `JSON.stringify(sample.controls)` with ordinary JavaScript serialization. It excludes all top-level metadata and the self-referential hash field.

`8098ad...` is SHA-256 over `JSON.stringify(sample.controls).replace(/'/g, '\\u0027')`, replacing literal apostrophes inside values before hashing. It is deterministic but a different hash domain.

Observed hashes:

- controls, ordinary serialization: `2422c0b59a7fca2d51838063cb3a7b75b1f13193cb283e3b84d765ebd33319fd`
- controls, apostrophe-escaped serialization: `8098ad73317e254a60086713635b7925ae2bed816ce0dc75662cda7de40244f9`
- whole parsed V2 object: `d833998b55cd1121c5dfb7caf608ea8953bc12f1d4b604b16f760df741390f42f`
- raw V2 file bytes: `0e0336f52cc1dfbccadab6ac95bdd9252c2a6cb967794573194f4d895a9ed0cb`

The prior SAFE_STOP was a real contract mismatch, but not evidence of tampered content: the sample and external artifact consistently used the wrong escaped-apostrophe domain. The production runner was normalized locally to the requested ordinary controls-array domain, but the sample/artifact remain unchanged and therefore cannot pass the corrected runner until separately regenerated under authorization.

## Request reconstruction

All 10 recorded requests were POSTs to `https://places.googleapis.com/v1/places:searchText`, with body `{textQuery, pageSize:3}` and field mask:

`places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri`

No languageCode, regionCode, location bias, or location restriction was present. Exact sequence, query, query hash, body, and response hash are in the machine-readable forensic JSON.

Production queries used only `name, commune, Martinique`; the historical exploratory runner appended the canonical address. The endpoint, method, field mask, payload.places parser, and displayName string/object handling are otherwise mechanically equivalent in the visible code. Production's identity evaluator is materially different: it derives postal from `control.commune` (usually no postal code), does not use canonical address or website, and requires the provider address to contain the commune. Historical evaluation used canonical postal/address and website compatibility.

## Response-stage evidence

The sanitized external artifact retains only response hashes and final rejected summaries. It does not retain HTTP status, raw place counts, parsed candidate arrays, or candidate identity signals. Therefore the exact rejection stage cannot be proven. States A (zero places), B (parser discard), and C (identity rejection) remain possible; D and E are not demonstrated. No raw response count is invented.

## Offline controls

- ELECTRONIQUE +: historical VERIFIED with `+596596513585`; production REJECTED with no selected place.
- POMPES FUNEBRES CARISTAN: historical VERIFIED with `+596696442230`; production REJECTED with no selected place.
- ACTIBURO: historical REJECTED as the invalid Rouen control; production REJECTED with no selected place.

## Proven classifications

- `HASH_DOMAIN_MISMATCH` — proven by the two deterministic serializations and stored declarations.
- `RUNNER_QUERY_REGRESSION` — proven as a behavioral delta: production omits canonical address from the query. Whether it caused the collapse is not provable without raw responses.
- `INSUFFICIENT_PERSISTED_EVIDENCE` — proven because sanitized artifacts cannot distinguish empty responses from parser discard or identity rejection.

Not proven: actual Google zero results, parser regression, field-mask regression, identity over-rejection, or branch over-rejection.

## Patch status

Only hash-domain normalization was applied to the production runner/test helper: the requested unescaped controls-array domain is now the expected contract. No sample, external artifact, thresholds, request budget, identity safety rule, gold data, or canonical state was changed.

## Rerun decision

A bounded rerun is required before production acceptance because the existing sanitized result cannot prove the response stage and was produced under the wrong hash declaration. No rerun is performed in this mission.
