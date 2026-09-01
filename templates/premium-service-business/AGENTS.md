# Instructions locales du template

Lire les règles racine du repo avant toute modification.

## Priorités

1. Exactitude factuelle
2. Clarté commerciale
3. Conversion
4. Mobile-first
5. Performance
6. Esthétique

## Interdictions

- ne jamais inventer une certification, un agrément, un avis, une note, une référence client ou un nombre d'années
- ne jamais présenter un formulaire non connecté comme opérationnel
- ne jamais utiliser une URL commerciale chatgpt.site
- ne jamais écraser un déploiement Cloudflare existant
- ne jamais activer de service payant sans autorisation explicite

## Utilisation

Le contenu métier doit être centralisé dans `config/site.ts`.
Tout élément de preuve doit être explicitement marqué `verified: true` avant affichage.
