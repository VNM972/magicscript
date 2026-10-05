# Magic Script — Founder Book

Manuel durable d'explication et de décision. Responsable : Stéphane, fondateur. Baseline documentaire : 7 septembre 2026. Périmètre : Magic Script, ses offres, son cycle commercial et les limites de son système. Ce livre ne certifie pas la disponibilité actuelle de la production.

## 0. Comment utiliser ce livre ?

Lire les chapitres 1 à 3 pour comprendre ce que Magic Script vend et comment une opportunité devient une livraison. Les chapitres 4 à 6 expliquent qui agit, avec quelle autorité et quelles preuves. Les chapitres 7 à 9 servent à décider quoi faire, quoi préserver et quoi différer. Les références A à D permettent de retrouver un terme, un responsable, une source ou une vérification ouverte.

Ce livre porte les principes et les décisions qui doivent survivre à une journée d'exploitation. Les commandes, reprises, files, incidents et mesures datées restent dans le [Day-1 operating pack](../bulk/reports/day-1-operating-pack-2026-09-07.md) et les rapports associés. Une lecture du Founder Book ne vaut pas autorisation d'envoyer, de déployer, de modifier un état métier ou de démarrer un service.

### Quelle preuve fait autorité ?

Les **décisions du fondateur définissent le produit et la politique voulus**. Les **preuves du dépôt et du runtime définissent le comportement réellement disponible**. Ni l'une ni l'autre ne remplace silencieusement l'autre : une intention approuvée ne prouve pas son implémentation ; une capacité technique ne constitue pas une permission.

Pour les permissions, partir des instructions applicables, notamment [AGENTS.md](../AGENTS.md), [CLAUDE.md](../CLAUDE.md), section 12, et de la [politique d'autonomie](autonomy-policy.md). Pour le comportement, partir du contrat concerné et de sa preuve d'acceptation. Un rapport est une observation datée avec un périmètre, pas une vérité éternelle. Si deux sources divergent, consigner les deux positions, la conséquence et la preuve nécessaire dans le registre D ; ne pas choisir simplement la plus récente sans vérifier son objet.

| Statut | Sens dans ce livre |
| --- | --- |
| **CONFIRMED** | Politique explicitement approuvée, contrat directement lu ou capacité appuyée par une preuve identifiée. Le texte précise laquelle ; ce label n'est pas une certification de production. |
| **TO VERIFY** | Preuve manquante, ambiguïté ou contradiction qui interdit une affirmation plus forte. Indiquer la décision affectée et le contrôle de clôture. |
| **FUTURE** | Intention ou capacité différée, non présentée comme disponible. Une approbation de principe reste distincte d'une autorisation d'exécution. |
| **DEPRECATED** | Affirmation historique explicitement dépassée pour l'usage indiqué. Conserver sa provenance ; ne pas supprimer son histoire. |

`UNKNOWN` est une valeur métier ou technique valide, distincte du statut éditorial `TO VERIFY`. `READY`, `PASS`, `ACTIVE` ou `SENT` ne signifient quelque chose qu'avec leur objet, leur provenance et leur périmètre.

### Quelle est la baseline, et où chercher ensuite ?

Le socle minimal a été établi avant rédaction : existence et lecture ciblée des cinq rapports demandés, des instructions, des politiques, des doctrines agents et des contrats commerciaux ; rapprochement des treize étapes du Deck avec les décisions du fondateur ; contrôle ciblé des définitions de scoring, états, hubs, revue Web Design et admission des jobs. Les empreintes de quarante fichiers sources ont été relevées. Il ne s'agit ni d'un audit récursif ni d'une nouvelle exécution du système.

| Question | Document à consulter |
| --- | --- |
| Pourquoi et selon quels principes ? | Ce Founder Book ; politiques canoniques pour leur détail. |
| Comment démarrer, contrôler ou arrêter la stack ? | Day-1 operating pack ; [local lifecycle](local-lifecycle.md) pour le contrat du lanceur. |
| Quel était l'état observé et quelle preuve a passé ? | [Morning full-window](../bulk/reports/morning-full-window-2026-09-07.md), [Deck V1 closure](../bulk/reports/deck-v1-closure-2026-09-07.md), [local runtime safety](../bulk/reports/local-runtime-safety-2026-09-07.md). |
| Qu'a décidé le fondateur pour la suite ? | [Founder input](../bulk/reports/founder-input-next-block-2026-09-07.md), distinct de l'état implémenté. |
| Quel prix, quelle transition, quel contrôle précis ? | Contrat spécialisé indiqué dans l'index C ; ne pas dupliquer ses procédures ici. |

## 1. Magic Script en une vue : quelle valeur crée-t-on ?

Magic Script transforme une opportunité commerciale documentée en site ou démonstration qui rend l'offre d'une entreprise plus claire et son parcours de contact plus simple. L'objectif est de relier un actif réel — expertise, réputation, réalisation, produit — à une friction observable, puis de montrer une amélioration crédible. Un site ancien n'est pas, à lui seul, un besoin commercial. [S01, S05]

Le système rassemble trois fonctions : recherche et qualification, production et contrôle web, préparation commerciale. Le fondateur conduit la relation, choisit les engagements et valide ce qui touche au contrat, à l'argent ou à une action externe. L'autonomie sert à réduire les tâches répétitives à l'intérieur de règles explicites. Elle n'efface pas cette responsabilité. [S01, S04]

La chaîne de valeur se lit ainsi : **opportunité vérifiée → démonstration pertinente → intérêt réel → échange humain → proposition validée → engagement prouvé → livraison acceptée**. Les objets circulent ; les acteurs travaillent dessus. Un prospect n'est pas un agent, un prototype n'est pas un job et une animation ne prouve pas une activité.

Trois plans doivent rester distincts : le site public Magic Script présente la marque ; le prototype montre une proposition adaptée au prospect ; le Deck permet au fondateur de comprendre et piloter le travail interne. La Sales Room relie la démonstration à une conversation commerciale contextualisée. Aucune de ces surfaces ne donne, par sa seule présence, l'autorisation de contacter le prospect. [S03, S17]

## 2. Modèle commercial : que vend-on, et à qui ?

### Qui mérite notre attention ?

**CONFIRMED — politique et contrat :** les documents de vente prennent en charge des clients professionnels. Le travail vise principalement les entreprises locales ; la qualification doit démontrer un bénéfice plausible. Les catégories Agent 1 décrivent l'opportunité : A, création ; B, refonte ; C, optimisation ; D, opportunité faible. Elles ne sont ni des formules tarifaires ni des niveaux d'intérêt du prospect. [S05, S09]

La qualification opérationnelle résulte d'un scoring déterministe et d'un seuil configuré. L'API prévoit un seuil par défaut de 65 ; ce nombre n'est pas une lecture de la configuration active. Le score prend en compte écart digital, force commerciale, contactabilité, adéquation locale, intérêt d'un prototype et confiance. Les bandes de priorité et l'éligibilité calculée d'un prototype sont encore d'autres notions. Leurs valeurs exactes restent dans le contrat de scoring. [S11]

**Qualifié signifie : nous avons une raison de travailler ce dossier. Intérêt explicite signifie : le prospect a effectivement exprimé un signal commercial.** Un score élevé, un email trouvé, un lien présent ou un prototype READY ne prouvent aucun consentement ni aucune réaction. Le contrat reconnaît notamment les classifications `POSITIVE_INTEREST`, `INFORMATION_REQUEST`, `PRICING_REQUESTED`, `MEETING_REQUESTED` et `CUSTOM_REQUEST` comme intérêt explicite. Il faut conserver le message ou l'événement entrant et sa provenance ; une classification isolée ne remplace pas cette preuve. [S10, S11]

### Quelle offre utiliser ?

**CONFIRMED — contrat de prix et de périmètre :** les montants ci-dessous proviennent de `MAGIC_SCRIPT_PRICING_POLICY` et les critères de `classifyCommercialScope`. Ils ne certifient ni les prix actuellement publiés en ligne ni les conditions particulières d'un devis. [S08]

| Formule canonique | Prix en EUR | Périmètre déterministe | Cycles de retours inclus |
| --- | --- | --- | --- |
| Starter / Lancement | 790 € fixe | Vitrine d'une page, sans fonctionnalité légère avancée. | 1 |
| Essentiel / Croissance | 1 190 € fixe | Vitrine de 2 à 5 pages, sans fonctionnalité légère avancée. | 2 |
| Business / Performance | 1 690 € fixe | Vitrine jusqu'à 8 pages avec au plus une fonctionnalité légère prise en charge, après application des critères précédents. | 3 |
| Premium | À partir de 2 290 € | Vitrine plus riche restant dans le périmètre pris en charge. | Non fixé dans le contrat ; à préciser au devis. |
| Sur mesure / CUSTOM | Sur devis | E-commerce, application spécifique ou exigence complexe. | À convenir. |

Les fonctionnalités légères reconnues sont réservation tierce, blog simple, formulaire avancé et intégration légère. Elles ne rendent pas automatiquement une intégration gratuite ou prête à fonctionner. Un espace client, un paiement métier, un catalogue important ou une intégration complexe fait sortir du forfait automatique. Un périmètre insuffisamment connu reste `UNKNOWN` ; ne pas lui attribuer arbitrairement une formule.

Le contrat prévoit **50 % d'acompte et 50 % de solde**. Le constructeur de devis canonique accepte uniquement un prix fixe ; Premium « à partir de » et CUSTOM nécessitent une définition et une validation humaines du prix final. Identité professionnelle, validité, délai, référence des CGV et mention de TVA doivent être renseignés. Ce livre ne déduit pas un régime fiscal d'un montant et n'ajoute pas de qualification HT/TTC non établie pour le devis concerné. [S08, S09]

**Option annuelle d'hébergement / infrastructure : montant CONFIRMED, contenu TO VERIFY.** Le code porte `annualCareCents = 19900` et le bilan d'implémentation décrit une infrastructure annuelle de **199 €**. Le socle lu ne précise pas exhaustivement hébergement, domaine, maintenance, assistance, renouvellement ou exclusions. Ne pas promettre leur inclusion : le devis doit définir l'option et ses limites avant engagement. Une démonstration ne vaut pas contrat d'hébergement. Voir D04. [S08, S18, S19]

### Comment ouvrir et poursuivre la relation ?

La méthode commerciale est : valoriser un actif réel, expliquer un écart précis sans dénigrer, montrer une amélioration effectivement préparée, proposer une prochaine action simple. Ne pas prétendre qu'une démo existe si elle n'existe pas ; ne pas présenter le prototype comme une commande ou comme le site officiel. L'autorisation du prospect de recevoir un lien est un signal utile, pas une vente. La permission donnée à Magic Script d'effectuer un contact externe reste une question distincte. [S05, S06]

La file humaine sert aux demandes de prix, rendez-vous, personnalisation, négociation, contrat, paiement et aux ambiguïtés engageantes. Elle ne transforme pas toutes les entreprises qualifiées en clients intéressés. Le fondateur examine le dossier exact, le contexte de l'échange et les inconnues avant d'engager Magic Script.

### Quelle place pour l'information comptable ou fiscale ?

**CONFIRMED — politique approuvée par le fondateur ; pas une certification d'automatisation.** La recherche peut recueillir une forme juridique, un statut ou un régime comptable/fiscal uniquement lorsqu'une source publique explicite permet de le vérifier. Ne jamais inférer un régime depuis la seule activité ou forme juridique. Classer la possibilité de réassurance : `AVAILABLE`, `NOT APPLICABLE` ou `UNKNOWN`. [S02]

Cette information est de la **sales intelligence, pas du conseil fiscal**. Elle n'entre pas dans l'argumentaire générique de premier contact. Son usage éventuel vient après intérêt et discussion, lorsqu'un devis ou une objection de prix le justifie. Toute formulation sur un traitement possible en charge ou en immobilisation reste conditionnelle et renvoie au comptable du client. Pour une micro-entreprise, ne pas affirmer que les frais Magic Script sont déductibles au réel du chiffre d'affaires imposable. Si le statut est inconnu, ne pas utiliser cet argument. Le livre transmet la politique de discours ; il ne valide aucun traitement fiscal individuel.

## 3. Cycle de bout en bout : comment passe-t-on du prospect à la livraison ?

**CONFIRMED — treize étapes de lecture métier :** l'ordre et les libellés concordent dans `processStages` du Deck et dans le founder input. Ce sont des repères pour le fondateur, pas treize états de base de données ni treize automatisations autonomes. La machine à états comporte des attentes, retours, sorties et branches ; la réalité d'un dossier ne doit pas être forcée dans un trajet linéaire. [S02, S10, S12]

| Étape canonique | Question et résultat attendu | Responsable et condition de passage |
| --- | --- | --- |
| 01 — Prospection | Quelle entreprise réelle présente une opportunité plausible ? Créer une identité et des sources distinctes des hypothèses. | Recherche / Agent 1 ; déduplication et provenance. Une fiche `SAS_PENDING` reste arrêtée dans le planner lu, sans libération implicite. |
| 02 — Qualification | Le bénéfice potentiel justifie-t-il la suite ? Distinguer type A/B/C/D, score et décision de qualification. | Règles déterministes sur dossier documenté ; disqualification possible, sans fabriquer de faiblesse. |
| 03 — Enrichissement | Que faut-il savoir pour concevoir et échanger honnêtement ? Actifs, friction, CTA, contact professionnel et inconnues. | Agent 1 / research / contact discovery ; faits et coordonnées sourcés. Une adresse trouvée n'autorise aucun envoi. |
| 04 — Prototype | Quelle amélioration concrète montrer ? Produire stratégie, artefact et résumé de démonstration. | Agent 2 unique codeur ; besoin et coût admissibles, dossier suffisant, limites des fonctions démonstratives explicites. |
| 05 — Web Design | La proposition est-elle claire, crédible et présentable ? Produire une revue attribuée. | BU Web Design ; `PASS` ou `PASS_WITH_NOTES` sans blocker applicable ; sinon correction ou attente. |
| 06 — QA | Les faits, le parcours mobile et la technique tiennent-ils ? Produire résultats et preuves. | Vérificateurs QA ; corrections par le codeur puis nouvelle vérification. Les gates client, dont mobile réel, restent nécessaires. |
| 07 — Intérêt explicite | Le prospect veut-il poursuivre ? Conserver son message et préparer un briefing. | Classification puis prise en charge humaine ; `INTERESTED` ne découle pas d'une visite supposée ou d'un score. |
| 08 — Rendez-vous | Un échange est-il réellement confirmé ? Préparer contexte, questions et prochaine décision. | Fondateur ; distinguer demande et `MEETING_BOOKED`, fondé sur un événement fiable. |
| 09 — Proposition | Quel périmètre répond au besoin exprimé ? Définir livrables, prix, exclusions, délais et options. | Fondateur assisté des contrats commerciaux ; `QUOTE_PENDING` représente un devis en préparation/validation, pas son acceptation. |
| 10 — Draft | Quels messages et documents sont prêts à relire ? Préparer les brouillons nécessaires. | Agents et fondateur ; validation humaine avant toute transmission. Ce repère transversal n'impose pas d'attendre l'étape 10 pour rédiger un premier brouillon. |
| 11 — Signature | Quel devis précis a été accepté, par qui et avec quelle preuve ? | Humain et workflow documentaire ; acceptation prouvée pour `COMMITTED`. Intégration de bout en bout **TO VERIFY**, D03. |
| 12 — Facturation | Quel paiement est exigible et lequel est confirmé ? Distinguer demande, facture et preuve d'acompte. | Fondateur ; `DEPOSIT_CONFIRMED` exige une référence de paiement pour `WON`. Aucun encaissement ne se déduit d'un lien affiché. |
| 13 — Delivery | Peut-on remettre le livrable conforme au périmètre accepté ? | Fondateur avec production et QA ; validation, preuves documentaires et paiement requis par le contrat. `WON` ne signifie pas livraison terminée. |

Le contact éventuel qui permet l'intérêt explicite est une **action contrôlée**, pas une étape oubliée à automatiser. Selon le dossier, la démonstration peut précéder l'intérêt ; une recherche ou un échange peut aussi exiger un retour à l'enrichissement. La doctrine historique de prototype après réponse et la machine actuelle ne se superposent pas entièrement : conserver cette différence dans D06. Le coût autorisé de production ne vaut jamais autorisation de provider payant. [S06, S13]

Les jalons commerciaux sont précis : `MEETING_BOOKED` suit une confirmation fiable ; `QUOTE_PENDING` suit un brouillon de devis ; `COMMITTED` requiert une preuve d'acceptation ; `WON` requiert une preuve de paiement d'acompte. Le workflow documentaire conserve aussi des références de document signé et de preuve. Ces contrats existent dans le code ; la réussite intégrale du funnel commercial n'est pas attestée par cette baseline. Le rapport Morning documente un échec à `COMMITTED`, sans correction à revendiquer ici. [S09, S10, S03]

Les sorties négatives font partie du fonctionnement normal : `DISQUALIFIED`, refus, opposition, `DO_NOT_CONTACT`, perte ou dormance. Un `DEAD_LETTER` est un job arrivé au terme de ses tentatives ; il n'est pas, par nature, un client perdu. Une escalade peut rester ouverte avec un motif ancien dépassé par une preuve ultérieure. Examiner la relation entre objets avant de décider d'une reprise ou d'une clôture.

## 4. Modèle mental du système : qui travaille sur quoi ?

### Quels sont les objets métier ?

| Objet | Ce qu'il représente | Confusion à éviter |
| --- | --- | --- |
| Prospect / contact | Entreprise étudiée et coordonnées/interlocuteurs associés. | Nom identique ne signifie pas dossier identique ; utiliser l'identifiant exact. |
| Dossier / recherche / score | Faits, sources, hypothèses, opportunité et évaluation. | Une recommandation n'est pas une réaction du prospect. |
| Message / réponse / événement | Brouillon, trace de transport ou interaction reçue. | `DRY_RUN` ne prouve pas un envoi réel. |
| Prototype / artefact / déploiement | Travail produit, version locale et éventuelle publication. | READY, URL persistée et disponibilité actuelle sont trois preuves différentes. |
| Sales Room / proposition / devis | Surface contextualisée et documents commerciaux associés. | Un lien disponible ne prouve ni lecture, ni signature, ni paiement. |
| Job / résultat / escalade | Travail planifié, résultat enregistré et décision humaine attendue. | Job réussi ne signifie pas QA produit réussie. |

Les données structurées portent les états et événements opérationnels ; les dossiers Markdown en rendent les faits et décisions lisibles. Un rapport ne doit pas servir à réécrire manuellement la base pour faire coïncider un récit avec l'écran. [S01, S03, S10]

### Quels sont les acteurs et leurs relations ?

L'**Orchestrator** applique les règles de routage et de progression : il lit l'état, choisit une action admissible, prépare un travail borné et reçoit un résultat vérifié. Son pouvoir est celui des contrats et permissions applicables. Le **hub sectoriel** regroupe une spécialité métier ; sa **BU** porte la responsabilité du domaine ; le **MO, maître d'œuvre**, coordonne le travail confié au spécialiste. Ces rôles logiques ne prouvent pas l'existence d'autant de processus ou de modèles actifs. [S06, S14]

Le contrat de transmission suit **Orchestrator → BU → MO → spécialiste → handoff → vérificateur → retour**. Le handoff doit préserver objectif, contexte, entrées, contraintes, provenance, confiance, blockers, prochain responsable et périmètre de décision. Le vérificateur peut rejeter une transmission incomplète ou qui élargit l'autorité. Cette couche est une organisation du travail existant, pas une seconde file libre de générer des agents ou des engagements. [S14]

Les agents 1, 2 et 3 décrivent respectivement analyse, production et relation commerciale ; la BU Web Design et les vérificateurs QA ajoutent des contrôles spécialisés. Ils ne fusionnent pas leurs autorités : la QA ne décide pas du prix, l'agent commercial ne certifie pas un fait non sourcé, et le codeur ne valide pas seul la présentation client. [S05–S07]

Le **pipeline** est la progression des objets et travaux ; le **Deck / Control Center** en est une vue de pilotage ; le **Living Swarm** en est une représentation visuelle. Les territoires fonctionnels visibles — prospection, recherche, contact, orchestration, prototype, QA, commercial et garde-fous — ne sont pas les hubs sectoriels comme BTP ou restauration. Ils répondent à deux questions différentes : « quelle fonction travaille ? » et « dans quel domaine métier ? ». [S12, S14, S16]

### Où se placent prototype et Sales Room ?

La surface publique générale présente Magic Script ; l'entrée personnalisée contextualise une démo ; la Sales Room prolonge l'échange autour du prospect. Les exemples de routes documentés sont `/`, `/demo/<clé>` et `/p/<clé>` : ils expriment des fonctions, pas une liste d'URLs actuellement disponibles. Le résolveur local distingue une proposition inconnue ou désactivée d'une page d'accueil générique. [S17]

La règle Web Design du prototype est spécifique : lorsqu'une `salesRoomUrl` est fournie par le runtime, son CTA commercial principal doit pointer exactement vers cette Sales Room. Le site final destiné aux clients de l'entreprise suit, lui, les canaux réellement exploités par cette entreprise et le Mobile Conversion Gate. Ne pas copier mécaniquement le CTA d'une démonstration Magic Script dans un site client final. [S07, S20]

## 5. Swarm et runtime : comment lire l'activité ?

**CONFIRMED — modèle implémenté et preuves locales datées :** le contrôle combine API, persistance structurée, file de jobs et runner ; le Deck lit les informations exposées. Le runner exécute le travail admis et retourne des résultats. Les claims atomiques, l'identité de stack, l'affinité du runner pour les artefacts et les contrôles de résultat bornent l'exécution. [S03, S15]

L'exploitation supportée privilégie une seule stack suivie, des identités cohérentes et une séparation explicite des modes local, mock, dry-run et réel. Conserver une stack suivie saine évite une reprise inutile. Démarrer peut initialiser la base locale et consommer du travail ; ignorer un smoke test ne rend pas le démarrage passif. Les commandes exactes et les options restent dans le runbook. [S03, S04]

Une absence ou divergence d'identité de stack fait refuser les routes runner avant accès D1. Une reprise ou un arrêt porte uniquement sur les processus dont l'identité et l'appartenance sont vérifiées. En cas de doute, conserver les métadonnées pour examen. Ne pas nettoyer les locks ou tuer des familles de processus pour faire disparaître un symptôme. [S15]

### Que signifie une ruche vivante ?

| État | Lecture permise |
| --- | --- |
| IDLE | Aucun travail actif démontré ; un mouvement ambiant peut continuer. |
| ACTIVE | Activité localisée dérivée d'un état réel ; l'animation seule ne suffit pas. |
| BLOCKED | Blocage visible avec cause à examiner ; ne justifie pas de figer tous les territoires. |
| ERROR | Erreur localisée à restituer ; ne pas inventer une activité de réparation. |
| UNKNOWN | Données absentes ou insuffisantes ; rester neutre, jamais afficher un succès par défaut. |

**CONFIRMED — décision produit :** le mouvement ambiant est non sémantique. `IDLE != STATIC` et `BLOCKED != STATIC`. Il ne doit simuler ni jobs, ni heartbeats, ni agents actifs. La réduction de mouvement peut limiter ou supprimer l'animation. Le construct existant est approuvé ; la correction de mouvement et le patch visuel V1.1 sont des intentions dont l'acceptation spécifique reste **TO VERIFY**, pas une nouvelle validation réalisée par ce livre. [S02, S16]

Un job en attente peut être légitimement inadmissible à cause d'un gate ou d'une capacité désactivée. Un heartbeat prouve la présence récente d'un runner, pas qu'il doit travailler. Une alerte agrégée de dead letters nécessite une lecture par dossier, type de travail et preuve ultérieure ; son total ne commande ni purge ni retry automatique. Les nombres, états instantanés et exceptions par prospect restent dans le Day-1 pack et Morning. [S03]

## 6. Qualité, sécurité et contrôle humain : quand peut-on avancer ?

### Quels contrôles sont indépendants ?

La qualité repose sur plusieurs preuves complémentaires : exactitude du dossier ; stratégie et CTA ; build et fonctionnement ; revue Web Design ; QA factuelle, mobile, conversion et technique ; acceptation du parcours client. Un `safe_for_outreach` ou `ready_to_send` produit par un agent est un résultat de préparation à relire, jamais une permission externe. [S05–S07]

**CONFIRMED — Mobile Conversion Gate :** mobile est une surface produit principale. Le parcours doit aider à découvrir, comprendre, choisir et contacter/réserver/demander un devis. L'action principale devrait normalement être atteignable en trois interactions significatives. Une mise en page simplement responsive ne suffit pas. [S20]

Le contrôle prend 390 px comme référence, couvre aussi 360, 375 et 430 px, puis tablette et desktop. Il examine compréhension immédiate, CTA utilisable, lisibilité, cibles tactiles, formulaires et états d'erreur/succès, clavier, stabilité et performances utiles. WhatsApp, téléphone ou réservation ne sont proposés que si l'entreprise exploite réellement ces canaux. Aucun chiffre de trafic ou de conversion ne doit être inventé.

Les blockers sont **non compensatoires** : CTA cassé, mauvaise destination, débordement, formulaire impossible, contenu essentiel illisible ou navigation bloquée suffisent à empêcher PASS. Le verdict final combine `MOBILE UX`, `MOBILE CONVERSION`, `MOBILE TECHNICAL` et `MOBILE REAL-DEVICE`. DevTools seul ne produit pas le PASS final. Si le matériel requis est indisponible, conserver cette limite explicite et le volet réel à vérifier ; ne pas transformer son absence en validation. L'intégration complète de cette preuve dans les contrôles automatiques reste distincte de l'obligation de politique, voir D05.

### Qu'est-ce qui protège un déploiement ?

Le prédicat Web Design accepte une revue attribuée à un owner et à un verifier, `PASS` ou `PASS_WITH_NOTES`, sans blocker. L'admission D1 contrôle le dernier prototype READY, l'état prospect adéquat et le même snapshot de revue lors du claim atomique. Le callback reste un contrôle supplémentaire. Une revue absente ou changée empêche le claim concerné sans consommer une tentative ; elle ne doit pas bloquer tous les autres travaux. [S15]

Cela confirme un contrôle **avant admission**, en complément de la validation de résultat. Cela ne certifie ni la révocation d'une approbation après claim ni une liaison cryptographique entre revue et artefact réellement déployé. La présence de cette protection n'active aucun déploiement réel. L'ancienne description « gate seulement au callback » est conservée comme historique dépassé pour ce point, D01. [S03]

### Où l'autorité humaine commence-t-elle ?

Une action automatique doit rester routinière, réversible, bornée, traçable, non contractuelle, non financière et non destructive. Les agents peuvent chercher, comparer, préparer, vérifier et recommander dans leur périmètre. Contact réel, envoi, déploiement externe, production, DNS, secrets, APIs payantes et opérations Git engageantes nécessitent l'autorisation explicite applicable. Contrats et paiements demandent une décision et une preuve humaines. Une sortie LLM seule ne déclenche jamais une action externe irréversible. [S01, S04]

La sécurité ne consiste pas à rendre chaque indicateur vert. Une capacité désactivée peut expliquer une attente normale. Une simulation ne doit pas être promue en envoi ; `WAITING_REPLY` peut provenir d'un dry-run historique. Avant de conclure qu'une personne attend une réponse ou doit être relancée, examiner la preuve de transport. [S03]

## 7. Modèle opératoire du fondateur : où mettre son attention ?

Le fondateur cherche d'abord la décision utile, son dossier et sa preuve. Le Deck doit rendre visibles l'état de sécurité, les indicateurs fiables, les actions humaines et la progression commerciale ; les détails techniques restent accessibles sans dominer cette lecture. Cet ordre est une politique d'usage. L'ordre visuel exact du patch V1.1 demeure dans le founder input, avec son propre besoin d'acceptation. [S02]

Pour une action humaine, comprendre l'identité exacte, le dernier résultat pertinent, le motif daté, la prochaine décision possible et ce qu'elle autoriserait. Une revue humaine peut aboutir à conserver l'attente, demander une correction locale ciblée, vérifier une preuve ou engager une étape commerciale autorisée. Elle ne nécessite pas de maquiller l'état pour donner l'impression de progresser.

Prioriser sécurité et intégrité avant blocage réel d'exploitation, puis travail produit utile, automatisation justifiée et polish. `READY`, `WAITING`, `BLOCKED`, `DONE` sont des états de travail : une tâche en attente ne doit pas interrompre une autre tâche sûre et autorisée. Continuer la meilleure action READY dans le périmètre, puis rendre la main lorsqu'aucune action utile autorisée ne reste. Le présent livre n'élargit aucun mandat. [S01]

### Comment maintenir ce livre sans créer une seconde vérité ?

Le modèle de maintenance ci-dessous attribue des responsabilités de revue ; il n'installe ni job de veille ni nouveau rôle runtime. Stéphane porte l'arbitrage produit et commercial. Le responsable technique de la modification apporte les preuves ; un vérificateur compétent relit les affirmations de capacité et de sécurité.

| Chapitres | Source de vérité du contenu | Owner / reviewer | Déclencheur de mise à jour |
| --- | --- | --- | --- |
| 0, 7 et références | Instructions, décisions explicites et index des contrats. | Fondateur ; mainteneur documentaire pour les liens. | Changement de politique, propriétaire ou chemin canonique ; conflit nouveau. |
| 1–2 | Doctrine métier, pricing/scope et documents de vente. | Fondateur commercial ; responsable du contrat de prix. | Offre, prix, retours inclus, option annuelle, périmètre client ou méthode de vente modifiés. |
| 3 | Étapes métier, machine à états et contrats commerciaux. | Fondateur et responsable technique du lifecycle. | Nouvelle transition, modification des preuves d'acceptation/paiement ou résolution d'un échec de funnel. |
| 4–5 | Contrats hubs/handoff, runtime, Deck et preuves d'acceptation. | Responsable technique ; vérificateur de la surface concernée. | Changement de routage, responsabilité, admission, identité ou sémantique visuelle. |
| 6 | CLAUDE, autonomie, gates et contrôles de sécurité. | Fondateur pour l'autorité ; vérificateur QA/sécurité pour la preuve. | Nouveau gate, modification d'un contrôle, incident invalidant une garantie. |
| 8–9 | Décisions fondateur et preuves de mise en œuvre. | Fondateur et responsable de la capacité. | Levée du freeze, exception approuvée ou acceptation d'une capacité future. |

Une modification de compteur, de PID, de file ou d'incident du jour met à jour le rapport ou runbook pertinent, pas automatiquement ce livre. Une révision durable doit expliquer quelle décision ou garantie a changé et pourquoi. Contrôler les liens et le diff ; ne pas réauditer tout le dépôt pour une mise à jour locale.

**Promotion des preuves :** une capacité `FUTURE` devient `CONFIRMED` seulement avec implémentation identifiée **et** preuve d'acceptation correspondant à la promesse. Pour une expérience interactive, une compilation ne remplace pas la QA du parcours ; pour une action externe, une simulation ne remplace pas une preuve réelle autorisée. Noter le périmètre local, simulé ou production. Une décision peut être `CONFIRMED` en tant que politique alors que son automatisation demeure `FUTURE` ou `TO VERIFY`.

En cas de conflit, inscrire les deux sources dans D, limiter les affirmations affectées et nommer le propriétaire de la résolution. Le fondateur tranche l'intention ; le contrôle technique établit le comportement. Après preuve, actualiser le chapitre et qualifier l'ancienne affirmation `DEPRECATED` avec la raison, sans effacer son rapport d'origine. Ce processus ne déclenche aucune réparation, migration ou publication par lui-même.

## 8. Décisions d'architecture et invariants : que doit-on préserver ?

| Invariant | Raison et conséquence pour une décision |
| --- | --- |
| Faits, hypothèses, inconnues et décisions restent distincts. | La crédibilité commerciale dépend de preuves conservées ; `UNKNOWN` vaut mieux qu'une invention. [S01, S05] |
| Les décisions sensibles sont déterministes et bornées. | Le LLM produit une proposition ; règles, schémas, états et permissions décident de son admissibilité. [S01, S14] |
| Un seul codeur modifie un prototype à la fois. | Les contrôles parallèles produisent des findings ; une correction coordonnée protège l'artefact. [S06, S07] |
| Les rôles et vues n'ajoutent pas d'autorité. | Une BU, une Sales Room ou un hub visuel ne devient ni décideur financier ni file autonome supplémentaire. [S10, S14, S17] |
| Préserver l'existant et prouver le manque avant création. | Réutiliser ou corriger minimalement ; préserver données, sources, artefacts et changements validés. [S01] |
| Qualité technique, présentation, mobile et permission restent séparés. | Un PASS partiel ne compense pas un blocker et n'autorise ni contact ni déploiement. [S07, S15, S20] |
| Historique et santé actuelle ne se confondent pas. | Une ancienne URL ou erreur nécessite une lecture datée ; un résultat de job ne résume pas le produit. [S03] |
| Simplifier le cockpit ne supprime pas les preuves. | HIDE n'est pas DELETE ; diminuer la visibilité d'UNKNOWN ne change pas l'état. [S02] |

Ces invariants expliquent les choix ; les procédures qui les réalisent vivent dans leurs documents spécialisés. Un changement souhaité doit montrer quel invariant il préserve, quelle exception explicite il requiert et quelle preuve permettra de le vérifier.

## 9. Limites et direction future : que peut-on réellement promettre ?

**CONFIRMED dans le périmètre des sources :** contrats de scoring, prix, états et documents ; orchestration et contrôles locaux ; prototypes et résultats QA ; Deck et Living Swarm exposant les données ; surfaces locales de démonstration et de Sales Room. Les rapports apportent des preuves d'acceptation locales datées. Ils n'établissent pas un service commercial intégralement autonome ni la disponibilité actuelle de chaque lien.

**TO VERIFY avant promesse plus large :** aboutissement du funnel à l'acceptation/paiement, livraison finale, disponibilité externe, couverture mobile sur matériel réel et prestations incluses dans l'option annuelle. Une branche de code ou un écran « Signature » ne prouve pas une chaîne de signature ou facturation complète. Les limites précises figurent dans D.

### Quel travail futur est approuvé ?

**CONFIRMED — politique : FEATURE FREEZE = ACTIVE.** Les catégories admises sont BUG, SECURITY, INCONSISTENCY, UX, VISUAL / LAYOUT, POLISH et REAL TECHNICAL DEBT. Une amélioration techniquement possible n'est pas une justification de nouvelle feature. Une catégorie permise ne constitue pas un mandat pour modifier n'importe quel composant. [S02]

**FUTURE — seule exception de feature approuvée : SENTINEL HUB / Bureau des Sentinelles.** Prévu près de l'Orchestrator comme supervision transversale, avec exactement deux agents initiaux :

- **SENTINEL** : observateur interne en lecture seule. Détecte incohérences, dérives et anomalies ; formule un sujet de recherche. Aucun droit de réparation automatique.
- **WATCHTOWER** : recherche externe bornée et comparaison d'alternatives, uniquement dans les domaines autorisés. Recommande `ADOPT`, `ADAPT`, `REJECT` ou `WATCH` ; aucun droit d'implémentation autonome.

La boucle est **DETECT → RESEARCH → COMPARE → RECOMMEND → HUMAN DECISION**. Ni mutation de lifecycle/D1, ni patch, déploiement ou contact automatique. L'approbation du concept n'est pas une preuve d'installation ni une autorisation permanente de surveillance externe. Ce livre ne présente pas ces deux agents comme actifs. [S02]

**FUTURE / DEFERRED — analytics Sales Room et sites clients.** Premières/dernières ouvertures, comptage des visites, clics CTA, ouvertures du prototype et sources de trafic restent une idée différée, soumise à `PROVE THE GAP` et à l'examen des données déjà disponibles chez les fournisseurs. Ne pas construire préventivement une plateforme propriétaire. [S02]

Le code contient déjà des événements Sales Room et des dérivations d'activité, notamment un comptage d'événements de partage. **CONFIRMED — primitives de code seulement** : elles ne suffisent pas à déclarer le produit analytics décrit ci-dessus opérationnel, exhaustif ou validé. Ne pas transformer un événement de consultation ou de partage en intérêt explicite. Cette frontière est consignée dans D07. [S17]

Les liens locaux Sales Room peuvent rester indisponibles lorsque leur serveur de preview ne fonctionne pas : le fondateur accepte cette limite et demande de ne la corriger qu'après friction d'usage prouvée. Le patch visuel V1.1 et la correction d'animation restent du polish approuvé à vérifier séparément, sans élargissement backend ou commercial. [S02]

## Référence A — Glossaire

| Terme | Définition utile au fondateur |
| --- | --- |
| Actif / friction | Force réelle du prospect / obstacle précis dans son parcours digital. |
| Qualified / QUALIFIED | Décision de qualification interne ; ne prouve aucun intérêt exprimé. |
| INTERESTED | Signal entrant classifié comme intérêt explicite, à relier à sa preuve. |
| SAS_PENDING | État d'attente dont le planner lu retourne STOP ; aucune libération implicite. |
| Hub / BU / MO | Domaine de spécialisation / responsabilité métier / coordination du travail. |
| Handoff | Transmission structurée qui conserve objectif, faits, contraintes et autorité. |
| Job / claim / lease | Unité de travail / attribution contrôlée / réservation temporaire d'exécution. |
| DEAD_LETTER | Travail terminal après échec ; sa conséquence métier doit être examinée. |
| Escalade / human queue | Décision humaine attendue avec dossier et preuves ; pas une instruction d'envoi. |
| QA / Web Design | Contrôles de qualité / revue de clarté et présentation, complémentaires. |
| Prototype READY | État de préparation d'un objet ; ne prouve ni publication ni readiness client complète. |
| Sales Room | Surface commerciale contextualisée ; distincte du prototype et du site public. |
| DRY_RUN / mock | Simulation de transport / résultat simulé ; aucun événement externe réel à en déduire. |
| COMMITTED / WON | Acceptation avec preuve / acompte avec preuve ; aucun des deux ne signifie livraison terminée. |
| Gate | Condition obligatoire de passage ; un blocker applicable empêche la promotion. |

## Référence B — Matrice d'autorité et de responsabilité

| Acteur | Peut préparer / exécuter dans son scope | Décide ou valide | Limite explicite |
| --- | --- | --- | --- |
| Fondateur | Relation, cadrage, revue de file et arbitrage. | Politique, offre, contrat, paiement et autorisations engageantes. | Une décision ne certifie pas un comportement technique non testé. |
| Orchestrator / core | Routage, planification et transitions autorisées sur preuves. | Admissibilité déterministe dans les permissions existantes. | Aucun élargissement de mandat, envoi libre ou verdict juridique. |
| Hub / BU / MO | Affectation spécialisée et coordination du handoff. | Contrôle de périmètre et responsabilité de domaine. | Rôles logiques ; pas de budget ou queue indépendante implicite. |
| Agent 1 / research / contact | Recherche publique, dossier, contacts et scoring. | Findings avec provenance et inconnues. | Ni invention ni consentement déduit. |
| Agent 2 / codeur | Prototype et corrections autorisées. | Livrable technique soumis aux revues. | Un seul écrivain par prototype ; aucune certification client auto-attribuée. |
| BU Web Design / QA / verifier | Contrôles et findings, acceptation ou rejet du résultat concerné. | Verdict de leur gate avec preuve. | PASS n'autorise pas une action externe. |
| Agent 3 / outreach | Angle commercial, briefing et brouillons. | Préparation pour validation humaine. | Aucun contact automatique ; pas de prix inventé. |
| API / runner | Admission, exécution, retour de résultat selon configuration. | Contrôles mécaniques, jamais politique commerciale. | Identité, ownership, gates et permissions restent requis. |
| Deck / Living Swarm | Affichage, navigation et lecture de preuves. | Aucun pouvoir supplémentaire par représentation. | Ni animation probante ni état inventé en cas de déconnexion. |
| SENTINEL / WATCHTOWER | **FUTURE** : observation / recherche et recommandations. | Humain à la fin de la boucle. | Aucune réparation, mutation ou action externe autonome. |

## Référence C — Index documentaire et sources

Les identifiants S renvoient aux sources lues, pas à une nouvelle hiérarchie globale. Les renvois groupés S05–S07 désignent chacun des groupes inclus. Les preuves de code concernent les contrats mentionnés ; les preuves de rapport concernent leur date et leur périmètre. Les anciennes statistiques et listes de travaux ne sont pas importées dans ce livre.

| ID | Source et rôle |
| --- | --- |
| S01 | [AGENTS](../AGENTS.md) et [CLAUDE](../CLAUDE.md), notamment section 12 : objectif, permissions, préservation, déterminisme et proactivité. |
| S02 | [Founder input](../bulk/reports/founder-input-next-block-2026-09-07.md) : décisions de produit, freeze, Sentinel, analytics différées et politique comptable. |
| S03 | [Day-1 pack](../bulk/reports/day-1-operating-pack-2026-09-07.md), [Morning](../bulk/reports/morning-full-window-2026-09-07.md), [Deck closure](../bulk/reports/deck-v1-closure-2026-09-07.md), [runtime safety](../bulk/reports/local-runtime-safety-2026-09-07.md) : procédures et preuves datées, limites et succession des corrections. |
| S04 | [Autonomie](autonomy-policy.md), [local lifecycle](local-lifecycle.md) : autorité et principes d'exploitation ; procédures détaillées hors livre. |
| S05 | [Agent 1](../agents/agent-1-prospection.md), [Agent 2](../agents/agent-2-prototype.md), [Agent 3](../agents/agent-3-commercial.md) : doctrine recherche, prototype et vente. |
| S06 | [Orchestrator](../agents/swarm/orchestrator.md), [research swarm](../agents/swarm/research-swarm.md), [outreach](../agents/swarm/outreach.md) : travail spécialisé et limites de contact. |
| S07 | [BU Web Design](../agents/agent-4-web-design.md), [prototype QA](../agents/swarm/prototype-qa.md) : contrôles et séparation des responsabilités. |
| S08 | [Pricing policy](../core/orchestrator/pricing-policy.ts), [commercial scope](../core/orchestrator/commercial-scope.ts) : prix, acompte/solde, montant annuel et classement du périmètre. |
| S09 | [Canonical quote](../core/orchestrator/canonical-quote.ts), [business documents](../core/orchestrator/business-documents.ts) : devis, client professionnel et preuves documentaires. |
| S10 | [Commercial lifecycle](../core/orchestrator/commercial-lifecycle.ts), [machine à états](../core/state/prospect-state-machine.ts), [next action](../core/orchestrator/next-action.ts) : intérêt, progression et branches. |
| S11 | [Prospect score](../core/scoring/prospect-score.ts), [API](../apps/api-worker/src/index.ts), traitement de recherche et requête overview : score, seuil et sens des agrégats. |
| S12 | [Deck page](../apps/control-center/app/page.tsx), `processStages` : treize libellés de lecture métier. |
| S13 | [Prototype cost gate](../core/orchestrator/prototype-cost-gate.ts) : besoin, coût et production FULL/LIGHT/NONE. |
| S14 | [Hub registry](../core/hubs/registry.ts), [BU teams](../core/hubs/team.ts), [BU handoff pipeline](../core/orchestrator/bu-handoff-pipeline.ts) : rôles et transmission bornée. |
| S15 | [Web Design predicate](../core/prototypes/web-design-review.ts), [D1 job queue](../core/persistence/d1-job-queue.ts), [API](../apps/api-worker/src/index.ts), `requireRunnerStack` : admission et identité. |
| S16 | [LiveSwarmGraph](../apps/control-center/components/LiveSwarmGraph.tsx) et Deck closure S03 : territoires fonctionnels, agents sémantiques et données visualisées. |
| S17 | [Sales Room](../core/personalization/sales-room.ts), [showcase README](../sites/magicscript-v2/README.md) : état, événements et distinction des surfaces locales. |
| S18 | [Implementation status](implementation-status.md), notamment delta local du 5 septembre : corroboration limitée de prix/capacités ; ne pas traiter sa liste historique comme état actuel global. |
| S19 | [CGV de la vitrine, source du dépôt](../sites/magicscript-v2/public/cgv.html) : périmètre au devis, limites de la démo et points juridiques à compléter ; aucune certification juridique par ce livre. |
| S20 | [Mobile Conversion Gate](mobile-conversion-gate.md) : standard mobile canonique et blockers non compensatoires. |
| S21 | [Architecture V2 cible](architecture-v2.md) : intention historique ; affirmations d'autonomie à lire avec D02 et les politiques actuelles. |

## Référence D — Registre borné des conflits et vérifications

Ce registre borne les affirmations du livre. Il ne constitue pas une liste d'actions autorisées à exécuter automatiquement. Une entrée peut être close documentairement tout en conservant la preuve historique ; une entrée ouverte limite seulement la capacité concernée, pas la disponibilité de tout le manuel.

| ID / statut | Sources et écart explicite | Traitement dans le livre ; preuve de clôture / responsable |
| --- | --- | --- |
| D01 — DEPRECATED, résolution documentée | Runtime safety décrit une identité API absente acceptée et un gate après exécution ; Morning et le code actuel ajoutent refus avant D1 et gate au claim. | L'ancienne description est historique pour ces deux points. Comportement ultérieur confirmé par lecture ciblée et acceptation rapportée. Responsable technique ; toute nouvelle promesse après claim exige sa propre preuve. |
| D02 — DEPRECATED pour l'autorité d'envoi autonome | Architecture V2 cible présente SEND, relances et déploiement standard sans escalade ; CLAUDE §12, autonomie et outreach imposent validation/autorisation explicites. | Les schémas anciens expliquent une cible, pas une permission. Les actions présentes dans `next-action` ne suffisent pas à autoriser leur exécution. Fondateur pour l'intention, responsable technique pour les garde-fous ; source ancienne conservée. |
| D03 — TO VERIFY | Contrats commerciaux prévoient `COMMITTED` puis `WON` ; Morning rapporte l'échec du test funnel à `COMMITTED`. Le workflow documentaire demande des références de PDF signé/preuve ; l'acceptation Sales Room possède aussi son contrat propre. | Ne pas déclarer le funnel complet ou une signature/facturation intégrée validés. Vérifier séparément l'articulation des preuves puis le chemin jusqu'au paiement et à la préparation de livraison, avec acceptance ciblée. Fondateur et responsable lifecycle. |
| D04 — TO VERIFY | Pricing policy fixe 199 € annuels ; implementation status parle d'infrastructure annuelle ; les CGV renvoient le contenu de l'hébergement/maintenance au devis. | Montant confirmé ; services inclus, exclusions et modalités à faire confirmer dans une offre explicite avant vente. Les mentions de TVA/CGV du devis nécessitent leur validation propre. Fondateur commercial ; pas de complément inventé. |
| D05 — TO VERIFY | Mobile Conversion Gate exige les dimensions dont matériel réel ; anciens rapports et QA automatisée ne prouvent pas tous ces volets par prototype. Le prédicat Web Design ne vérifie pas à lui seul ce dossier complet. | Politique obligatoire, enforcement complet non démontré. Preuve mobile réelle et couverture applicable par livrable avant PASS client ; si matériel absent, conserver la limite. Responsable QA et fondateur pour readiness. |
| D06 — TO VERIFY pour l'équivalence des parcours | Doctrine swarm décrit prototype après réponse positive ou priorité ; machine actuelle dirige `POSITIVE_REPLY` vers l'humain et possède une branche prototype depuis `CONTACT_FOUND`. Deck présente treize repères, dont Draft transversal. | Treize étapes confirmées comme lecture métier, aucune bijection avec les états. Vérifier les branches d'orchestration concernées avant de promettre un déclenchement automatique précis. Responsable lifecycle ; ne pas réordonner silencieusement les étapes. |
| D07 — TO VERIFY / frontière FUTURE | Founder input diffère les analytics ; le contrat Sales Room contient déjà événements d'accès/partage et dérivations. | Primitives existantes reconnues, produit analytics différé. Toute promotion exige périmètre approuvé, flux réellement collecté et acceptance ; un clic ne prouve pas l'intérêt. Fondateur et responsable Sales Room. |
| D08 — TO VERIFY, preuve externe hors baseline | Les rapports du 7 septembre conservent l'ancien état apex/Amen en attente ; le contexte conversationnel transmis affirme un lancement ensuite vérifié, sans preuve canonique correspondante établie ici. | Ne présenter ni le blocage ni sa clôture comme état externe actuel. Rattacher une preuve datée apex/HTTPS/redirection et préservation DNS/mail lors d'une mission autorisée ; aucune vérification réseau ou modification ici. Fondateur / responsable infrastructure. |
| D09 — TO VERIFY | Founder input approuve V1.1 et mouvement ambiant ; Deck closure accepte la V1 et le construct, sans accepter spécifiquement toutes les décisions ultérieures. | Intention confirmée, livraison du patch non revendiquée. QA ciblée de la hiérarchie et des états IDLE/BLOCKED/ERROR/UNKNOWN avec réduction de mouvement. Responsable UI ; pas de redesign autorisé par ce livre. |
| D10 — TO VERIFY pour l'interprétation commerciale du KPI | La requête overview `qualified` exclut les états initiaux/disqualifiés et agrège plusieurs états aval ; le mot « qualifié » peut être lu comme état exact ou intérêt commercial. | Toujours distinguer agrégat du Deck, état `QUALIFIED` et intérêt explicite. Vérifier la définition au besoin avant un reporting de conversion ; aucune correction de KPI dans ce travail. Responsable Deck et fondateur. |

L'acceptation de ce livre signifie que le modèle et ses limites sont documentés avec des sources vérifiables. Elle ne clôt pas automatiquement les entrées `TO VERIFY` et ne change aucun état métier, autorisation ou service.
