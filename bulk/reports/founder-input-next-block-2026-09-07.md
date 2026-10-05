# MAGIC SCRIPT — FOUNDER INPUT FOR NEXT BLOCK

Status: FOUNDER-APPROVED INPUT
Date: 2026-09-07

Purpose:

Provide explicit founder decisions to the next Codex/Work session so they do not need to be rediscovered or reinterpreted.

This file contains product/layout decisions only.

It is NOT a source of runtime truth.

Do NOT use this file to override canonical D1 state, job state, lifecycle state, runtime state, security configuration or repository evidence.

---

## 1. SCOPE FREEZE

Magic Script is now under a strict feature freeze.

No new product feature should be introduced.

The only currently approved future feature exception is:

SENTINEL HUB / BUREAU DES SENTINELLES

Everything else discovered during review must be classified as one of:

- BUG
- SECURITY
- INCONSISTENCY
- UX
- VISUAL / LAYOUT
- POLISH
- REAL TECHNICAL DEBT
- DEFER

Do not create features merely because an improvement is technically possible.

---

## 2. DECK V1.1 — APPROVED VISUAL PATCH

Scope:

VISUAL / LAYOUT POLISH ONLY

No:

- backend change;
- runtime change;
- lifecycle change;
- D1 schema change;
- new data;
- new workflow;
- new automation;
- new feature.

### KPI

ACTION:

MOVE

Decision:

Move the principal KPI summary immediately below the main header / safe-mode status so the founder sees the operational state first.

---

### ACTIONS / JOBS

ACTION:

MOVE

Decision:

Move "Ce que Stéphane doit faire ensuite" high in the Overview, immediately after the KPI summary or in the nearest operationally useful position.

Founder actions must be visible before secondary technical information.

---

### PROCESS COMMERCIAL

ACTION:

MOVE + REGRID

Decision:

Move the commercial process higher in the Overview.

Required layout:

ROW 1 — 7 equal blocks

01 Prospection
02 Qualification
03 Enrichissement
04 Prototype
05 Web Design
06 QA
07 Intérêt explicite

ROW 2 — 6 equal blocks

08 Rendez-vous
09 Proposition
10 Draft
11 Signature
12 Facturation
13 Delivery

Visual requirements:

- 7 blocks on row 1;
- 6 blocks on row 2;
- homogeneous visual width;
- homogeneous height;
- strict alignment;
- balanced spacing;
- left-to-right reading;
- no isolated/orphan process card;
- do not change process semantics;
- do not rename or reorder stages unless existing canonical labels differ and preserving canonical truth requires it.

---

### V1 READINESS

ACTION:

COLLAPSE

Decision:

Keep available but collapsed by default.

It is no longer important enough to dominate the normal founder Overview.

Do not delete the underlying information.

---

### DOCUMENTS & PREUVES

ACTION:

COLLAPSE

Decision:

Keep available but collapsed by default.

Do not delete evidence or document links.

---

### HUB CONTROL PLANE

ACTION:

HIDE

Decision:

Hide from the normal Overview.

Do not delete its underlying information or implementation.

This is diagnostic/structural information, not a primary founder cockpit surface.

---

### DIAGNOSTICS

ACTION:

KEEP COLLAPSED

Decision:

Retain, collapsed by default.

---

### HUMAN ACTION CARDS

ACTION:

COMPRESS

Decision:

Reduce unnecessary vertical height and repeated technical text.

Keep:

- meaningful state;
- next founder action;
- blocker summary;
- navigation/action controls that genuinely work.

Long technical evidence should remain accessible through the existing detail/proof mechanism rather than dominate each card.

Do not remove useful evidence.

---

### RENDEZ-VOUS CONFIRMÉS

ACTION:

CONDITIONAL HIDE

Decision:

When confirmed meeting count = 0:

hide the large meetings section.

When confirmed meeting count >= 1:

show the section automatically.

Do not fabricate meeting state.

---

### CALL COPILOT

ACTION:

MOVE DOWN

Decision:

Place below active commercial / meeting-oriented surfaces.

No Call Copilot feature expansion is authorized.

---

### BUILD & QA PIPELINE

ACTION:

COMPRESS

Decision:

Reduce vertical spacing substantially.

Preserve real prototype/build/QA state.

Repeated identical statuses should remain truthful but visually de-emphasized.

---

### WEB DESIGN UNKNOWN

ACTION:

DE-EMPHASIZE

Decision:

Do not hide or convert UNKNOWN into another state.

Reduce repeated visual noise when many rows carry the same UNKNOWN state.

UNKNOWN must remain explicit and truthful.

---

### COMMERCIAL ENTRY / SALES ROOMS

ACTION:

MOVE / GROUP

Decision:

Keep close to prototypes / commercial delivery-related surfaces.

Current Sales Room links may remain as they are for now.

Do NOT add automatic link-health logic in this patch.

If local Sales Room links become operationally annoying during real use, handle that in a later proven-gap patch.

---

### FREE PROVIDERS

ACTION:

HIDE

Decision:

Hide from normal Overview.

Do not remove underlying configuration or provider information.

---

### OUTBOUND SWITCHES

ACTION:

HIDE

Decision:

Hide detailed switches from normal Overview.

The high-level safe-mode state is sufficient for normal founder operation.

Do not change safety semantics.

---

### HEADER / CONTROL CENTER TITLE

ACTION:

RESIZE

Decision:

Reduce unnecessary vertical space if it improves cockpit density.

Do not redesign branding.

---

## 3. LIVING SWARM — APPROVED MOTION CORRECTION

The current Living Swarm visual construct is APPROVED.

Do NOT redesign it.

Do NOT change:

- topology;
- territory arrangement;
- visual DNA;
- cluster construct;
- hub semantics;
- color direction unless required for consistency;
- semantic agents.

The only approved correction is ambient movement.

Canonical rule:

IDLE != STATIC

BLOCKED != STATIC

The hive must remain visually alive even when no real job is running.

### Required semantics

IDLE

= subtle ambient organic motion only.

ACTIVE

= ambient organic motion + localized activity derived from real runtime state.

BLOCKED

= ambient organic motion continues + blocked territory/state remains visually identifiable.

ERROR

= ambient organic motion continues + localized error state.

UNKNOWN

= ambient organic motion continues + neutral/unknown semantic state.

prefers-reduced-motion

= animation may be strongly reduced or disabled.

### Ambient movement is NON-SEMANTIC

Permitted examples:

- very slow micro-node drift;
- subtle filament tension/relaxation;
- extremely slow internal microstructure movement;
- restrained depth movement;
- slight breathing of organic masses.

Forbidden:

- fake job traffic;
- fake heartbeats;
- fake active agents;
- particles visibly travelling as if work were occurring;
- arcade pulses;
- excessive glow;
- motion that implies real runtime activity when none exists.

Runtime state and ambient movement must be decoupled.

A BLOCKED orchestrator must NOT freeze the entire swarm.

---

## 4. SENTINEL HUB — ONLY APPROVED FUTURE FEATURE

Name:

SENTINEL HUB

Deck / swarm concept:

BUREAU DES SENTINELLES

Position:

Adjacent / close to the Orchestrator as a transversal oversight capability.

Initial population:

Exactly two agents.

### SENTINEL

Role:

Internal integrity observer.

Mission:

Observe Magic Script itself for anomalies, inconsistencies, drift and abnormal state.

Examples of useful observations:

- config says OFF but runtime says ON;
- D1 state disagrees with Deck display;
- unexpected process/runtime drift;
- WAIT becoming abnormal;
- new DEAD_LETTER;
- repeated errors;
- missing mandatory gate;
- prototype state inconsistent with artifact/deployment state;
- queue growth anomaly;
- runner/stack mismatch;
- service health contradicting dependency health.

Default authority:

READ-ONLY / OBSERVER.

Do not automatically repair.

---

### WATCHTOWER

Role:

External research & alternatives observer.

Mission:

Consume internal research topics from Sentinel and also perform bounded external monitoring where explicitly authorized.

Research domains may include:

- web technologies;
- design / UX patterns;
- security;
- tooling;
- relevant repositories;
- provider changes;
- technical alternatives;
- regulatory changes when relevant;
- implementation patterns.

Outputs should classify candidate approaches as:

ADOPT
ADAPT
REJECT
WATCH

Default authority:

RESEARCH + RECOMMENDATION ONLY.

No autonomous implementation.

---

### SENTINEL HUB CANONICAL LOOP

SENTINEL
→ DETECT

SENTINEL
→ FORMULATE RESEARCH TOPIC

WATCHTOWER
→ RESEARCH

WATCHTOWER
→ COMPARE

WATCHTOWER
→ RECOMMEND

PRIMARY / ORCHESTRATOR / HUMAN
→ DECIDE

Canonical short form:

DETECT
→ RESEARCH
→ COMPARE
→ RECOMMEND
→ HUMAN DECISION

No autonomous repair loop.

No automatic patching.

No automatic lifecycle mutation.

No automatic D1 mutation.

No automatic deploy.

No automatic contact.

---

## 5. SALES ROOM / SITE ANALYTICS — DEFERRED IDEA

There is value in tracking engagement with Sales Rooms and client sites.

However:

THIS IS NOT AUTHORIZED FOR THE NEXT PATCH.

Potential future Sales Room engagement signals:

- first open;
- last open;
- total opens;
- CTA click;
- prototype open;
- proposal/contact click when applicable.

Potential future client-site analytics:

- visits;
- page views;
- WhatsApp / phone / form CTA interactions;
- traffic source where appropriate.

Rule:

PROVE THE GAP before implementation.

Do not build a proprietary analytics platform preemptively.

First inspect whether existing infrastructure/providers already expose sufficient evidence.

---

## 6. SALES ROOM LINKS — CURRENT FOUNDER DECISION

Current local Sales Room links may remain unchanged.

The founder accepts that a local URL may occasionally be unavailable if its preview server is not running.

Do NOT patch this proactively.

Only revisit if real usage proves it creates operational friction.

Classification:

DEFER — ONLY IF REAL USAGE BECOMES ANNOYING

---

## 7. ACCOUNTING / TAX SALES INTELLIGENCE RULE

During prospect research / qualification, when publicly verifiable information exists, Magic Script may collect factual legal/accounting context useful for later commercial reassurance.

Possible factual inputs:

- legal form;
- company / EI / micro status when reliably identifiable;
- publicly explicit tax/accounting regime where available;
- publicly explicit VAT status where available.

Never infer or invent a regime.

Internal classification:

ACCOUNTING / TAX REASSURANCE =
AVAILABLE
NOT APPLICABLE
UNKNOWN

Usage rule:

Do NOT use this as a generic first-contact sales argument.

Use only later in the commercial relationship when relevant, typically:

INTEREST
→ DISCUSSION
→ QUOTE / PRICE OBJECTION

Potential safe framing:

For a business under an applicable real accounting regime, the Magic Script service may potentially be treated as a professional expense or as an asset subject to accounting/amortization treatment depending on its nature and the client's regime.

The client should confirm treatment with their accountant.

For micro-enterprises:

Do NOT claim that Magic Script fees are deductible as actual business expenses from taxable turnover.

If status is UNKNOWN:

Do not mention the tax/accounting reassurance argument.

This is SALES INTELLIGENCE, not tax advice.

---

## 8. OVERVIEW TARGET ORDER

Preferred normal founder Overview hierarchy:

HEADER + SAFE MODE

↓

PRINCIPAL KPI

↓

ACTIONS / JOBS

↓

PROCESS COMMERCIAL — 7 + 6

↓

LIVING SWARM

↓

PROTOTYPES / SALES ROOMS

↓

RENDEZ-VOUS — only when count >= 1

↓

CALL COPILOT

↓

SECONDARY / COLLAPSED INFORMATION

- V1 Readiness
- Documents & preuves
- Diagnostics

Hidden from normal Overview:

- Hub Control Plane
- Free Providers
- Outbound switches

---

## 9. NO-DELETION RULE

HIDE does not mean DELETE.

COLLAPSE does not mean DELETE.

DE-EMPHASIZE does not mean CHANGE STATE.

The visual patch must preserve:

- canonical data;
- evidence;
- underlying system capability;
- security semantics;
- navigation where still relevant;
- historical information.

The objective is cockpit clarity, not information destruction.

---

## 10. NEXT CODEX SESSION INSTRUCTION

The next Codex session should treat this document as explicit founder product/layout input.

Do not rediscover whether the founder wants these changes.

Still apply:

PROVE THE GAP
→ MINIMAL CHANGE
→ VERIFY

to the implementation itself.

Founder decisions in this document define DESIRED BEHAVIOR / LAYOUT.

Canonical repository/runtime/D1 evidence continues to define CURRENT SYSTEM TRUTH.

Do not confuse the two.

---

## 11. CURRENT FEATURE POLICY

FEATURE FREEZE = ACTIVE

Approved work categories:

BUG
SECURITY
INCONSISTENCY
UX
VISUAL / LAYOUT
POLISH
REAL TECHNICAL DEBT

Only approved future feature exception:

SENTINEL HUB

All other feature ideas:

DEFER unless founder explicitly changes this policy.
