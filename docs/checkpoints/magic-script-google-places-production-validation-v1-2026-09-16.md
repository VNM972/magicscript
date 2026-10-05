# Magic Script — Google Places Production Validation V1

## Final result analysis checkpoint

**Verdict:** `GOOGLE_PLACES_PRODUCTION_VALIDATION_V1_SAFE_STOP`

No Google request, test, runner, GKEY access, Tavily request, or external request was performed during this final analysis. The existing sanitized operator artifact was read locally only.

## Integrity finding

The requested canonical V2 sample hash is:

```text
2422c0b59a7fca2d51838063cb3a7b75b1f13193cb283e3b84d765ebd33319fd
```

The computed hash using the runner's documented canonical serialization is:

```text
8098ad73317e254a60086713635b7925ae2bed816ce0dc75662cda7de40244f9
```

The sample declares `8098ad...`, and the external artifact also declares `8098ad...`. The sample is internally consistent with the artifact but does not match the required frozen expected hash. Under the trust contract, this is a fail-closed integrity blocker. The sample was not modified.

## Run accounting

- Controls: 10
- Google requests recorded in artifact: 10
- Maximum budget: 10
- Budget satisfied: yes
- Additional requests in this analysis: 0

## Prospect-by-prospect comparison

| Business | Commune / branch | Gold phone | Google entity | Identity | Google phone | Phone | Branch |
|---|---|---:|---|---|---:|---|---|
| ELECTRONIQUE + | Le Lamentin — Place d'Armes | +596596513585 | none | REJECTED | none | ABSENT | CONFLICT |
| POMPES FUNEBRES CARISTAN | Basse-Pointe — Zone Artisanale Eyma | +596696442230 | none | REJECTED | none | ABSENT | CONFLICT |
| ACTIBURO MARTINIQUE | Le Lamentin — ZI La Lézarde | +596596511236 | none | REJECTED | none | ABSENT | CONFLICT |
| KAY JUJU | Fort-de-France — 182 Bois Boyer | +33970355233 | none | REJECTED | none | ABSENT | CONFLICT |
| ENVIE D AILLEURS | Sainte-Luce — 15 rue Victor Hugo | +596596743276 | none | REJECTED | none | ABSENT | CONFLICT |
| SARL SOREIDOM | Le Robert — 3 Rue de l'Industrie | +596596380559 | none | REJECTED | none | ABSENT | CONFLICT |
| DEKRA Le Lamentin | Le Lamentin — Habitation Carrère | +596596565085 | none | REJECTED | none | ABSENT | CONFLICT |
| Générale d'Optique Les Mangles | Le Lamentin — Zone Industrielle Les Mangles | +596596645869 | none | REJECTED | none | ABSENT | CONFLICT |
| Sun Loisirs Martinique | Les Trois-Îlets — Marina Pointe du Bout | +596696055152 | none | REJECTED | none | ABSENT | CONFLICT |
| La Balade du Soleil | Le François — François/Robert excursions | +596696300449 | none | REJECTED | none | ABSENT | CONFLICT |

## Metrics

- `ENTITY_FOUND`: 0/10
- `ENTITY_RESOLUTION_RATE`: 0%
- `IDENTITY_VERIFIED`: 0/10
- `IDENTITY_MISBIND_COUNT`: 0
- `PHONE_PRESENT`: 0/10
- `PHONE_PRESENCE_RATE`: 0%
- `PHONE_MATCH_COUNT`: 0/10
- `PHONE_MATCH_RATE`: 0%
- `PHONE_CONFLICT_COUNT`: 0/10
- `PHONE_CONFLICT_RATE`: 0%
- `BRANCH_ERROR_COUNT`: 0
- `BRANCH_ERROR_RATE`: 0%

`CONFLICT` branch labels in the per-control table indicate that no verified Google branch was available; they are not counted as wrong-branch promotions. There were no provider entities or phones to promote.

## Trust contract decision

The production trust contract requires a matching frozen sample hash, deterministic identity verification, zero material misbindings, zero wrong-branch promotions, and terms-compatible governance. Because the required V2 hash does not match the sample/artifact hash, the result cannot be accepted even though the artifact is internally consistent and fail-closed. No thresholds were changed after seeing results.

No Google phone was made trusted, and no scoring, contactability, qualification, canonical contact, or outreach behavior changed.

## Safety confirmations

- No additional Google request: confirmed.
- No GKEY access: confirmed.
- Zero Tavily: confirmed.
- Zero Research replay: confirmed.
- Zero canonical mutation: confirmed.
- Zero trustedPhone mutation: confirmed.
- Zero scoring mutation: confirmed.
- Zero outreach: confirmed.
- V2 sample unchanged: confirmed.
- Historical events preserved: confirmed.

Full machine-readable analysis: `bulk/reports/google-places-production-validation-v1.json`.
