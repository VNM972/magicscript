# Cloudflare deployment inventory — Magic Script V2

Last updated: 2026-08-31

This inventory records only URLs, Cloudflare service routes and account display names explicitly supplied by the user or visible in user-provided screenshots. It does not claim that source code has been recovered from Cloudflare.

## Cloudflare accounts visible in the dashboard

The account selector screenshot confirms these account display names:

- Neighborly Treatment
- Stephanemire75@gmail.com's Account
- Sunelek
- Torpid Tea
- Tropic Gros Oeuvre

## Canonical Tropic Gros Œuvre deployment

The user explicitly selected this deployment as the one to keep:

- Public URL: https://tropic-gros-oeuvre-magicscript.torpid-tea.workers.dev/
- Service: `tropic-gros-oeuvre-magicscript`
- Account display name: `Torpid Tea`
- Dashboard route supplied: https://dash.cloudflare.com/d5d78c6e3aaafed1831e4e33d35009bf/workers/services/view/tropic-gros-oeuvre-magicscript/production
- Account ID from that route: `d5d78c6e3aaafed1831e4e33d35009bf`
- Status: KEEP / canonical

The previous duplicate URL is no longer canonical:

- https://tropic-gros-oeuvre-magicscript.booming-practice.workers.dev/
- Status: DELETE APPROVED BY USER, deletion not yet executed from this environment

Do not delete the canonical Torpid Tea deployment.

## Production / historical deployments

| Project | Public URL | Cloudflare service | Account display name | Account ID | Status |
|---|---|---|---|---|---|
| Magic Script | https://magicscript.fr | magicscript-fr | Stephanemire75@gmail.com's Account | 735e70444fc3cf27084177d3b06c76e7 | Keep / source recovery pending |
| Magic Script Worker | https://magicscript-fr.stephanemire75.workers.dev/ | magicscript-fr | Stephanemire75@gmail.com's Account | 735e70444fc3cf27084177d3b06c76e7 | Keep / source recovery pending |
| SUNELEK | Public URL not yet verified | sunelek-magicscript | Sunelek | ede0c7a35a324d1bec4187defaf01ac0 | Keep / source recovery pending |
| Tropic Gros Œuvre — canonical | https://tropic-gros-oeuvre-magicscript.torpid-tea.workers.dev/ | tropic-gros-oeuvre-magicscript | Torpid Tea | d5d78c6e3aaafed1831e4e33d35009bf | KEEP |
| Tropic Gros Œuvre — duplicate | https://tropic-gros-oeuvre-magicscript.booming-practice.workers.dev/ | tropic-gros-oeuvre-magicscript | Not reverified | Unknown | DELETE APPROVED / pending execution |
| Zakari | https://zakari-magicscript.neighborly-treatment.workers.dev/ | Dashboard route not yet supplied | Neighborly Treatment | Unknown | Keep / source recovery pending |
| Chez Carole | https://chez-carole-magicscript.pages.dev/ | Pages project route not yet supplied | Unknown | Unknown | Keep / source recovery pending |

## Cloudflare dashboard routes supplied

- Magic Script: https://dash.cloudflare.com/735e70444fc3cf27084177d3b06c76e7/workers/services/view/magicscript-fr/production
- SUNELEK: https://dash.cloudflare.com/ede0c7a35a324d1bec4187defaf01ac0/workers/services/view/sunelek-magicscript/production
- Tropic Gros Œuvre canonical under Torpid Tea: https://dash.cloudflare.com/d5d78c6e3aaafed1831e4e33d35009bf/workers/services/view/tropic-gros-oeuvre-magicscript/production

## Safety rules

- Never delete or overwrite the canonical Tropic Gros Œuvre deployment under `torpid-tea.workers.dev`.
- The `booming-practice.workers.dev` Tropic duplicate has explicit user approval for deletion, but execution must only occur through authenticated Cloudflare access.
- Never overwrite another historical Cloudflare project before its source has been recovered or otherwise preserved.
- Do not infer a workers.dev hostname from a service name when the account subdomain is unknown.
- Do not publish a portfolio link as verified merely because a dashboard route exists. The public endpoint and deployed content must also be checked.
- No email sending is enabled by this inventory.
