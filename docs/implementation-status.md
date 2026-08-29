# Magic Script V2 — Implementation Status

_Last updated: 2026-08-29_

## Branch

Development branch: `magic-script-v2`

`main` remains untouched.

## Implemented

### Product rules

- autonomy policy
- human escalation policy
- swarm roles
- fact-check rules
- suppression-list rule
- no paid API without explicit approval
- automatic reconciliation of actionable prospects
- terminal-failure escalation only after retry exhaustion

### Core

- prospect state machine
- deterministic scoring
- next-action planner
- human escalation detection
- event model
- in-memory repositories for tests
- D1 repository adapters
- atomic D1 job claiming
- retry / dead-letter behavior
- stale-runner lease recovery
- runner claim ownership
- runner affinity for prototype build / QA / deploy work
- duplicate pending/running job protection

### Continuous integration

GitHub Actions now runs:

- core typecheck
- core tests
- API Worker typecheck
- agent runner typecheck
- Control Center production build

Automatic CI runs are disabled on `magic-script-v2` to prevent notification storms. Validation is deliberate: the workflow runs only on the dedicated `ci-check` branch or by manual dispatch. The first controlled validation run completed successfully: core tests, API Worker typecheck, runner typecheck and Control Center production build all passed. The workflow also performs a non-blocking live preflight against the free public business API.

### Control plane

Cloudflare Worker API with:

- health
- overview
- prospects
- prototype status
- provider usage
- outreach / follow-up status
- events
- jobs
- runners
- escalations
- autopilot discovery tick
- autopilot reconciliation
- runner claim / success / failure
- runner heartbeat
- inbound reply ingestion
- deterministic job drain
- stale-job recovery

### Agent execution plane

Local Kimi Code runner with:

- isolated work directories
- AgentSwarm prompts
- runner heartbeat
- job polling
- retry callbacks
- JSON result parsing
- prototype work-directory persistence
- deterministic prototype build verification
- prototype QA pass
- Cloudflare Pages deployment adapter behind a safety switch

Supported agent jobs:

- DISCOVER_PROSPECTS
- RUN_RESEARCH_SWARM
- DISCOVER_CONTACT
- GENERATE_OUTREACH
- FACT_CHECK_OUTREACH
- CLASSIFY_REPLY
- BUILD_PROTOTYPE
- RUN_PROTOTYPE_QA
- DEPLOY_PROTOTYPE
- SEND_EMAIL / SEND_FOLLOW_UP / SEND_DEMO_LINK through the configured transport

### API Recherche d’entreprises — primary free discovery

The primary structured discovery source is now the French government API Recherche d’entreprises.

It is used before SIRENE and Kimi because it:

- is officially published through data.gouv / Annuaire des Entreprises;
- requires no API key or account;
- has zero monetary API cost;
- supports department and activity-section filters;
- has a documented maximum of 7 requests/second per IP, while Magic Script uses only one paginated request per discovery cycle;
- persists the next Martinique page in D1 so discovery progresses instead of repeatedly scanning page 1.

Magic Script currently queries businesses with active establishments in Martinique in sections F, G, I, L, M, N, R and S. It explicitly reads the API's `matching_etablissements` and accepts only an active establishment in department 972, instead of incorrectly assuming the legal-unit head office is local. The selected local SIRET/address/activity is then sent through the existing research/scoring funnel.

If the public directory API is unavailable or yields no new prospects, Magic Script falls back to optional SIRENE and then the Kimi discovery swarm.

### INSEE SIRENE discovery

The discovery layer can now use the free INSEE SIRENE API as the first structured source for Martinique.

When `INSEE_SIRENE_API_KEY` is configured:

- active establishments with Martinique postal codes are scanned;
- activity codes are filtered toward local-business categories relevant to Magic Script;
- the public Annuaire des Entreprises page is stored as the existence source;
- a persisted D1 cursor avoids restarting the same page on every discovery cycle;
- newly created prospects immediately enter the normal research/scoring funnel;
- any SIRENE API failure falls back to the Kimi discovery swarm instead of stopping autopilot.

The SIRENE source discovers companies; it does not replace the deeper web research swarm.

### Hunter free fallback

Contact discovery follows this order:

1. public-source Kimi/Swarm discovery;
2. second public-source pass;
3. Hunter free API fallback only if the first two passes fail.

The Hunter fallback:

- runs Email Count first;
- calls Domain Search only when Hunter reports available emails;
- prefers sourced business addresses;
- enforces confidence and suppression gates;
- tracks monthly Hunter usage in D1;
- defaults to a 40-credit internal budget to preserve part of the free allowance.

Hunter is not used for sending.

### Controlled test-email sink

A dedicated SMTP test-sink mode is implemented for end-to-end mailbox validation.

When `MAGICSCRIPT_TEST_EMAIL_MODE=true`:
- the runner ignores the prospect address for delivery;
- every outbound message is routed to `MAGICSCRIPT_TEST_RECIPIENT`;
- the original prospect address remains metadata only;
- D1 records the send as `TEST_SENT`, not a commercial `SENT`;
- reply correlation can still be exercised from the controlled inbox.

This lets Magic Script validate the real Amen SMTP/IMAP loop without contacting prospects.

### Email transport

Two paths exist:

1. `dry-run` for zero-risk end-to-end testing;
2. `amen-smtp` for the existing Magic Script mailbox, using Amen SMTP outbound and IMAP inbound.

The Amen adapter includes:

- SMTP authentication check without sending;
- real SMTP sending behind the sending safety switch;
- IMAP polling;
- MIME reply parsing;
- In-Reply-To correlation;
- threaded follow-ups and demo replies;
- forwarding replies to the response-classification pipeline.

### Autonomous follow-ups

Implemented:

- configurable daily send limit;
- max follow-up count;
- D+3 first follow-up by default;
- D+5 second follow-up by default;
- suppression-list check before scheduling;
- automatic stop after a reply;
- reply threading;
- Control Center visibility.

### Prototype pipeline

Implemented behind deployment/sending safety switches:

```text
POSITIVE_REPLY
→ BUILD_PROTOTYPE
→ deterministic npm install/build
→ static out/ verification
→ PROTOTYPE_QA
→ fact/mobile/conversion/technical swarm
→ correction cycle on failure
→ PROTOTYPE_READY
→ Cloudflare Pages deploy
→ DEMO_REPLY_READY
→ threaded demo link reply
→ WAITING_REPLY
```

The QA correction cycle stays on the same runner/work directory to avoid multi-agent file conflicts.

### Control Center

The dashboard now reads real backend data for:

- prospects
- qualified leads
- emails
- replies
- hot leads
- prototypes
- live runners
- active jobs
- open human escalations
- Hunter usage
- outreach/follow-up limits
- prototype build / QA status
- safety switches
- live event stream
- dynamic Swarm nodes driven by active jobs and prospect states
- explicit TEST SINK / DRY RUN safety state

### Local first-run tooling

Implemented:

- zero-key public discovery preflight through `npm run check:free-api`;

- local-only D1 config
- one-command PowerShell start script
- one-command stop script
- smoke-test probe
- local logs under `.magicscript/`

The local smoke mode enables only internal `dry-run` delivery. It does not send external email.

## Deliberately disabled by default

- real outbound email
- automatic prototype deployment
- production D1
- production Worker deployment
- production autopilot
- paid APIs

## Remaining before first real commercial activation

1. run the one-command local swarm smoke test on a machine with authenticated Kimi Code;
2. verify D1 + Kimi discovery/research/contact/outreach in that runtime;
3. optionally add the Hunter Free key as a secret and validate fallback behavior;
4. configure Amen mailbox credentials as runtime secrets;
5. run SMTP/IMAP connectivity checks without sending;
6. verify SPF/DKIM/DMARC;
7. deploy the development Worker / D1 / Control Center;
8. run an end-to-end dry-run against public prospects;
9. validate prototype build + QA + Pages preview in development;
10. explicitly approve real outbound email before enabling the production sending switch.

## Production gate

No real prospect must receive an email until all of the following are true:

- CI is green;
- local/development smoke tests pass;
- D1 state transitions pass;
- suppression list is enforced;
- contact confidence gate is enforced;
- outreach fact-check passes;
- domain authentication is verified;
- daily send limits are configured;
- bounce/reply ingestion works, including hard-bounce suppression;
- prototype QA works when a demo is generated;
- real sending is explicitly approved.
