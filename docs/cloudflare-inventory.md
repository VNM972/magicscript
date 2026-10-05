# Cloudflare deployment inventory — Magic Script V2

Last updated: 2026-09-06

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

## Magic Script production launch closure

### Official gate

- Current status: **WWW LIVE / APEX PENDING**.
- `PRODUCTION WWW = PASS`.
- `PRODUCTION LAUNCH VERIFIED` is allowed only after the apex serves a valid HTTPS response and a permanent redirect to `https://www.magicscript.fr/*` with the path preserved.

### Production WWW — PASS (verified 2026-09-06)

- Canonical public URL: https://www.magicscript.fr/
- Cloudflare Pages production project: `magicscript-demos-a185c139`
- Pages production URL: https://magicscript-demos-a185c139.pages.dev/
- Production branch: `main`
- Both URLs returned HTTPS `200`, each with `26,073` response bytes.
- Both response bodies had SHA-256 `AF74A24C1117A4CF25A81B59B424E58762E1052B28152D63923C70616D52D53C`.
- The final production deployment is intentionally static-only: only `public/` was staged, so the earlier Functions bundle is not active.
- A read-only `GET` of `/api/contact` and a read-only `GET` of an unknown route returned the same body and SHA-256 as the homepage. There is no intended active email path.
- Legal, privacy and fail-closed copy remain part of the previously targeted launch verification; this closure pass did not change site code or content.

Reproducible checks:

```powershell
curl.exe -L -sS -o NUL -w "www|%{http_code}|%{url_effective}|%{size_download}`n" https://www.magicscript.fr/
curl.exe -L -sS -o NUL -w "pages|%{http_code}|%{url_effective}|%{size_download}`n" https://magicscript-demos-a185c139.pages.dev/

curl.exe -L -sS https://www.magicscript.fr/ -o "$env:TEMP\ms-www.html"
curl.exe -L -sS https://magicscript-demos-a185c139.pages.dev/ -o "$env:TEMP\ms-pages.html"
Get-FileHash "$env:TEMP\ms-www.html" -Algorithm SHA256
Get-FileHash "$env:TEMP\ms-pages.html" -Algorithm SHA256
```

The verified DNS baseline is `www.magicscript.fr CNAME magicscript-demos-a185c139.pages.dev`.

### Apex — BLOCKED on Amen server-side redirect/TLS

- Public apex `magicscript.fr` remains on Amen at `81.88.57.68`.
- On 2026-09-06, `curl.exe -I https://magicscript.fr/` failed certificate validation with `SEC_E_WRONG_PRINCIPAL`; the launch gate therefore remains closed.
- Amen support ticket `527041` is open for a valid HTTPS `301` from `https://magicscript.fr/*` to `https://www.magicscript.fr/*`, preserving the path.
- The discovered Amen micro-hosting IP is `213.158.79.9`. Earlier forced-host diagnostics reached WordPress/nginx, showed that the intended `.htaccess` redirect was not applied, and found an untrusted TLS chain. This IP is diagnostic evidence, not authorization to change DNS.

### No-touch boundaries

- Do not change the public apex A record from `81.88.57.68` while ticket `527041` is pending.
- Do not touch the `www` CNAME, MX or other mail DNS, Amen authoritative nameservers, DNSSEC, or the Cloudflare `www` custom domain.
- Do not deploy, change Cloudflare or Amen configuration, or enable any email path as part of this closure record.
- Do not alter, delete, or deploy over the historical Worker `magicscript-fr`.

### Historical Worker recovery reference

- Historical Worker URL: https://magicscript-fr.stephanemire75.workers.dev/
- Service: `magicscript-fr`
- Account display name: `Stephanemire75@gmail.com's Account`
- Account ID: `735e70444fc3cf27084177d3b06c76e7`
- Dashboard route: https://dash.cloudflare.com/735e70444fc3cf27084177d3b06c76e7/workers/services/view/magicscript-fr/production
- Recovery/source preservation is still pending. Keep this Worker unchanged as the historical recovery/rollback reference; `sites/magicscript-v2/README.md` carries the matching warning not to overwrite it before recovery or archival.

### Final verification after Amen replies

- [ ] Confirm the public apex DNS target supplied/retained by Amen; do not assume `213.158.79.9` is the production target.
- [ ] Confirm `https://magicscript.fr/` has a valid certificate without bypass flags.
- [ ] Confirm the apex root returns permanent `301` to `https://www.magicscript.fr/`.
- [ ] Confirm an apex path such as `/mentions-legales` returns permanent `301` to the same path on `www`.
- [ ] Confirm `https://www.magicscript.fr/` still returns HTTPS `200`.
- [ ] Recompare SHA-256/content parity between `www` and `magicscript-demos-a185c139.pages.dev`.
- [ ] Confirm MX/mail DNS is unchanged (baseline: MX priority `10`, `mail-fr.securemail.pro`) and Amen authoritative DNS remains `ns1.amenworld.com` / `ns2.amenworld.com`.

## Production / historical deployments

| Project | Public URL | Cloudflare service | Account display name | Account ID | Status |
|---|---|---|---|---|---|
| Magic Script Pages production | https://www.magicscript.fr/ and https://magicscript-demos-a185c139.pages.dev/ | magicscript-demos-a185c139 | Not reverified | Unknown | KEEP / WWW production |
| Magic Script Worker (historical) | https://magicscript-fr.stephanemire75.workers.dev/ | magicscript-fr | Stephanemire75@gmail.com's Account | 735e70444fc3cf27084177d3b06c76e7 | KEEP / source recovery pending / do not alter |
| SUNELEK | Public URL not yet verified | sunelek-magicscript | Sunelek | ede0c7a35a324d1bec4187defaf01ac0 | Keep / source recovery pending |
| Tropic Gros Œuvre — canonical | https://tropic-gros-oeuvre-magicscript.torpid-tea.workers.dev/ | tropic-gros-oeuvre-magicscript | Torpid Tea | d5d78c6e3aaafed1831e4e33d35009bf | KEEP |
| Tropic Gros Œuvre — duplicate | https://tropic-gros-oeuvre-magicscript.booming-practice.workers.dev/ | tropic-gros-oeuvre-magicscript | Not reverified | Unknown | DELETE APPROVED / pending execution |
| Zakari | https://zakari-magicscript.neighborly-treatment.workers.dev/ | Dashboard route not yet supplied | Neighborly Treatment | Unknown | Keep / source recovery pending |
| Chez Carole | https://chez-carole-magicscript.pages.dev/ | Pages project route not yet supplied | Unknown | Unknown | Keep / source recovery pending |

## Cloudflare dashboard routes supplied

- Magic Script historical Worker: https://dash.cloudflare.com/735e70444fc3cf27084177d3b06c76e7/workers/services/view/magicscript-fr/production
- SUNELEK: https://dash.cloudflare.com/ede0c7a35a324d1bec4187defaf01ac0/workers/services/view/sunelek-magicscript/production
- Tropic Gros Œuvre canonical under Torpid Tea: https://dash.cloudflare.com/d5d78c6e3aaafed1831e4e33d35009bf/workers/services/view/tropic-gros-oeuvre-magicscript/production

## Safety rules

- Never delete or overwrite the canonical Tropic Gros Œuvre deployment under `torpid-tea.workers.dev`.
- The `booming-practice.workers.dev` Tropic duplicate has explicit user approval for deletion, but execution must only occur through authenticated Cloudflare access.
- Never overwrite another historical Cloudflare project before its source has been recovered or otherwise preserved.
- Do not infer a workers.dev hostname from a service name when the account subdomain is unknown.
- Do not publish a portfolio link as verified merely because a dashboard route exists. The public endpoint and deployed content must also be checked.
- No email sending is enabled by this inventory.
