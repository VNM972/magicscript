# Magic Script V2 — V1/V2 Architectural Boundary

**Mission:** V2-M001 — boundary and salvage freeze.
**Status:** canonical architectural authority for subsequent V2 missions.

## Purpose

This document freezes the approved V1 salvage decisions before new V2 agents are built. It distinguishes what is currently present from what is future V2. It does not claim that deferred V2 features exist.

## Canonical future funnel (FUTURE V2)

```text
AGENT 1: discovery + ICP + dedup + contact + opportunity
  -> INGESTED
  -> VERTICAL DESIGNER
  -> DESIGN DIRECTOR REVIEW
       -> insufficient: DESIGNER -> REVIEW
  -> PROPOSAL READY
  -> OUTREACH READY
  -> VISIBLE ON DECK
  -> OPERATOR SEND
  -> CONTACTED
  -> PROPOSAL VIEW / RETURN / SHARE
  -> MEETING BOOKED
  -> CALL COPILOT
  -> QUOTE READY
  -> operator validates/sends quote
```

Only a valid **EMAIL or MOBILE** may enter the future V2 funnel. No commercial outreach is automatically sent: the operator triggers commercial sending.

## Frozen decisions

- Engagement calculation remains backend capability for Hive/analytics; it is not an operator-facing primary metric. The eventual Deck uses understandable signals such as proposal viewed, return visit, share and meeting booked.
- Reusable email reply/IMAP capability remains in the backend, but is not a central V2 Deck feature.
- `sites/magicscript-v2` is the public website. It is separate from the internal Control Center and its legal/public assets are preserved.
- No V1 prospect is migrated into V2. `Sunelek` is quarantined; `M Patrimoine` may remain a technical/design reference; SNEMM demo coupling is not an active V2 admission path.

## Classification vocabulary

- **KEEP** — active reusable infrastructure or public surface.
- **ADAPT** — currently present and reusable, but its V2 contract will change later.
- **QUARANTINE** — may remain for compatibility, history, diagnostics or reference, but must not be treated as active V2 product behavior.
- **REMOVE** — clearly obsolete and safe to delete; no current removal is required by this freeze.
- **NEW_V2** — conceptual future work, explicitly not implemented in V2-M001.

The machine-readable inventory is `config/magicscript-v2-boundary.json`. It is deliberately small and lists actual repository paths.

## Current repository surfaces

### KEEP — CURRENTLY PRESENT

- Event history and persistence: `core/events`, `database/schema.sql`.
- Queue, jobs, claims, retries and runner mechanics: `core/jobs`, `apps/agent-runner`, `apps/api-worker/src/index.ts`.
- Prototype/build/install/static-output/deployment primitives: `core/prototypes`, `apps/agent-runner/src`, `apps/api-worker/src/index.ts` (deployment remains guarded).
- SMTP transport, idempotency, suppression and reusable reply/IMAP paths: `outreach`, `apps/api-worker/src/index.ts` (external sending remains disabled unless explicitly configured and manually authorized).
- Engagement, share and return-visit tracking primitives: backend/API and schema.
- Booking, meetings, Call Copilot and quote/pricing/document primitives: `apps/api-worker`, `apps/control-center`, `core` (their final V2 relations/UI are deferred).
- Agent runs, jobs/events history, Overnight Mission Compiler, BU Watch, LiveSwarmGraph, LiveRefresh, local preview/lifecycle scripts and CI foundation where present.
- Public website and legal pages: `sites/magicscript-v2`.

### ADAPT — CURRENTLY PRESENT, V2 CONTRACT DEFERRED

- Configuration: `core/config.ts`.
- Prospect/contact types and D1 repository/schema: `core/types/prospect.ts`, `core/persistence/d1-prospect-repository.ts`, `database/schema.sql`.
- Discovery/contact providers and research outputs: `core/providers`, `core/contact-acquisition`, `core/contact-presence`, `core/research`.
- Current Agent 1 and Agent 2/prototype strategy: `agents`, `apps/agent-runner/src`, `core/orchestrator`.
- Web design review, prototype QA, BU registry/team content, orchestrator/next-action/escalation and outreach generation: corresponding `core`, `agents` and runner files.
- Meetings relation, Call Copilot UI, business documents, commercial lifecycle, Control Center DTOs, QA/smoke tests and prospect template.

### QUARANTINE — CURRENTLY PRESENT BUT NOT ACTIVE V2 ARCHITECTURE

- V1 discovery/research/contact/scoring progression and its admission gates: `core/orchestrator/engine.ts`, `core/orchestrator/next-action.ts`, `core/providers/discovery.ts`, `core/scoring`.
- Association/public-services routing, prototype cost as a funnel gate, automatic V1 follow-up behavior and automatic outreach progression are legacy behavior, not the canonical V2 funnel.
- Current V1 Control Center page: `apps/control-center/app/page.tsx` and related legacy panels. It remains operational for diagnostics, but is not the final Deck; its technical IDs, provider/runner panels and legacy Sales Room concepts are not V2 UX requirements.
- Sales Room surface: `sites/magicscript-v2/public/index.html`, `sites/magicscript-v2/public/app.js`; retained only for compatibility/reference until Proposal migration.
- Legacy prospect fixtures: `prospects/sunelek.md`, `bulk/sunelek.md`, `prototypes/sunelek`; none may feed V2 automatically. M Patrimoine remains reference-only where present. SNEMM is not an active V2 prospect.
- Visible Integrity Observer, operator summary and “du premier signal à la livraison” panels are legacy UI/documentation concepts, not V2 architecture.

### REMOVE

No broad deletion is authorized in M001. No reusable primitive is removed. Future removal requires a focused, dependency-checked mission.

### NEW_V2 — NOT IMPLEMENTED

Agent 1 V2; Vertical Designers; Senior Design Director; meeting notification layer; Hive Architect; Hive Intelligence UI; final multichannel ProspectContact model; full V2 state machine; new outreach copy; proposal-linked meetings.

## M009 implementation — V2 Operator Deck V1 (IMPLEMENTED)

The internal Control Center now exposes a compact commercial Operator Deck backed by `GET /api/v2/deck`. The projection is fail-closed to canonical `PROPOSAL_READY` records with valid prospect linkage and includes only operator-useful identity, opportunity, contactability, Proposal link, engagement signals, and supported meeting status. The primary UI removes legacy developer/runtime noise, does not expose engagement scores, and does not implement send, outreach, Agent 3, deployment, or Sales Room behavior.

M009 final acceptance is proven by `artifacts/v2/deck/m009-final-acceptance.json`: the production Control Center build succeeded; the real local Deck rendered in Chrome/CDP; Proposal-ready fixtures appeared while non-ready fixtures stayed hidden; the Proposal link returned HTTP 200; viewed, returned, shared, and meeting signals were visible; legacy diagnostics and send behavior were absent; and a desktop screenshot was captured. Operator send and Agent 3 remain deferred to M010.

## V2-M010 documentary closure — CLOSED / PASS

**MILESTONE=V2-M010**
**STATUS=PASS / CLOSED**
**CLASSIFICATION=M010_CAN_CLOSE_NOW**

The independent closure review compositionally proves all original mandatory M010 requirement groups. Evidence is accepted across focused deterministic tests, real Worker/D1 runtime evidence, runner evidence, browser/UI evidence, and persisted acceptance artifacts. No authoritative V2 governance document requires one monolithic acceptance execution containing every M010 invariant.

| Requirement | Status |
|---|---|
| M010-R01 — Grounded deterministic drafts | PROVEN |
| M010-R02 — Immutable revisions | PROVEN |
| M010-R03 — Exact revision/fingerprint approval | PROVEN |
| M010-R04 — Approved historical r1 / successor r2 / stale rejection | PROVEN |
| M010-R05 — Operator-controlled EMAIL only / no automatic initial send | PROVEN |
| M010-R06 — Atomic reservation and idempotence | PROVEN |
| M010-R07 — Successful send projections | PROVEN |
| M010-R08 — Suppression / invalid-send protection | PROVEN |
| M010-R09 — Deterministic failure semantics | PROVEN |
| M010-R10 — Manual MOBILE confirmation only | PROVEN |
| M010-R11 — Operator Deck preparation / Contacted projection / safety boundary | PROVEN |

- **PRODUCT_BLOCKERS=0**
- **UNPROVEN_MANDATORY_REQUIREMENTS=0**
- **MONOLITHIC_ACCEPTANCE_REQUIRED=NO**
- **REAL_EXTERNAL_EMAIL_SENT_DURING_ACCEPTANCE=NO**
- **BACKEND_SMS_SEND=NO**
- **BACKEND_WHATSAPP_SEND=NO**
- Historical harness/infrastructure failures are not current product blockers; the canonical retry lifecycle is `PENDING → RUNNING → SENDING → failure evidence → /fail → PENDING` when retryable, eventually `DEAD_LETTER` after exhausted retries.
- Optional, non-blocking hardening remains deferred: explicit duplicate-success callback invocation, duplicate-failure callback invocation, a second MOBILE confirmation invocation in the monolithic runner, and further monolithic harness cleanup. None keeps M010 open.
- Scope remains limited to M010. Call Copilot, Buzz, Commercial Playbook, automation, payment, later tunnel requirements, and M011 are not included or started.

## M008 implementation — Proposal Packaging V1 (IMPLEMENTED)

Proposal Packaging V1 consumes a genuinely passed `VISUAL_QA_REPORT_V1` and creates one canonical `PROPOSAL_V1` while preserving build, proposal and prospect provenance. The tracked Proposal link resolves through the isolated public Proposal route; first view, return visit and share events are recorded as `PROPOSAL_VIEWED`, `RETURN_VISIT` and `SHARE_CLICKED`. The public booking entry path is available without exposing private contact/debug data. Proposal creation is deterministic and idempotent for the same approved build and QA evidence. M001 operator-send protections remain preserved. No Sales Room, Deck, outreach or deployment is reintroduced.

M008 final acceptance is proven by `artifacts/v2/proposal/m008-final-acceptance.json`: the corrected Visual QA evidence produced a canonical Proposal, preserved provenance, resolved the tracked link with HTTP 200 HTML, verified isolation and engagement events, exercised booking entry, confirmed idempotent creation, and confirmed safety gates for private data, Sales Room, outreach and deployment.

## M002 implementation — Contact & Opportunity Pack V2 (IMPLEMENTED)

The post-Agent-1 admission boundary is implemented at `POST /api/v2/admission` and in `core/admission`. It accepts only explicit Contact & Opportunity Pack V2 input, normalizes contacts deterministically, rejects malformed/non-contactable packs, deduplicates by stable identifiers/domain/qualifying normalized contact, and persists successful admissions as `INGESTED`. A successful admission is then projected deterministically to `DESIGN_REQUEST_V1` and one queued `V2_DESIGN_REQUEST` job; no designer consumes that job in M003. The path is `INGESTED -> DESIGN REQUEST -> DESIGN JOB QUEUED`. It does not score, research, run discovery, invoke a prototype cost gate, or migrate historical V1 prospects.

## Autonomy and safety invariants

1. A valid EMAIL or MOBILE is required at the V2 admission boundary.
2. No legacy prospect is automatically migrated or admitted to V2.
3. No commercial send is automatic. Draft/prepared outreach may be generated, but sending is an explicit operator action.
4. Sending, SMTP, suppression, idempotency and IMAP capability are preserved as backend primitives.
5. Engagement scores stay backend-only; operator signals remain understandable and event-based.
6. Public website and internal Control Center remain separate deployable surfaces.
7. Cost gates, discovery, research and scoring cannot silently become the canonical V2 funnel.
8. New V2 agents and Hive UI remain deferred; the V2 Operator Deck V1 is implemented as an internal commercial surface, while Proposal routes remain isolated and are not a Sales Room surface.
9. Infrastructure history remains auditable and deterministic.

## Migration principles

Prefer classify/document, then detach or guard, then narrowly remove only when a dependency audit proves safety. Preserve dirty-tree user work and do not migrate or reactivate old prospects. Subsequent missions must update both this document and the machine manifest when a boundary changes.

## M003 boundary note

M003 adds `core/design/design-request.ts` and `core/design/design-handoff.ts`. The handoff accepts only an existing canonical V2 prospect in `INGESTED`, projects persisted admitted pack data without research/contact projection, stores `DESIGN_REQUEST_V1`, and queues `V2_DESIGN_REQUEST` through the existing jobs queue. Repeated calls use the prospect plus request version as the deterministic key. The queued job is intentionally not consumed by a Vertical Designer in this mission. `INGESTED` remains `STOP` in the legacy `next-action` map, so it cannot enter V1 research, scoring, prototype, outreach, or Sales Room progression.

## M004 implementation — Vertical Designer Engine V1 (IMPLEMENTED)

`core/design/design-artifact.ts` provides one common profile-based engine for RESTAURANT, BEAUTY, LOCAL_SERVICE and GENERAL_LOCAL_BUSINESS. It consumes only canonical `DESIGN_REQUEST_V1`, applies grounded content rules, validates structured `DESIGN_ARTIFACT_V1`, and persists immutable revisions through `v2_design_artifacts` using schema version plus content revision. M005 adds `core/design/design-review.ts` and `core/design/design-director.ts`: an independent Senior Design Director produces persisted `DESIGN_REVIEW_V1` findings and either approves or creates a structured correction request for the same Vertical Designer engine. `V2_DESIGN_REVIEW` and `V2_DESIGN_REVISION` jobs are bounded to `MAX_DESIGN_REVISIONS = 3`, idempotent, persist artifact status transitions, and stop at approval or `REVIEW_LIMIT_REACHED`. M005R proves approval, correction, limit, replay, isolation, and the transactional M004 table-rebuild migration with executable assertions. No research, scoring, private contacts, outreach, Proposal, Deck or deployment is performed; the prospect remains `INGESTED`. M006 adds `core/builder/site-builder.ts`: only an internally `APPROVED` `DESIGN_ARTIFACT_V1` may create one deterministic `BUILD_ARTIFACT_V1` with local static source/output under `artifacts/v2/sites/<prospect>/<artifact>/`; the Builder performs no research or design strategy.

## M006 implementation — Builder V1 (IMPLEMENTED)

`V2_BUILD_SITE` is a distinct queue job created by the approved-artifact handoff. The common Builder validates approval, design-request/prospect/vertical linkage, generates semantic responsive HTML/CSS and a build manifest, verifies the local output, and persists `v2_build_artifacts`. Replays reuse the deterministic build identity and successful output. DRAFT, CORRECTION_REQUIRED and REVIEW_LIMIT_REACHED artifacts are rejected. No deployment, Proposal, Deck, outreach or visual QA is included.

## M007 implementation — Local Visual QA V1 (IMPLEMENTED)

`core/visual-qa` validates successful local `BUILD_ARTIFACT_V1` output through the existing loopback preview server and CDP browser mechanism. It checks desktop and 390px mobile rendering, approved section fidelity, CTA visibility, overflow, navigation, assets, placeholders, runtime errors and accessibility basics. Reports persist as `VISUAL_QA_REPORT_V1`; implementation defects create bounded `BUILD_CORRECTION_REQUEST_V1` records and remain in the Builder path. QA stops at `MAX_VISUAL_QA_ATTEMPTS = 3` without auto-passing. Deployment, Proposal, Deck and outreach remain deferred.

## Validation note

M007R real-browser acceptance is proven by `artifacts/v2/qa/m007r-final-acceptance.json`: Chrome/CDP rendered the genuine M006 `BUILD_ARTIFACT_V1` at 1440x900 and 390x844, captured screenshots, detected an injected mobile overflow, persisted a correction, rebuilt through Builder V1, and revalidated the corrected build to PASS. Replay and the three-attempt `VISUAL_QA_LIMIT_REACHED` behavior were also verified. This freeze is based on the actual repository at M001 preflight. Existing V1 code remains in place where removing it would be broad or destructive; that is an explicit quarantine, not a claim that it is the future V2 implementation.
