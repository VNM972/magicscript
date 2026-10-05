# Magic Script Agent 1 Canonical Bridge Checkpoint — 2026-09-15

## Recovery

- Branch: `wp09-sales-room-bfa-20260904`.
- Existing dirty/untracked work preserved; no reset, revert, deployment, outreach, or broad discovery performed.
- `project/PROJECT_STATE.json`: revision 36, `V1_FIELD_FROZEN`, no active mission. It does not record the historical Agent 1 shortlist tunnel.
- Latest relevant prior checkpoints were the Le Bayou real-tunnel checkpoint and BU visibility/creative checkpoint.

## Confirmed gap

The canonical `AGENT1_CANDIDATE_BATCH_V1` contract and `POST /api/agent1/batches` adapter existed. The runtime `DISCOVER_PROSPECTS` runner path previously returned a legacy discovery result and never called the canonical adapter.

## Implemented bridge

- Added `apps/agent-runner/src/agent1-canonical.ts` to convert legacy discovery output into a validated runtime `AGENT1_CANDIDATE_BATCH_V1` batch.
- Added `MagicScriptApi.ingestAgent1Batch()` and runner dispatch for `DISCOVER_PROSPECTS`.
- Added controlled runner/API authorization for this endpoint.
- Tightened the discovery prompt to require identity evidence.
- Added focused bridge tests.

## Runtime proof

The repository-managed local stack was restarted with approved host-level execution because confined Wrangler/tsx execution hit Windows `spawn EPERM`.

- Managed API health: `ok=true`, local D1 configured, email disabled, deployment disabled.
- Managed runner: shared stack ID, heartbeat `BUSY/IDLE` functioning.
- Existing canonical batch `targeted-shortlist-2026-09-15` is persisted as `DISCOVER_PROSPECTS`, source `agent1-canonical-v1`, contract `AGENT1_CANDIDATE_BATCH_V1`.
- Its Agent 1 context is persisted in `discovery.prospect_created` events for KAY JUJU and BERNARD'S COFFEE SHOP with SIREN/SIRET/city and evidence.
- Both candidates reached D1 `Prospect` rows without broad discovery.
- Both downstream `RUN_RESEARCH_SWARM` jobs were claimed and completed successfully by the shared runner:
  - KAY JUJU: `650d916f-fb75-4181-8cd6-e359f18693b7`
  - BERNARD'S COFFEE SHOP: `ff5052a2-fcea-4baf-a6b3-0971d8638b81`
- Both produced `research.scored` events and Control Center/API projections with `scoreType=CALIBRATED_RESEARCH`, `scoreSource=research.scored`, evidence integrity passed, and deterministic score `0` because no supported commercial/contact/prototype evidence was found. Both were correctly `DISQUALIFIED`; no qualification override occurred.
- KAY JUJU's registry URL was not treated as an owned website by the updated evidence path in the latest runtime result; BERNARD'S canonical `websiteUrl` is null.
- No outreach, email, deployment, paid provider, prototype, or broad discovery action occurred.

## Validation

- `npm run typecheck:runner`: PASS.
- `npm run typecheck:api`: PASS.
- `git diff --check`: PASS.
- Confined runner/test execution hit documented Windows `spawn EPERM`; approved host-level managed lifecycle execution succeeded.

## Objective status

The Agent 1 → canonical ingestion → D1 Prospect → Research → Evidence Integrity → CALIBRATED_RESEARCH → Control Center connection is now proven locally for the recovered targeted shortlist. Remaining unrelated pending jobs were not consumed.
