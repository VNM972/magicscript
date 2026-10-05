# Google Places Production Validation V3 — Preparation Safe Stop

## Finding

The requested contract is internally inconsistent with the supplied unchanged V2 controls.

The requirement says the canonical hash must be:

```text
sha256(JSON.stringify(sample.controls))
```

For the exact controls parsed from the unchanged V2/V3 JSON, Node `JSON.stringify(sample.controls)` produces:

```text
14dbf9dcff8540ba11e2edb2dcafa599a8c867fe87080ae81d0e4d37dcca31b2
```

The required value is:

```text
2422c0b59a7fca2d51838063cb3a7b75b1f13193cb283e3b84d765ebd33319fd
```

The `2422c0...` value is produced by the prior PowerShell/escaped-apostrophe serialization domain, not by JavaScript `JSON.stringify` over the parsed controls. Replacing apostrophes before hashing produces `8098ad...`, not the requested `2422c0...`, depending on the exact serialization path. A JSON file cannot preserve source-level escape spelling after parsing: `JSON.stringify` serializes the parsed string value.

Changing the controls to force `2422c0...` would violate the exact-control identity requirement. Changing the expected hash would violate the supplied contract. Therefore no scientifically valid V3 runner can both use exactly `sha256(JSON.stringify(sample.controls))` and accept `2422c0...` for these unchanged controls.

## Work performed

- Created V3 paired sample with the exact 10 V2 controls:
  `bulk/reports/google-places-production-validation-v1-sample-v3.json`
- Updated the runner to load V3 only, use address-parity queries, enforce 10 gold controls, and produce V3 sanitized observability fields.
- Added response-stage classification and bounded mock fixtures.
- Historical V1, V2, first external result, prior analysis, and forensic artifacts were not modified.
- No Google, Tavily, GKEY, or external request occurred.

## Test result

The exact bounded host retry executed the focused test once after sandbox `spawn EPERM`.

```text
22 passed
6 failed
```

The six failures are the same proven canonical-hash mismatch and its fail-before-network consequences. Typechecks passed:

```text
npm run typecheck:core
npm run typecheck:api
npm run typecheck:runner
```

`git diff --check` passed.

## Required operator decision before continuing

Choose one, explicitly:

1. redefine the canonical hash contract as the actual JavaScript `JSON.stringify(sample.controls)` hash (`14dbf9...`), or
2. preserve `2422c0...` and define the exact non-JavaScript canonical serialization that produced it, or
3. permit a corrected V3 control serialization that is no longer byte/value-identical to the parsed V2 controls.

No rerun is scientifically authorized until this contradiction is resolved.
