# Magic Script V2 — Autonomy Policy

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

### AUTO_WITH_GUARDRAILS

Exécution automatique si les garde-fous sont satisfaits.

Exemples :
- envoyer un email ;
- déployer une démo ;
- lancer un prototype automatique pour un prospect à fort score.

Garde-fous minimum :
- données prospect suffisamment vérifiées ;
- email professionnel valide ;
- absence dans la suppression list ;
- absence de contact récent incompatible avec la relance ;
- contenu sans affirmation non sourcée ;
- fréquence d'envoi dans les limites configurées ;
- domaine d'envoi correctement authentifié.

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
