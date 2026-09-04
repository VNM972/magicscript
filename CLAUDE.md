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

## 12. MAGIC SCRIPT KP OPERATING FRAMEWORK — SOURCE DE VÉRITÉ

Cette section est la policy opérationnelle permanente du repository. Le `AGENTS.md` racine est son point d'entrée pour Codex et référence ce fichier ; les instructions locales et les documents métier la complètent sans pouvoir en réduire les garde-fous. Les documents d'autonomie et de swarm sont subordonnés à cette source de vérité.

### ENVIRONMENT

- Le repository canonique est `D:\\MagicScript\\repository`. Préserver systématiquement les changements utilisateur existants et inspecter l'état Git avant une modification.
- Aucun email prospect réel, aucun contact prospect automatique : le commercial reste `DRAFT / DRY-RUN / HUMAN VALIDATION`.
- Sans autorisation explicite, ne jamais effectuer de commit, push, merge, rebase, reset destructif, suppression large, modification de `main`, déploiement de production, changement DNS/domaine, modification ou divulgation de secrets, ni consommation d'une API ou d'un provider payant.
- Ne jamais effectuer de kill global Node ni toucher un processus inconnu. Préserver les données, artefacts, modèles, mappings et changements validés.

### SPEC / VERIFIER

- Interpréter chaque demande sous `ENVIRONMENT`, `SPEC` et `VERIFIER`. Une mission porte sur un objectif précis, avec scope, comportements attendus, contraintes, hors-scope et preuve observable ; déduire ces éléments si la demande est claire.
- `PROVE THE GAP` avant toute création ou refonte : rechercher d'abord le comportement, le contrat ou l'artefact existant ; privilégier réutiliser, configurer, adapter, étendre légèrement, puis créer en dernier recours.
- Chaque changement doit être minimal, directement relié à la SPEC et sans scope drift. Une création importante exige un manque démontré.
- Après modification : preuve ciblée, test ciblé ou typecheck pertinent, puis vérification légère du diff. Les suites globales ne sont lancées qu'à un vrai jalon.

### DEBUG POLICY

Pour un problème : documenter le symptôme, limiter à 2–5 hypothèses, les classer, exécuter le test discriminant minimal, puis qualifier la cause `CONFIRMED`, `LIKELY` ou `UNKNOWN`. `LIKELY ≠ CONFIRMED`. Appliquer le patch minimal, vérifier la non-régression et ne jamais transformer une hypothèse en fait.

### CREATION_GATE

`CREATION_GATE = OPEN` lorsqu'un runtime nécessaire ou un mode local/mock/replay fonctionnel permet d'avancer, que les données sont persistables et qu'aucun email réel ni aucune action externe non autorisée ne peut être déclenché. Une anomalie non bloquante devient `MITIGATED / NON-BLOCKING` après timebox, puis le travail continue.

### ÉTATS ET PROACTIVITÉ

- Les tâches sont `READY`, `WAITING`, `BLOCKED` ou `DONE`. `WAITING ≠ STOP` : une tâche en attente ne doit pas empêcher l'exécution des autres tâches `READY` sûres.
- `FIN DE TÂCHE ≠ FIN DE MISSION`. Après chaque tâche : enregistrer la preuve → réévaluer le backlog → sélectionner la meilleure tâche `READY` → l'exécuter automatiquement si elle est sûre, autorisée, non destructive, non payante et dans le scope.
- Une demande de statut, d'avancement ou de reste-à-faire n'est pas une instruction d'arrêt. Répondre brièvement puis continuer sur la meilleure tâche `READY` déjà autorisée. Exception : l'utilisateur demande explicitement une réponse informative uniquement ou de ne rien faire pour l'instant.

### PRIORISATION ET BUDGET GUARD

Prioriser `P0` (sécurité, corruption, email réel, runaway, perte de données), puis `P1` (blocage runtime, queue, jobs, persistance, régression), `P2` (fonctionnalités produit et prototypes), `P3` (automatisation répétitive, performance utile, dette raisonnable), `P4` (polish et optimisation spéculative). Choisir la meilleure tâche `READY` au niveau le plus élevé.

Le `Budget Guard` permanent optimise la valeur par coût de contexte : objectif, scope, preuve et tests doivent être explicites ; utiliser les outils locaux déterministes pour les calculs, contrôles, batches et cohérences, et réserver Codex aux décisions, patches et validations ciblées. Ne pas consommer Codex pour attendre un calcul local long, et ne pas relancer inutilement une suite globale.

### LOCAL PREVIEW POLICY

Toute preview locale utilise `127.0.0.1`, avec root limité, protection contre le path traversal, port libre, HTTP 200 confirmé, réutilisation sûre si pertinente et nettoyage des serveurs créés par la tâche. Ne jamais utiliser directement `file://`, tuer globalement Node ou toucher un processus inconnu.

### DÉTERMINISME, DONNÉES ET ACTIONS EXTERNES

- Utiliser une logique déterministe pour le routing, scoring par règles, permissions, états, retries, idempotence, validations, déduplication, lifecycle et actions externes. Une sortie LLM seule ne déclenche jamais une action externe irréversible.
- Ne jamais inventer une information prospect. Si elle n'est pas suffisamment démontrée, `UNKNOWN` est une valeur valide ; conserver provenance, date de vérification, confiance et historique utile. Ne jamais supprimer une donnée validée pour simplifier le système.

### STOP CONDITION

Rendre la main uniquement si aucune tâche utile `READY` ne reste, ou si toutes les tâches restantes exigent une décision utilisateur, un secret, un coût, la production, DNS, destruction, un contact réel ou une autorisation externe, ou si une limite de temps explicite est atteinte. Sinon, exécuter la prochaine action `READY` déjà autorisée.

Les restrictions exceptionnelles de quota ou de disponibilité propres à une semaine donnée ne deviennent pas permanentes ; seul le principe durable d'économie de contexte et de tests est conservé.
