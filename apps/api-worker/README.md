# Magic Script API Worker

Backend Cloudflare Worker de la V2.

## État actuel

Endpoints disponibles :

- `GET /health`
- `GET /api/overview`
- `GET /api/prospects`
- `GET /api/events?limit=100`
- `POST /api/orchestrator/plan`

L'envoi email est désactivé par défaut.

## Sécurité

Dans `wrangler.jsonc` :

- autopilot = false
- sending = false
- prototype deploy = false
- email provider = disabled

Aucune activation ne doit être faite sans vérification de la base, des garde-fous et de l'infrastructure email.

## D1

1. créer une base D1 de développement ;
2. appliquer `database/schema.sql` ;
3. ajouter le binding `DB` dans `wrangler.jsonc` ;
4. vérifier `GET /health` ;
5. tester les lectures avant d'activer l'autopilot.

Ne jamais utiliser directement une base de production pour les premiers tests.
