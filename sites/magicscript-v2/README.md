# Magic Script V2 — commercial showcase

Premium static showcase prepared for the future `magicscript.fr` flagship.

## Safety status

- No client, testimonial, result, certification or metric is invented.
- SUNELEK and Tropic Gros Œuvre are described only at a conservative factual level.
- M Patrimoine is explicitly labelled as an internal project, not an external client.
- Public portfolio URLs are intentionally withheld from the UI until Cloudflare source and deployment URLs are revalidated.
- The public contact form uses a server-side Pages Function; outbound email remains disabled by default until the professional reception address is verified and explicitly enabled.

## Cloudflare

The preview Worker name is deliberately new: `magicscript-fr-v2-preview`.

This must not overwrite the historical `magicscript-fr` deployment. Recover or archive the historical Cloudflare source before moving the production custom domain.

## QA targets

- 390 px mobile viewport
- keyboard navigation and visible focus
- reduced-motion support
- no heavyweight front-end dependency
- factual copy review before production deployment

## Local preview

Use `npm.cmd run preview:local` from the repository root for browser QA. The launcher serves only this public folder on `127.0.0.1`, selects a free port if the preferred port is occupied, verifies `/_local-preview/health` with HTTP 200, then opens the local URL. It never uses `file://`. The local static launcher does not transmit contact forms; use `wrangler pages dev` from this directory when testing the Pages Function wiring.

To deploy a Pages Preview with the Function included, run Wrangler from this directory and deploy `public` (the sibling `functions` directory is detected from the project root). Reception stays disabled while `CONTACT_EMAIL_ENABLED` is `false`.

The local prospect fixture uses three explicit surfaces: `/` is the generic public brand site, `/demo/snemm` is the personalized prototype entry, and `/p/snemm` is the Sales Room. The legacy `/p/fixture-snemm-v2` fixture alias remains available locally. Unknown or disabled `/p/<key>` routes show a neutral “Proposition indisponible” page instead of falling back to the homepage. Targeted launcher checks run with `npm.cmd run test:local-preview`.
