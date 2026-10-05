# Magic Script — Trusted Phone Canonical Correction Migration V1

Migration: `TRUSTED_PHONE_CANONICAL_CORRECTION_V1`  
Schema: `trusted-phone-state.v1`  
Scope: local D1 only; no provider calls

## Model change

Added the durable `phone_trust_states` projection with phone, normalized phone, `TRUSTED`/`REVOKED`/`AMBIGUOUS`/`UNTRUSTED` status, reason, source ownership, entity binding, identity status, evidence event, source metadata, canonicalization event, effective/revoked timestamps, and schema version. Original phone and research/presence events remain untouched.

Added deterministic trust recomputation and append-only correction events:

- `phone.trust.canonicalized`
- `phone.trust.revoked`

Stable event IDs make the migration idempotent.

## Six-row result

| Prospect | Classification | Phone | Source/identity | Action | After | Contactability |
|---|---|---|---|---|---|---|
| ATHENA TRADING | REAL_COMMERCIAL | 06 12 34 56 78 | owned source; VERIFIED; entity-bound | canonicalized | TRUSTED | eligible for 85 |
| GUY HOQUET L'IMMOBILIER | REAL_COMMERCIAL | 06 12 34 56 78 | owned URL; REJECTED; not bound | revoked projection | AMBIGUOUS | no contribution |
| MART'AUDIO | REAL_COMMERCIAL | 06 12 34 56 78 | owned URL; REJECTED; not bound | revoked projection | AMBIGUOUS | no contribution |
| SAVOIE | REAL_COMMERCIAL | 02 98 55 00 00 | owned URL; REJECTED; not bound | revoked projection | AMBIGUOUS | no contribution |
| SUNeLEK - WhatsApp E2E | TECHNICAL_TEST | 05 96 71 10 10 | third-party/ambiguous; UNKNOWN | excluded and revoked projection | UNTRUSTED | no contribution |
| VESPA ANTILLES | REAL_COMMERCIAL | 06 12 34 56 78 | owned URL; REJECTED; not bound | revoked projection | AMBIGUOUS | no contribution |

The phone display value remains in `prospects.phone` to preserve historical/current raw data. Trusted-phone eligibility is now represented separately by `phone_trust_states`.

## Counts

- `TRUSTED_PHONE_BEFORE`: 6
- `TRUSTED_PHONE_VALID`: 1
- `TRUSTED_PHONE_REVOKED`: 0 (the four invalid real-commercial rows are `AMBIGUOUS` because the persisted evidence is insufficient to classify the source as a known global-support source)
- `TRUSTED_PHONE_AMBIGUOUS`: 4
- `TRUSTED_PHONE_UNTRUSTED`: 1
- `REAL_COMMERCIAL_TRUSTED_PHONE`: 1

## Idempotency and D1 invariants

First run:

- prospects: 95 → 95
- non-empty phone rows: 6 → 6
- events: 9227 → 9233 (+6 append-only correction events)
- `research.scored`: 80 → 80

Second run:

- prospects: 95 → 95
- non-empty phone rows: 6 → 6
- events: 9233 → 9233 (+0)
- `research.scored`: 80 → 80

No original event was deleted or rewritten. No prospect row was changed. No Research replay occurred.

## Positive controls

No valid two-member positive-control set was manufactured. Only one real-commercial trusted phone was found (`ATHENA TRADING`), and it is not an approved Google positive control. Therefore the next Google production-validation mission must first establish at least two independently verified controls using existing local evidence or an explicitly approved evidence mission.

`POSITIVE_CONTROL_SET_INSUFFICIENT`

## Historical control regressions

ACTIBURO Rouen `02 35 52 82 00` and GIE LIEMAN generic support `+33 9 39 20 04 83` remain rejected by the repaired source-ownership contract. No missing historical event was fabricated. The historical Google result remains immutable:

`GOOGLE_PLACES_STRUCTURED_PROVIDER_EXPLORATORY_V1_FAIL`

The control-integrity note remains:

`BENCHMARK_CONTROL_INTEGRITY_COMPROMISED`

The Google 7/8 uncovered phone result is coverage-only and was not promoted.

## Tests and safety

The focused trust and provenance regressions pass, including append-only/idempotency contracts, ambiguous/revoked/untrusted exclusion, valid trusted-phone contactability, global/support rejection, ACTIBURO/GIE regressions, synthetic exclusion, history preservation, and zero provider/Tavily/Research/outreach assertions. Required core, API, and runner typechecks pass. Diff check passes.

Confirmed: local D1 only; zero Google requests; zero Tavily queries; zero Research replay; zero outreach; zero deployment; historical events preserved; dirty tree preserved.

## Recommended next mission

Run a separately approved Google production-validation design mission only after creating two valid, real-commercial, entity-bound positive controls and defining provenance retention/caching boundaries. Do not promote Google benchmark phones into canonical trusted-phone state.

TRUSTED_PHONE_CANONICAL_CORRECTION_V1_ACCEPTED
