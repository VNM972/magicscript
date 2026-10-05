# Magic Script V1 — Control Center closeout

**Status: READY_FOR_HUMAN_ACCEPTANCE**

## Verified workflow

- `PROTOTYPE_REQUIRED` exposes **PRÉPARER LE PROTOTYPE** and **DIFFÉRER**.
- Strategy/build/QA/deploy remain on the canonical lifecycle; no prototype or Sales Room is fabricated.
- Prototype jobs are projected with the latest `updatedAt` job per prospect, plus separate strategy-job status.
- A real prototype is counted only from `/api/prototypes`; strategy-only jobs do not increment prototype counters.
- `HUMAN_ACTION_REQUIRED` remains in the operator queue. Deferred prototype work can resume only when prototype-defer history exists.
- Raw/model phone values are shown as `NON VÉRIFIÉ`; only a validated, manually dialed phone preparation is displayed as actionable.
- Sales Rooms remain gated by real prototype, Web Design, QA, deployment and explicit configuration. No external deployment or outreach is enabled.

## Current local records

- ATHENA TRADING (`73576dde-c29e-44ec-9a0d-fa7c0e0fb712`): `PROTOTYPE_REQUIRED`, calibrated score 73, no prototype row, no strategy/build job; latest events are repeated `prototype.review_started`. Exact stop: before strategy job creation. Its phone is model/research-observed and is not presented as verified.
- SAVOIE (`50c1fb37-77d1-42d3-8417-20f58aab8238`): `HUMAN_ACTION_REQUIRED` after `prototype.review_deferred`, no prototype row/build job. Resume is guarded by deferred-prototype history. Its contact remains `UNVERIFIED` because the recorded email/domain mismatch is unresolved.
- No Sales Room is fabricated for either prospect.

## Remaining V1 limitations

1. Strategy is persisted in generic `job_results`, not a dedicated versioned strategy table.
2. Local ATHENA/SAVOIE prototype cost-gate evaluations are absent; attempting runner execution would be blocked until a canonical evaluation exists.
3. Control Center visual acceptance and full test execution outside sandbox remain human tasks.
4. Deployment, sending, autopilot and prototype deployment remain disabled.
5. Existing historical incident data is preserved; current local target records have no escalation row despite deferred-event history and should be checked during human acceptance.

## Human closeout checklist

- Perform final visual deck acceptance at `http://127.0.0.1:3000`.
- Run PowerShell test suites outside the sandbox if required (`npm run test:core`, runner focused tests, Control Center tests).
- Execute OPS-06 only under the approved human procedure.
- Record V1 close decision.
- Start V2 planning on the V2 branch; prioritize Experiment Manager, proposer/evaluator/gate, D1 ledger, rollback, governance lock, inbox/audit/source ledger, recovery observability, and lifecycle maturity.

No human acceptance is implied by this document.
