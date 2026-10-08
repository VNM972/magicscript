# Swarm state — contrat v1.0.0

Source unique : le JSON Schema ci-dessous est chargé par Python et Next.js. Son default définit la topologie vide commune ; x-jobRoles définit la projection des types de jobs.

## Sémantique

- Horodatages UTC RFC 3339. sourceStatus=ready signifie lecture réussie, pas moteur sain. La route Next lit d'abord le Worker, puis le JSON local en fallback si la voie Worker échoue ; le fallback exige un instantané valide de moins de 20 secondes. missing est le repli API sans fichier. JSON invalide ou instantané périmé : HTTP 503.
- Quatre BUs représentent des phases visuelles, pas les verticales SWARM_HUBS. Positions normalisées [0,1], répartition verticale adaptée sur mobile.
- Sept agents de base représentent des rôles, pas sept processus attestés. Des jobs simultanés créent des instances role:jobId, sans écraser la concurrence.
- Tous les jobs non terminaux et les 100 terminaux les plus récents sont inclus ; 50 événements récents. activeJobs compte RUNNING/SENDING, activeAgents compte processing. PENDING reste idle ; SEND_UNKNOWN devient waiting_gatekeeper (intervention nécessaire, sans approbation prouvée).
- Jobs terminés dans l'historique, sans maintenir les agents actifs. progress=null signifie inconnu, SUCCEEDED donne 1. startedAt vient de claimed_at, sinon null.
- health=null : aucun indicateur normalisé. swarm.status : processing si activité, attention si SEND_UNKNOWN ou erreur dans les jobs projetés, sinon idle ; unavailable si source absente.
- route contient seulement la BU attestée par le type de job. Aucun transfert déduit d'un prospect commun. Types inconnus : job conservé, BU/agent nuls et route vide.
- Edges : topologie possible, idle sans preuve de transfert, activeJobIds vide. Aucune impulsion fictive. Fibres et particules Canvas décoratives.
- Gatekeepers idle, decision=null : SUCCEEDED ne prouve jamais une validation humaine. waiting/approved/rejected réservés aux décisions explicites.
- Client : cinq états agent ; flash success limité à 1,5 s par transition, non rejoué à chaque sondage.
- IDs uniques et références cohérentes : agentIds, businessUnitId, currentJobId, currentAgentId, currentBusinessUnitId, source/target, route, activeJobIds.
- Messages des événements : type canonique uniquement. Aucun payload, email, erreur brute ou secret publié. Sévérité dérivée du type : error/failed/dead_letter/rejected, puis warning/invalid/unknown, sinon info.

## Exécution

SQLite : URI mode=ro, query_only=ON, transaction de lecture. Base D1 locale canonique par défaut, surcharge --db explicite. Aucun accès D1 distant. Base vide avec tables jobs/events : quatre BUs et agents idle. Base absente/incompatible : erreur, jamais création de DB.

Daemon : publication atomique toutes les 5 s, réessai au cycle suivant si erreur ; dernier fichier périmé après 20 s. Frontend : polling 5 s, délai maximum 4 s, annulation au démontage, dernier rendu conservé avec « Moteur indisponible ». Pause/mouvement réduit n'arrêtent pas le polling.

JSON public = artefact local à ne pas committer ; expose les identifiants opérationnels. Servir le deck dans son environnement de confiance. Exige un serveur Next Node avec ce document et le fichier accessibles, pas un export statique.

Depuis la racine du dépôt, PowerShell :
- git switch feature/swarm-backend-connection
- npm run swarm:daemon en parallèle du dev control-center si on veut le fallback actif
- Autre terminal : npm run dev:control-center
- Ouvrir http://localhost:3000, Living Hive.

Tests : python -B -m unittest discover -s tests -p test_swarm_state_writer.py ; npm run build:control-center. Test polling : arrêter le daemon, modifier temporairement le JSON avec timestamp frais, attendre un cycle, puis régénérer avec --once. Ne jamais modifier SQLite.

## Schéma exécutable

<!-- SWARM_SCHEMA -->
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "metadata",
    "swarm",
    "businessUnits",
    "agents",
    "gatekeepers",
    "edges",
    "jobs",
    "events"
  ],
  "properties": {
    "metadata": {
      "$ref": "#/$defs/metadata"
    },
    "swarm": {
      "$ref": "#/$defs/swarm"
    },
    "businessUnits": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/businessUnits"
      }
    },
    "agents": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/agents"
      }
    },
    "gatekeepers": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/gatekeepers"
      }
    },
    "edges": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/edges"
      }
    },
    "jobs": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/jobs"
      }
    },
    "events": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/events"
      }
    }
  },
  "$defs": {
    "metadata": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "timestamp",
        "schemaVersion",
        "sourceStatus"
      ],
      "properties": {
        "timestamp": {
          "type": "string",
          "format": "date-time"
        },
        "schemaVersion": {
          "enum": [
            "1.0.0"
          ]
        },
        "sourceStatus": {
          "enum": [
            "ready",
            "missing"
          ]
        }
      }
    },
    "swarm": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "name",
        "status",
        "health",
        "activeJobs",
        "activeAgents"
      ],
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "name": {
          "type": "string",
          "minLength": 1
        },
        "status": {
          "enum": [
            "idle",
            "processing",
            "attention",
            "unavailable"
          ]
        },
        "health": {
          "type": [
            "number",
            "null"
          ],
          "minimum": 0,
          "maximum": 1
        },
        "activeJobs": {
          "type": "integer",
          "minimum": 0
        },
        "activeAgents": {
          "type": "integer",
          "minimum": 0
        }
      }
    },
    "businessUnits": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "name",
        "status",
        "position",
        "agentIds"
      ],
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "name": {
          "type": "string",
          "minLength": 1
        },
        "status": {
          "enum": [
            "idle",
            "processing",
            "waiting_gatekeeper",
            "success",
            "error"
          ]
        },
        "position": {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "x",
            "y"
          ],
          "properties": {
            "x": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            "y": {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            }
          }
        },
        "agentIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    },
    "agents": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "name",
        "type",
        "businessUnitId",
        "status",
        "currentJobId",
        "progress",
        "startedAt"
      ],
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "name": {
          "type": "string",
          "minLength": 1
        },
        "type": {
          "type": "string",
          "minLength": 1
        },
        "businessUnitId": {
          "type": "string",
          "minLength": 1
        },
        "status": {
          "enum": [
            "idle",
            "processing",
            "waiting_gatekeeper",
            "success",
            "error"
          ]
        },
        "currentJobId": {
          "type": [
            "string",
            "null"
          ]
        },
        "progress": {
          "type": [
            "number",
            "null"
          ],
          "minimum": 0,
          "maximum": 1
        },
        "startedAt": {
          "type": [
            "string",
            "null"
          ],
          "format": "date-time"
        }
      }
    },
    "gatekeepers": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "name",
        "businessUnitId",
        "status",
        "currentJobId",
        "decision"
      ],
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "name": {
          "type": "string",
          "minLength": 1
        },
        "businessUnitId": {
          "type": "string",
          "minLength": 1
        },
        "status": {
          "enum": [
            "idle",
            "waiting",
            "approved",
            "rejected"
          ]
        },
        "currentJobId": {
          "type": [
            "string",
            "null"
          ]
        },
        "decision": {
          "enum": [
            null,
            "approved",
            "rejected"
          ]
        }
      }
    },
    "edges": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "source",
        "target",
        "status",
        "activeJobIds"
      ],
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "source": {
          "type": "string",
          "minLength": 1
        },
        "target": {
          "type": "string",
          "minLength": 1
        },
        "status": {
          "enum": [
            "idle",
            "active",
            "error"
          ]
        },
        "activeJobIds": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    },
    "jobs": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "prospectId",
        "status",
        "currentBusinessUnitId",
        "currentAgentId",
        "progress",
        "route"
      ],
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "prospectId": {
          "type": [
            "string",
            "null"
          ]
        },
        "status": {
          "enum": [
            "PENDING",
            "RUNNING",
            "SENDING",
            "SEND_UNKNOWN",
            "SUCCEEDED",
            "FAILED",
            "DEAD_LETTER"
          ]
        },
        "currentBusinessUnitId": {
          "type": [
            "string",
            "null"
          ]
        },
        "currentAgentId": {
          "type": [
            "string",
            "null"
          ]
        },
        "progress": {
          "type": [
            "number",
            "null"
          ],
          "minimum": 0,
          "maximum": 1
        },
        "route": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    },
    "events": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "id",
        "timestamp",
        "type",
        "severity",
        "message"
      ],
      "properties": {
        "id": {
          "type": "string",
          "minLength": 1
        },
        "timestamp": {
          "type": "string",
          "format": "date-time"
        },
        "type": {
          "type": "string",
          "minLength": 1
        },
        "severity": {
          "enum": [
            "info",
            "warning",
            "error"
          ]
        },
        "message": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  },
  "default": {
    "metadata": {
      "timestamp": "1970-01-01T00:00:00Z",
      "schemaVersion": "1.0.0",
      "sourceStatus": "missing"
    },
    "swarm": {
      "id": "magic-script",
      "name": "Magic Script",
      "status": "unavailable",
      "health": null,
      "activeJobs": 0,
      "activeAgents": 0
    },
    "businessUnits": [
      {
        "id": "discovery",
        "name": "DISCOVERY",
        "status": "idle",
        "position": {
          "x": 0.22,
          "y": 0.33
        },
        "agentIds": [
          "scout",
          "qualifier"
        ]
      },
      {
        "id": "research",
        "name": "RESEARCH",
        "status": "idle",
        "position": {
          "x": 0.76,
          "y": 0.25
        },
        "agentIds": [
          "analyst",
          "fact"
        ]
      },
      {
        "id": "build",
        "name": "BUILD",
        "status": "idle",
        "position": {
          "x": 0.68,
          "y": 0.73
        },
        "agentIds": [
          "designer",
          "qa"
        ]
      },
      {
        "id": "delivery",
        "name": "DELIVERY",
        "status": "idle",
        "position": {
          "x": 0.22,
          "y": 0.75
        },
        "agentIds": [
          "publisher"
        ]
      }
    ],
    "agents": [
      {
        "id": "scout",
        "name": "Signal Scout",
        "type": "role",
        "businessUnitId": "discovery",
        "status": "idle",
        "currentJobId": null,
        "progress": null,
        "startedAt": null
      },
      {
        "id": "qualifier",
        "name": "Qualifier",
        "type": "role",
        "businessUnitId": "discovery",
        "status": "idle",
        "currentJobId": null,
        "progress": null,
        "startedAt": null
      },
      {
        "id": "analyst",
        "name": "Deep Research",
        "type": "role",
        "businessUnitId": "research",
        "status": "idle",
        "currentJobId": null,
        "progress": null,
        "startedAt": null
      },
      {
        "id": "fact",
        "name": "Fact Checker",
        "type": "role",
        "businessUnitId": "research",
        "status": "idle",
        "currentJobId": null,
        "progress": null,
        "startedAt": null
      },
      {
        "id": "designer",
        "name": "Creative Builder",
        "type": "role",
        "businessUnitId": "build",
        "status": "idle",
        "currentJobId": null,
        "progress": null,
        "startedAt": null
      },
      {
        "id": "qa",
        "name": "Visual QA",
        "type": "role",
        "businessUnitId": "build",
        "status": "idle",
        "currentJobId": null,
        "progress": null,
        "startedAt": null
      },
      {
        "id": "publisher",
        "name": "Delivery Agent",
        "type": "role",
        "businessUnitId": "delivery",
        "status": "idle",
        "currentJobId": null,
        "progress": null,
        "startedAt": null
      }
    ],
    "gatekeepers": [
      {
        "id": "g-discovery",
        "name": "Discovery Gate",
        "businessUnitId": "discovery",
        "status": "idle",
        "currentJobId": null,
        "decision": null
      },
      {
        "id": "g-research",
        "name": "Research Gate",
        "businessUnitId": "research",
        "status": "idle",
        "currentJobId": null,
        "decision": null
      },
      {
        "id": "g-build",
        "name": "Build Gate",
        "businessUnitId": "build",
        "status": "idle",
        "currentJobId": null,
        "decision": null
      },
      {
        "id": "g-delivery",
        "name": "Delivery Gate",
        "businessUnitId": "delivery",
        "status": "idle",
        "currentJobId": null,
        "decision": null
      }
    ],
    "edges": [
      {
        "id": "e1",
        "source": "scout",
        "target": "g-discovery",
        "status": "idle",
        "activeJobIds": []
      },
      {
        "id": "e2",
        "source": "g-discovery",
        "target": "analyst",
        "status": "idle",
        "activeJobIds": []
      },
      {
        "id": "e3",
        "source": "analyst",
        "target": "fact",
        "status": "idle",
        "activeJobIds": []
      },
      {
        "id": "e4",
        "source": "fact",
        "target": "g-research",
        "status": "idle",
        "activeJobIds": []
      },
      {
        "id": "e5",
        "source": "g-research",
        "target": "designer",
        "status": "idle",
        "activeJobIds": []
      },
      {
        "id": "e6",
        "source": "designer",
        "target": "g-build",
        "status": "idle",
        "activeJobIds": []
      },
      {
        "id": "e7",
        "source": "g-build",
        "target": "publisher",
        "status": "idle",
        "activeJobIds": []
      },
      {
        "id": "e8",
        "source": "publisher",
        "target": "g-delivery",
        "status": "idle",
        "activeJobIds": []
      },
      {
        "id": "e9",
        "source": "g-delivery",
        "target": "qualifier",
        "status": "idle",
        "activeJobIds": []
      }
    ],
    "jobs": [],
    "events": []
  },
  "x-jobRoles": {
    "DISCOVER_PROSPECTS": "scout",
    "RUN_SCORING": "qualifier",
    "DISCOVER_CONTACT": "qualifier",
    "VALIDATE_CONTACT": "qualifier",
    "RUN_RESEARCH_SWARM": "analyst",
    "FACT_CHECK_OUTREACH": "fact",
    "FACT_CHECK_INFORMATION_RESPONSE": "fact",
    "BUILD_PROTOTYPE": "designer",
    "GENERATE_PROTOTYPE_STRATEGY": "designer",
    "CREATIVE_WEB_DESIGN_SYNTHETIC": "designer",
    "V2_DESIGN_REQUEST": "designer",
    "V2_DESIGN_REVISION": "designer",
    "V2_BUILD_SITE": "designer",
    "V2_BUILD_CORRECTION": "designer",
    "RUN_PROTOTYPE_QA": "qa",
    "RUN_SYNTHETIC_PROTOTYPE_QA": "qa",
    "V2_DESIGN_REVIEW": "qa",
    "V2_VISUAL_QA": "qa",
    "GENERATE_OUTREACH": "publisher",
    "SEND_EMAIL": "publisher",
    "SEND_FOLLOW_UP": "publisher",
    "CLASSIFY_REPLY": "publisher",
    "DEPLOY_PROTOTYPE": "publisher",
    "SEND_DEMO_LINK": "publisher",
    "ESCALATE_TO_HUMAN": "publisher",
    "GENERATE_INFORMATION_RESPONSE": "publisher",
    "SEND_INFORMATION_RESPONSE": "publisher"
  }
}
```
