# Magic Script V2 — Deck Final Specification

**STATUS: PRODUCT SPEC FROZEN FOR IMPLEMENTATION**  
**Authority:** implementation authority for the final Magic Script V2 Deck.  
**Scope:** documentation/product specification only. This document does not claim implementation.

## 1. Product definition

The Deck is **Magic Script's Operator Commercial Cockpit**: a premium, human-facing business product for operating the commercial pipeline.

It is not a developer console, infrastructure dashboard, raw event viewer, backend state-machine inspector, or technical governance console.

Normal operator views hide internal IDs, hashes, fingerprints, raw engagement and quality scores, job/event IDs, backend state-machine internals, technical M00X labels, and raw governance plumbing. Technical authority remains backend-side.

Closed product decisions remain closed: M001–M010, CP01–CP05, Booking CTA, and their evidence are not reopened. Proposal is the sole canonical prospect-facing commercial runtime. Sales Room is legacy/internal only.

### Frozen decisions

- Home layout: approved.
- Centered Living Hive: approved.
- Active production WIP maximum: 20 prospects.
- Living Hive: passive and non-interactive.
- Magic Script visual direction: approved.
- Proposal-only prospect-facing authority: approved.

## 2. Brand and visual system

- **Base:** near-black / charcoal.
- **Primary energy:** Magic Orange.
- **Text:** off-white.
- **Secondary:** muted slate / gray.
- **Style:** premium, modern, clean, executive, AI/SaaS; restrained outside the Living Hive.
- Use the Magic Script logo consistently.
- Use a modern geometric sans-serif. If no exact production font is already canonically established, specify the visual requirement without inventing a licensed/proprietary font dependency.
- No gamer RGB, multicolor cyberpunk, Matrix styling, or crypto-dashboard noise.
- The Living Hive receives the richest glow, movement, and energy. Surrounding blocks remain calm and clean.

## 3. Home Deck — frozen layout

Desktop hierarchy:

```text
HEADER
  operational summary + Living Hive + upcoming actions
  commercial pipeline filters
  compact prospect working list
```

The Living Hive is the central visual anchor and receives approximately 50–60% of the central upper workspace width, with enough height for meaningful spatial depth. Conceptually:

- **Left:** TODAY / operator workload.
- **Center:** Living Hive.
- **Right:** upcoming meetings, due follow-ups, important recent signals.
- **Below:** pipeline filters, then prospect list.

Responsive behavior is conceptual only at this stage: preserve the information hierarchy and the Hive's prominence as the viewport narrows; mobile implementation details are not designed by this freeze.

### Header

Keep navigation minimal: Magic Script identity/logo, prospect search, Prospects, Meetings, Improvements / CP05 governance, Archives, and a dedicated Living Hive entry. Avoid technical navigation.

### TODAY

Answer **what requires the operator's attention now?** with a small set of useful counters: active prospects X/20, follow-ups due, meetings today, and quotes requiring validation. No vanity metrics and no engagement score.

### Commercial filters

Human-readable progression:

**À contacter → Envoyés → En attente → RDV → Devis → Relances → Gagnés → Perdus → Archivés**

Canonical domain states remain authoritative underneath; React must not duplicate lifecycle authority. “Demo ready” is an underlying readiness condition, not the primary commercial status.

### Prospect list

Keep rows/cards compact. Show only company, activity/vertical, useful location, available channels, demo/Proposal readiness when relevant, human-readable outreach state, latest meaningful signal, and next meaningful action. The dominant row action is **OUVRIR**.

### Right-side operational block

Concise sections: **PROCHAINS RDV**, **RELANCES DUES**, **SIGNAUX IMPORTANTS**. Signals may include a reply, Proposal return, meeting booking/reschedule, or another meaningful canonical milestone. Do not reproduce Buzz, clicks, or every event.

## 4. Active production WIP — hard rule

The canonical active production/contact WIP limit is **20 prospects**. At most 20 prospects occupy the active “À contacter / production active” window.

Only prospects in an active Deck slot may trigger:

**Vertical Designer → Senior Design Director → Builder → Visual QA → Proposal**

Backlog prospects may retain discovery, research, and contactability data, but must not trigger website/demo production or consume Designer/Builder/QA resources. When a prospect is contacted/sent, rejected, archived, disqualified, or otherwise leaves active production, its slot becomes available. Already-produced demos are not deleted. Sent, waiting, meeting, quote, follow-up, and similar prospects remain visible but do not consume the 20 production slots. Manual operator priority may pull a backlog prospect into an available slot.

The Deck/canonical commercial authority decides eligibility. The Living Hive only observes resulting work and never grants or manages slots.

## 5. Prospect workspace

Opening a prospect leads to one coherent commercial workspace containing, where canonical authority exists: identity/context; activity, vertical, and location; Proposal access and canonical public Proposal link; research/personalization evidence; current outreach and history; meaningful history; meetings; notes; current next action; quote/follow-up entry points; and archive/reactivate when applicable.

Provide a clearly grouped **ACTIONS** area rather than scattering controls. Sales Room must not appear as prospect-facing authority. Proposal remains the canonical public commercial runtime.

### Outreach workspace / CP04 authority

Expose **EMAIL / MOBILE**, the current prospect-specific message, human-readable quality state, concise blocker/correction reason, edit, approval state, and email send only when canonical authority allows it. MOBILE is manual only.

Allowed human-readable states include: Message prêt; Correction nécessaire; Bloqué; Abstention; Approuvé pour cette version; Version modifiée — nouvelle approbation nécessaire; Envoi disponible; Envoi non disponible; Envoyé.

Normal operators never see hashes, fingerprints, raw quality score, quality attempt number, or internal revision diagnostics. Backend exact-revision authority remains enforced.

## 6. Human commercial signals

Expose concise real signals: Proposal viewed, returned, meaningful share, response received, meeting booked/rescheduled, and latest meaningful action. Never expose raw engagement score or create a noisy event feed.

## 7. Living Hive — role and visual contract

The Living Hive is purely observational. There is **no operator interaction with agents**: the operator cannot launch, stop, move, reprioritize, assign, approve, modify, or trigger work from the visualization.

Its purpose is to show how Magic Script lives through real Business Units, agents, work, interactions, intra-/inter-BU handoffs, waiting, blocked work, completion, concurrency, and Hive observations. Every operational visual corresponds to real telemetry. Fabricated tasks, handoffs, blocking, workload, progress, or observations are prohibited. Ambient micro-motion is allowed only when it does not imply fake business activity.

### Visual target

The target sensation is alive, organic, fluid, spatial, layered, energetic, continuously breathing, and more active when real work increases. The perceptual target is 3.5D/4D: foreground, midground, background, parallax, true-looking depth, trajectories passing in front of and behind clusters, layered particles, volumetric BU clusters, multiple velocity bands, organic irregularity, calm/active contrast, and simultaneous activity. It should feel like a living organism rather than a graph.

### Semantic grammar

| Real state/entity | Visual meaning |
|---|---|
| Agent | Stable semantic core inside its BU cluster |
| Business Unit | Volumetric territory containing real agents |
| Working | Local orange circulation and increased local energy |
| Waiting | Slow held orbit; subtle life without fake work |
| Blocked | Local amber interruption; noticeable, not catastrophic/red-alert noise |
| Completed | Brief convergence/resolution, then settled state |
| Intra-BU handoff | Short directional pulse between real agents |
| Inter-BU handoff | Longer trajectory crossing BU boundaries |
| Hive | Observer near the BU(s) it actually observes |
| Hive observation | Fine persistent relationship strand for configured scope; pulse toward Hive only on a real observation |
| Idle system | Subtle breathing, dust, and depth drift |
| High activity | More illumination, path/particle density, and velocity while readable |

### Home and full Ruche views

Home uses a compact camera/configuration: central, visually dominant, no controls, fewer labels, reduced decorative particle count, and the same real telemetry, scene/domain model, and renderer as the full view where practical.

The dedicated **Ruche** view is a near-fullscreen passive visualization of the entire organism. It has no controls and uses the same telemetry, semantic scene model, and rendering engine, with a different camera, detail level, particle budget, labels, and depth visibility. There must not be two independent Swarm implementations.

### Truth and transport

The Hive consumes an observability projection of canonical system truth and is never a second business-truth source:

```text
canonical jobs/events/routing
  → ordered observability projection
  → snapshot + incremental observations
  → Living Hive scene model
  → renderer
```

The final direction is an initial snapshot plus ordered incremental observations, realtime delivery where practical, and SSE as the preferred passive one-way push. Short-cursor polling is acceptable for the first proof/fallback. Multi-second snapshot-only normal operation is not acceptable as final liveness behavior. No lifecycle decisions belong in the visual layer. Final renderer direction is WebGL / Three.js unless later implementation evidence disproves it.

## 8. Call Room

Provide a dedicated meeting/Call Room.

**Pre-call:** prospect summary, interaction history, Proposal engagement, known needs, missing information, meeting objective, useful competitor benchmark where capability exists, and relevant Magic Script offers.

**During call:** visually distinguish **CLIENT** (client-confirmed facts/ideas), **STÉPHANE** (operator instructions/notes to Copilot), and **COPILOT** (suggestions/replies). Copilot may provide the next useful question, objection suggestion, ambiguity/information gap, purchase signal, and risk/inconsistency alert. Copilot never makes the commercial decision. Client-confirmed information outranks pre-call assumptions.

### Visible offer catalog

- STARTER / Lancement — **790 €**
- ESSENTIEL / Croissance — **1,190 €**
- BUSINESS / Performance — **1,690 €**
- PREMIUM — **from 2,290 €**
- CUSTOM — **sur devis**

Where canonical logic exists, show fit, supporting reasons, and blockers/incompatibilities as guidance. Stéphane chooses. Do not invent hosting inclusions.

## 9. Post-call, quote, follow-up

Expose structured summary, confirmed need, objections, decisions, commitments, selected offer/offer to quote, next action, quote generation and versioning, obsolete/superseded quote status, required operator validation before commitment, and follow-up state.

The desired conceptual follow-up model is +24h, +72h, +7d, then archive when appropriate. Exact schedules must not be presented as active until canonical backend timing support is verified; implementation must not silently invent timing.

## 10. Archive and reactivate

ARCHIVED is distinct from LOST, DO_NOT_CONTACT, DORMANT, DISQUALIFIED, and WON. Archive preserves history. Provide explicit **REACTIVATE**. Reactivation restores an appropriate active workflow without deleting/recreating historical context. Exact lifecycle transition authority must be verified during implementation.

## 11. CP05 Improvements

CP05 is a separate Deck area labelled **AMÉLIORATIONS**, not mixed into prospect pipeline cards. Each proposal shows observed pattern, why it exists, bounded component, evidence/sample size, expected benefit, known risks, reversibility, and the explicit statement: **NO CHANGE IS APPLIED AUTOMATICALLY**.

Human actions are **APPROVE**, **REJECT**, and **KEEP_TESTING**. APPROVE is governance state only and must not automatically mutate a playbook. Buzz remains separate: the Deck reflects authoritative state and Buzz notifies important events. The Hive is not a notification feed.

## 12. Explicitly legacy, removed, or hidden

The final operator UI must not use Sales Room as prospect-facing authority, “M010 · OUTREACH REVIEW”, raw Proposal IDs, content hashes, quality fingerprints, raw quality scores, raw engagement scores, “No meeting” noise badges, developer/runner/provider/job operational views, backend event dumps, or technical readiness internals.

## 13. Closed implementation plan

The slices below are ordered dependencies. Target surfaces are likely documentation-level implementation targets and must be reconciled with the repository during D0; no production files are changed by this specification.

### D0 — Deck design system / shell
- **Objective:** Establish the Magic Script visual tokens, logo usage, typography requirement, route/shell contract, safe navigation, and calm-versus-Hive hierarchy.
- **Likely targets:** `apps/control-center` Deck shell/layout/style surfaces and shared UI primitives.
- **Dependencies:** None.
- **Acceptance outcome:** A shell can host Home, prospect, Call Room, Improvements, Archives, Meetings, and Ruche without technical navigation.
- **Out of scope:** Domain logic, telemetry, production workflows, CP milestone changes.

### D1 — Canonical full-pipeline projection + 20-slot WIP gate
- **Objective:** Expose one canonical operator-safe pipeline projection and enforce active production eligibility at 20 slots.
- **Likely targets:** Deck-facing projection/adapter surfaces and existing canonical API contracts; no React lifecycle authority.
- **Dependencies:** D0; existing canonical commercial authority.
- **Acceptance outcome:** Slot occupancy, backlog promotion, release, and visibility are deterministic; only eligible slots can feed production.
- **Out of scope:** Renderer, visual Hive, new lifecycle states, schema changes.

### D2 — Home Deck layout and operator-safe outreach projection
- **Objective:** Build the frozen Home composition, human filters, Today block, compact list, right operational block, and CP04-safe outreach presentation.
- **Likely targets:** Home Deck route/components and operator-safe projection types.
- **Dependencies:** D0, D1, CP04 authority.
- **Acceptance outcome:** Home answers what needs attention now without raw diagnostics or duplicated lifecycle logic.
- **Out of scope:** Call Room, Hive telemetry, new sending authority.

### D3 — Human commercial signals
- **Objective:** Present concise canonical signals and next actions without an event dump or raw scores.
- **Likely targets:** signal projection and Home/prospect signal components.
- **Dependencies:** D1, D2, canonical event authority.
- **Acceptance outcome:** Real Proposal, response, meeting, and meaningful-action signals render consistently.
- **Out of scope:** Buzz redesign, fabricated signals, engagement scoring UI.

### D4 — Prospect workspace + Actions
- **Objective:** Deliver one coherent prospect workspace with grouped Actions, Proposal access, context, history, notes, meetings, outreach, and next action.
- **Likely targets:** prospect route, workspace panels, action adapters.
- **Dependencies:** D1–D3.
- **Acceptance outcome:** An operator can open a prospect and find all canonical commercial context without Sales Room authority.
- **Out of scope:** New backend transitions, Call Room, quotes beyond existing entry points.

### D5 — Living Hive observability contract / ordered telemetry
- **Objective:** Define and validate canonical-to-observability projection, snapshot shape, ordered observations, cursor semantics, scopes, and semantic state mapping.
- **Likely targets:** documentation/contracts and existing observability/API boundary; backend implementation only in a later authorized task.
- **Dependencies:** D1; runtime audit evidence.
- **Acceptance outcome:** Every rendered operational fact has a traceable canonical source and ordering rule.
- **Out of scope:** UI controls, fake telemetry, renderer, lifecycle decisions in the visual layer.

### D6 — Living Hive realtime delivery + scene model
- **Objective:** Provide snapshot plus ordered incremental delivery, preferably SSE, and a single scene/domain model consumed by both Hive views.
- **Likely targets:** observability transport contract, scene model, client subscription boundary.
- **Dependencies:** D5.
- **Acceptance outcome:** Reconnect/cursor behavior is defined; live updates do not require snapshot-only polling; compact and full views share truth/model.
- **Out of scope:** Final visual polish, operator controls, business command APIs.

### D7 — Living Hive visual prototype / semantic states
- **Objective:** Prototype the WebGL/Three.js scene and semantic grammar using real telemetry, including depth, clusters, paths, waiting, blocked, completion, and observation strands.
- **Likely targets:** new Living Hive renderer/scene surfaces, isolated visual fixtures only for development.
- **Dependencies:** D5, D6.
- **Acceptance outcome:** The scene is legible, organic, and honest under idle and high real activity; no fake business activity is implied.
- **Out of scope:** Home integration, production controls, independent second renderer.

### D8 — Living Hive Home integration + full Ruche view
- **Objective:** Integrate the compact central Home Hive and dedicated near-fullscreen passive Ruche using one renderer/model and distinct camera/detail budgets.
- **Likely targets:** Home composition, Ruche route, Hive camera/configuration surfaces.
- **Dependencies:** D2, D6, D7.
- **Acceptance outcome:** Both views are passive, visually coherent, telemetry-consistent, and preserve Home hierarchy.
- **Out of scope:** Agent commands, slot management, notification feed.

### D9 — Call Room
- **Objective:** Deliver pre-call and during-call workspace with CLIENT/STÉPHANE/COPILOT distinction and decision safeguards.
- **Likely targets:** Call Room route, transcript/notes projection, Copilot presentation surfaces.
- **Dependencies:** D4.
- **Acceptance outcome:** Client-confirmed facts outrank assumptions; Copilot suggests but cannot decide.
- **Out of scope:** Offer pricing changes, autonomous commitments.

### D10 — Offers during call
- **Objective:** Present the frozen offer catalog and canonical fit/reason/blocker guidance.
- **Likely targets:** Call Room offer panel and existing offer authority adapters.
- **Dependencies:** D9, canonical offer logic.
- **Acceptance outcome:** Prices and labels match the catalog; Stéphane remains chooser; no undocumented hosting claims.
- **Out of scope:** New packages, automatic selection, contract commitment.

### D11 — Post-call / quote / follow-up
- **Objective:** Provide structured post-call capture, quote versioning/status, validation gates, and supported follow-up state.
- **Likely targets:** post-call panels, quote workspace, follow-up projection.
- **Dependencies:** D9, D10, verified backend timing/version authority.
- **Acceptance outcome:** Superseded quotes and required validation are clear; unsupported schedules are not presented as active.
- **Out of scope:** Invented timers, autonomous commitment, pricing changes.

### D12 — Archive / reactivate
- **Objective:** Expose distinct archive semantics and explicit reactivation with preserved history.
- **Likely targets:** Archives route, prospect Actions, lifecycle transition adapters.
- **Dependencies:** D1, D4, verified lifecycle authority.
- **Acceptance outcome:** Archive is not conflated with lost/disqualified/etc.; reactivation is explicit and history-preserving.
- **Out of scope:** Redefining canonical lifecycle transitions.

### D13 — CP05 governance UI
- **Objective:** Deliver separate AMÉLIORATIONS review with evidence, bounded scope, risks, reversibility, and human governance actions.
- **Likely targets:** Improvements route and proposal review components.
- **Dependencies:** D0, existing CP05 authority.
- **Acceptance outcome:** Approve/reject/keep-testing records governance state only; no automatic playbook mutation.
- **Out of scope:** Reopening CP05, automatic rollout, pipeline-card mixing.

### D14 — Authority / legacy cleanup
- **Objective:** Remove/hide forbidden technical and legacy operator presentation and verify Proposal-only prospect-facing authority.
- **Likely targets:** Deck routes/components, labels, navigation, projection mappers.
- **Dependencies:** D2–D13.
- **Acceptance outcome:** No forbidden IDs, diagnostics, event dumps, M010 label, Sales Room authority, or technical readiness internals remain in normal operator views.
- **Out of scope:** Deleting backend history or legacy internal capabilities.

### D15 — Final end-to-end rehearsal / performance / visual QA
- **Objective:** Rehearse the commercial cockpit end to end and validate WIP, authority boundaries, responsive hierarchy, accessibility/readability, Hive truthfulness, realtime behavior, and visual performance.
- **Likely targets:** Deck-wide QA/rehearsal documentation and authorized test/fixture surfaces.
- **Dependencies:** D0–D14.
- **Acceptance outcome:** Independent evidence confirms the frozen product behavior, 20-slot rule, Proposal authority, passive Hive, and acceptable performance under realistic concurrency.
- **Out of scope:** New features, reopening closed milestones, production-code redesign outside observed defects.

## 14. Implementation guardrails

Do not perform one giant rewrite. Each slice has one tangible objective, preserves prior evidence, is independently testable, and reuses backend authority rather than duplicating domain logic in React. The Living Hive is a first-class product surface, not a decorative afterthought. This freeze does not implement the Deck, telemetry, runtime, schema, or any CP/M milestone.
