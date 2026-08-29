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

### Hunter free fallback

Contact discovery now follows this order:

1. public-source Kimi/Swarm discovery;
2. second public-source pass;
3. Hunter free API fallback only if the first two passes fail.

The Hunter fallback:
- runs Email Count first because that endpoint is free;
- calls Domain Search only when Hunter reports available emails;
- prefers sourced generic business addresses;
- enforces the same confidence + suppression gates;
- tracks monthly Hunter usage in D1;
- defaults to a 40-credit internal budget to preserve part of the 50-credit free allowance.

Hunter is not used for sending. The existing Amen mailbox remains the outbound/inbound transport.

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

### Email transport

Two paths now exist:

1. `dry-run` for zero-risk end-to-end testing;
2. `amen-smtp` for the existing Magic Script mailbox, using Amen SMTP outbound and IMAP inbound.

The Amen adapter includes:
- SMTP authentication check without sending;
- real SMTP send implementation behind the sending safety switch;
- IMAP polling;
- MIME reply parsing;
- In-Reply-To correlation;
- forwarding replies to the response-classification pipeline.

No real email is sent while the sending switch remains disabled.

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
6. configure the existing Amen mailbox runtime secrets;
7. run SMTP/IMAP connectivity check;
8. verify SPF/DKIM/DMARC;
9. run a controlled Amen SMTP test only after explicit approval;
10. implement follow-up scheduler;
11. implement prototype builder + QA + Cloudflare demo deployment;
12. finalize Control Center visual polish and live swarm graph;
13. enable autopilot only after the dry-run gates pass.

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
