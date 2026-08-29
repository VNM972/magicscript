# Magic Script Agent Runner

Le runner est le plan d'exécution local de Magic Script V2.

Le contrôle reste sur Cloudflare (API + D1), tandis que les tâches agentiques lourdes sont exécutées par Kimi Code sur une machine disposant du CLI Kimi et de sa configuration d'authentification.

## Pourquoi

Cloudflare Worker est adapté au contrôle, aux états et aux API, mais pas à l'exécution d'un agent de code local avec shell et swarm.

Le runner :

1. réclame un job au backend ;
2. crée un dossier de travail isolé ;
3. lance Kimi Code en mode non interactif ;
4. demande explicitement l'utilisation d'AgentSwarm pour les tâches parallélisables ;
5. parse la sortie JSON ;
6. renvoie le résultat au backend ;
7. laisse le backend décider de la prochaine étape.

## Jobs actuellement supportés

- DISCOVER_PROSPECTS
- RUN_RESEARCH_SWARM
- DISCOVER_CONTACT
- GENERATE_OUTREACH
- FACT_CHECK_OUTREACH

Aucun job SEND_EMAIL n'est exécuté ici pour le moment.

## Pré-requis

- Node.js
- Kimi Code CLI installé et authentifié
- accès au backend Magic Script
- MAGICSCRIPT_RUNNER_TOKEN

## Variables

- MAGICSCRIPT_API_BASE_URL
- MAGICSCRIPT_RUNNER_TOKEN
- KIMI_EXECUTABLE
- MAGICSCRIPT_RUNNER_WORK_DIR
- MAGICSCRIPT_POLL_INTERVAL_MS
- MAGICSCRIPT_SWARM_MAX_CONCURRENCY

## Sécurité

Les tâches de recherche s'exécutent dans des dossiers temporaires dédiés.

Le runner n'a pas besoin d'écrire dans le repo Magic Script pour ces tâches.

Les futurs jobs de construction de prototype auront un espace de travail et des permissions séparés.


## Amen mailbox

Magic Script V2 now has a direct Amen adapter.

This avoids requiring a separate paid sending API because the existing mailbox can use authenticated SMTP for outbound mail and IMAP for replies.

Default Amen endpoints:

- SMTP: `smtp-fr.securemail.pro:465`
- IMAP: `mail-fr.securemail.pro:993`
- SSL/TLS enabled

The mailbox credentials are runtime secrets only.

Before any real sending, run:

```bash
npm --workspace magic-script-agent-runner run email:check
```

This checks SMTP + IMAP authentication and sends no email.

Real sending still requires both:

```text
MAGICSCRIPT_SENDING_ENABLED=true
MAGICSCRIPT_EMAIL_PROVIDER=amen-smtp
```

Those switches remain disabled by default.


## Controlled SMTP test sink

Before any real prospect sending, the Amen SMTP path can be tested against one controlled inbox:

```text
MAGICSCRIPT_EMAIL_PROVIDER=amen-smtp
MAGICSCRIPT_SENDING_ENABLED=true
MAGICSCRIPT_TEST_EMAIL_MODE=true
MAGICSCRIPT_TEST_RECIPIENT=<controlled test inbox>
```

In this mode, the runner never delivers to the prospect address. It reroutes the message to the controlled inbox and returns the original prospect recipient only as metadata.

Do not commit mailbox credentials or the controlled inbox address.
