# Local runtime safety — 2026-09-07

## Proven starting state

- Branch `wp09-sales-room-bfa-20260904`, HEAD `47d693880be1a00075e08f0a8e38369752894fb2`, behind upstream by one commit, intentionally dirty.
- The tracked lifecycle stack was still running: Control Center on `127.0.0.1:3000`, API on `127.0.0.1:8787`, runner ID `magicscript-LAPTOP-BDP53BBS` (tracked root PID 28948).
- A separate stale Magic Script API was listening on `127.0.0.1:8790` from `wrangler.local.jsonc`; it was unresponsive and retained the unsafe pre-fix configuration.

## Proven cause

`npm run dev:api:local` delegates to the API workspace command `wrangler dev --config wrangler.local.jsonc --port 8787`. That local config explicitly set autopilot, sending and prototype deployment to `true` and the email provider to `dry-run`. The Deck does not start this path: `npm run dev:control-center` starts only Next.js and reads the API at `127.0.0.1:8787` when available.

The API maps the config value directly into `prototypeDeployEnabled`; when true, `/api/runner/jobs/claim` includes `DEPLOY_PROTOTYPE`. A direct API has no stack generation by default, and the stack guard accepts runner requests when the server-side stack ID is absent. The long-lived lifecycle runner therefore reconnected after fetch failures and claimed a pending job when the direct API briefly became available.

The runner had been started by the supported lifecycle on 2026-09-04 with email disabled and prototype deployment mode `mock`. Before this correction, however, an independently started runner treated an unset deploy mode as the real Cloudflare path.

## UCPA trace

- Prospect: `4cc2b65b-02e3-42bf-8bc7-a5787c351a4f` (`UCPA SPORT VACANCES (UCPA)`).
- Job: `f5bce6d9-7086-4b1f-86aa-2fcd43bb1412`, `DEPLOY_PROTOTYPE`, created 2026-09-01, pending before the Deck run, third/final attempt on 2026-09-06 at 20:49 UTC.
- Claiming runner: `magicscript-LAPTOP-BDP53BBS`, the tracked lifecycle runner process tree rooted at PID 28948 (execution child PID 27080).
- Claim transition: prospect `PROTOTYPE_READY` → `PROTOTYPE_DEPLOYING`.
- Runner output: mock pages.dev URL plus the explicit record `Local mock deployment; no Cloudflare request made.`
- Success callback: rejected with HTTP 500 because the persisted QA payload had no valid BU Web Design review.
- Final state: job `DEAD_LETTER`, attempts `3/3`; prospect `HUMAN_ACTION_REQUIRED`; one expected open `MANUAL_REVIEW_REQUIRED` escalation created; prototype remains `READY` with `deployment_url = NULL`.
- No recent outreach-message write and no email/contact/deployment success event was recorded. No UCPA replay, retry, cancellation or manual lifecycle mutation was performed by this mission.

The Web Design gate is a callback-time persistence gate, not a pre-deployment gate: it blocked state promotion after the mock result, but it would have been too late to prevent a real Pages request. It is therefore not counted as the sole deployment safety boundary.

## Startup paths and safe defaults

| Command | Services / bindings | External capability | Safe default |
|---|---|---|---|
| `npm run dev:control-center` | Next.js Control Center; development API target `127.0.0.1:8787` | Starts no runner, email or deploy path | Safe by itself |
| `npm run dev:api:local` | API on 8787; local D1 binding (no `remote: true`) | Deploy admission off; sending off; provider disabled | Deny |
| `npm run dev:runner` | Runner only; configured local API required | Email defaults disabled; deploy mode now defaults mock; real deploy requires explicit `cloudflare` | Deny / mock |
| `npm run ms:start` | Control Center 3000 + API 8787 + runner; stack-generation fence | CLI overrides sending false, email disabled and deploy admission false; runner mock | Deny |
| `npm run smoke:swarm` | Uses an already running local API and local D1 | May exercise local orchestration; no real external action under the supported stack | Local only |
| `npm run ms:start -- -Full` | Full local stack with deterministic dry-run email provider | Simulated outbound state only; deploy admission remains off and runner remains mock | Dry-run only |

## Correction

- `apps/api-worker/wrangler.local.jsonc`: local autopilot, sending and deploy admission now false; email provider disabled.
- `apps/agent-runner/src/deploy.ts`: unset/empty deploy mode defaults to `mock`; only literal `cloudflare` reaches the real Pages path; unknown values fail closed.
- Added focused deploy-mode tests and clarified `docs/local-lifecycle.md`.
- Stopped only the conclusively unsafe stale Magic Script API tree on port 8790. Mission-created isolated-check trees on 8791 were also stopped. Other Magic Script and unrelated processes were preserved.

## Verification

- Runner deploy-mode tests: 3/3 pass.
- Core orchestrator tests: 13/13 pass, including send/deploy switch blocking.
- Runner typecheck: pass.
- API typecheck: pass.
- Supported lifecycle status: API, runner and Control Center tracked/running.
- Live API health on 8787 after hot reload: autopilot false, sending false, email provider disabled, effective outbound disabled, test mode false, deploy false.
- Live Deck request on 3000: HTTP 200.
- Isolated `wrangler dev --local` on 8791 reached `Ready` with separate persistence, but its health request hung in the multi-instance environment; the mission-created tree was removed. The supported 8787 path supplied the runtime health proof.
- Read-only D1 forensic queries confirmed the UCPA job/result/escalation/prototype state and absence of recent outreach writes.
- Final listeners: preserved Control Center 3000, Deck preview 3002 and API 8787; unsafe 8790 and mission-created 8791 absent.
- `git diff --check`: pass (exit 0, no output).

## Remaining risks

- A direct API without `MAGICSCRIPT_STACK_ID` still accepts an authenticated runner from another local stack. With corrected defaults it cannot offer deploy or external-send jobs, but it may offer non-external local work if those jobs already exist.
- The BU Web Design check remains after runner execution. Explicitly authorized real deployments should eventually add the same gate before claim/execution; that is outside this normal-startup safety delta.
- Alternate-port multi-instance Wrangler health remained unreliable; the supported 8787 lifecycle path is healthy.

## Acceptance matrix

| Criterion | Result | Evidence |
|---|---|---|
| R1–R2 | PASS | Direct local API config and command chain proven |
| R3–R4 | PASS | Runner/process and UCPA transition reconstructed from process tree, logs and D1 |
| R5 | PASS | Mock result, null deployment URL, no recent outreach write or success event |
| R6–R8 | PASS | Deck 200 with safe API; local API health safe; runner default mock tested |
| R9–R12 | PASS | Email/contact/deploy off; local D1 only |
| R13–R15 | PASS | No Cloudflare/Amen/DNS mutation; dirty state preserved; no UCPA replay |
| R16 | PASS | Focused tests and typechecks pass |
| R17 | PASS | `git diff --check` exit 0, no output |
