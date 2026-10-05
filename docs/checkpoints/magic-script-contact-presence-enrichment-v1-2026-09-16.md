# Magic Script Contact & Presence Enrichment V1 — 2026-09-16

## Architecture

Agent 1 canonical Prospect → bounded deterministic public enrichment in the local runner → Research output → API Evidence Integrity → calibrated scoring → `research.scored` event → API/Control Center projection.

The runner uses `fetchSourcePage` only (public HTTP(S), SSRF/DNS guards, GET-only, bounded timeout/size/redirects, no credentials, no form submission). Existing independent phone extraction remains the only path to `trustedPhone`; model-authored phone/email/social claims are not authoritative.

## Current source audit and waterfall

1. French legal/business registry: **IMPLEMENTED** for identity; not a contact crawler.
2. Google Places/Business Profile: **ABSENT**; no credential or paid API activated. It remains unavailable/UNKNOWN.
3. Owned website: **PARTIAL/IMPLEMENTED** through strict same-origin Evidence Integrity and bounded fetch.
4. Website JSON-LD, `tel:`, `mailto:`, visible phone/email, social links, WhatsApp links, and contact forms: **IMPLEMENTED** deterministic parser over fetched HTML.
5. Official Instagram/Facebook/TikTok: **PARTIAL**; only links/sameAs independently observed from fetched pages are accepted. No arbitrary profile scraping.
6. Booking/menu/vertical platforms: **PARTIAL taxonomy only**; no dedicated crawler.
7. Generic directory fallback: **PARTIAL**; registry/Annuaire evidence exists, no Google Maps HTML scraping.

At most three candidate public URLs are fetched per Research result: owned `websiteUrl`, then bounded Research source URLs. Each fetched page is capped at 500 KB. No submission or mutation is performed.

## Canonical status semantics

Each field is `UNKNOWN` until searched, `VERIFIED` when exact identity-bound evidence is observed, `N/A` after bounded sources were checked without a reliable value, and `REJECTED` when identity/evidence validation fails. Audit includes `sourcesChecked`, `sourcesProcessed`, `reasons`, `enrichedAt`, evidence type, and source URL.

## Trust boundaries

- `trustedPhone` is still produced only by independent fetched evidence and still deterministically rehydrates contactability to 85.
- A verified phone does not imply verified WhatsApp. WhatsApp links are `VERIFIED`; a phone alone is not.
- Third-party listings never become `OWNED_WEBSITE`.
- Forms are detected but never submitted.
- Email is never guessed; model-only email is not canonical.
- No automatic email, WhatsApp, phone, DM, or form action exists.

## Router and drafts

Existing contactability projection remains human-gated. Email preparation is a `mailto` draft with `requiresHumanSend=true`; phone preparation requires a human dial. Existing outreach message generation remains DRAFT-only and continues to require validated unsuppressed email, fact-checking, and any existing prototype gates. No new send behavior was introduced.

## Real prospect validation

Canonical local prospects:

- KAY JUJU: `d12e10f8-6252-4f28-9c50-aa2742aa74c0`, SIREN `920247814`, currently DISQUALIFIED/score 0. Existing research had registry-only evidence; enrichment now records bounded audit and leaves fields UNKNOWN/N/A according to fetch completion. No outreach.
- BERNARD'S COFFEE SHOP: `7c2901b1-fab6-40c2-8645-ee6f51329544`, SIREN `892355967`, currently DISQUALIFIED/score 0. Existing research had no owned website; enrichment records the bounded attempt and does not invent channels. No outreach.

The local API was offline during inspection; no live rerun or score change was forced. Existing scores and qualification state are preserved.

## Validation

- Core enrichment focused tests: 3 passed.
- Core enrichment typecheck: passed.
- Runner/API typechecks: passed after runner integration.
- Full focused runner/API execution requires host-level retry when Windows Node spawn returns EPERM.
- No paid provider, deployment, outreach, message send, WhatsApp send, DM, form submission, qualification override, threshold change, Evidence Integrity weakening, or score manipulation occurred.

## Remaining provider gaps

Google Places/Business Profile, generic directories, JS-rendered sites, and platform-specific booking/menu/social acquisition are not enabled. Adding Google Places later requires explicit provider authorization/credentials; until then these routes remain unavailable/UNKNOWN rather than fabricated.
