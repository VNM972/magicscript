# EXTERNAL PATTERN ADOPTION MAP V1

## How to read this map

Each row classifies an external project's patterns for Magic Script:

| Classification | Meaning |
|---|---|
| ADOPT | Use directly or near-directly |
| ADAPT | Integrate with modifications |
| BENCHMARK | Study for metrics, not copy |
| REJECT / DEFER | Not suitable or not yet |

---

## Agentic Inbox — `ADAPT`

| Dimension | Value |
|---|---|
| **Pattern** | Inbox/workflow organization with bounded agent turns |
| **Target Magic Script module** | `core/orchestrator/engine.ts`, `apps/api-worker/src/index.ts` (inbox polling) |
| **Expected benefit** | Better agent turn lifecycle, bounded in-flight work |
| **Safety implications** | Safe — inbox pattern is already partially present (Amen IMAP polling) |
| **Target version** | V1.1 (incremental on current mailbox loop) |
| **Prerequisite** | Existing Amen inbox loop is in production; adapt only when IMAP reliability issues arise |

---

## Claude Ads — `ADAPT`

| Dimension | Value |
|---|---|
| **Pattern** | Approval gates, audit trail, source ledger |
| **Target Magic Script module** | `core/experimentation/experiment-manager.ts`, `core/events/event-store.ts` |
| **Expected benefit** | Stronger experiment governance, human-in-the-loop audit trail |
| **Safety implications** | Safety-positive — strengthens the governance lock with traceable decisions |
| **Target version** | V1 (experiment manager foundation existing), expanded in V1.1 |
| **Prerequisite** | Experiment Manager V1 is now implemented; Claude Ads pattern informs the reviewerRequired/gate mechanism |

---

## Camofox — `REJECT / DEFER`

| Dimension | Value |
|---|---|
| **Pattern** | (Explicitly excluded from V1 per operator direction) |
| **Reason** | Does not align with current Magic Script architecture; would require substantial refactor |
| **Target version** | V2 at earliest, and only if operator explicitly authorizes |
| **Safety implications** | Not introducing Camofox avoids scope drift and architectural disruption |

---

## Cross-cutting notes

1. **Do NOT** copy external repositories into the Magic Script codebase.
2. Each adoption requires a focused evaluation with test proof before integration.
3. External patterns inform design — they do not replace canonical Magic Script security invariants.
4. V1 is frozen for evidence trust and scoring; external pattern integration is V1.1+ work.