# Magic Script V2 local lifecycle

The supported Windows entry points are:

```powershell
npm run ms:start
npm run ms:stop
npm run ms:restart
npm run ms:status
npm run ms:doctor
```

`ms:start` creates `.magicscript/runner.lock.json` before starting the local API, runner and Control Center. A second start refuses to create another stack. The lock records the process IDs and runner identity; stale metadata is recovered only when every recorded PID is gone. A live PID with an unexpected command line is preserved for review.

`ms:stop` validates the recorded process identity and stops each owned Windows process tree, including `npm`, `node`, `cmd` and `tsx` descendants where present. If a PID has been reused or cannot be identified safely, the metadata is kept and the command fails closed.

The local stack sets:

- `MAGICSCRIPT_SENDING_ENABLED=false`
- `MAGICSCRIPT_EMAIL_PROVIDER=disabled`
- `MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE=mock`

These values must remain disabled/mock for local smoke tests. Real mailbox credentials belong only in local runtime configuration and must never be committed.

The direct local API command (`npm run dev:api:local`) is also fail-closed: autopilot, sending and prototype deployment are disabled in `apps/api-worker/wrangler.local.jsonc`. Starting the Control Center alone (`npm run dev:control-center`) does not start the API or runner.

The runner defaults an unset `MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE` to `mock`. A real Pages path requires the separate explicit value `MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE=cloudflare` as well as API-side deployment admission and Cloudflare credentials.

For a faster continuation when dependencies and checks were already validated:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\magic-script.ps1 start -SkipInstall -SkipChecks
```

For a process/lock-only check when Kimi is unavailable, add `-SkipSmoke`; this does not run the discovery smoke test.

The full repository checks are:

```powershell
npm run check
npm run typecheck:runner
npm --workspace magic-script-agent-runner test
```

Cloudflare Pages deploys are performed by the runner only when the explicit deploy mode is `cloudflare`, with credentials supplied through runtime environment variables. Use the Pages test project documented in `docs/cloudflare-inventory.md`; do not change DNS or production resources from this local lifecycle.

For a real Pages E2E, persist only the non-secret account/project selection once:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-cloudflare-local.ps1 `
  -AccountId '<CLOUDFLARE_ACCOUNT_ID>' `
  -PagesProject '<PAGES_PROJECT_NAME>'
```

This writes `.magicscript/cloudflare.local.json`, which is ignored by Git. The API token is never written there; the runner uses `CLOUDFLARE_API_TOKEN` from the current session or the existing Wrangler OAuth profile.


## Day-1 operational hardening — 2026-09-07

The normal local lifecycle now forces prototype deployment admission to false and runner deploy mode to mock, even if the shell inherited true/cloudflare. Its stop hint is `npm run ms:stop`. Sending stays disabled (Full uses in-process dry-run).

Runner API routes fail before D1 access: missing/blank server stack identity => HTTP 503; missing/blank/mismatched runner identity => HTTP 409. The supported launcher generates one GUID, propagates it to API and runner, checks /health, and refuses an occupied 8787. Direct API-only operation remains possible; it does not authorize any runner while unfenced. No escape hatch was added.

Deployment claims require the latest prototype READY, prospect PROTOTYPE_READY, and the canonical canPromoteWithWebDesignReview predicate. The atomic claim rechecks the approved row ID, exact QA JSON, latest-row identity and lifecycle. Invalid/missing/changed review leaves the job PENDING without consuming attempts. Callback validation remains. This is an admission-time proof, not a new approval-revocation protocol for work already in flight; real deployments remain outside this operating mode.

Preferred already-installed startup is `npm run ms:start -- -SkipInstall -SkipChecks -SkipSmoke`, after explicitly choosing local ollama-aider and loopback Ollama as shown in the operating pack. These flags do NOT make startup read-only: D1 schema initialization and the runner still occur. Default ms:start also runs npm install, broad checks and discovery smoke. Do not use any startup/smoke command as forensic verification of canonical D1. For an already healthy tracked stack, keep it and use ms:status.

Alternate-port/multi-instance Wrangler is diagnostic-only, unsupported for Day-1; investigation deferred. The supported path is 8787. Stop with ms:stop; never kill all Node/workerd processes or delete .next directories. ms:stop performs a graceful lease callback before stopping verified process trees; do not use it merely as a read-only health check.

SAFETRANSPORT WAIT is expected with provider disabled; do not enable sending to make it PASS. NODEADLETTERS WAIT is an aggregate: 21 raw terminal rows, 14 without a later same-kind success (6 historical DISQUALIFIED + 8 current failures). WAITING_REPLY can come from DRY_RUN; inspect transport evidence. Job SUCCEEDED does not imply product QA PASS. An OPEN escalation reason is dated evidence and may be superseded (OPCO build succeeded later).

See bulk/reports/day-1-operating-pack-2026-09-07.md and bulk/reports/morning-full-window-2026-09-07.md. Earlier real Pages configuration examples in this document are not Day-1 startup commands and are not authorized by this mission.
