# Magic Script V2 — Local Swarm Smoke Test

This is the first real execution milestone for the V2 engine.

It runs the Cloudflare Worker and D1 locally, starts the Kimi runner, queues a real public-business discovery job, and exposes the result in the Control Center.

## Safety

The local configuration deliberately sets:

```text
MAGICSCRIPT_AUTOPILOT_ENABLED=true
MAGICSCRIPT_SENDING_ENABLED=false
MAGICSCRIPT_EMAIL_PROVIDER=disabled
MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED=false
```

The swarm can research public businesses and generate internal pipeline data.
It cannot send a real email.

## Windows one-command path

From the repository root on branch `magic-script-v2`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-swarm.ps1
```

The launcher:

1. verifies Node, npm and Kimi;
2. installs workspace dependencies;
3. runs typechecks, tests and dashboard build;
4. initializes a local-only D1 database;
5. starts the API Worker on port 8787;
6. starts the Kimi runner;
7. starts the Control Center on port 3000;
8. queues the first discovery batch;
9. waits for discovery to complete;
10. confirms that a live runner and prospect data exist.

## Local services

- Control Center: `http://127.0.0.1:3000`
- API Worker: `http://127.0.0.1:8787`
- D1: local Wrangler storage only

Wrangler local mode keeps D1 separate from the remote Cloudflare database unless remote mode is explicitly requested.

## Discovery batch

The local config starts with only 3 businesses in Martinique.

Discovery now tries the official no-key API Recherche d’entreprises first. If that source creates prospects directly, the smoke test accepts that path and does not wait for a Kimi DISCOVER_PROSPECTS job. Kimi remains the fallback and performs the deeper research jobs.

This validates:

```text
DISCOVERY
→ KIMI RUNNER
→ D1
→ RESEARCH JOB CREATION
→ CONTROL CENTER
```

without creating a large test workload.

## Hunter

Hunter is optional for the first smoke test.

Without `HUNTER_API_KEY`, the system uses the public-source Kimi contact discovery passes and simply skips the Hunter fallback.

When a Hunter Free key is later configured, it must be supplied as a runtime secret and never committed.

## Amen

The Amen SMTP/IMAP adapter is already implemented but is not involved in this smoke test.

Mailbox connectivity can be checked separately without sending:

```powershell
npm --workspace magic-script-agent-runner run email:check
```

That command requires the mailbox credentials to be present as runtime environment variables.

## Logs

Local process logs are written to:

```text
.magicscript/logs/
```

This directory is gitignored.

## Pass criteria

The smoke test passes only if:

- API is healthy;
- D1 is configured;
- local autopilot is on;
- real sending is off;
- discovery succeeds;
- at least one prospect exists;
- a runner heartbeat is live.

A successful smoke test still does not authorize real outbound email.


## Zero-key API preflight

Before starting the full swarm, the public French business API can be tested independently:

```powershell
npm run check:free-api
```

This performs a read-only request for active Martinique businesses.

It requires no Hunter key, no INSEE key, no mailbox password and sends no email.


## Worker + D1 CI smoke

The controlled validation branch also runs the Cloudflare Worker against Wrangler local D1 without a Kimi runner.

It verifies:

```text
free public directory
→ Worker
→ local D1
→ prospect creation
→ Research Swarm job queued
```

This test needs no Hunter key, no mailbox credentials and no paid API.

The local Worker transport remains `dry-run`, so external email delivery is impossible during this smoke.
