# Google Places Production Validation V1 — Design + Bounded Validation

**Phase status:** `GOOGLE_PRODUCTION_VALIDATION_EXTERNAL_RUN_REQUIRED`

This document is a design and pre-call stop. No Google call was made by Harness, no Google phone was promoted, and no scoring, qualification, contactability, outreach, or Evidence Integrity behavior was changed.

## Production trust contract

The proposed evidence class is `DIRECT_STRUCTURED_PROVIDER_EVIDENCE`:

- `providerPlaceId`
- `providerType: GOOGLE_PLACES_NEW`
- `acquiredAt`
- `canonicalProspectId`
- `identitySignals`
- `identityVerdict`
- `phoneNormalized`
- provenance metadata (`provider`, query hash, response hash, field mask, operator run ID)
- response integrity metadata (request count, HTTP status, SHA-256 payload hash)
- `schemaVersion`

The contract is implemented in `core/google-places-trust.ts`. It is deliberately separate from `PhoneTrustState`; `googlePhoneMayBecomeTrustedPhone()` is a hard-coded `false` V1 gate.

## Identity contract

Identity is verified only by deterministic, non-phone signals: business/trade name, locality, address/postal code, and compatible website domain when available. Any material conflict yields `REJECTED`; insufficient corroboration yields `AMBIGUOUS`. Wrong branch and wrong locality therefore fail closed. Phone is not accepted as an identity input and cannot increase confidence.

## Google governance findings (bounded, non-legal conclusion)

The applicable Google Maps Platform Terms and Service Specific Terms must be reviewed by the operator/legal owner for the account and current EEA configuration before production use. The sources consulted were:

- [Google Maps Platform Terms](https://cloud.google.com/maps-platform/terms)
- [Google Maps Platform Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms)
- [Google Cloud AUP](https://cloud.google.com/terms/aup)

Because the rendered terms were not fully available in this local run, this mission does **not** claim permission to persist Places content. Architecture therefore treats the following as separate:

**Persistable candidate metadata (subject to account/terms confirmation):** provider place ID, canonical prospect ID, acquisition timestamp, hashes, field mask, request/run provenance, deterministic identity signals/verdict, and validation metrics.

**Google content requiring live or limited-lifetime use until confirmed:** phone, formatted address, display name, website, and any copied response content. The safe fallback is `prospect → persisted placeId + provenance → live/revalidated Place Details → operator-visible current phone`; never permanent phone copying by default.

No derived-data permission, indefinite cache period, or refresh interval is invented here. Operator must record the exact current contractual answer before acceptance.

## Predeclared validation set

The exact frozen set is `bulk/reports/google-places-production-validation-v1-sample.json`.

- 10 controls, 7 Martinique communes represented across food, retail, restaurant, automotive, industrial services, HVAC, funeral services, electronics, and office supplies.
- Branch-sensitive treatment is enabled for every control.
- Existing historical ACTIBURO/GIE controls are not reused as positive controls; ACTIBURO is retained only as a wrong-phone regression control.
- Only ELECTRONIQUE +, CARISTAN, and ACTIBURO currently have independently recorded first-party gold phone evidence in repository artifacts. The other seven controls are predeclared but not yet eligible for a Google call until gold evidence is established from a first-party official or authoritative government source. If fewer than 10 are safely completed by the operator, report `SAFE_STOP` with the exact available count.
- Sample hash (SHA-256 of `JSON.stringify(controls)`): `7a63d984d05602916f324b72ab9021978362f1ef6fabbe14bf88d6d70a62145e`.

Gold evidence rules: identity-bound, location/branch-bound where necessary, deterministically normalized; never Google, snippets, generic directories, publisher support numbers, or platform footer numbers. The existing SUNELEK directory number is explicitly not gold.

## Operator runner

Run only outside Harness, by an authorized operator, after freezing and reviewing the sample:

```powershell
$env:GKEY = '<operator-managed key>'
node scripts/run-google-places-structured-provider-benchmark.mjs
Remove-Item Env:GKEY
```

The exact operator-only runner is `scripts/run-google-places-production-validation-v1.mjs`. It reads only `process.env.GKEY`, verifies the frozen sample before the first request, makes at most 10 bounded Text Search requests, emits sanitized fields only, and never mutates canonical state. Do not pass `GKEY` to Harness, CI, tests, or repository files. The older exploratory runner remains historical and must not be used for this validation.

## Required metrics and acceptance gate

For every gold reference record entity resolution, deterministic identity binding, phone presence, normalized phone equality, conflict, and branch correctness. Report:

`ENTITY_RESOLUTION_RATE`, `IDENTITY_PRECISION`, `PHONE_PRESENCE_RATE`, `PHONE_EXACT_MATCH_RATE`, `PHONE_CONFLICT_RATE`, `BRANCH_ERROR_RATE`.

Acceptance requires zero material identity misbindings, zero wrong-branch phone promotions, high phone agreement against independently verified gold references, explicit reporting of every conflict, terms-compatible architecture, and Evidence Integrity still fail-closed. No arbitrary scoring weights are used and no Google contactability value of 85 is assigned.

## Required tests

The trust tests must cover:

- `GOOGLE_IDENTITY_FAILS_CLOSED`
- `WRONG_BRANCH_REJECTED`
- `PHONE_DOES_NOT_INFLUENCE_IDENTITY`
- `GOLD_REFERENCE_FIRST_PARTY_ONLY`
- `DIRECTORY_NOT_GOLD_REFERENCE`
- `GOOGLE_CONTENT_GOVERNANCE_ENFORCED`
- `PLACE_ID_PROVENANCE_PRESERVED`
- `NO_GOOGLE_PHONE_AUTO_TRUST`
- `NO_SCORING_CHANGE`
- `NO_OUTREACH`
- `NO_TAVILY`

Then run the relevant trust, Contact Presence, Evidence Integrity, and API tests, followed by:

```text
npm run typecheck:core
npm run typecheck:api
npm run typecheck:runner
git diff --check
```

Historical exploratory result `GOOGLE_PLACES_STRUCTURED_PROVIDER_EXPLORATORY_V1_FAIL` and the 7/8 coverage signal remain unchanged. This phase ends before any new real Google request with `GOOGLE_PRODUCTION_VALIDATION_EXTERNAL_RUN_REQUIRED`.
