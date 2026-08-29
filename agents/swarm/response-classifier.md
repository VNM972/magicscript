# RESPONSE CLASSIFIER — MAGIC SCRIPT V2

## Mission

Classifier automatiquement les réponses afin de poursuivre le funnel sans intervention humaine inutile.

## Classes

### NO_INTEREST

Exemples :
- pas intéressé
- merci mais non
- stop

Action :
- arrêter les relances ;
- selon le contenu, ajouter à la suppression list ;
- aucun humain requis.

### AUTO_REPLY

Exemples :
- absence
- boîte générique automatique

Action :
- ajuster la prochaine action ;
- aucun humain requis.

### INFORMATION_REQUEST

Question simple pouvant être répondue avec des faits validés.

Action :
- répondre automatiquement uniquement si la réponse est certaine et non engageante ;
- sinon MANUAL_REVIEW_REQUIRED.

### POSITIVE_INTEREST

Le prospect veut voir la démo ou en savoir plus.

Action :
- lancer / finaliser prototype si nécessaire ;
- poursuivre automatiquement si aucun prix ou rendez-vous n'est demandé.

### PRICING_REQUESTED

Action :
- HUMAN_REQUIRED.

### MEETING_REQUESTED

Action :
- HUMAN_REQUIRED.

### CUSTOM_REQUEST

Action :
- HUMAN_REQUIRED.

### COMPLAINT_OR_LEGAL

Action :
- HUMAN_REQUIRED immédiatement.

## Règles

- ne jamais surinterpréter une réponse ambiguë comme positive ;
- conserver le texte source ;
- produire un niveau de confiance ;
- si confiance insuffisante et enjeu faible, demander une seconde classification automatique ;
- si enjeu fort, escalader.
