# Magic Script — Trusted Phone Provenance Audit + Control Repair V1

Date: 2026-09-16  
Mode: local-only, read-only D1 audit; no provider calls

## State preservation

The repository was dirty before this mission. No reset, stash, clean, unrelated revert, provider request, Tavily query, Research replay, outreach, deployment, or canonical write was performed. Local D1 was opened read-only. Historical events were preserved.

## Current canonical phone enumeration

The populated local D1 contains six prospects with a non-empty canonical `prospects.phone` value. The audit artifact `bulk/reports/trusted-phone-provenance-audit-v1.json` contains the complete record-level enumeration, including IDs, names, normalized phones, source URL/domain when recoverable, source type, evidence type, identity status, research event ID, acquisition event ID, canonicalization/presence event ID, and timestamp.

Current rows:

- ATHENA TRADING — `06 12 34 56 78` — source `https://athena-trading.com/contact`; historical research phone evidence; ownership needs review.
- GUY HOQUET L'IMMOBILIER — `06 12 34 56 78` — source `https://www.menhir-immobilier.fr/contact`; historical research phone evidence; identity history is rejected in the latest presence event; needs review.
- MART'AUDIO — `06 12 34 56 78` — source `https://www.mart-audio.com/contact`; latest Tavily presence rejected; needs review.
- SAVOIE — `02 98 55 00 00` — source `https://www.savoie.com/contact`; latest Tavily presence rejected; needs review.
- SUNeLEK - WhatsApp E2E — `05 96 71 10 10` — source `https://www.pagesjaunes.fr/pros/61829365`; third-party source; needs review.
- VESPA ANTILLES — `06 12 34 56 78` — source `https://www.vespa-antilles.com/contact`; latest Tavily presence rejected; needs review.

The current local D1 schema has a canonical `phone` field, not a separate persisted `trustedPhone` field. Accordingly, this mission did not silently rewrite or revoke those rows. Deterministic correction events/governance for canonical phone revocation are not present in the inspected schema.

## Known controls

The supplied ACTIBURO and GIE LIEMAN control findings are retained as historical evidence-integrity findings, but neither control appears as a current non-empty-phone row in the populated local D1 inspected during this run. The historical benchmark artifacts still record:

- ACTIBURO → `02 35 52 82 00`: known Rouen number, not Martinique business evidence; root cause is third-party/global source phone accepted after page-level identity matching.
- GIE LIEMAN GESTION → `+33 9 39 20 04 83`: generic Le Guichet des Formalités support number; root cause is a site-global platform phone accepted as target evidence.

This discrepancy is a blocker to claiming a complete current-D1 control repair or automatic before/after revocation for those two rows.

## Rule repaired

The smallest fail-closed repair is implemented in contact presence and evidence integrity:

- Phone evidence now carries optional source ownership and entity-bound metadata.
- `THIRD_PARTY_SITE_GLOBAL_CONTACT`, `AMBIGUOUS_SOURCE_OWNERSHIP`, `UNKNOWN`, or explicit `entityBound: false` cannot create `trustedPhone`.
- Owned business sources, direct structured business sources, and explicitly entity-bound third-party listing fields remain eligible.
- Existing non-phone evidence behavior is unchanged.

The runner classifies same-domain fetched phone evidence as `OWNED_BUSINESS_SOURCE`; other fetched candidates are marked `THIRD_PARTY_LISTING_BUSINESS_FIELD` pending explicit page-level ownership. This is conservative relative to the prior global-contact defect.

## Audit counts

- `TRUSTED_PHONE_BEFORE`: 6 current local-D1 canonical phone rows
- `TRUSTED_PHONE_VALID`: 0 conclusively established by persisted evidence in this read-only audit
- `TRUSTED_PHONE_REVOKED`: 0 persisted corrections; no correction event was authorized or available
- `TRUSTED_PHONE_AMBIGUOUS`: 6

These counts are an audit classification, not a canonical mutation.

## Required regression coverage

Added tests cover:

- third-party global phone rejection
- directory support phone rejection
- site footer/global phone rejection
- entity-bound listing phone acceptance
- owned-site phone preservation
- JSON-LD target phone preservation
- ACTIBURO Rouen regression
- GIE LIEMAN generic support regression
- historical event preservation
- no Google request
- zero Tavily usage
- no outreach

Focused provenance/evidence tests: 47 passed. Core, API, and runner typechecks passed. `git diff --check` passed.

## Operational impact

Until a separate deterministic revocation/canonicalization migration is approved, Contact Presence and contactability must not treat the six ambiguous canonical phone rows as newly validated. No score, qualification, contactability, or outreach state was changed by this mission.

The historical token `GOOGLE_PLACES_STRUCTURED_PROVIDER_EXPLORATORY_V1_FAIL` remains unchanged. The Google positive controls were compromised as controls by the provenance defects; this is recorded as `BENCHMARK_CONTROL_INTEGRITY_COMPROMISED`. No Google rerun is authorized by this mission.

## Next recommended mission

Approve a separately bounded, write-enabled canonical correction migration that:

1. maps each persisted phone to a deterministic provenance class;
2. creates append-only revocation/canonicalization events;
3. clears or recomputes only invalid canonical phone state;
4. rehydrates Contact Presence/contactability from corrected evidence without Research replay;
5. independently repairs/replaces the positive controls; and
6. adds persisted provenance columns or an append-only evidence index distinct from provider content.

TRUSTED_PHONE_PROVENANCE_AUDIT_V1_SAFE_STOP
