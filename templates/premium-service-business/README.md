# Premium Service Business Template

Base réutilisable Magic Script pour les entreprises de services premium, B2B, sécurité, conseil, immobilier, artisanat haut de gamme et activités locales nécessitant une forte crédibilité.

## Objectif

Créer rapidement un prototype crédible, mobile-first et orienté conversion sans dupliquer les erreurs ou informations non vérifiées d'un prospect.

## Démarrage

```powershell
cd templates/premium-service-business
npm install
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Personnalisation

Modifier en priorité `config/site.ts`.

Ce fichier centralise :

- nom et positionnement
- titre et promesse du hero
- services
- CTA
- coordonnées
- éléments de réassurance vérifiés
- couleurs
- SEO
- informations légales

## Règle factuelle

Ne jamais transformer un placeholder, une hypothèse, un témoignage, une certification, une référence client, un chiffre, une zone d'intervention ou une ancienneté en affirmation publique sans preuve.

Les éléments de réassurance sont filtrés par `verified: true`.

## Démonstration vs production

`site.isDemo` vaut `true` par défaut. Le template demande alors aux moteurs de recherche de ne pas indexer le site.

Avant mise en production :

1. remplacer tous les contenus "À renseigner"
2. vérifier les coordonnées et liens
3. compléter les mentions légales
4. confirmer les preuves et références
5. passer `isDemo` à `false`
6. vérifier le build avec `npm run build`
7. tester le rendu mobile autour de 390 px

## Cloudflare

Le projet utilise `output: "export"`. Après `npm run build`, le site statique est généré dans `out/`.

Le fichier `wrangler.jsonc` est prévu pour servir ce dossier via Cloudflare. Renommer le projet Cloudflare avant tout premier déploiement client afin de ne jamais écraser un déploiement existant.
