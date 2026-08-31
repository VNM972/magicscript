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

Important correction: the dashboard route with account ID `d5d78c6e3aaafed1831e4e33d35009bf` was explicitly identified by the user as belonging to the account display name `Torpid Tea`, even though the Worker service itself is named `tropic-gros-oeuvre-magicscript`.

This means there are currently two separate Tropic-related Cloudflare contexts visible:
1. the `Torpid Tea` account, which contains the Worker service `tropic-gros-oeuvre-magicscript`;
2. a separate account display name `Tropic Gros Oeuvre`, whose Account ID and contents are not yet verified.

Do not merge these two accounts until the second Tropic account has been inspected.

## Production / historical deployments

| Project | Public URL | Cloudflare service | Account display name | Account ID | Source recovery |
|---|---|---|---|---|---|
| Magic Script | https://magicscript.fr | magicscript-fr | Stephanemire75@gmail.com's Account | 735e70444fc3cf27084177d3b06c76e7 | Pending |
| Magic Script Worker | https://magicscript-fr.stephanemire75.workers.dev/ | magicscript-fr | Stephanemire75@gmail.com's Account | 735e70444fc3cf27084177d3b06c76e7 | Pending |
| SUNELEK | Public URL not yet verified | sunelek-magicscript | Sunelek | ede0c7a35a324d1bec4187defaf01ac0 | Pending |
| Tropic Gros Œuvre — Worker known | https://tropic-gros-oeuvre-magicscript.booming-practice.workers.dev/ | tropic-gros-oeuvre-magicscript | Torpid Tea | d5d78c6e3aaafed1831e4e33d35009bf | Pending |
| Tropic Gros Œuvre — separate account | Public URL not yet verified | Unknown | Tropic Gros Oeuvre | Unknown | Pending |
| Zakari | https://zakari-magicscript.neighborly-treatment.workers.dev/ | Dashboard route not yet supplied | Neighborly Treatment | Unknown | Pending |
| Chez Carole | https://chez-carole-magicscript.pages.dev/ | Pages project route not yet supplied | Unknown | Unknown | Pending |

## Cloudflare dashboard routes supplied

- Magic Script: https://dash.cloudflare.com/735e70444fc3cf27084177d3b06c76e7/workers/services/view/magicscript-fr/production
- SUNELEK: https://dash.cloudflare.com/ede0c7a35a324d1bec4187defaf01ac0/workers/services/view/sunelek-magicscript/production
- Tropic Gros Œuvre Worker under Torpid Tea: https://dash.cloudflare.com/d5d78c6e3aaafed1831e4e33d35009bf/workers/services/view/tropic-gros-oeuvre-magicscript/production

## Safety rules

- Never delete or overwrite a historical Cloudflare project before its source has been recovered or otherwise preserved.
- Do not infer a workers.dev hostname from a service name when the account subdomain is unknown.
- Do not assign an account display name to a project without direct evidence.
- Do not merge the `Torpid Tea` and `Tropic Gros Oeuvre` accounts without direct verification.
- Do not publish a portfolio link as verified merely because a dashboard route exists. The public endpoint and deployed content must also be checked.
- No email sending is enabled by this inventory.
