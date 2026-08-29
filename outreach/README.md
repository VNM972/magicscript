# Magic Script V2 — Outreach

Cette couche gère le démarchage automatisé.

## Pipeline

```text
prospect qualifié
  ↓
recherche d'un email professionnel public
  ↓
validation / confiance
  ↓
personnalisation
  ↓
fact-check
  ↓
suppression-list check
  ↓
envoi depuis une adresse @magicscript.fr
  ↓
réponse / bounce / silence
  ↓
relance ou classification
```

## Règles

- ne jamais envoyer à une adresse marquée DO_NOT_CONTACT
- conserver la source de chaque adresse trouvée
- éviter les adresses personnelles si une adresse professionnelle pertinente existe
- dédupliquer par entreprise, domaine et email
- tracer chaque envoi et chaque relance
- limiter les relances selon une politique explicite
- ne pas inventer de faits dans les emails
- toujours permettre l'opposition
- ne jamais activer un fournisseur payant sans validation explicite

## À implémenter

- discovery/
- contacts/
- validation/
- campaigns/
- sending/
- followups/
- replies/
- suppression/
