# Google Places Production Validation V3 — Hash Contract Resolution

## Independent verification

Using the exact Node implementation:

```js
crypto.createHash('sha256').update(JSON.stringify(sample.controls), 'utf8').digest('hex')
```

Results:

```text
V2_CONTROLS_HASH = 14dbf9dcff8540ba11e2edb2dcafa599a8c867fe87080ae81d0e4d37dcca31b2
V3_CONTROLS_HASH = 14dbf9dcff8540ba11e2edb2dcafa599a8c867fe87080ae81d0e4d37dcca31b2
JSON.stringify(v2.controls) === JSON.stringify(v3.controls) = true
```

The paired-sample gate passes.

## Adopted V3 contract

V3 now adopts:

```text
14dbf9dcff8540ba11e2edb2dcafa599a8c867fe87080ae81d0e4d37dcca31b2
```

The executable contract is exactly:

```text
sha256(JSON.stringify(sample.controls), utf8)
```

No apostrophe escaping, whole-object hashing, or raw-file hashing is used.

Historical values remain preserved as metadata only:

- `2422c0...`: `historicalMisidentifiedHash`; not used as the V3 gate.
- `8098ad...`: historical V2 declared escaped-domain hash; not used as the V3 gate.

No control, gold phone, source URL, business identity, prospect ID, or branch value changed.

## Verification

Focused V3 tests, after the required Windows sandbox EPERM host retry:

```text
31 passed
0 failed
```

Passed checks include V1/V2 preservation, parsed control equality, hash equality, canonical hash domain, historical hash exclusion, V3-only runner use, address-inclusive query construction, request budget, identity fail-closed behavior, response-stage classification, sanitized artifacts, no GKEY persistence, zero Tavily, and no canonical mutation.

Typechecks passed:

```text
npm run typecheck:core
npm run typecheck:api
npm run typecheck:runner
git diff --check
```

No Google request, Tavily request, GKEY access, external network request, canonical mutation, scoring mutation, contactability mutation, qualification mutation, or outreach occurred.

The V3 operator rerun is ready but was not executed.
