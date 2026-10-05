# Bulk des fiches clients

Ce dossier est la source de regroupement des fiches utilisées par Magic Script.

- Une fiche par client, au format Markdown ; les fichiers individuels sont nommés avec l’identifiant stable du prospect.
- Les identifiants et les informations vérifiées sont conservés dans chaque fiche.
- L’initialisation locale doit être idempotente : une fiche existante est réutilisée, jamais recréée ni supprimée.
- Les fiches synthétiques de test sont explicitement marquées comme telles.
- Aucune fiche de ce dossier ne constitue une autorisation d’envoi d’email.

Le dossier `prospects/` reste conservé pour compatibilité avec les travaux existants ; les copies regroupées ici servent de point d’entrée bulk.

## Logo et identité visuelle

Avant de créer une identité visuelle pour un prototype, rechercher d’abord un
logo ou un actif de marque existant sur le site officiel et les canaux publics
officiels du prospect. Lorsqu’aucun site exploitable n’est trouvé, la page
Facebook officielle de l’entreprise devient une source prioritaire, en la
distinguant d’un profil personnel, d’un groupe ou d’un relais tiers.

La fiche ou la sortie de recherche doit distinguer :

- `OFFICIAL_LOGO_FOUND` : source publique officielle observée ;
- `PUBLIC_LOGO_CANDIDATE` : actif public trouvé, mais provenance ou conditions de réutilisation à confirmer ;
- `NOT_FOUND` : recherche effectuée sans logo exploitable trouvé ;
- `UNKNOWN` : recherche insuffisante ou résultat contradictoire.

Un logo officiel exploitable est réutilisé lorsque les conditions d’usage sont
claires. Une nouvelle identité visuelle n’est créée que lorsqu’aucune identité
exploitable n’est confirmée. Ne jamais inventer de logo, de source ou de droit
d’usage ; une donnée absente reste `UNKNOWN`.

## Snapshot Martinique

`npm run bulk:snapshot-martinique` met à jour `bulk/martinique/index.md` et les
fiches individuelles à partir des prospects déjà présents dans la D1 locale.
L’export est plafonné à 50 fiches, idempotent et sans contact : il ne crée ni ne
supprime de prospect et n’exporte aucune adresse email. Les anciens fichiers
individuels ne sont pas supprimés automatiquement.
