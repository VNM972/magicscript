# Magic Script Prospect Database Re-enrichment V1 — 2026-09-16

## Scope and safety

Local-only migration of the existing canonical D1 prospect database. No discovery, prospect creation/deletion, outreach, sending, deployment, paid provider, threshold, qualification, or Evidence Integrity changes were performed. Existing dirty-tree changes were preserved.

## Initial inventory

- Local database: `magicscript-dev` (Wrangler local D1).
- Initial canonical prospect count: **95**.
- Initial state counts: DISCOVERED 5; DISQUALIFIED 57; HUMAN_ACTION_REQUIRED 11; PROTOTYPE_READY 14; PROTOTYPE_REQUIRED 4; QUALIFIED 1; WAITING_REPLY 3.
- Historical `research.scored` events before migration: 80.
- Existing historical contactPresence projection was nested only in latest research.scored and was absent for most historical rows.

## Classification and exclusions

Classification was conservative and backed by current row metadata/policy markers. Five SNEMM/SUNeLEK rows were retained as internal relations; six explicit synthetic/fixture rows were excluded; three human-blocked rows (including UCPA and the human-action special cases) were retained and not advanced. No current red-list or opt-out rows were identified in the available schema/event policy data; none were inferred. No duplicate/superseded rows were inferred from current identity constraints.

## Migration algorithm

1. Read every existing prospect and latest historical research payload.
2. Eligible set: `commercial_eligibility` HIGH_PRIORITY or RESEARCH, excluding special internal, synthetic, human-blocked, and known fixture identities.
3. For each eligible row, replay the existing bounded public GET Contact & Presence V1 path against the historical website/source candidates. No forms were submitted and no messages were sent.
4. Persist a `contact_presence.enriched` event containing schema version, algorithm version, stable fingerprint/idempotency key, complete status-bearing Contact Presence snapshot, and `researchReplay:false` reason.
5. Research was not replayed because this bounded migration did not authorize a full Research re-evaluation for material evidence; historical `research.scored` events and scores remain untouched.
6. Stable event ID: `cpv1-{prospectId}-{fingerprint prefix}`. Re-running the script produced no duplicate event IDs.

UNKNOWN means no usable source was successfully searched/identity was unresolved/provider fetch failed. N/A means bounded source processing completed without reliable evidence. Verified values retain parser evidence.

## Execution results

- TOTAL_PROSPECTS: **95**
- REAL_COMMERCIAL: **33**
- ELIGIBLE_FOR_REENRICHMENT: **33**
- REENRICHED: **33**
- ALREADY_CURRENT: **0**
- EXCLUDED_INTERNAL: **5**
- EXCLUDED_SYNTHETIC: **6**
- HUMAN_BLOCKED: **3**
- EXCLUDED_RED_LIST: **0 observed**
- EXCLUDED_OPT_OUT: **0 observed**
- DUPLICATES_OR_SUPERSEDED: **0 inferred**
- Contact presence events after replay: **33**
- Historical research.scored events after replay: **80** (preserved)
- Prospect rows after replay: **95** (unchanged)
- Duplicate migration event IDs: **0**

Contact availability among eligible rows:

- WITH_AT_LEAST_ONE_VERIFIED_CONTACT: **17**
- WITH_VERIFIED_PHONE: **2**
- WITH_VERIFIED_EMAIL: **1**
- WITH_VERIFIED_INSTAGRAM: **0**
- WITH_VERIFIED_WHATSAPP: **0**
- WITH_VERIFIED_CONTACT_FORM: **2**
- WITH_NO_VERIFIED_CONTACT: **16**
- WITH_UNKNOWN_ENRICHMENT_BLOCKER: **28**

Verified website evidence was also present on several rows; website presence is not treated as proof of WhatsApp. No WhatsApp inference was made.

## Research replay decisions

Research replayed: **0**. No historical research.scored event was rewritten. The migration records that research replay was not performed. The existing trustedPhone → contactability 85 invariant and Evidence Integrity gate were not altered; therefore no score/contactability change was applied by this migration.

## Control Center/API projection

API overview and detail projection were updated to use the latest `contact_presence.enriched` event when present, while retaining fallback to historical `research.scored.contactPresence`. This prevents an older research event from overwriting the current enrichment. All eight fields are returned with explicit status when a migrated snapshot exists: phone, email, website, Instagram, Facebook, TikTok, WhatsApp, contact form.

Operator action audit:

- PHONE: IMPLEMENTED_AND_ACTIVE as evidence-bound human call preparation only; no automatic dialing/tel action.
- EMAIL: IMPLEMENTED_AND_ACTIVE as evidence-bound human-send draft only.
- WHATSAPP: DISPLAY_ONLY.
- INSTAGRAM: DISPLAY_ONLY.
- CONTACT FORM: DISPLAY_ONLY.

No new send behavior was added.

## Tests and validation

Added `core/tests/prospect-reenrichment-migration.test.ts` covering stable replay identity, exclusion preservation, and GET-only/no-external-action contract. Existing Contact Presence, Evidence Integrity, Contactability, and API projection tests remain the relevant focused suites. Required commands still to be run at final checkpoint: `npm run typecheck:core`, `npm run typecheck:api`, `npm run typecheck:runner`, Control Center build if needed, and `git diff --check`.

## Remaining blockers

The current repository does not persist a dedicated Contact Presence table; snapshots are event-backed. Public pages that cannot be fetched or whose identity cannot be resolved remain UNKNOWN by policy. Research re-evaluation for newly material evidence remains a separate bounded action and was intentionally not performed automatically. WhatsApp, Instagram, and contact-form operator actions remain display-only by policy.

## Required safety confirmations

- No prospect deleted.
- No fresh discovery wave or arbitrary prospect created.
- No outreach, email, WhatsApp, Instagram DM, phone call, or form submission.
- No paid provider activated and no deployment.
- No qualification override, threshold manipulation, or Evidence Integrity weakening.
- Exclusions and historical events preserved.

Final status pending required validation commands: `PROSPECT_DATABASE_REENRICHMENT_V1_SAFE_STOP` unless all validation gates pass and every eligible row is confirmed current.
