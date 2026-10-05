# Magic Script — Google Places Structured Provider Exploratory V1

Date: 2026-09-16  
Provider: `GOOGLE_PLACES_NEW`  
Mode: operator-executed external API; analysis performed locally without GKEY

## Frozen sample

- Source: `bulk/reports/tomtom-structured-provider-sample-v1.json`
- SHA-256: `b39721d123fd252a1e9dca276fa49446a454027fcb381958be6cfe207699d75d`
- Composition: 10 total; 8 `UNCOVERED`; 2 `POSITIVE_CONTROL`; 0 `ADVERSARIAL`
- Sample unchanged during analysis.

## Request accounting

The operator artifact reports 10 requests. The artifact contains all 10 frozen prospect IDs, each with `requestCount: 1`; sum is 10 and there are no secondary requests.

## Google metrics

- `ENTITY_FOUND`: 7 / 10
- `IDENTITY_VERIFIED`: 7 / 10
- `IDENTITY_AMBIGUOUS`: 0 / 10
- `IDENTITY_REJECTED`: 3 / 10
- `NOT_FOUND`: 0 / 10
- `PHONE_FIELD_PRESENT`: 7 / 10
- `INCREMENTAL_PHONE_COUNT`: 7 / 8
- `INCREMENTAL_PHONE_RATE`: 87.5%
- `POSITIVE_CONTROL_ENTITY_MATCH`: 0 / 2
- `POSITIVE_CONTROL_PHONE_MATCH`: 0 / 2
- `POSITIVE_CONTROL_PHONE_MISMATCH`: 0 / 2
- `POSITIVE_CONTROL_PHONE_ABSENT`: 2 / 2
- `IDENTITY_MISBIND_COUNT`: 0
- `TOTAL_REQUESTS`: 10

## Uncovered prospect results

| Canonical prospect | Found | Verdict | Google entity/address | Website | Phones | Incremental verified phone |
|---|---:|---|---|---|---|---:|
| BERNARD'S COFFEE SHOP | Yes | VERIFIED | Bernard'S Coffee — Kiosque n⁸11, Rue de la liberté, Fort-de-France 97200 | bernards-coffee.business.site | 0696 16 13 27 / +596 696 16 13 27 | Yes |
| CORAIL | No | REJECTED | No selected entity | — | — | No; all candidates rejected by deterministic identity binding |
| ENVIE D AILLEURS | Yes | VERIFIED | Envie d'Ailleurs — 15 Rue Victor Hugo, Sainte-Luce 97228 | boutiques-enviedailleurs.com | 05 96 74 32 76 / +33 5 96 74 32 76 | Yes |
| ELECTRONIQUE + | Yes | VERIFIED | ELECTRONIQUE + — Centre Commercial Place d'Armes, Le Lamentin 97232 | — | 0596 51 35 85 / +596 596 51 35 85 | Yes |
| KAY JUJU | Yes | VERIFIED | Restaurant Kay Juju - Spécialités Haïtiennes — 182 Route de Lamentin, Fort-de-France 97200 | — | 0696 53 65 44 / +596 696 53 65 44 | Yes |
| L'UNIVERS DU PNEU | Yes | VERIFIED | L'Univers du Pneu Le Morne Rouge — Rue Jean-Jaurès Haut du Bourg, Le Morne-Rouge 97260 | luniversdupneu.mq | 0596 66 06 98 / +596 596 66 06 98 | Yes |
| POMPES FUNEBRES CARISTAN | Yes | VERIFIED | Pompes Funèbres Martinique : Pompes Funèbres Caristan — Zone artisanale Eyma, Basse-Pointe 97218 | pfcaristan.fr | 0696 44 22 30 / +596 696 44 22 30 | Yes |
| SARL SOREIDOM | Yes | VERIFIED | Soreidom — 1 Rue Isambert, Le Robert 97231 | soreidom.com | 05 96 38 05 59 / +33 5 96 38 05 59 | Yes |

## Positive controls

- **ACTIBURO** — intended business not resolved; verdict `REJECTED`; Google phone absent; current trusted phone `02 35 52 82 00`; result `ABSENT`.
- **GIE LIEMAN GESTION** — intended business not resolved; verdict `REJECTED`; Google phone absent; current trusted phone `+33939200483`; result `ABSENT`.

No canonical phone, trusted phone, contactability, score, qualification, or other operational state was changed.

## Direct TomTom comparison

| Measure | TomTom | Google |
|---|---:|---:|
| Entity coverage | 2 / 10 | 7 / 10 |
| Identity verified | 2 / 10 | 7 / 10 |
| Incremental phone coverage | 0 / 8 | 7 / 8 (87.5%) |
| Positive-control resolution | 0 / 2 | 0 / 2 |
| Identity errors/misbinds | 0 reported | 0 |
| Total requests | 12 | 10 |

## Predeclared exploratory gate

The gate is **FAIL**. Although identity misbinds are zero and 7/8 uncovered prospects yielded incremental identity-verified phones, both positive controls did not resolve to their intended businesses. The predeclared PASS condition therefore is not satisfied.

This result means Google Places does not pass this exploratory gate. It does not authorize `trustedPhone`, `DIRECT_STRUCTURED_PROVIDER_EVIDENCE`, contactability changes, scoring, qualification, production routing, or permanent Google-content persistence.

## Data-governance boundary

Retained benchmark fields are provider place ID, provider name, address, website, national and international phones, normalized phone, identity signals/verdict/reason, query, response timestamp, response hash, and request count. This is not a legal conclusion. Google Places content persistence/caching constraints must be addressed in a later production integration design. Persisted place IDs/provenance and provider-content retention must remain architecturally distinct.

## Safety confirmation

Harness never received GKEY; GKEY was not persisted; no additional Google request was made; Tavily queries and Research replay were zero; no canonical contact, trustedPhone, scoring, or qualification mutation occurred; no outreach or deployment occurred; the frozen sample is unchanged; historical events and the pre-existing dirty tree were preserved.

## Next recommended mission

Do not integrate Google into production from this exploratory result. If pursued, run a separately approved production-validation/design mission focused on positive-control resolution, Google data-governance/caching constraints, provenance architecture, and explicit operational authorization.

GOOGLE_PLACES_STRUCTURED_PROVIDER_EXPLORATORY_V1_FAIL
