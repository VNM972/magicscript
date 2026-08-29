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
- runner claim ownership

### Control plane

Cloudflare Worker API with:

- health
- overview
- prospects
- events
- jobs
- runners
- escalations
- autopilot tick
- runner claim / success / failure
- runner heartbeat
- inbound reply ingestion
- deterministic job drain

### Agent execution plane

Local Kimi Code runner with:

- isolated work directories
- AgentSwarm prompts
- runner heartbeat
- job polling
- retry callbacks
- JSON result parsing

Supported agent jobs:

- DISCOVER_PROSPECTS
- RUN_RESEARCH_SWARM
- DISCOVER_CONTACT
- GENERATE_OUTREACH
- FACT_CHECK_OUTREACH
- CLASSIFY_REPLY

### Funnel implemented before real sending

```text
DISCOVERY
→ RESEARCH SWARM
→ SCORE
→ QUALIFY / DISQUALIFY
→ CONTACT DISCOVERY
→ CONTACT VALIDATION
→ OUTREACH DRAFT
→ FACT CHECK
→ OUTREACH VERIFIED
→ SEND GATE
```

### Reply pipeline

Provider-agnostic inbound endpoint exists.

```text
REPLY
→ REPLY_RECEIVED
→ CLASSIFY_REPLY
→ refusal / auto-reply / positive interest / price / meeting / custom / legal
→ automatic continuation or human escalation
```

### Control Center

- real backend data, not fake counters
- active jobs
- runner heartbeat status
- open human escalations
- outbound safety switches

### Safe email test mode

A `dry-run` provider path exists in the deterministic worker.

It creates a synthetic provider message id and advances the state machine without sending anything externally.

## Deliberately disabled

- real email sending
- real email provider
- automatic prototype deployment
- production D1
- production Cloudflare Worker
- autopilot
- prototype code-writing runner

## Not yet completed

1. execute repository typecheck/tests/build in a real runtime;
2. provision development D1 and apply schema;
3. deploy development API Worker;
4. start authenticated Kimi runner;
5. run dry-run end-to-end smoke test;
6. choose/configure outbound email provider;
7. verify SPF/DKIM/DMARC;
8. implement actual SEND_EMAIL provider;
9. implement follow-up scheduler;
10. implement prototype builder + QA + Cloudflare demo deployment;
11. finalize Control Center visual polish and live swarm graph;
12. enable autopilot only after the dry-run gates pass.

## Production gate

No real prospect must receive an email until all of the following are true:

- build/tests pass;
- D1 state transitions pass smoke tests;
- suppression list is enforced;
- contact confidence gate is enforced;
- outreach fact-check passes;
- domain authentication is verified;
- daily send limits are configured;
- bounce/reply ingestion is working;
- user explicitly approves activation of real sending.
