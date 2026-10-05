# BU WEB DESIGN — CONTRÔLE OBLIGATOIRE DES SITES TESTS

## Mission

La BU Web Design transforme le prototype produit par l’Agent 2 en démonstration claire, crédible et présentable. Elle intervient avant toute miniature, présentation commerciale ou mise en ligne d’un site test.

Ce contrôle ne remplace pas la validation des faits de l’Agent 1 ni la validation commerciale de l’Agent 3. Il vérifie que le visiteur comprend rapidement le site et peut agir sans friction.

## Règle de passage

Tout nouveau site test doit recevoir un état `DESIGN_REVIEW_REQUIRED`, puis un compte rendu BU Web Design. Tant que le compte rendu n’est pas `PASS` ou `PASS_WITH_NOTES`, le site ne doit pas être ajouté à la vitrine, transformé en miniature finale ou publié.

Les sites déjà présents dans la vitrine sont protégés : pas de refonte automatique. Une correction est limitée aux erreurs factuelles, aux défauts bloquants de lisibilité, aux problèmes de navigation ou aux erreurs de rendu signalées.

## Entrées obligatoires

- dossier prospect validé et classification de l’opportunité ;
- `Design Direction` sélectionnée par le moteur Magic Script, avec ses principes visuels, sa grammaire de sections, sa stratégie d’image et ses anti-patterns ;
- identité visuelle disponible : logo, couleurs, ton et règles d’usage ;
- parcours principal et CTA prioritaire ;
- liste des faits confirmés, des éléments à vérifier et des éléments interdits ;
- aperçu desktop et aperçu de navigation mobile ;
- miniature proposée, lorsqu’elle existe.

## Contrôle visuel et éditorial

1. **Compréhension en cinq secondes** : activité, public et action attendue sont identifiables.
2. **Identité** : logo visible, non déformé et correctement contrasté ; palette, typographie, espacements et traitement des boutons cohérents.
3. **Langage grand public** : préférer « navigation mobile », « demander un devis », « prendre rendez-vous » ou « voir l’offre » à des termes techniques comme `390 px`, `responsive`, `QA`, `recherche` ou `direction` lorsqu’ils ne sont pas nécessaires au visiteur.
4. **Hiérarchie** : titres, chiffres, cartes et formulaires sont alignés ; aucune superposition, coupure, débordement ou zone de signature illisible. Le regard doit suivre une priorité nette plutôt qu’une suite de blocs de poids identique.
5. **Conversion** : le CTA principal est évident. Pour un nouveau prototype Magic Script, lorsqu'une `salesRoomUrl` est fournie par le runtime, le CTA principal doit pointer exactement vers cette Sales Room. Aucun formulaire local, faux booking ou soumission commerciale directe ne doit être présenté comme connecté dans le prototype.
6. **Preuves** : chaque chiffre ou affirmation possède une source ou une formulation prudente ; aucune réussite client, localisation, certification ou promesse n’est inventée.
7. **Mouvement** : les animations renforcent la lecture, respectent la réduction de mouvement et ne masquent pas les informations.
8. **Miniature** : le titre, la localisation et l’identité visibles dans la carte correspondent exactement au prototype validé.

## Gate de composition anti-slop

La BU applique la `Design Direction` existante comme contrat de composition. Elle vérifie ses `visualPrinciples`, `heroStrategy`, `sectionGrammar`, `imageStrategy`, `density` et `antiPatterns` ; elle ne crée pas une seconde direction artistique en parallèle.

Les défauts suivants sont `BLOCKED`, et non de simples notes :

- mur de cartes ou grille de panneaux utilisée comme composition par défaut ;
- apparence de dashboard ou de template SaaS générique sans rapport avec l’activité ;
- sections répétitives enfermées dans les mêmes boîtes, avec même largeur, même poids et même rythme ;
- hero assemblé comme une collection de blocs interchangeables, sans image directrice, geste typographique ou composition propre au prospect ;
- hiérarchie plate où titre, preuve, service, chiffre et CTA se concurrencent ;
- absence d’images réelles lorsque des visuels officiels vérifiés et réutilisables sont disponibles ;
- manque d’espace négatif, de respiration ou de variations d’échelle ;
- rythme éditorial monotone qui répète la même structure d’une section à l’autre.

Une exception n’est acceptable que si la `Design Direction` sélectionnée justifie explicitement ce choix pour le secteur et si le compte rendu cite cette justification. « Moderne », « propre », « premium » ou « plus lisible » ne constitue pas une justification sectorielle. En l’absence d’images réelles vérifiées, le site doit construire sa direction avec typographie, matière, cadrage, couleur, espace négatif et rythme ; il ne doit pas compenser par une banque d’images générique ni par davantage de cartes.

## Livrable de la BU

Le compte rendu doit contenir :

- décision : `PASS`, `PASS_WITH_NOTES` ou `BLOCKED` ;
- corrections effectuées ;
- points factuels à confirmer ;
- contrôles desktop et mobile réalisés ;
- validation de la miniature ;
- capture ou aperçu de référence pour la prochaine retouche.

Un site test ne quitte la BU qu’avec un rendu stable, un texte compréhensible et une liste explicite des réserves restantes.
