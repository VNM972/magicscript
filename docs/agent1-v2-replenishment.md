# Magic Script V2 — Agent 1 Replenishment

Status: FROZEN FOR IMPLEMENTATION

## Frozen operating policy

- ACTIVE MAX = 20
- READY RESERVE TARGET = 40
- LOW WATER = 20
- CRITICAL = 10
- EVALUATION CADENCE = 6 HOURS
- ACTIVE GEOGRAPHY = MARTINIQUE ONLY
- NO QUALITY LOWERING
- NO AUTO GEOGRAPHIC EXPANSION

READY_RESERVE is a derived upstream pool. A candidate counts only when the canonical Agent 1 ICP decision is `ADMIT`, a qualifying `EMAIL` or deterministically classified `MOBILE` exists, canonical dedupe has passed, the candidate has no active production slot, it has not entered downstream production, and it remains commercially eligible. The canonical admission and contact normalization authorities remain unchanged.

`CAPABILITY_GATED`, `QUALITY_GATED`, `NEEDS_CONTACT_DISCOVERY`, and `REJECT` never count as reserve. Contact discovery may be retried only through existing enrichment paths; a candidate enters reserve only after canonical re-evaluation returns `ADMIT`.

## Cadence and bounded search

Every six hours is an evaluation cadence, not a mandatory search. At or above 40, no discovery is requested. At 20–39, one bounded batch is recommended; at 10–19, at most two; at 0–9, at most three. The policy module returns these bounded recommendations and never loops recursively or searches after each candidate.

When an active slot opens, an eligible reserve candidate is selected first by deterministic existing order (oldest admission/creation time, then canonical id). No fresh discovery is required when reserve is available. Active slot acquire/release semantics remain unchanged, and reserve candidates do not trigger Designer, Senior Design Director, Builder, Visual QA, or Proposal.

## Supply and geography safeguards

A bounded replenishment attempt with reserve still below low-water and no newly produced admissible Martinique candidate exposes `MARTINIQUE_SUPPLY_LOW`. This is distinct from one temporary low-reserve evaluation and never expands geography automatically. Guadeloupe, Guyane, mainland France, and other territories require a human product decision.

No database migration is introduced: reserve is derived from existing admitted prospect/admission-contact state plus active-slot and downstream state. The existing Worker cron is already configured for `0 */6 * * *`; policy evaluation is separate from discovery execution.
