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

`Torpid Tea` is currently unassigned to a Magic Script project. Do not infer that it corresponds to Chez Carole or another deployment without verification.

## Production / historical deployments

| Project | Public URL | Cloudflare service | Account display name | Account ID | Source recovery |
|---|---|---|---|---|---|
| Magic Script | https://magicscript.fr | magicscript-fr | Stephanemire75@gmail.com's Account | 735e70444fc3cf27084177d3b06c76e7 | Pending |
| Magic Script Worker | https://magicscript-fr.stephanemire75.workers.dev/ | magicscript-fr | Stephanemire75@gmail.com's Account | 735e70444fc3cf27084177d3b06c76e7 | Pending |
| SUNELEK | Public URL not yet verified | sunelek-magicscript | Sunelek | ede0c7a35a324d1bec4187defaf01ac0 | Pending |
| Tropic Gros Œuvre | https://tropic-gros-oeuvre-magicscript.booming-practice.workers.dev/ | tropic-gros-oeuvre-magicscript | Tropic Gros Oeuvre | d5d78c6e3aaafed1831e4e33d35009bf | Pending |
| Zakari | https://zakari-magicscript.neighborly-treatment.workers.dev/ | Dashboard route not yet supplied | Neighborly Treatment | Unknown | Pending |
| Chez Carole | https://chez-carole-magicscript.pages.dev/ | Pages project route not yet supplied | Unknown | Unknown | Pending |

## Cloudflare dashboard routes supplied

- Magic Script: https://dash.cloudflare.com/735e70444fc3cf27084177d3b06c76e7/workers/services/view/magicscript-fr/production
- SUNELEK: https://dash.cloudflare.com/ede0c7a35a324d1bec4187defaf01ac0/workers/services/view/sunelek-magicscript/production
- Tropic Gros Œuvre: https://dash.cloudflare.com/d5d78c6e3aaafed1831e4e33d35009bf/workers/services/view/tropic-gros-oeuvre-magicscript/production

## Safety rules

- Never delete or overwrite a historical Cloudflare project before its source has been recovered or otherwise preserved.
- Do not infer a workers.dev hostname from a service name when the account subdomain is unknown.
- Do not assign an account display name to a project without direct evidence.
- Do not publish a portfolio link as verified merely because a dashboard route exists. The public endpoint and deployed content must also be checked.
- No email sending is enabled by this inventory.
