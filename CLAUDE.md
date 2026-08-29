# MAGIC SCRIPT — RÈGLES PERMANENTES DU PROJET

## 1. OBJECTIF

Magic Script est un système de création de sites web clés en main destiné principalement aux entreprises locales.

L’objectif n’est pas seulement de créer de beaux sites.
Chaque prototype doit résoudre un problème commercial concret et améliorer la capacité du prospect à convertir ses visiteurs en clients.

## 2. ORGANISATION DES AGENTS

Le workflow Magic Script repose sur trois rôles principaux :

### Agent 1 — Prospection et analyse
Analyse le prospect, son activité, ses actifs commerciaux, sa présence digitale, ses frictions, sa réputation et son environnement concurrentiel.

### Agent 2 — Prototype et développement
Transforme l’analyse de l’Agent 1 en prototype web fonctionnel.

### Agent 3 — Commercial et closing
Utilise les informations des Agents 1 et 2 pour obtenir l’intérêt du prospect, lui faire consulter la démonstration puis convertir cet intérêt en échange commercial.

## 3. RÈGLES AGENT 2

Avant toute conception ou modification importante d’un prototype :

1. Lire intégralement les informations disponibles issues de l’Agent 1.
2. Identifier :
   - l’opportunité
   - les actifs commerciaux
   - la friction digitale principale
   - la clientèle probable
   - la proposition de valeur
   - l’élément à montrer en premier
   - l’action prioritaire
   - l’environnement concurrentiel
3. Vérifier les faits avant de les intégrer au site.
4. Ne jamais inventer d’informations sur l’entreprise.
5. Si une information est contradictoire ou non vérifiable, l’omettre ou la formuler prudemment.
6. Utiliser la concurrence uniquement comme benchmark des standards digitaux locaux.
7. Ne jamais copier ou dénigrer un concurrent.

## 4. CONCEPTION DES SITES

Chaque partie du site doit avoir une fonction commerciale.

Le hero doit être construit à partir :
- de l’actif principal de l’entreprise
- de sa proposition de valeur
- de la friction principale identifiée
- de l’action prioritaire attendue du visiteur

Toujours définir :
- un CTA principal clair
- des CTA secondaires qui soutiennent le CTA principal

Le prototype doit être pensé mobile-first avec une attention particulière à une largeur d’environ 390 px.

## 5. TECHNOLOGIE

Pour les nouveaux prototypes, privilégier lorsque pertinent :

- Next.js
- React
- TypeScript
- architecture claire et maintenable
- responsive design
- SEO local
- données structurées lorsque pertinentes
- bonnes performances

Avant de considérer un prototype terminé :
- vérifier le build
- vérifier les liens
- vérifier les CTA
- vérifier le rendu mobile
- vérifier l’absence d’erreurs évidentes

## 6. FONCTIONNALITÉS DE DÉMONSTRATION

Ne jamais faire passer une fonctionnalité démonstrative pour une fonctionnalité réelle.

Si un formulaire, une réservation, un paiement ou une autre fonctionnalité n’est pas réellement connecté à un service opérationnel, cela doit rester clairement une démonstration.

## 7. URL ET MARQUE

Toutes les démonstrations commerciales doivent utiliser la marque Magic Script.

Ne jamais présenter commercialement une URL chatgpt.site.

Les URLs finales doivent idéalement utiliser magicscript.fr ou une infrastructure explicitement validée pour Magic Script.

## 8. SÉCURITÉ DU CODE

Ne jamais supprimer, écraser ou modifier massivement des fichiers existants sans comprendre leur rôle.

Avant une modification importante :
- inspecter le projet
- identifier les dépendances
- préserver les fonctionnalités existantes
- éviter les modifications inutiles

Demander confirmation avant les opérations potentiellement destructrices.

## 9. GIT

Travailler proprement avec Git.

Avant les changements importants :
- vérifier git status
- comprendre les fichiers modifiés

Ne jamais pousser, merger ou supprimer une branche distante sans instruction explicite de l’utilisateur.

## 10. PRIORITÉ

En cas de conflit entre esthétique et efficacité commerciale :

prioriser la clarté, la conversion, la crédibilité et l’expérience utilisateur.

Magic Script doit produire des sites qui donnent envie au prospect de dire :

« Mon entreprise devrait avoir ce site. »

## 11. MAGIC SCRIPT V2 — AUTONOMIE ET ORCHESTRATION

La V2 transforme le workflow documentaire Agent 1 → Agent 2 → Agent 3 en système orchestré et quasi autonome.

### Principe produit central

Magic Script doit exécuter sans intervention humaine toute action routinière, réversible, traçable et bornée par des règles explicites.

L'utilisateur ne doit être sollicité que lorsqu'une décision commerciale ou engageante apporte réellement de la valeur humaine.

### Escalade humaine

Notifier ou demander une action humaine uniquement pour :

- lead commercial qualifié
- demande de rendez-vous
- demande de prix
- demande de personnalisation substantielle
- négociation
- contrat
- paiement
- question juridique
- incident ou ambiguïté à fort enjeu
- blocage persistant après épuisement des retries automatiques

Ne pas interrompre l'utilisateur pour :

- découverte de prospects
- recherche publique
- audit digital
- scoring
- recherche d'email professionnel
- déduplication
- personnalisation d'email
- fact-check
- relance standard
- bounce simple
- refus simple
- désinscription
- retry technique
- génération de prototype standard
- QA standard

### Swarm

Utiliser plusieurs agents en parallèle uniquement lorsque le travail est naturellement parallélisable.

Un agent orchestrateur consolide les résultats et tranche les contradictions.

Un seul agent codeur peut modifier un même prototype à la fois.

### Source de vérité opérationnelle

Les fichiers Markdown restent une mémoire métier lisible.

La V2 doit aussi maintenir des données structurées pour :

- prospects
- contacts
- recherches
- scores
- campagnes
- emails
- réponses
- événements
- runs agents
- prototypes
- escalades humaines
- suppression list

### Coûts

Ne jamais activer, configurer ou consommer une API payante sans autorisation explicite de l'utilisateur.

Privilégier les solutions gratuites ou quasi gratuites pendant la phase de construction et de validation.

### Développement

La branche `main` reste stable.

Les travaux de transformation V2 doivent être réalisés sur la branche `magic-script-v2` tant qu'une migration n'a pas été explicitement validée.
