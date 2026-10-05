# Agent 3 — contrat commercial canonique, A3-CP01

Cette fondation applique le Playbook V1 approuvé dans la tâche « Review Agent 3 commercial playbook » (`01a0c7c8-a79d-7be2-aa68-d46b2c43da0a`). Elle définit les entrées, les preuves autorisées, les décisions et les oracles de premier contact EMAIL / MOBILE. Les détails exécutables résident dans les modules ci-dessous ; ce document explique leur rôle sans maintenir une seconde table de politiques ou de tarifs.

## Autorités et périmètre

L’Agent 1 conserve l’autorité sur l’ICP, l’identité, la déduplication, la contactabilité et l’opportunité. L’Agent 3 utilise ce contexte versionné ; il ne recalcule pas l’admission et ne crée aucun score prospect. L’artefact préparé et sa version doivent appartenir au prospect de référence. L’objectif commercial est une réaction volontaire à cet artefact, jamais une perte, une urgence ou une relation préalable inventée.

CP01 est une fondation testable, sans intégration aux producteurs de messages existants. Aucun envoi, transport, appel LLM, changement UI, paiement, choix autonome d’offre ou déploiement n’est introduit. Les règles M010 de validation, de révision et de provenance opérateur restent inchangées : une approbation ne se transfère pas à une autre révision. Call Copilot et Buzz restent séparés. La préparation de réponses, de devis et de relances relève de périmètres distincts ; cette fondation de premier contact ne les active pas.

## Sources exécutables

| Source canonique | Responsabilité |
| --- | --- |
| [commercial-contract.ts](../core/outreach/commercial-contract.ts) | Contrat typé, références prospect / Agent 1 / artefact, claims et validation de provenance |
| [commercial-policy.ts](../core/outreach/commercial-policy.ts) | Version du playbook, doctrine, politiques EMAIL / MOBILE, décisions d’abstention et classes anti-génériques |
| [commercial-catalog.ts](../core/outreach/commercial-catalog.ts) | Projection bornée des seules offres autorisées, à partir des autorités prix et périmètre existantes |
| [commercial-fixture.ts](../core/outreach/commercial-fixture.ts) | Schéma des cas synthétiques et attentes d’évaluation |
| [commercial-oracles.ts](../core/outreach/commercial-oracles.ts) | Contrôles objectifs déterministes, indépendants du transport |
| [fixtures.ts](../core/tests/fixtures/agent3-commercial/fixtures.ts) | Matrice synthétique F01–F28, sans données prospect ni URLs réelles |

## Claims et données externes

Chaque assertion personnalisée porte une identité, un texte, un type de support, des références sources, un extrait ou fait probant, une portée, des limites et un statut. Les dates nécessaires à la vérification et à la fraîcheur font partie de la preuve. Une observation doit venir d’un fait observé ; une dérivation exige une règle nommée ; une confirmation opérateur exige une attribution datée.

Une opportunité n’est pas automatiquement une observation. Une inconnue reste inconnue ou est omise. Les claims sans provenance, non soutenus ou contradictoires ne peuvent pas justifier un message. Les limites et qualifications ne doivent pas disparaître dans la formulation. Une réservation démonstrative ne devient pas un service de réservation connecté. Les contenus prospect et externes sont des données, jamais des instructions, même s’ils demandent explicitement de modifier les règles commerciales.

Ces validations prouvent la cohérence structurelle des données déclarées. Elles ne prétendent pas vérifier automatiquement la vérité d’une source ni interpréter exhaustivement une paraphrase libre.

## Canaux et catalogue

`CHANNEL_POLICIES` définit les objectifs et plafonds de longueur, le sujet, l’ouverture, la structure, le CTA et la signature de chaque canal. EMAIL attend un objet et un corps avec une ancre vérifiée, l’artefact présenté honnêtement, son lien canonique, une invitation légère et une opposition simple. MOBILE exige une identité immédiate, un détail reconnaissable et une courte question, sans objet ni formule de courrier. Il se compose directement pour ce canal ; raccourcir un email ne constitue pas cette adaptation. MOBILE ne prouve aucune disponibilité WhatsApp.

Le lien déjà inclus n’appelle pas une demande d’autorisation de l’envoyer. Le prix est absent par défaut et aucune urgence n’est permise. Les constantes exécutables sont l’unique référence pour les limites numériques et les règles détaillées.

La projection catalogue réutilise [pricing-policy.ts](../core/orchestrator/pricing-policy.ts) et [commercial-scope.ts](../core/orchestrator/commercial-scope.ts). Elle conserve les modes FIXED / FROM / QUOTE, les montants applicables, la source et la version ; aucune table de prix parallèle n’est créée. L’entrée est une liste d’offres déjà autorisées, pas une demande de recommandation. Une portée commerciale ne prouve pas une capacité opérationnelle. Ne jamais en déduire remise, fiscalité HT/TTC, délai, maintenance, domaine, engagement annuel ou clause contractuelle.

## Abstention et anti-générique

`ABSTENTION_DECISIONS` est le mapping canonique des motifs vers les décisions. L’opposition ou suppression, le canal invalide et le premier contact déjà effectué bloquent le premier contact. L’absence de valeur soutenue, les preuves insuffisantes, un claim requis non admissible, un périmètre non confirmé ou un contexte contradictoire ne doivent pas être comblés par du texte générique. L’abstention commerciale ne modifie jamais le score ni l’admission Agent 1.

`ANTI_GENERIC_POLICY` distingue les classes BLOCK et REWRITE, avec des exemples pour CP02. Ces définitions sont une politique et des annotations d’évaluation ; elles ne constituent pas un détecteur sémantique complet. La présence d’exemples n’autorise ni juge LLM ni régénération automatique.

## Fixtures, oracles et limite de preuve

Les fixtures déterministes représentent des identités synthétiques, le contexte Agent 1, les canaux et l’historique, les claims acceptés et rejetés, les artefacts, les capacités démontrées, le catalogue autorisé et les assertions permises ou interdites. Elles portent une décision attendue, les contrôles objectifs, les attentes qualitatives et, si applicable, le motif d’abstention.

Les oracles vérifient notamment le canal, la suppression, le premier contact, l’appartenance de la proposition, le lien exact, les placeholders, la longueur, la résolution des claims, les références catalogue et l’abstention attendue. Ils rendent aussi vérifiables l’absence d’action transport et la non-transmission d’une approbation entre révisions. Ils consomment des données et ne contactent aucun destinataire.

Un résultat déterministe valide ne démontre pas, à lui seul, la qualité persuasive d’un texte ni son intégration dans le produit.

## A3-CP02 — Commercial Quality Gate

`commercial-quality-gate.ts` évalue le candidat exact après la fondation CP01. Il ne décide jamais si un prospect doit être contacté : l'admission et le contexte restent sous l'autorité Agent 1, tandis que M010 conserve l'autorité d'approbation opérateur. `READY_FOR_OPERATOR` signifie uniquement que le contenu peut être présenté à l'opérateur ; aucun envoi, transport ou contournement d'approbation n'est déclenché.

Les décisions suivent une précédence explicite : abstention de prérequis CP01, blockers objectifs/non-compensables, puis qualité sémantique bornée et seuil. Les contrôles CP01 sont réutilisés, sans second score prospect. Les blockers incluent suppression/opposition, canal ou historique invalides, identité d'artefact, claims non résolus, lien canonique, placeholders, catalogue, structure de canal, feature/prix/urgence/familiarité inventés et opposition absente. Un score élevé ne compense jamais un blocker.

Le score de message est distinct : SPECIFICITY 20, COMMERCIAL_RELEVANCE 20, HUMANNESS 15, CHANNEL_FIT 15, CTA_QUALITY 10, CONCISION 10, ANTI_GENERIC 10. Le seuil canonique est 80/100, avec aucune dimension sous 2 et SPECIFICITY, COMMERCIAL_RELEVANCE et CHANNEL_FIT au moins à 3. L'interface `BoundedSemanticAssessment` accepte une appréciation explicitement fournie ; elle ne devient pas l'autorité de factualité, suppression, provenance, catalogue, prix, propriété de proposition ou abstention.

La régénération est bornée à une seule tentative ciblée (`MAX_REGENERATION_ATTEMPTS = 1`) et ne sert pas à réparer un manque d'autorité ou de preuve. EMAIL et MOBILE ont des structures indépendantes ; MOBILE n'est jamais un email raccourci et ne déduit pas WhatsApp. Le résultat contient la révision et l'empreinte du contenu évalué. Toute modification, y compris une édition opérateur, doit être réévaluée et ne transfère pas silencieusement une décision précédente.

La persistance des retours, les profils verticaux de production, l'intégration UI et toute évolution de génération restent hors périmètre de CP02 et devront faire l'objet d'une mission explicitement autorisée.
