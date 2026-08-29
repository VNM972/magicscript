# Magic Script V2 Database

Le schéma est volontairement compatible avec une base SQLite-like afin de garder une voie simple vers :

- SQLite en local ;
- Cloudflare D1 en production ;
- un autre stockage SQL si nécessaire.

## Source de vérité opérationnelle

Tables principales :

- prospects
- contacts
- events
- jobs
- outreach_messages
- replies
- suppression_list
- agent_runs
- prototypes
- human_escalations

## Règle

Les dossiers Markdown prospect restent utiles pour lecture humaine, mais ils ne doivent plus être l'unique état opérationnel du système.

## Migration initiale

Appliquer `schema.sql` sur une base de développement avant toute intégration provider réelle.

Aucune base de production n'est créée automatiquement par ce repo.
