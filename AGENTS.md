# MAGIC SCRIPT — INSTRUCTIONS REPOSITORY

@CLAUDE.md

## MAGIC SCRIPT — MOBILE CONVERSION GATE

Canonical specification: `docs/mobile-conversion-gate.md`

For client-facing prototypes and production sites, especially local-service and Martinique-oriented work:

- mobile is a primary product surface, not a desktop afterthought;
- define and optimize the critical mobile conversion journey;
- a merely responsive layout is not sufficient;
- the applicable Mobile Conversion Gate must pass before a prototype/site is considered ready for client delivery;
- hard blockers are non-compensatory;
- real-device validation is required for final PASS when suitable hardware is available;
- do not invent mobile usage, traffic or conversion statistics for a client;
- prefer observable evidence and the client's actual commercial channels.

Do not weaken or bypass this gate for visual polish or delivery speed.

## MAGIC SCRIPT — MISSION GOVERNANCE

These rules are mandatory for every mission:

1. **Product proof first.** Code, passing unit/integration tests, database `SUCCEEDED`, routes, or changed job status do not prove completion. Operator-facing behavior requires observable product proof; when UI/browser behavior is involved, real Chrome/CDP proof is authoritative.
2. **Read-only diagnostic first.** For an unknown or broken workflow, establish `ROOT_CAUSE`, `FIRST_BROKEN_LINK`, and `TARGET_FILE_MAP` before implementation. Do not edit while the broken link is ambiguous; use a separate read-only diagnostic mission for high-risk/shared workflows when practical.
3. **Freeze the target file map.** Declare exact allowed files before implementation and edit nothing outside it. If another file is necessary, stop, explain why, and require a new explicit mission.
4. **Path discipline.** Repository root is exactly `D:\\MagicScript\\repository`. Confirm paths exist, use root-relative paths, and never guess or concatenate unsupported Windows search paths. Tool/path failure is not proof that a file is absent.
5. **Edit discipline.** Before every edit, re-read the exact current section and build the patch from current contents. Never reuse stale `old_string`, especially in shared files.
6. **Edit circuit breaker.** On `old_string` missing, identical replacement, invalid arguments, or missing path: re-read and retry at most once; after two consecutive failures on one file, stop editing it and inspect contents and diff.
7. **Typecheck circuit breaker.** After a relevant typecheck failure, diagnose the exact failure before any unrelated edit; do not chase errors with speculative repeated edits.
8. **One golden-path stage per mission.** Prove one downstream stage at a time (for example artifact, QA, human validation, then Sales Room). Once the requested stage is proven, stop.
9. **Separate concerns.** Do not combine diagnosis, implementation, API projection, UI wiring, browser proof, and next-stage development in one uncontrolled mission. Prove backend/product capability before UI exposure when practical.
10. **No scope broadening.** If substantially more files, systems, architecture, or behavior are required, `SAFE_STOP`; do not improvise a larger project.
11. **Blocked means stop.** A `BLOCKED` or `SAFE_STOP` mission ends. Report `LAST_PROVEN_STAGE`, `FIRST_BROKEN_STAGE`, `ROOT_CAUSE`, and `NEXT_MINIMAL_MISSION` rather than silently starting implementation.
12. **Real browser acceptance.** For Control Center behavior, use the existing local Chrome/CDP capability when browser proof is required, including `scripts/qa-surface.cjs`. Never substitute static rendering or source inspection for requested browser acceptance.
13. **ICP is product acceptance.** Evaluate sourcing quality against Magic Script's commercial ICP: restaurants, bars, cafés, barbers, beauty/salons, and similar local consumer-facing businesses. Mostly off-target output is a product failure even when technically correct.
14. **Preserve the dirty tree.** Never reset, revert, normalize, or overwrite unrelated changes. Only declared target files and exact scoped changes may be altered.
15. **Acceptance authority.** `REAL PRODUCT / BROWSER PROOF > focused integration proof > unit tests > code inspection > assumption`. Lower-level proof cannot override contradictory operator behavior.
