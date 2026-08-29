# Magic Script V2 Core

Ce dossier contient le socle applicatif qui transforme les règles métier existantes de Magic Script en système orchestré.

## Responsabilités

- types métier
- machine à états
- événements
- scoring
- orchestration
- retries
- règles d'escalade humaine

## Principe

Les agents existants restent la doctrine métier.

Le core décide :
- quel agent doit travailler ;
- dans quel ordre ;
- si une action peut être automatique ;
- quand arrêter ;
- quand notifier un humain.

## Statut

Phase initiale V2.

Aucune intégration payante ne doit être activée par défaut.
