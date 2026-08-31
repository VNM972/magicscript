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

Cloudflare Pages deploys are performed by the runner only when the explicit deploy mode is not `mock`, with credentials supplied through runtime environment variables. Use the Pages test project documented in `docs/cloudflare-inventory.md`; do not change DNS or production resources from this local lifecycle.
