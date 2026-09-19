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

`database/schema.sql` est la source de vérité d'initialisation ; le dépôt ne
dispose pas d'un framework de migrations versionnées. Une base déjà créée doit
donc recevoir, dans un rollout séparé, revu et explicitement autorisé, les
colonnes d'identité et d'éligibilité commerciale ainsi que l'index unique
`SIREN + SIRET` décrits dans ce schéma avant d'activer la découverte V2.5.1.
Cette mise à niveau n'est jamais exécutée automatiquement au démarrage.
