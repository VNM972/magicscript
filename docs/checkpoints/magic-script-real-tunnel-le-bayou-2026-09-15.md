# Magic Script Real Tunnel Checkpoint — Le Bayou

Date: 2026-09-15
Prospect: `5d1ad3d5-b8ff-417d-97a2-b40ce7b8ce1c`
Scope: local/read-only runtime inspection plus narrow repository semantic correction.

## Completed

- Inspected canonical Le Bayou D1 state, historical jobs, events, evidence-integrity output, and open escalations.
- Confirmed latest Research job `24ed6bdf-54d2-4810-b0b6-e3ef7ce3ed1e` is the existing controlled replay; no additional replay was appended.
- Confirmed latest `research.scored` event `3e06e7f8-8986-421d-9827-6687c91900f6`: score 34, `scoreType`/source are Research-derived in current runtime projection, lifecycle `DISQUALIFIED`, evidence passed with non-blocking `UNSUPPORTED_WEBSITE`, phone/contactability absent.
- Confirmed Eventofy is treated as public listing evidence, not proof of owned website. Menu-Touch and Buzzmag are claim-specific public sources.
- Added explicit claim categories `publicListing`, `bookingPlatform`, `menuProvider`, `eventPlatform`; preserved same-origin official website trust gate.
- Removed unsafe Research persistence fallback that carried `current.websiteUrl` forward when no trusted owned website existed.
- Added focused tests for listing/platform semantics and verified official-domain canonicalization.
- Typechecks passed: core, API, runner.
- Host-level focused suites passed: core 260 tests, runner 31 tests. Restricted sandbox run hit documented Node spawn EPERM; bounded host execution succeeded.
- `git diff --check` passed (line-ending warnings only).

## Runtime findings

- Current Le Bayou row at inspection: `DISQUALIFIED`, score 34, stored historical `website_url` still `https://le-bayou.eventofy.com/` because no new replay was performed after the code fix. The fix applies to future processing and intentionally did not rewrite history.
- Historical Le Bayou Research jobs: three succeeded before this mission; no new job created in this mission.
- No Cost Gate, Agent 2, prototype build, deployment, outreach, or QA path was authorized or reached because score 34 remains below qualification and lifecycle is DISQUALIFIED.
- BU Web Design is currently a deterministic technical/composition gate, not a creative file-editing agent. It reports owner/verifier/checks/blockers but does not modify prototype files. There is no proven review → rework → rebuild → re-review loop. `PASS_WITH_NOTES` can appear when blocking findings are empty even if visual quality was not actually inspected.
- Current open operational escalations are unrelated to Le Bayou. The most direct current human-block example is UCPA: missing/malformed Web Design review before deployment. Other open blocks are historical prototype/build/QA failures. One pending `ESCALATE_TO_HUMAN` job exists for OPERATEUR DE COMPETENCES. None is a Le Bayou decision.
- Control Center persists job results in `job_results` and exposes them through API job `result`, but the UI largely renders kind/status. Research evidence, Agent 1 dossier, Agent 2 strategy/build details, QA findings, Web Design review details, and commercial draft provenance are materially under-projected. This is a visibility gap, not proof that those BUs did nothing.
- API and Control Center listeners were not running during inspection; no GUI refresh verification was possible.

## Safety

No outreach, no production deployment, no paid provider action, no manual qualification, no score override, no Cost Gate bypass, and no additional real prospect.

## Next command

After services are intentionally started, run a read-only API query for the current Control Center projection and, only if a future Research replay is explicitly required, append at most one replay for Le Bayou and verify the corrected canonical website remains absent unless an owned domain is independently supported.
