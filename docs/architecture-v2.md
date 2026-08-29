# Magic Script V2 — Architecture cible

## Objectif produit

Magic Script V2 doit fonctionner comme un SDR + analyste + studio web quasi autonome.

Principe central :

> Tant qu'une action est routinière, réversible et automatisable, le système l'exécute sans intervention humaine.

L'intervention humaine n'est requise qu'en cas de signal commercial qualifié ou d'action engageante.

## Funnel autonome

```text
DISCOVERY
  ↓
RESEARCH
  ↓
SCORING
  ↓
CONTACT DISCOVERY
  ↓
CONTACT VALIDATION
  ↓
OUTREACH GENERATION
  ↓
FACT CHECK / QA
  ↓
SEND
  ↓
WAITING_REPLY
  ↓
FOLLOW_UPS
  ↓
RESPONSE CLASSIFICATION
  ↓
┌──────────────┬──────────────┬─────────────────┐
│ NOT INTEREST │ NO RESPONSE  │ POSITIVE SIGNAL │
│ archive      │ retry policy │ prototype/lead  │
└──────────────┴──────────────┴─────────────────┘
                                  ↓
                           HUMAN ESCALATION
```

## Human escalation

Escalader uniquement pour :

- HOT_LEAD
- MEETING_REQUESTED
- PRICING_REQUESTED
- CUSTOM_REQUEST
- CONTRACT_REQUIRED
- PAYMENT_REQUIRED
- LEGAL_REVIEW_REQUIRED
- MANUAL_REVIEW_REQUIRED après échec des contrôles automatiques

Ne pas escalader pour :

- recherche prospect
- audit site
- recherche d'email professionnel
- déduplication
- scoring
- génération d'email
- relance standard
- bounce simple
- refus simple
- désinscription
- retry technique
- prototype standard
- QA standard
- déploiement standard

## Swarm

Le swarm est utilisé uniquement lorsque le parallélisme apporte une valeur réelle.

### Research swarm

- Business facts
- Website audit
- Reputation / reviews
- Social presence
- Competitive benchmark
- Contact discovery

Un orchestrateur consolide ensuite les sorties et tranche les contradictions.

### Prototype QA swarm

- Fact checker
- Mobile checker
- Conversion checker
- Technical checker

Un seul agent codeur modifie un prototype à la fois.

## Couches logicielles

```text
core/
  orchestrator/
  state/
  scoring/
  events/
  types/

agents/
  existing/
  swarm/

outreach/
  discovery/
  contacts/
  validation/
  campaigns/
  sending/
  followups/
  replies/
  suppression/

prototypes/
  existing prospect sites

apps/
  control-center/
```

## Source de vérité

Les fichiers Markdown restent utiles comme audit humain et mémoire métier.

La source de vérité opérationnelle V2 doit être structurée :

- prospects
- contacts
- research findings
- scores
- outreach messages
- campaign events
- replies
- agent runs
- prototypes
- human escalations
- suppression list

## Contraintes

- aucune API payante sans autorisation explicite
- aucune suppression ou réécriture massive de l'existant
- aucune information inventée sur un prospect
- aucune fonctionnalité de démonstration présentée comme réelle
- aucune modification simultanée d'un même prototype par plusieurs agents
- main reste stable ; développement sur magic-script-v2
