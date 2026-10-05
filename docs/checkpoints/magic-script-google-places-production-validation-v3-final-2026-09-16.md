# Google Places Production Validation V3 — Final Result Analysis

## Verdict

`GOOGLE_PLACES_PRODUCTION_VALIDATION_V3_SAFE_STOP`

The existing operator artifact was analyzed locally only. No test, runner, Google request, Tavily request, GKEY access, or external request was performed during this analysis.

## Run integrity

- Sample: `bulk/reports/google-places-production-validation-v1-sample-v3.json`
- Canonical controls hash: `14dbf9dcff8540ba11e2edb2dcafa599a8c867fe87080ae81d0e4d37dcca31b2`
- External result: `bulk/reports/google-places-production-validation-v1-external-results-v3.json`
- Controls: 10
- Recorded requests: 10
- Request budget: 10
- Query contract: `exploratory-parity-address.v1`
- Identity contract: `deterministic-multi-signal.v1`
- Observability schema: `sanitized-response-stage.v1`

## Metrics

- `ENTITY_FOUND`: 10/10
- `ENTITY_RESOLUTION_RATE`: 100%
- `IDENTITY_VERIFIED`: 8/10
- `IDENTITY_MISBIND_COUNT`: 0
- `PHONE_PRESENT`: 8/10
- `PHONE_PRESENCE_RATE`: 80%
- `PHONE_MATCH_COUNT`: 5/10 overall; 5/8 verified entities
- `PHONE_MATCH_RATE`: 50% overall; 62.5% of verified entities
- `PHONE_CONFLICT_COUNT`: 3/10 overall; 3/8 verified entities
- `PHONE_CONFLICT_RATE`: 30% overall; 37.5% of verified entities
- `PHONE_ABSENT_COUNT`: 2/10
- `BRANCH_MATCH_COUNT`: 8/10
- `BRANCH_ERROR_COUNT`: 0
- `BRANCH_ERROR_RATE`: 0%
- `HTTP_ERROR_COUNT`: 0
- `SCHEMA_ERROR_COUNT`: 0

Response stages:

- `VERIFIED`: 8
- `IDENTITY_REJECTED`: 2
- `GOOGLE_ZERO_RESULTS`: 0
- `PARSER_ZERO_CANDIDATES`: 0
- `IDENTITY_AMBIGUOUS`: 0
- `BRANCH_REJECTED`: 0
- `HTTP_ERROR`: 0
- `SCHEMA_ERROR`: 0

## Complete diagnostics

| # | Business | Commune / branch | Raw places | Parsed | Identity candidates | Verified | Identity | Phone | Branch | Stage |
|---:|---|---|---:|---:|---:|---:|---|---|---|---|
| 1 | ELECTRONIQUE + | Le Lamentin — Place d'Armes | 1 | 1 | 1 | 1 | VERIFIED | EXACT_MATCH | MATCH | VERIFIED |
| 2 | POMPES FUNEBRES CARISTAN | Basse-Pointe — Zone Artisanale Eyma | 1 | 1 | 1 | 1 | VERIFIED | EXACT_MATCH | MATCH | VERIFIED |
| 3 | ACTIBURO MARTINIQUE | Le Lamentin — ZI La Lézarde | 1 | 1 | 1 | 1 | VERIFIED | EXACT_MATCH | MATCH | VERIFIED |
| 4 | KAY JUJU | Fort-de-France — 182 Bois Boyer | 1 | 1 | 1 | 1 | VERIFIED | CONFLICT | MATCH | VERIFIED |
| 5 | ENVIE D AILLEURS | Sainte-Luce — 15 rue Victor Hugo | 1 | 1 | 1 | 1 | VERIFIED | CONFLICT | MATCH | VERIFIED |
| 6 | SARL SOREIDOM | Le Robert — 3 Rue de l'Industrie | 2 | 2 | 2 | 1 | VERIFIED | CONFLICT | MATCH | VERIFIED |
| 7 | DEKRA LE LAMENTIN | Le Lamentin — Habitation Carrère | 1 | 1 | 1 | 0 | REJECTED | ABSENT | NOT_EVALUATED | IDENTITY_REJECTED |
| 8 | GENERALE D'OPTIQUE LES MANGLES | Le Lamentin — Zone Industrielle Les Mangles | 2 | 2 | 2 | 0 | REJECTED | ABSENT | NOT_EVALUATED | IDENTITY_REJECTED |
| 9 | SUN LOISIRS MARTINIQUE | Les Trois-Îlets — Marina Pointe du Bout | 1 | 1 | 1 | 1 | VERIFIED | EXACT_MATCH | MATCH | VERIFIED |
| 10 | LA BALADE DU SOLEIL | Le François — François/Robert excursions | 1 | 1 | 1 | 1 | VERIFIED | EXACT_MATCH | MATCH | VERIFIED |

### Explicit conflicts

- KAY JUJU: Google phone conflicts with first-party gold phone.
- ENVIE D AILLEURS: Google phone conflicts with first-party gold phone.
- SARL SOREIDOM: Google phone conflicts with first-party gold phone.

No conflicting Google phone was promoted.

## V2 → V3 comparison

| Metric | V2 | V3 |
|---|---:|---:|
| Entity found | 0/10 | 10/10 |
| Identity verified | 0/10 | 8/10 |
| Phone present | 0/10 | 8/10 |
| Identity misbindings | 0 | 0 |
| Branch errors | not observable | 0 |

Interpretation: V3 restored the canonical-address query contract and unified the deterministic identity path. The V2 0/10 result was an implementation collapse, not evidence that Google returned zero coverage. V3 confirms substantial Google entity coverage, while also revealing three real phone conflicts.

## Trust-contract application

The production contract requires:

- zero material identity misbindings;
- zero wrong-branch promotions;
- high phone agreement against independently verified gold references;
- explicit conflict reporting;
- governance compatibility;
- Evidence Integrity remaining fail-closed.

V3 satisfies the identity-misbinding and branch-safety conditions:

```text
identity misbindings: 0
wrong-branch promotions: 0
branch errors: 0
```

However, phone agreement is not high enough for production phone-source acceptance: 3 of 8 verified entities conflict with independent gold phones. The conflicts are explicitly reported, but reporting them does not satisfy the acceptance gate. Google phones remain evidence-only and are not trusted phones.

No scoring or contactability calibration was performed. No value of 85 was assigned. No qualification or outreach behavior changed.

## Preservation and safety

- V1 sample preserved.
- V2 sample preserved.
- V3 sample preserved.
- V1 external result preserved.
- Prior V1 analysis preserved.
- Forensic report preserved.
- No additional Google request.
- No GKEY access.
- Zero Tavily.
- Zero Research replay.
- Zero canonical mutation.
- Zero trustedPhone mutation.
- Zero scoring mutation.
- Zero contactability mutation.
- Zero qualification mutation.
- Zero outreach.
- Historical events preserved.

Machine-readable report: `bulk/reports/google-places-production-validation-v1-final-v3.json`.
