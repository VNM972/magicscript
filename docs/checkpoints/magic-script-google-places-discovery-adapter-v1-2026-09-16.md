# Google Places Structured Discovery Adapter V1 + Multi-Phone Contact Model V1

## Summary

Implemented Google Places as a **STRUCTURED_DISCOVERY_CANDIDATE** provider and upgraded Magic Script phone handling to support **multiple legitimate phone numbers per prospect**, using the authoritative `libphonenumber-js/max` phone library.

## Phone library

- Library: `libphonenumber-js@^1.13.13` (max metadata variant).
- Status: newly added as a dependency of `@magicscript/core`.
- Phone type classification no longer uses hand-written prefix regexes. All E.164 normalization and MOBILE/LANDLINE detection is delegated to libphonenumber-js/max.
- Contract: `normalizePhoneE164(value, countryCode?)`, `classifyPhoneType(value, countryCode?)`, `parsePhone(value, countryCode?)`.
- Country context: MQ (Martinique) and FR (France) supported explicitly; international-format numbers detect the country automatically. Without country context a local-only number fails conservatively.

### Regression examples

| Region | Type | Input | E.164 | Phone type |
|---|---|---|---|---|
| MQ | FIXED_LINE | `0596511236` (MQ) | `+596596511236` | LANDLINE |
| MQ | MOBILE | `0696000000` (MQ) | `+596696000000` | MOBILE |
| FR | FIXED_LINE | `0142685300` (FR) | `+33142685300` | LANDLINE |
| FR | MOBILE | `0612345678` (FR) | `+33612345678` | MOBILE |
| MQ | international | `+596 696 00 00 00` | `+596696000000` (no double prefix) | MOBILE |
| FR | international | `+33 6 12 34 56 78` | `+33612345678` (no double prefix) | MOBILE |

Unknown/unparseable (`not-a-number`, VOIP, TOLL_FREE, unknown countries) → UNKNOWN, never guessed.

## Multi-phone model

- `PhoneRecord` models each phone independently: normalizedPhone, displayPhone, phoneType, sourceKind, identityBinding, branchBinding, trustStatus, trustReasonCodes, provenance timestamps.
- All legitimate entity-bound numbers coexist: multiple mobiles, mobile + landline, multiple landlines.
- Trust is per phone, never prospect-wide.
- Deduplicate by normalizedPhone + prospectId; multiple sources for the same number merge trust rather than duplicating.
- Operator priority: TRUSTED MOBILE → VERIFIED MOBILE → OTHER MOBILE → FIXED_LINE_OR_MOBILE → LANDLINE → UNKNOWN; `preferredMobile` chosen deterministically.
- Landlines retained and shown, never discarded, never outrank a mobile.
- WhatsApp stays independent; MOBILE does not imply WhatsApp; LANDLINE not selected for SMS/WhatsApp.

## Google structured-discovery adapter

- `googlePlacesStructuredDiscovery(...)` returns placeId, identity verdict + reason codes, branch verdict, website candidate, phone candidates collection, request metadata.
- **Disabled by default** (`enabled !== true` → NOT_EVALUATED / GOOGLE_DISABLED).
- Phone never influences identity binding.
- Google alone never creates trustedPhone, never sets contactability 85, never modifies qualification/scoring, never establishes WhatsApp, never authorizes outreach.
- Different valid Google vs first-party numbers coexist as MULTIPLE_VALID_PHONE_CANDIDATES, not automatic conflict.
- Sanitized observability; GKEY never logged/persisted.
- No real Google call is made by the adapter (pure function over a candidate response + identity target).

## Multiple numbers do not inflate scoring

- Contactability is a scalar; the collection adds no count/mobile/source bonus.
- A legitimately trusted phone continues through the existing trusted-phone contactability path.

## Tests

Focused (phone-record + adapter): **61 passed, 0 failed**.
Regression (google-places-trust + phone-trust + phone-extractor): **33 passed, 0 failed**.

## Validation

- `npm run typecheck:core` — pass
- `npm run typecheck:api` — pass
- `npm run typecheck:runner` — pass
- `git diff --check` — clean (exit 0)

## Safety

- Zero real Google requests.
- Zero Tavily.
- Zero GKEY access.
- Zero external network requests.
- No D1 mutation, no trustedPhone mutation, no scoring/contactability/qualification mutation, no outreach, no deployment.
