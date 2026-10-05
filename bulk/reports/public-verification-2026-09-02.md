# Vérification publique ciblée — avant enrichissement

Date : 2026-09-02  
Périmètre : fiches réelles dont le score public est encore incomplet.  
Exclusion : le prospect synthétique de test n'est pas enrichi.

## Règles appliquées

- Vérifier d'abord l'identité, l'activité et la présence publique.
- Ne pas déduire un score à partir d'un simple nom ou d'un annuaire.
- Conserver `UNKNOWN` lorsqu'une information locale ou juridique n'est pas suffisamment établie.
- Ne pas collecter ni ajouter d'adresse personnelle.
- Aucun changement D1, aucun envoi, aucun déploiement et aucune suppression pendant cette étape.

## Résultats

| Fiche | Vérification publique | Décision avant enrichissement |
|---|---|---|
| APAVE EXPLOITATION FRANCE | Présence officielle Apave à Fort-de-France et activités locales de contrôle, essais, formation et conseil confirmées. L'entité « Apave Exploitation France » est également identifiée dans une page officielle Apave. | Présence et activité vérifiées. Ne pas compléter les éléments de scoring non prouvés sans source plus ciblée. |
| INRAE ANTILLES-GUYANE FORT-DE-FRANCE | Identité et activité du centre INRAE Antilles-Guyane confirmées. Des activités et événements liés à la Martinique/Fort-de-France sont publics, mais l'existence d'un établissement juridique exactement nommé comme la fiche à Fort-de-France n'est pas suffisamment établie. | Enrichissement local limité. Conserver l'incertitude sur l'implantation exacte. |
| Sun Loisirs Martinique | Site public officiel actif, activités d'excursions et de loisirs en Martinique, réservation et navigation publique visibles. | Identité, activité et présence web vérifiées. Fiche enrichissable sur ces seuls éléments. |
| DEKRA / DEKRA INDUSTRIAL (2 fiches séparées) | Présence officielle au Lamentin confirmée. Une source administrative martiniquaise identifie aussi DEKRA Industrial comme contrôleur technique d'un projet local. | Présence locale et activité vérifiées ; les deux enregistrements restent séparés, sans fusion automatique d'entités. |
| CEF - YESSS ELECTRIQUE | Le site officiel YESSS référence des agences Antilles-Guyane, dont Le Lamentin et Rivière-Salée. Une source d'annuaire publique corroborante reprend l'activité et l'adresse du Lamentin. | Présence réseau et activité vérifiées ; l'annuaire reste secondaire et ne doit pas être la seule base d'un score. |
| GENERALE D'OPTIQUE | Le site officiel référence plusieurs magasins en Martinique, dont deux au Lamentin, avec les services d'opticien associés. | Identité, activité, présence locale et présence web vérifiées. Fiche enrichissable sur ces éléments. |

## Sources publiques

- [Apave Martinique — Fort-de-France](https://find-us.apave.com/fr/martinique/fort-de-france/apave-martinique-113)
- [Apave — Apave Exploitation France](https://www.apave.com/fr-FR/reconnaissance/prefecture-expert-pour-visites-techniques-petits-trains-routiers-martinique-apave-exploitation-0)
- [INRAE — Centre Antilles-Guyane](https://www.inrae.fr/centres/antilles-guyane)
- [INRAE — activité liée à la Martinique](https://asset.antilles.hub.inrae.fr/actualites/l-ur-asset-a-accueilli-les-lyceens-de-martinique-petit-bourg)
- [Sun Loisirs — site officiel](https://sunloisirs.com/)
- [DEKRA — agence poids lourd du Lamentin](https://www.dekra-pl.com/Rdv/Step1Nat/02)
- [DEAL Martinique — document administratif citant DEKRA Industrial](https://www.martinique.developpement-durable.gouv.fr/IMG/pdf/pc_coulee_blanche_st_pierre_cp.pdf)
- [YESSS — agences Antilles-Guyane](https://www.yesss-fr.com/agences-cef.php)
- [Générale d'Optique — magasins en Martinique](https://www.generale-optique.com/opticien/martinique)

## État de sortie

- Vérification publique ciblée : `PASS_PARTIEL`
- Fiches réelles examinées : `7`
- Prospect synthétique exclu : `1`
- Scores modifiés : `0`
- Données D1 modifiées : `0`
- Emails envoyés : `0`
- Déploiements externes : `0`
- Prochaine action sûre : enrichir uniquement les champs explicitement vérifiés, puis produire un contrôle de cohérence ciblé.
