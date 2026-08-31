# Cloudflare deployment inventory — Magic Script V2

Last updated: 2026-08-31

This inventory records only URLs and Cloudflare service routes explicitly supplied by the user. It does not claim that source code has been recovered from Cloudflare.

## Production / historical deployments

| Project | Public URL | Cloudflare service | Account ID | Source recovery |
|---|---|---|---|---|
| Magic Script | https://magicscript.fr | magicscript-fr | 735e70444fc3cf27084177d3b06c76e7 | Pending |
| Magic Script Worker | https://magicscript-fr.stephanemire75.workers.dev/ | magicscript-fr | 735e70444fc3cf27084177d3b06c76e7 | Pending |
| SUNELEK | Public URL not yet verified | sunelek-magicscript | ede0c7a35a324d1bec4187defaf01ac0 | Pending |
| Tropic Gros Œuvre | https://tropic-gros-oeuvre-magicscript.booming-practice.workers.dev/ | tropic-gros-oeuvre-magicscript | d5d78c6e3aaafed1831e4e33d35009bf | Pending |
| Zakari | https://zakari-magicscript.neighborly-treatment.workers.dev/ | Dashboard route not yet supplied | Unknown | Pending |
| Chez Carole | https://chez-carole-magicscript.pages.dev/ | Pages project route not yet supplied | Unknown | Pending |

## Cloudflare dashboard routes supplied

- Magic Script: https://dash.cloudflare.com/735e70444fc3cf27084177d3b06c76e7/workers/services/view/magicscript-fr/production
- SUNELEK: https://dash.cloudflare.com/ede0c7a35a324d1bec4187defaf01ac0/workers/services/view/sunelek-magicscript/production
- Tropic Gros Œuvre: https://dash.cloudflare.com/d5d78c6e3aaafed1831e4e33d35009bf/workers/services/view/tropic-gros-oeuvre-magicscript/production

## Safety rules

- Never delete or overwrite a historical Cloudflare project before its source has been recovered or otherwise preserved.
- Do not infer a workers.dev hostname from a service name when the account subdomain is unknown.
- Do not publish a portfolio link as verified merely because a dashboard route exists. The public endpoint and deployed content must also be checked.
- No email sending is enabled by this inventory.
