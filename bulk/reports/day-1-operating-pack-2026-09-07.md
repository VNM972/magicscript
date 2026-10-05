# Day-1 operating pack — 2026-09-07

## A. SAFE START

Depuis PowerShell, dans D:\MagicScript\repository : commencer par `npm run ms:status`. Si la stack est déjà suivie et saine, la conserver.

Commande préférée après arrêt, dépendances déjà installées et contrôles validés :

~~~powershell
Set-Location D:\MagicScript\repository
$env:MAGICSCRIPT_AGENT_PROVIDER = 'ollama-aider'
$env:OLLAMA_API_BASE = 'http://127.0.0.1:11434'
Remove-Item Env:MAGICSCRIPT_RUNNER_PROSPECT_ID -ErrorAction SilentlyContinue
npm run ms:start -- -SkipInstall -SkipChecks -SkipSmoke
~~~

Cette commande démarre API + runner + Deck ; elle initialise le schéma local et peut traiter des jobs locaux. Elle n’est pas une inspection en lecture seule. Si une dépendance manque ou un port est occupé, garder le diagnostic et demander une réparation ciblée ; aucune installation automatique de dépannage.

## B. HEALTH CHECK

~~~powershell
npm run ms:status
$health = Invoke-RestMethod http://127.0.0.1:8787/health
$lock = Get-Content .magicscript/runner.lock.json -Raw | ConvertFrom-Json
$health
$health.stackId -and ($health.stackId -eq $lock.stackId)
~~~

PASS attendu : API/runner/Control Center « tracked », ports 8787/3000 ouverts, health ok=true et databaseConfigured=true ; stackId non vide et comparaison True. Le runner doit apparaître IDLE avec heartbeat récent, sans job actif dans l’état présent. Sending=false, emailProvider=disabled, effectiveOutboundMode=disabled, prototypeDeployEnabled=false, autopilotEnabled=false. Runner local mock, D1 local sans remote binding : aucune écriture production. Le Deck affiche 57 prospects, 10 escalades, 20 prototypes au snapshot ; les nombres peuvent changer après travail futur autorisé. UNKNOWN n’est jamais une preuve de santé.

SAFETRANSPORT WAIT et AUTOPILOT WAIT sont attendus avec ces protections OFF. NODEADLETTERS WAIT est connu et détaillé ci-dessous ; ne pas chercher un écran tout vert en activant des capacités.

## C. DO NOT START

Ne pas utiliser en exploitation fondateur : `npm run dev:api` (config générique), API/runner directs non appariés, Wrangler sur ports alternatifs, `npm run ms:start -- -Full`, `smoke:swarm`, `smoke:full`, commandes configure-cloudflare/deploy. Le ms:start sans options installe et lance un smoke ; préférer les options ci-dessus. -SkipSmoke ne suspend pas le runner.

## D. DECK ENTRY POINT

[Deck local](http://127.0.0.1:3000/) ; [actions](http://127.0.0.1:3000/#actions), [pipeline](http://127.0.0.1:3000/#prospection), [prototypes](http://127.0.0.1:3000/#prototypes).

## E. CURRENT HUMAN QUEUE

P0 : aucun blocage de sécurité non résolu démontré.

| ITEM / ID | CURRENT STATE | CLASSIFICATION | PRIORITY | FOUNDER ACTION |
| --- | --- | --- | --- | --- |
| UCPA SPORT VACANCES (UCPA) / 4cc2b65b-02e3-42bf-8bc7-a5787c351a4f | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P1 | Examiner le dossier UCPA et décider maintien en attente ou revue Web Design locale. Aucun replay/déploiement. |
| ARTUS MANAGEMENT / c965f79e-5aaa-4624-b73f-01e361c0be4e | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P2 | Examiner le CTA et demander une correction/QA locale distinctement autorisée. |
| La Balade du Soleil / bbd73175-accc-40a4-a24b-a9d147bfdfff | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P2 | Décider réparation locale du launcher avant reprise autorisée ou maintien en attente. |
| OFFICE CENTRAL DE COOPERATION A L ECOLE (OCCE) / 0f81b0ed-1f57-421c-aaed-85015c431baa | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P2 | Décider réparation locale du package avant reprise ou maintien en attente. |
| OPERATEUR DE COMPETENCES DES ENTREPRISES DE PROXIMITE / 8c48d357-d6b9-4c80-8e28-0e760c0c06c6 | HUMAN_ACTION_REQUIRED | NEEDS VERIFICATION | P2 | Examiner le build réussi et la QA inconnue avant toute décision lifecycle. |
| QUALICONSULT / 23151e23-579f-424d-a629-0430c5676722 | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P2 | Décider réparation locale et validation avant reprise ou maintien en attente. |
| REFUGE / 019e118b-54cd-4085-a61b-54a846fe950a | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P2 | Décider réparation locale ciblée avant reprise ou maintien en attente. |
| SNEMM / 65271cb1-77be-40a5-8aa3-83aa3328391a | HUMAN_ACTION_REQUIRED | NEEDS VERIFICATION | P2 | Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |
| SNEMM / c349c8cf-ccad-4580-b210-49ebfd2d1d8f | HUMAN_ACTION_REQUIRED | NEEDS VERIFICATION | P2 | Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |
| SNEMM / fad22438-7200-4bf1-92ec-437a5396e131 | HUMAN_ACTION_REQUIRED | NEEDS VERIFICATION | P2 | Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |


P2 supplémentaires : 13 prototypes READY/QA PASS attendent une revue Web Design locale et restent sans URL ; aucune activation externe requise. SNEMM `2609319c-5578-4a37-99bb-1b0923a2f81f` est ACTION TOMORROW P2 : examiner son artefact actuel et son ancienne URL persistée avant choix commercial (actualité de l’URL UNKNOWN). Ne pas confondre avec les trois SNEMM bloqués.

P3 : 13 DEAD_LETTER historiques à conserver ; trois WAITING_REPLY issus d’envois DRY_RUN, aucune réponse réelle attendue ; 30 DISQUALIFIED sans action commerciale. Les 21 DEAD_LETTER incluent les huit échecs actuels déjà rattachés aux dossiers ci-dessus. SAFETRANSPORT = EXPECTED WAIT P3 ; NODEADLETTERS = EXPECTED WAIT P3 après classification, aucun retry/purge. L’unique job PENDING OPCO est une escalade humaine, EXPECTED WAIT P2 ; le dossier demande vérification de sa QA.

## F. FIRST COMMERCIAL DAY FLOW

START SAFE STACK → CHECK HEALTH → OPEN DECK → REVIEW P0/P1 → SELECT PROSPECT → REVIEW CURRENT STATE → action commerciale manuelle hors automatisation seulement si le fondateur le veut → observer/mettre à jour par le workflow supporté → revoir la prochaine action.

Avant toute transition, lire les preuves et le dossier exact. Ne jamais marquer SENT sur la base d’un DRY_RUN ni considérer READY/QA PASS comme une autorisation de déploiement. Les commandes d’écriture commerciales ne sont pas exécutées ici. Le test historique funnel échoue au jalon COMMITTED : cette étape devra être vérifiée séparément avant de s’y fier ; ne pas modifier D1 à la main pour le contourner.

## G. CURRENT EXTERNAL SAFETY

REAL EMAIL = OFF

REAL CONTACT = OFF

REAL DEPLOY = OFF

PRODUCTION WRITE = OFF

## H. STOP / RECOVERY

Commande : `npm run ms:stop`. Elle vérifie l’identité des processus suivis, libère proprement les leases, arrête leurs arbres et conserve les métadonnées en cas de doute. Ne pas tuer Node/workerd par nom, ni le preview 3002, ni un PID inconnu ; ne pas effacer les .next historiques ou les locks à la main.

Après redémarrage : utiliser SAFE START, puis HEALTH CHECK. En cas de conflit de PID ou de génération, arrêter la reprise et faire examiner les métadonnées ; ne pas lancer un second Wrangler. Aucun restart n’a été exécuté dans cette mission, afin de préserver la file canonique.

## I. EXTERNAL BLOCKERS

Dernière preuve locale disponible : apex magicscript.fr en attente Amen, ticket 527041, d’après le rapport Deck/local safety du 7 septembre. État externe actuel non revérifié ; ne bloque pas l’exploitation locale. Aucune investigation Amen/DNS effectuée. Les anciennes URLs de démo ne sont pas réputées actuelles sans contrôle séparément autorisé.
