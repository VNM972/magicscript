# TomTom Structured Provider Exploratory V1 — Final Checkpoint

**Status:** `FAIL_EXPLORATORY`

## Frozen sample

Artifact: `bulk/reports/tomtom-structured-provider-sample-v1.json`

- Benchmark: `tomtom-structured-provider-exploratory-v1`
- Total: 10
- UNCOVERED: 8
- POSITIVE_CONTROL: 2
- ADVERSARIAL_IDENTITY: 0
- SHA-256 of `JSON.stringify(sample)`: `b39721d123fd252a1e9dca276fa49446a454027fcb381958be6cfe207699d75d`

The frozen sample was verified unchanged after the operator run. No sample regeneration or modification occurred.

## External result validation

Source artifact: `bulk/reports/tomtom-structured-provider-external-results-v1.json`

- benchmarkId: valid
- sample hash: valid and matches frozen sample
- result rows: 10/10 expected prospects represented
- sanitized: no TTKEY, API key header, authorization material, environment dump, or secret-bearing URL found
- provenance: provider entity IDs, deterministic queries, acquisition timestamps, identity signals, and Discover/Details response hashes retained for the two verified entities
- provider freshness: not exposed; recorded as unavailable
- canonical state: no canonical mutation performed

## Exact request accounting

- Discover: 10
  - one primary Discover for each of the 10 benchmark prospects
- Details: 2
  - one Details request for each uniquely identity-verified Discover result:
    - ENVIE D AILLEURS
    - KAY JUJU
- Secondary Discover: 0
- Total: **12**

Therefore: `10 Discover + 2 Details + 0 secondary Discover = 12 total requests`.

## Metrics

| Metric | Result |
|---|---:|
| SAMPLE_TOTAL | 10 |
| UNCOVERED_TOTAL | 8 |
| POSITIVE_CONTROL_TOTAL | 2 |
| ADVERSARIAL_TOTAL | 0 |
| ENTITY_FOUND | 2 |
| IDENTITY_VERIFIED | 2 |
| IDENTITY_AMBIGUOUS | 0 |
| IDENTITY_REJECTED | 0 |
| NOT_FOUND | 8 |
| PHONE_FIELD_PRESENT | 0 |
| INCREMENTAL_PHONE_COUNT | 0 |
| INCREMENTAL_PHONE_RATE | 0 / 8 = 0% |
| POSITIVE_CONTROL_ENTITY_MATCH | 0 |
| POSITIVE_CONTROL_PHONE_MATCH | 0 |
| POSITIVE_CONTROL_PHONE_MISMATCH | 0 |
| POSITIVE_CONTROL_PHONE_ABSENT | 2 |
| IDENTITY_MISBIND_COUNT | 0 |
| DISCOVER_REQUESTS | 10 |
| DETAILS_REQUESTS | 2 |
| TOTAL_REQUESTS | 12 |

## Uncovered results

| Canonical prospect | Entity | Verdict | Provider | Locality | Phone | Incremental phone | Reason |
|---|---|---|---|---|---|---|---|
| BERNARD'S COFFEE SHOP | No | NOT_FOUND | — | — | No | No | no candidate selected |
| CORAIL | No | NOT_FOUND | — | — | No | No | no candidate selected |
| ENVIE D AILLEURS | Yes | VERIFIED | Envie d'Ailleurs | Sainte-Luce | No | No | exact compatible identity; no phone field |
| ELECTRONIQUE + | No | NOT_FOUND | — | — | No | No | no candidate selected |
| KAY JUJU | Yes | VERIFIED | Kay Juju | Fort-de-France | No | No | exact compatible identity; no phone field |
| L'UNIVERS DU PNEU | No | NOT_FOUND | — | — | No | No | no candidate selected |
| POMPES FUNEBRES CARISTAN | No | NOT_FOUND | — | — | No | No | no candidate selected |
| SARL SOREIDOM | No | NOT_FOUND | — | — | No | No | no candidate selected |

No incremental identity-verified phones were returned.

## Positive controls

| Control | Intended business resolved | TomTom phone | Current trustedPhone | Result | Identity verdict |
|---|---|---|---|---|---|
| ACTIBURO | No | — | 02 35 52 82 00 | ABSENT | NOT_FOUND |
| GIE LIEMAN GESTION | No | — | +33939200483 | ABSENT | NOT_FOUND |

The controls did not resolve to intended TomTom entities. This is not classified as a phone mismatch; the correct result is `ABSENT` because no identity-bound entity and phone were returned.

## Exploratory decision

**FAIL_EXPLORATORY**

The predeclared rule fails because:

- both positive controls did not resolve to intended businesses;
- zero of eight uncovered prospects produced an incremental identity-verified phone;
- the incremental count is `0`, which is `<= 1`.

Identity misbind count is zero, but that alone cannot pass the gate.

This result does not authorize production integration or any canonical contact change. Provider phones remain candidates only. Do not implement `trustedPhone`, Contact Presence mutation, contactability changes, scoring changes, qualification changes, production routing, or `DIRECT_STRUCTURED_PROVIDER_EVIDENCE`.

**Next recommended mission:** no production validation is justified from this benchmark result. Any future `STRUCTURED_PROVIDER_PRODUCTION_VALIDATION` would require a separately authorized redesign of query coverage and control handling; it must not be inferred from this run.

## Safety confirmation

- Harness never received TTKEY.
- TTKEY was never persisted or printed.
- No additional TomTom request was made by Harness.
- Zero Tavily queries.
- Zero Research replay.
- Zero canonical contact mutation.
- Zero trustedPhone mutation.
- Zero scoring mutation.
- Zero qualification mutation.
- Zero outreach.
- Zero deployment.
- Frozen sample unchanged.
- Historical events preserved.
- Dirty tree preserved.

TOMTOM_STRUCTURED_PROVIDER_EXPLORATORY_V1_FAIL
