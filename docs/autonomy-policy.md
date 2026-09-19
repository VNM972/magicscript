# Magic Script V2 — Autonomy Policy

Ce document détaille la source de vérité définie dans `CLAUDE.md`. Il ne peut pas autoriser une action interdite par cette policy.

## Règle générale

Le système doit minimiser les interruptions humaines.

Une action peut être exécutée automatiquement si elle est :

1. routinière ;
2. réversible ;
3. bornée par des règles explicites ;
4. traçable ;
5. non contractuelle ;
6. non financière ;
7. non destructive.

## Niveaux d'autonomie

### AUTO

Exécution sans validation humaine.

Exemples :
- trouver des prospects ;
- analyser un site ;
- rechercher un email professionnel public ;
- scorer un prospect ;
- rédiger un premier email ;
- effectuer un fact-check ;
- planifier une relance ;
- classifier une réponse ;
- archiver un refus ;
- ajouter une adresse à la suppression list ;
- relancer après erreur technique selon retry policy ;
- générer un prototype standard ;
- lancer les QA automatiques.

### AUTO_WITH_GUARDRAILS — préparation locale uniquement

Exécution automatique uniquement pour une action locale, réversible, traçable et sans contact externe.

Exemples :
- préparer un brouillon et ses preuves pour validation humaine ;
- lancer une preview locale/mock/replay ;
- lancer un prototype local pour un prospect suffisamment documenté.

Garde-fous minimum :
- données prospect suffisamment vérifiées ;
- contenu sans affirmation non sourcée ;
- aucune transmission externe ;
- aucun email réel ;
- aucun déploiement production, changement DNS/domaine, secret ou API payante.

L'envoi d'un email, tout contact prospect automatique et tout déploiement externe nécessitent une action explicite de l'opérateur et une validation humaine distincte ; ils ne sont jamais déclenchés par l'autopilot, un job de réconciliation ou un LLM seul. La provenance `operator-send` est la seule provenance autorisée pour une mise en file d'envoi commercial.

Dans V2-M001, l'autopilot peut préparer et conserver un brouillon, mais il ne peut pas transformer automatiquement `OUTREACH_VERIFIED`, `FOLLOW_UP_DUE` ou `DEMO_REPLY_READY` en envoi commercial actif. Le transport SMTP et la réception IMAP restent conservés côté backend.

### HUMAN_REQUIRED

Aucune action automatique finale.

Cas :
- demande de prix ;
- demande de rendez-vous ;
- demande de personnalisation substantielle ;
- négociation ;
- contrat ;
- paiement ;
- question juridique ;
- plainte ;
- réponse ambiguë à fort enjeu ;
- incident réputationnel.

## Notification policy

Ne notifier l'utilisateur que lorsque :
- un lead devient HOT ;
- un rendez-vous est demandé ;
- un prix est demandé ;
- une demande personnalisée nécessite une décision ;
- une action contractuelle ou financière est requise ;
- le système est bloqué après épuisement de la retry policy.

Tout le reste doit rester visible dans le Control Center sans notification intrusive.
