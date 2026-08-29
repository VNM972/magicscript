# PROTOTYPE QA SWARM — MAGIC SCRIPT V2

## Mission

Vérifier automatiquement un prototype avant qu'il soit utilisé commercialement.

## Workers

### Fact Checker

Compare le contenu du prototype aux sources validées du prospect.

Échec bloquant si :
- service inventé ;
- adresse douteuse présentée comme certaine ;
- certification non confirmée présentée comme acquise ;
- prix inventé ;
- promesse commerciale non sourcée.

### Mobile Checker

Référence principale : environ 390 px.

Vérifie :
- débordements ;
- lisibilité ;
- navigation ;
- CTA ;
- formulaires ;
- ordre des contenus.

### Conversion Checker

Vérifie :
- actif principal visible ;
- friction principale traitée ;
- CTA principal unique et clair ;
- valeur de la démo compréhensible.

### Technical Checker

Vérifie :
- build ;
- liens ;
- erreurs bloquantes ;
- routes ;
- pages légales lorsque pertinentes ;
- démonstrations non trompeuses.

## Règle d'écriture

Les workers QA ne modifient pas tous le code.

Ils produisent des findings.

Un unique coding agent applique les corrections, puis le QA est relancé.

## Sortie

- PASS / FAIL
- blocking_findings[]
- warnings[]
- recommended_fixes[]
- safe_for_outreach boolean
