# Morning full-window — 2026-09-07

## Starting evidence

Branch wp09-sales-room-bfa-20260904 ; HEAD 47d693880be1a00075e08f0a8e38369752894fb2 ; behind 1, dirty intentionnellement. Lecture obligatoire dans l’ordre du prompt effectuée. Deck V1/local runtime safety clos conservés comme preuves antérieures ; aucun ré-audit global. Listeners initiaux/finals 3000 PID25656, 3002 PID1852, 8787 PID24692 ; arbres suivis API30276/runner28948/CC32888. Stack GUID 47e5ce5e-af45-467e-9193-4d82f0714f0f. Aucun runtime démarré/arrêté par la mission.

## Sub-agent findings

| SUB-AGENT | SCOPE | KEY FINDING | PRIMARY DECISION |
| --- | --- | --- | --- |
| A human_queue | File/D1/WAIT/DEAD_LETTER | 10 OPEN,21 DEAD_LETTER ; OPCO supersédé ; 3 WAITING_REPLY DRY_RUN | Classifications ci-dessous sans mutation |
| B stack_audit | Identité/startup | API expected absent = allow ; démarrage init+runner même SkipSmoke | Guard503/409 ; pas de restart ; forcer deploy false/mock |
| C predeploy_audit | Gate Web Design | Callback trop tard ; prédicat réutilisable en D1 queue | Filtre atomique snapshot + test en mémoire |
| D (agent B réutilisé) | Deck consistency | UNKNOWN faux zéro, attente réelle dry-run, ancien timeout | Petites corrections texte/données ; QA navigateur |


Les quatre investigations logiques ont utilisé trois slots, en lecture seule. La revue supplémentaire de l’implémentation par C a échoué à cause d’une limite d’usage ; elle n’est pas présentée comme réalisée. Le primaire a intégré/relu le SQL, exécuté les tests et détient le verdict.

## Proven gaps and changes

- requireRunnerStack refusait seulement un mismatch lorsque le serveur avait un ID ; il refuse maintenant l’ID serveur absent/blanc avec503, et le header absent/blanc/différent avec409, après auth mais avant D1.
- D1JobQueue.next réutilise canPromoteWithWebDesignReview sur les derniers prototypes READY de prospects PROTOTYPE_READY. L’UPDATE atomique exige ID+JSON QA exacts, dernier prototype et états toujours admissibles. Aucun attempt consommé pour un refus ; les autres jobs continuent. Même filtre pour tous les appelants D1, sans nouveau contrat de queue ni duplication du prédicat. Callback final inchangé.
- Le startup conservait true/cloudflare hérités ; false/mock sont désormais forcés. Le message d’arrêt pointe sur ms:stop. Provider agent/endpoint sont explicitement locaux dans le runbook.
- Deck : UNKNOWN sur absence backend pour compteurs/action vide ; consigne WAITING_REPLY sans présumer un vrai envoi ; motif historique explicite et daté dans les actions ; pas de conseil outreach erroné pour MANUAL_REVIEW_REQUIRED ; liste prototypes 20/20 au lieu de6/20 ; états QA et Web Design séparés ; next action READY ne promet plus une URL disponible.
- Deux fixtures API existantes reçoivent une stack correspondante pour conserver la portée de leurs tests après durcissement ; aucun contournement de sécurité.

## Canonical queue

Snapshot primaire 2026-09-07T04:10:59.322Z, SQLite ouvert readOnly:true et PRAGMA query_only=ON. 252 jobs =230 SUCCEEDED +21 DEAD_LETTER +1 PENDING. 57 prospects =30 DISQUALIFIED +10 HUMAN_ACTION_REQUIRED +14 PROTOTYPE_READY +3 WAITING_REPLY. 20 prototypes ; 10 OPEN escalations MANUAL_REVIEW_REQUIRED. Aucun reply ; messages 3DRY_RUN et7REJECTED, aucun SENT ni draft/verified supplémentaire. Pas de P0 de sécurité démontré.

Les classements sont des décisions opérationnelles de cette mission, pas des écritures dans le lifecycle ni les priorités canoniques du Deck (NORMAL reste NORMAL). P1 UCPA vise sa revue, pas une urgence globale. Chaque item a exactement un classement/priorité. Les jobs et checks sont des entités distinctes de leurs prospects ; on ne double pas le nombre d’escalades.

| ITEM / ID | CURRENT STATE | CLASSIFICATION | PRIORITY | FOUNDER ACTION |
| --- | --- | --- | --- | --- |
| UCPA SPORT VACANCES (UCPA) / 4cc2b65b-02e3-42bf-8bc7-a5787c351a4f | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P1 | Examiner le dossier UCPA et décider maintien en attente ou revue Web Design locale. Aucun replay/déploiement. |
| ARTUS MANAGEMENT / c965f79e-5aaa-4624-b73f-01e361c0be4e | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P2 | Examiner le CTA et demander une correction/QA locale distinctement autorisée. |
| La Balade du Soleil / bbd73175-accc-40a4-a24b-a9d147bfdfff | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P2 | Décider réparation locale du launcher avant reprise autorisée ou maintien en attente. |
| OFFICE CENTRAL DE COOPERATION A L ECOLE (OCCE) / 0f81b0ed-1f57-421c-aaed-85015c431baa | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P2 | Décider réparation locale du package avant reprise ou maintien en attente. |
| OPERATEUR DE COMPETENCES DES ENTREPRISES DE PROXIMITE / 8c48d357-d6b9-4c80-8e28-0e760c0c06c6 | HUMAN_ACTION_REQUIRED | NEEDS VERIFICATION | P2 | Examiner le build réussi et la QA inconnue avant toute décision lifecycle. |
| QUALICONSULT / 23151e23-579f-424d-a629-0430c5676722 | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P2 | Décider réparation locale et validation avant reprise ou maintien en attente. |
| REFUGE / 019e118b-54cd-4085-a61b-54a846fe950a | HUMAN_ACTION_REQUIRED | REAL BLOCKER | P2 | Décider réparation locale ciblée avant reprise ou maintien en attente. |
| SNEMM / 65271cb1-77be-40a5-8aa3-83aa3328391a | HUMAN_ACTION_REQUIRED | NEEDS VERIFICATION | P2 | Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |
| SNEMM / c349c8cf-ccad-4580-b210-49ebfd2d1d8f | HUMAN_ACTION_REQUIRED | NEEDS VERIFICATION | P2 | Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |
| SNEMM / fad22438-7200-4bf1-92ec-437a5396e131 | HUMAN_ACTION_REQUIRED | NEEDS VERIFICATION | P2 | Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |


### Registre détaillé de tous les prospects (état courant, preuve et décision)

Automatisation encore attendue maintenant = NO pour ces57 dossiers : 30disqualifiés, 3attentes simulées, 10décisions humaines, 14déploiements inhibés. La présence du heartbeat ne signifie pas qu’un job est admissible. Dépendance externe requise maintenant = NO ; un futur déploiement/contact demanderait une autorisation distincte. Founder YES pour les10 OPEN et SNEMM READY ; NO pour le reste (revue locale facultative des13 READY). Historique YES pour DISQUALIFIED/WAITING_REPLY, NO pour les autres ; le motif OPCO est historique mais le dossier humain reste courant.

| PROSPECT / ID | LIFECYCLE | JOB / KIND / STATE / ATTEMPTS | DERNIÈRE PREUVE | PROTOTYPE / URL | CLASSIFICATION / PRIORITY | BLOCKER / ACTION |
| --- | --- | --- | --- | --- | --- | --- |
| Magic Script Full Smoke Fixture / 00000000-0000-4000-8000-000000000001 | WAITING_REPLY | e90080a6-c556-4964-a933-cc2319c38fbc / SEND_EMAIL / SUCCEEDED / 1/3 | 09af6211-55d1-4209-9e81-f1be75b50516 email.dry_run @ 2026-09-02T05:31:26.406Z | Aucun | HISTORICAL / NO ACTION / P3 | Envoi DRY_RUN seulement : aucune réponse réelle attendue ; Conserver l’historique ; aucune relance fondée sur cette simulation. |
| REFUGE / 019e118b-54cd-4085-a61b-54a846fe950a | HUMAN_ACTION_REQUIRED | 949c0493-0b61-4121-9ed1-b54ffe011708 / ESCALATE_TO_HUMAN / SUCCEEDED / 1/3 | 66a404e9-86c8-48ac-9a4f-8c58ad3b91a0 orchestrator.human_escalation_planned @ 2026-09-02T05:31:26.314Z | Aucun | REAL BLOCKER / P2 | Import hello absent / configuration Next invalide ; Décider réparation locale ciblée avant reprise ou maintien en attente. |
| QUALICONSULT EXPLOITATION / 01a0f0d1-2f45-46e6-bb9a-d4e38973174b | DISQUALIFIED | 45961fbc-1727-4dc1-a226-4cb6a0fb2e16 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 9e5cf3b6-f5eb-45ec-be86-b473598d9888 research.scored @ 2026-09-02T03:35:54.938Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| QUALICONSULT SECURITE / 0ccd1a72-187c-4053-845f-3bc54121069d | PROTOTYPE_READY | b1f59c7f-97fb-434b-bc33-ce27f538abca / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | adaa1714-48b5-484f-a153-a10b63712d70 orchestrator.deploy_blocked @ 2026-09-02T05:31:26.258Z | e0bb7112-76ee-4f65-9350-ef5c0db73dcb READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| OFFICE CENTRAL DE COOPERATION A L ECOLE (OCCE) / 0f81b0ed-1f57-421c-aaed-85015c431baa | HUMAN_ACTION_REQUIRED | 28837652-39c6-4ac9-81f3-663b9bb357b0 / ESCALATE_TO_HUMAN / SUCCEEDED / 1/3 | 14e693cc-ebc2-4a2d-9dc6-a3524e39b6e9 orchestrator.human_escalation_planned @ 2026-09-02T05:31:26.330Z | Aucun | REAL BLOCKER / P2 | ERR_INVALID_PACKAGE_CONFIG au build ; Décider réparation locale du package avant reprise ou maintien en attente. |
| CONSTRUCTEL CONSTRUCTIONS TELECOMMUNICA. / 179b2145-1454-4919-b518-428f0dcf4760 | PROTOTYPE_READY | 38bb2974-097a-4de3-a764-7fb2ff3f8ccb / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | 4b442ed7-1e62-40a9-9682-4d3c764f6dfd orchestrator.deploy_blocked @ 2026-09-02T05:31:26.237Z | 5b426164-9f3f-4941-b8fe-210d88fd154c READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| AG2R REUNICA-LA MARTINIQUE-LE LAMEN / 21420fbb-72bd-4a37-b34a-19f2ed77f4e0 | DISQUALIFIED | c15aa052-c598-45bb-8c69-2dc584c53873 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | e476e8ed-88f2-4927-aef1-c24cda9a5353 research.scored @ 2026-09-02T02:25:55.807Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| QUALICONSULT / 23151e23-579f-424d-a629-0430c5676722 | HUMAN_ACTION_REQUIRED | 535f25b8-353c-40e5-9ef2-164553728765 / ESCALATE_TO_HUMAN / SUCCEEDED / 1/3 | e12925d9-896d-46ad-8610-d7911e53c7c5 orchestrator.human_escalation_planned @ 2026-09-02T05:31:26.277Z | bd59fc3d-2168-4f50-8bdc-0e5b6d6283eb QA_FAILED / QA FAIL / URL NULL | REAL BLOCKER / P2 | Build TypeScript Icon invalide ; produit QA_FAILED/FAIL ; Décider réparation locale et validation avant reprise ou maintien en attente. |
| INRAE ANTILLES-GUYANE FORT-DE-FRANCE / 25d37ec7-c8fe-4cca-b9ec-a43c632482e3 | DISQUALIFIED | 2d968ccd-8679-4b12-80ce-65659b1cf1e4 / RUN_RESEARCH_SWARM / DEAD_LETTER / 3/3 | 58b38d03-e795-477c-8ca0-0620da5a2e32 automation.terminal_failure_archived @ 2026-09-01T22:03:18.936Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| SNEMM / 2609319c-5578-4a37-99bb-1b0923a2f81f | PROTOTYPE_READY | e2a9dc3d-9623-4356-a334-e87b6a744759 / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | 4b9c7524-db4e-45e6-bc8d-32a43689585d orchestrator.deploy_blocked @ 2026-09-04T16:20:10.596Z | ab1db373-0d98-4752-8319-c28e1472706b READY / QA PASS / URL https://snemm-2609319c.magicscript-demos-a185c139.pages.dev/ | ACTION TOMORROW / P2 | Ancienne URL persistée ; correspondance au build du 4 septembre UNKNOWN ; Examiner ce dossier précis, ses faits, son artefact actuel et son ancienne URL avant toute intention commerciale manuelle. |
| SMAC / 275bb1e3-b999-4eba-83de-45d85c32b931 | PROTOTYPE_READY | 636668e5-b22d-44ba-88e9-0930e40a3fa8 / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | 3a5fae22-8eb8-4412-869f-e9ad14ac213e orchestrator.deploy_blocked @ 2026-09-02T05:31:26.262Z | 0cf8e6b4-6edc-439e-b806-de5d838c3789 READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| DEKRA / 2ac64a6a-6920-4151-a90e-1820e367ec5d | DISQUALIFIED | 84cceae6-b969-408c-a4e9-6bb69eba7fb8 / RUN_RESEARCH_SWARM / DEAD_LETTER / 3/3 | bb2aaa24-68f6-4c25-a343-85b26521ee1a automation.terminal_failure_archived @ 2026-09-01T07:33:22.622Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| TK ELEVATOR FRANCE / 2b337d96-861e-46c4-b960-2c51f62c02ad | DISQUALIFIED | 3b1c29ac-e58c-4fd7-9a1e-57c776627331 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 3db16a3c-9915-4595-bbc9-dbe6b2695f29 research.scored @ 2026-09-01T23:44:30.954Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| APAVE INFRASTRUCTURES ET CONSTRUCTION FRANCE / 3f3dfce6-697e-4ec0-b1b2-ead53c468709 | DISQUALIFIED | 32d0e82f-83d7-4b6d-97a2-824b455d7264 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 81fc54fd-e208-4058-b0a2-75a5f5d1de4a research.scored @ 2026-09-01T22:22:47.354Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| STELLIANT EXPERTISE & RISQUES CONSTRUCTION / 4b76cb39-46bb-4583-ae06-2da7f055418a | DISQUALIFIED | b4f7b7cb-0127-4482-81f2-9cdf1899366e / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | e6b1d4bd-fc1c-4fb5-984e-2540ac362173 research.scored @ 2026-09-02T05:25:58.458Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| UCPA SPORT VACANCES (UCPA) / 4cc2b65b-02e3-42bf-8bc7-a5787c351a4f | HUMAN_ACTION_REQUIRED | f5bce6d9-7086-4b1f-86aa-2fcd43bb1412 / DEPLOY_PROTOTYPE / DEAD_LETTER / 3/3 | 79f44219-d66b-4f6f-a36e-d87f8d6ae0b3 automation.terminal_failure @ 2026-09-06T20:49:28.634Z | ea995900-d6e7-4936-8b82-5d5f7708d347 READY / QA PASS / URL NULL | REAL BLOCKER / P1 | Web Design absent/malformé ; déploiement OFF ; Examiner le dossier UCPA et décider maintien en attente ou revue Web Design locale. Aucun replay/déploiement. |
| UNION NATIONALE DU SPORT SCOLAIRE (UNSS) / 4d9337bf-c8cb-44ff-b192-6915b1eddffa | DISQUALIFIED | cb24bbb6-e540-4757-99d0-540301c2ee46 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 702419f8-c525-4e4a-ab21-9134d3e1b28c research.scored @ 2026-09-01T22:06:47.788Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| FRATERNITE SACERDOTALE SAINT-PIE X / 56a57399-1917-4455-a1ea-4d53e81bacf0 | PROTOTYPE_READY | 28c4e017-99be-4738-bdf1-fbe3c731adbc / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | c84b5696-6d55-41dd-b302-e906d06c6f76 orchestrator.deploy_blocked @ 2026-09-02T05:31:26.241Z | db093e4a-b587-4270-a974-327962a024fa READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| ASSOCIATION POUR L'EMPLOI DES CADRES (APEC) / 56cb7cd1-a762-45a8-ab21-af1165890d80 | PROTOTYPE_READY | 4e38717c-abb4-4783-94af-2bfaf168c726 / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | dabbbc5c-cc20-4287-b201-fa9a0ee2b29c orchestrator.deploy_blocked @ 2026-09-02T05:31:26.282Z | 9beb4192-4ff8-474b-8908-fe27e52e81b0 READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| 374202 MARTINIQUE RELAY ZR / 57955a24-b74a-4176-bad3-db3083ac2656 | DISQUALIFIED | f63dbab6-fece-40f2-9928-73311422ddbb / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 6da8cbac-a4e2-4b6f-99e5-eea886666b65 research.scored @ 2026-08-31T19:42:53.514Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| TOTAL DILLON / 57ea6ecb-6170-4aef-b135-c17652b03bf3 | DISQUALIFIED | 3f9f23e1-1c93-4f9d-8720-216b33e25a83 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 04b526ba-85be-4250-a9d8-6385f9f4c043 research.scored @ 2026-09-02T02:37:22.495Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| RESTALLIANCE / 5bd05368-cdf3-444a-a2c1-b1ef5d1bb029 | DISQUALIFIED | 50f4f0a3-211b-4cd2-a966-eabc049fd160 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 44c2605a-9f06-4ab2-8851-b213d5ae4bd0 research.scored @ 2026-09-01T06:27:42.959Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| ARTUS SERVICES / 6124bf69-ae35-419f-85e0-e491e0d52cf1 | DISQUALIFIED | 94550bea-0fc1-4404-a85e-fc7a7c974c22 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 56efa444-f28a-46f8-9ba3-c53022c0d03d research.scored @ 2026-09-02T00:46:48.607Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| EURO INFORMATION SERVICES / 649ae177-36d8-4804-a082-4069b95a0e86 | PROTOTYPE_READY | c103dc2c-875a-47d2-bf69-c0149c3d5d3e / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | ca873829-a987-4a7d-bb30-e13ee4d819d2 orchestrator.deploy_blocked @ 2026-09-02T05:31:26.268Z | 8e1151b8-d38c-47b6-a7cf-19fc3a4d9a4c READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| SNEMM / 65271cb1-77be-40a5-8aa3-83aa3328391a | HUMAN_ACTION_REQUIRED | 8cd7040e-10fa-49f8-889c-c42df016293c / ESCALATE_TO_HUMAN / SUCCEEDED / 1/3 | d315f0f7-61e9-4fb5-a130-72f25f2a97ff orchestrator.human_escalation_planned @ 2026-09-02T05:31:26.362Z | Aucun | NEEDS VERIFICATION / P2 | Dossiers homonymes distincts ; anciens échecs build/arrêt runner ; Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |
| SA BATA OUTRE MER (BOM) / 6ab95ee2-8fa3-48fb-a354-2137817634fc | DISQUALIFIED | d0b8e127-2727-4e33-a0ba-4a622c49c055 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 10bfc45b-4167-4632-86e8-5e0adde00236 research.scored @ 2026-09-02T05:12:15.081Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| SGS FRANCE (SERCOVAM; VERNOLAB;COURTRAY) / 6c5ec70e-5a81-46b8-b1d9-2445d302d5dc | PROTOTYPE_READY | 8c86993a-1898-4602-8693-12ac3e5c6121 / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | dbeaf1c2-5435-4910-9f9f-71aa63d8307a orchestrator.deploy_blocked @ 2026-09-02T05:31:26.251Z | f6bf8978-8e6a-4c42-ad3f-af139a602e5f READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| TOTALENERGIES MARKETING ANTILLES GUYANE / 6d624316-cc4f-40bc-aa66-dabcd83d8b31 | DISQUALIFIED | 5bf06a3c-4351-446b-8839-ed4435c8eb66 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 66765516-d55d-400a-9996-c89c02547360 research.scored @ 2026-09-02T02:45:33.419Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| SACEM / 7101af89-be8f-45ed-b17b-794cbff65755 | DISQUALIFIED | bd505b22-92a1-4210-8a19-8fcf5b9ef30b / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | d62833e3-57d3-4f87-86bc-fd217ccee629 research.scored @ 2026-09-02T02:28:40.749Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| GENERALE D'OPTIQUE / 73443884-39de-4aae-a6e6-24a1433a12ee | DISQUALIFIED | a3156182-39dc-4fe6-bd16-d13dd24335cd / RUN_RESEARCH_SWARM / DEAD_LETTER / 3/3 | 06db9ded-5b55-4416-b073-0236ca4c6b61 automation.terminal_failure_archived @ 2026-08-31T22:35:55.111Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| SOL ANTILLES GUYANE (S A G) / 776667fb-d60f-47ed-8d69-4e190b03ac4d | PROTOTYPE_READY | bbcbc244-f107-4c9f-990e-57a7f8187446 / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | 50f462bf-f46d-44f0-bdc0-c989b035c53c orchestrator.deploy_blocked @ 2026-09-02T05:31:26.245Z | 508541c7-6211-49c9-937a-611d3be65f25 READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| LE SOUVENIR FRANCAIS / 7f379533-3f01-40f3-a4d2-8c393c0716bf | DISQUALIFIED | 8ce60a43-9625-478d-bf5f-641006b2194f / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | d18c5586-59ed-444f-9450-f731f593ef0e research.scored @ 2026-08-31T19:32:57.675Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| BOUYGUES ENERGIES & SERVICES (BOUYGUES ENERGIES & SERVICES) / 80628c9c-e17d-4c58-996e-ce189b7a090f | DISQUALIFIED | 47fdd3ff-b9d3-4726-8c0a-6968a9552a86 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 05a66c48-367b-44cf-8a0a-2a1feba1df9a research.scored @ 2026-09-01T22:16:45.723Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| BUREAU VERITAS CONSTRUCTION / 81f1e3ff-b2e5-4379-b27b-e923ac3a99bf | PROTOTYPE_READY | 340ed43c-48d1-49a1-8887-c48570a1a483 / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | d9e5ecd5-0fda-4879-a13c-ee1c12aa78b7 orchestrator.deploy_blocked @ 2026-09-02T05:31:26.299Z | a3463e12-3d27-4f87-960e-5103479df65d READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| DEKRA INDUSTRIAL / 88827016-931f-4777-9e5e-1a2b8714c6d7 | DISQUALIFIED | e24195a3-0fe4-4aa1-9a72-ae35f716432b / RUN_RESEARCH_SWARM / SUCCEEDED / 2/3 | d4716eea-50f2-4ac9-a659-4bcdffac4dcd research.scored @ 2026-09-02T00:39:32.161Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| OPERATEUR DE COMPETENCES DES ENTREPRISES DE PROXIMITE / 8c48d357-d6b9-4c80-8e28-0e760c0c06c6 | HUMAN_ACTION_REQUIRED | c99167c0-ca46-4fd3-a862-eab4d9d0d196 / BUILD_PROTOTYPE / SUCCEEDED / 2/3 | 5beee045-34fe-4870-b41f-fba5a2284862 orchestrator.human_escalation_planned @ 2026-09-02T05:31:26.321Z | 0b055bb8-c7cf-4a4e-9151-7f4fccb70a02 BUILT / QA UNKNOWN / URL NULL | NEEDS VERIFICATION / P2 | Timeout historique dépassé par BUILD SUCCEEDED ; prototype BUILT, QA UNKNOWN ; Examiner le build réussi et la QA inconnue avant toute décision lifecycle. |
| TOTALENERGIES RENOUVELABLES FRANCE / 96a77be3-680c-46fc-9882-8568b84219c1 | DISQUALIFIED | c76fa951-63f1-4f4f-8355-8bd910998e22 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 40ee07ad-06c0-4c05-bbeb-e9b7b302cb63 research.scored @ 2026-09-02T02:42:49.513Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| CNRS UMR7154 IPGP / 97b6bceb-a408-4c16-8ccb-90a65123b02b | DISQUALIFIED | 003a486e-d418-444d-b23f-94df4a9b81d8 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | c0e1d20c-9f0d-4842-b853-c5f9b5c6a2a3 research.scored @ 2026-08-31T19:40:17.753Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| SEGULA TECHNOLOGIES FRANCE / 99333708-2b8c-4b22-8ef4-e8e58e2a5566 | PROTOTYPE_READY | 3eddc88c-dfe0-4db0-a13a-f97dea733b16 / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | 8faf8e1f-dcaa-4d0c-ac59-517177337fb5 orchestrator.deploy_blocked @ 2026-09-02T05:31:26.229Z | 1fc82e27-5bc0-413d-9a06-df9ffd177272 READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| INEO INFRACOM / a38681c7-e7e6-470c-a90e-220088fe625e | DISQUALIFIED | cbf9856e-6e74-4696-8d28-3041be8afd83 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 98f13608-e230-48da-804e-ce7b4ad25f92 research.scored @ 2026-09-02T02:53:14.216Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| CEF - YESSS ELECTRIQUE / a97c4945-ece6-4590-9503-74180fe91f67 | DISQUALIFIED | 08a5c323-c83a-4fd6-8f95-9b44a27bfae0 / RUN_RESEARCH_SWARM / DEAD_LETTER / 3/3 | f6df5658-c4e9-4b97-a309-b9125dc38d79 automation.terminal_failure_archived @ 2026-08-31T22:35:55.227Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| Magic Script E2E Synthetic Prospect / af8c9cc6-4c49-4aa5-9365-40fc79fa480d | WAITING_REPLY | 0d5d2d5e-73de-48d2-8b66-3671a5b9bbbe / SEND_EMAIL / SUCCEEDED / 1/3 | b3b32547-9ef4-4775-87a2-70fdc075c59d email.dry_run @ 2026-09-01T07:01:56.979Z | 9f73e08e-7d3e-499d-b33e-f715690a9658 DEPLOYED / QA PASS / URL https://magic-script-e2e-synthetic-p.magicscript-demos-a185c139.pages.dev/ | HISTORICAL / NO ACTION / P3 | Envoi DRY_RUN seulement : aucune réponse réelle attendue ; Conserver l’historique ; aucune relance fondée sur cette simulation. |
| FINANCE CONSEIL / b41082c6-84e8-4981-8163-9fbe1addeebf | DISQUALIFIED | fcbe2a5c-9bad-49bd-85fa-dd6b221433b3 / DISCOVER_CONTACT / SUCCEEDED / 1/3 | 8a13154c-8dce-434c-b93e-57e57b456062 orchestrator.job_queued @ 2026-09-01T11:17:13.751Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| ASL DE LA MARTINIQUE / b6437e30-edf7-441c-87ac-828c56977807 | DISQUALIFIED | 744d7bce-5ca2-47db-902a-f002f48b259a / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | b2522f96-6832-4d44-ad6b-90dfdac166d0 research.scored @ 2026-09-01T23:30:19.498Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| BUREAU VERITAS EXPLOITATION / bb428966-e820-4e76-89f2-457b879aceb4 | PROTOTYPE_READY | ff1a9c14-4f5b-4edc-8ed6-be7833386976 / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | 515643c6-6f37-46e8-b865-8118ca7652f1 orchestrator.deploy_blocked @ 2026-09-02T05:31:26.304Z | 708271e6-6a68-4874-8513-2e07a4ee0f06 READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| La Balade du Soleil / bbd73175-accc-40a4-a24b-a9d147bfdfff | HUMAN_ACTION_REQUIRED | fc88675c-5644-4a2e-a028-49d917567abf / ESCALATE_TO_HUMAN / SUCCEEDED / 1/3 | 27b2030e-7e2b-47fc-9b74-d274c4a86eba orchestrator.human_escalation_planned @ 2026-09-02T05:31:26.347Z | Aucun | REAL BLOCKER / P2 | Ancien launcher Aider/Python311 en échec ; Décider réparation locale du launcher avant reprise autorisée ou maintien en attente. |
| SNEMM / c349c8cf-ccad-4580-b210-49ebfd2d1d8f | HUMAN_ACTION_REQUIRED | 2732bd08-87c2-4331-904f-03050ea0607b / ESCALATE_TO_HUMAN / SUCCEEDED / 1/3 | f224b1d0-cce8-4ef4-994e-036c517a8159 orchestrator.human_escalation_planned @ 2026-09-02T05:31:26.372Z | Aucun | NEEDS VERIFICATION / P2 | Dossiers homonymes distincts ; anciens échecs build/arrêt runner ; Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |
| AGPM-GESTION / c66cd2c2-9d8c-4d04-b83c-15f38a14058f | PROTOTYPE_READY | 3a7fb802-c1a9-4bdc-883a-a360f08f0359 / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | 5dba419d-fe6d-40d2-891e-1872ceb80eaf orchestrator.deploy_blocked @ 2026-09-02T05:31:26.232Z | 8927c51b-35d8-439a-9fe0-e4d523a6428c READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| Sun Loisirs Martinique / c7ebc520-44a6-411b-906a-690fbd4df2a3 | DISQUALIFIED | 9f3d1fa2-e90e-4145-bbd2-11ed07de6829 / RUN_RESEARCH_SWARM / DEAD_LETTER / 3/3 | 5eee7f21-54f4-4e3e-872e-68ec173143a6 automation.terminal_failure_archived @ 2026-09-01T07:33:27.815Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| ARTUS MANAGEMENT / c965f79e-5aaa-4624-b73f-01e361c0be4e | HUMAN_ACTION_REQUIRED | c4ecfc09-daf6-469f-8eeb-8517deff4377 / ESCALATE_TO_HUMAN / SUCCEEDED / 1/3 | 6f23ba35-657a-41d1-8f68-50468aa7c47f orchestrator.human_escalation_planned @ 2026-09-02T05:31:26.294Z | 8a484d65-dc53-43a3-8822-6736ffa965f7 QA_FAILED / QA FAIL / URL NULL | REAL BLOCKER / P2 | Job QA SUCCEEDED mais produit QA_FAILED/FAIL : CTA absent ; Examiner le CTA et demander une correction/QA locale distinctement autorisée. |
| Aux Deux Gouttes d'Eau / cf8479be-7c9b-46ce-9bc3-eea3b46223cb | DISQUALIFIED | 84be53b8-afb3-436a-9f2f-7c493e602fb3 / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 8289eb64-d120-45d1-9842-024b4d8eed1a research.scored @ 2026-09-01T06:50:40.815Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| SOMAREC / d2053b57-68a5-45d8-8fbb-e549096be39c | PROTOTYPE_READY | e435d68e-9a21-4a98-8244-b2916166dc0e / RUN_PROTOTYPE_QA / SUCCEEDED / 1/3 | ac166531-6373-4b8a-a1fe-8f18833e125e orchestrator.deploy_blocked @ 2026-09-02T05:31:26.254Z | dbfea04a-4db4-4e00-bf09-7b0d66daf381 READY / QA PASS / URL NULL | EXPECTED WAIT / P2 | Déploiement désactivé ; revue Web Design manquante ; URL NULL ; Sélection locale facultative ; examiner artefact/faits/revue Web Design. Laisser déploiement OFF. |
| APAVE EXPLOITATION FRANCE / da0d4664-6a21-4a47-a0b3-daab7bd13b9d | DISQUALIFIED | 71978763-4cf5-458f-88aa-956e9e61cc23 / RUN_RESEARCH_SWARM / DEAD_LETTER / 3/3 | 2551ba1e-0f85-4e18-94fb-090193d1b630 automation.terminal_failure_archived @ 2026-09-01T22:09:26.419Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| SOCIETE NATIONALE D'ENTRAIDE DE LA MEDAILLE MILITAIRE (SNEMM) / dd85cd4c-9348-45bb-bce8-84917b9bc76f | WAITING_REPLY | db1ac307-a24c-442b-8289-799101507aa9 / SEND_EMAIL / SUCCEEDED / 1/3 | 8eef08f8-2bb5-426d-bfdb-780e52a008c4 email.dry_run @ 2026-08-31T21:32:42.928Z | 2bb558f3-67cd-4154-9226-a9e2e85d72a1 DEPLOYED / QA PASS / URL https://societe-nationale-d-entraide.magicscript-demos-a185c139.pages.dev/ | HISTORICAL / NO ACTION / P3 | Envoi DRY_RUN seulement : aucune réponse réelle attendue ; Conserver l’historique ; aucune relance fondée sur cette simulation. |
| STATION VITO / e1182a15-88f4-4ce1-8071-19cf0b078fd2 | DISQUALIFIED | f890bdcd-f7d6-4aeb-80f0-c3dd344cf60d / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 05b6f826-722e-418e-8aa3-be4be666a065 research.scored @ 2026-09-02T02:40:06.196Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| SOC FIDUCIAIRE NAT JURIDIQUE FISCALE (FIDUCIAL SOFIRAL AVOCATS) / f401d5ae-49d0-46b0-97c4-8846d05cb25d | DISQUALIFIED | eb407ba1-696d-446c-9250-c48cd814fd9a / RUN_RESEARCH_SWARM / SUCCEEDED / 1/3 | 72f9b6b5-8f1e-4ee7-8901-807c2b15653c research.scored @ 2026-09-02T00:44:02.566Z | Aucun | HISTORICAL / NO ACTION / P3 | Dossier disqualifié ; Aucune action commerciale Day-1. Conserver les preuves. |
| SNEMM / fad22438-7200-4bf1-92ec-437a5396e131 | HUMAN_ACTION_REQUIRED | 216cb46b-233c-40fd-97ac-44870a1d55b3 / ESCALATE_TO_HUMAN / SUCCEEDED / 1/3 | 6efbb81b-3fb5-453d-976c-af4058612442 orchestrator.human_escalation_planned @ 2026-09-02T05:31:26.355Z | Aucun | NEEDS VERIFICATION / P2 | Dossiers homonymes distincts ; anciens échecs build/arrêt runner ; Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |

### OPEN escalation trace

| ID | PROSPECT | CRÉÉ UTC | POURQUOI VISIBLE / BLOCAGE | AUTO / FOUNDER / HISTORIQUE / EXTERNE |
| --- | --- | --- | --- | --- |
| 17899c04-5bb2-4af9-b50c-c0f6c1d773d7 | 4cc2b65b-02e3-42bf-8bc7-a5787c351a4f | 2026-09-06T20:49:28.631Z | OPEN MANUAL_REVIEW_REQUIRED ; Web Design absent/malformé ; déploiement OFF | NO / YES / NO / NO |
| 03f844c7-a5b8-4c76-844f-8196a4a68919 | 23151e23-579f-424d-a629-0430c5676722 | 2026-09-02T02:02:02.442Z | OPEN MANUAL_REVIEW_REQUIRED ; Build TypeScript Icon invalide ; produit QA_FAILED/FAIL | NO / YES / NO / NO |
| 2c07915b-4915-4c0b-9b4c-369a7d7111be | c965f79e-5aaa-4624-b73f-01e361c0be4e | 2026-09-02T01:23:57.868Z | OPEN MANUAL_REVIEW_REQUIRED ; Job QA SUCCEEDED mais produit QA_FAILED/FAIL : CTA absent | NO / YES / NO / NO |
| c8d2c5ed-b934-4693-8fe3-eddadd0607b8 | 019e118b-54cd-4085-a61b-54a846fe950a | 2026-09-01T23:56:56.267Z | OPEN MANUAL_REVIEW_REQUIRED ; Import hello absent / configuration Next invalide | NO / YES / NO / NO |
| 8a4d7b19-d27e-4f16-adba-aeef8d14a5ab | 8c48d357-d6b9-4c80-8e28-0e760c0c06c6 | 2026-09-01T22:56:00.498Z | OPEN MANUAL_REVIEW_REQUIRED ; Timeout historique dépassé par BUILD SUCCEEDED ; prototype BUILT, QA UNKNOWN | NO / YES / NO / NO |
| 2630fa6f-7886-440a-b583-81e9e91d9af8 | 0f81b0ed-1f57-421c-aaed-85015c431baa | 2026-09-01T22:28:52.387Z | OPEN MANUAL_REVIEW_REQUIRED ; ERR_INVALID_PACKAGE_CONFIG au build | NO / YES / NO / NO |
| b68aa534-4e24-49b4-a1df-5599778485c3 | bbd73175-accc-40a4-a24b-a9d147bfdfff | 2026-09-01T14:20:36.072Z | OPEN MANUAL_REVIEW_REQUIRED ; Ancien launcher Aider/Python311 en échec | NO / YES / NO / NO |
| 039f3dd8-93b9-40ca-b185-233d26c76610 | fad22438-7200-4bf1-92ec-437a5396e131 | 2026-09-01T14:20:05.483Z | OPEN MANUAL_REVIEW_REQUIRED ; Dossiers homonymes distincts ; anciens échecs build/arrêt runner | NO / YES / NO / NO |
| bb3b326d-1e86-4f6f-b67f-5da7ee235f7d | 65271cb1-77be-40a5-8aa3-83aa3328391a | 2026-09-01T11:37:58.770Z | OPEN MANUAL_REVIEW_REQUIRED ; Dossiers homonymes distincts ; anciens échecs build/arrêt runner | NO / YES / NO / NO |
| f7c10d02-1f63-48d5-9d16-bb77ff960294 | c349c8cf-ccad-4580-b210-49ebfd2d1d8f | 2026-09-01T11:17:14.609Z | OPEN MANUAL_REVIEW_REQUIRED ; Dossiers homonymes distincts ; anciens échecs build/arrêt runner | NO / YES / NO / NO |

### DEAD_LETTER : classification exhaustive

| JOB / PROSPECT | KIND / ATTEMPTS | MISE À JOUR | SOUS-TYPE / CLASSIFICATION / PRIORITÉ | ACTION |
| --- | --- | --- | --- | --- |
| f5bce6d9-7086-4b1f-86aa-2fcd43bb1412 / 4cc2b65b-02e3-42bf-8bc7-a5787c351a4f | DEPLOY_PROTOTYPE / 3/3 | 2026-09-06T20:49:28.598Z | policy/Web Design + exhausted retries ; REAL BLOCKER / P1 | Examiner le dossier UCPA et décider maintien en attente ou revue Web Design locale. Aucun replay/déploiement. |
| dc19be34-5d43-4254-ba29-aa9f266b9639 / 23151e23-579f-424d-a629-0430c5676722 | BUILD_PROTOTYPE / 3/3 | 2026-09-02T02:02:02.410Z | exhausted retries, current human dossier ; REAL BLOCKER / P2 | Décider réparation locale et validation avant reprise ou maintien en attente. |
| 6d73fe4a-c1e6-4f93-ba51-a02e825cc185 / 019e118b-54cd-4085-a61b-54a846fe950a | BUILD_PROTOTYPE / 3/3 | 2026-09-01T23:56:56.233Z | exhausted retries, current human dossier ; REAL BLOCKER / P2 | Décider réparation locale ciblée avant reprise ou maintien en attente. |
| f79ed40f-ce61-481c-839f-06d01d1b949e / 0f81b0ed-1f57-421c-aaed-85015c431baa | BUILD_PROTOTYPE / 3/3 | 2026-09-01T22:28:52.368Z | exhausted retries, current human dossier ; REAL BLOCKER / P2 | Décider réparation locale du package avant reprise ou maintien en attente. |
| 71978763-4cf5-458f-88aa-956e9e61cc23 / da0d4664-6a21-4a47-a0b3-daab7bd13b9d | RUN_RESEARCH_SWARM / 3/3 | 2026-09-01T22:09:26.408Z | historical disqualified/global ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| 2d968ccd-8679-4b12-80ce-65659b1cf1e4 / 25d37ec7-c8fe-4cca-b9ec-a43c632482e3 | RUN_RESEARCH_SWARM / 3/3 | 2026-09-01T22:03:18.923Z | historical disqualified/global ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| 284e9f25-9225-464f-a96c-76981bd5b524 / 2609319c-5578-4a37-99bb-1b0923a2f81f | DEPLOY_PROTOTYPE / 3/3 | 2026-09-01T19:54:29.212Z | superseded by later same-kind success ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| 10c603f2-e961-4003-8457-6d4c2a82d467 / bbd73175-accc-40a4-a24b-a9d147bfdfff | BUILD_PROTOTYPE / 3/3 | 2026-09-01T14:20:36.053Z | exhausted retries, current human dossier ; REAL BLOCKER / P2 | Décider réparation locale du launcher avant reprise autorisée ou maintien en attente. |
| f7523f37-b978-4dbe-aa3a-2665cb7a0978 / fad22438-7200-4bf1-92ec-437a5396e131 | BUILD_PROTOTYPE / 3/3 | 2026-09-01T14:20:05.460Z | exhausted retries, current human dossier ; NEEDS VERIFICATION / P2 | Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |
| 1c6e382d-16e6-480a-832a-e2f2f5fd2c77 / 2609319c-5578-4a37-99bb-1b0923a2f81f | GENERATE_PROTOTYPE_STRATEGY / 3/3 | 2026-09-01T13:43:28.717Z | superseded by later same-kind success ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| a12ece6a-2402-4d58-98d6-3b9787ac00ab / 2609319c-5578-4a37-99bb-1b0923a2f81f | RUN_PROTOTYPE_QA / 3/3 | 2026-09-01T13:39:12.111Z | superseded by later same-kind success ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| 3ef008f9-c55e-4c00-b724-226b9a820be6 / 65271cb1-77be-40a5-8aa3-83aa3328391a | BUILD_PROTOTYPE / 3/3 | 2026-09-01T11:37:58.723Z | exhausted retries, current human dossier ; NEEDS VERIFICATION / P2 | Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |
| 501dbdfe-0893-4104-b92c-3572aeb4177f / c349c8cf-ccad-4580-b210-49ebfd2d1d8f | BUILD_PROTOTYPE / 3/3 | 2026-09-01T11:17:14.573Z | exhausted retries, current human dossier ; NEEDS VERIFICATION / P2 | Identifier le dossier commercial exact avant reprise/clôture. Ne pas fusionner les IDs. |
| 208ba643-b226-4d54-a6ad-928e0e4c2f11 / fad22438-7200-4bf1-92ec-437a5396e131 | GENERATE_PROTOTYPE_STRATEGY / 3/3 | 2026-09-01T07:34:33.941Z | superseded by later same-kind success ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| 9f3d1fa2-e90e-4145-bbd2-11ed07de6829 / c7ebc520-44a6-411b-906a-690fbd4df2a3 | RUN_RESEARCH_SWARM / 3/3 | 2026-09-01T07:33:27.804Z | historical disqualified/global ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| 84cceae6-b969-408c-a4e9-6bb69eba7fb8 / 2ac64a6a-6920-4151-a90e-1820e367ec5d | RUN_RESEARCH_SWARM / 3/3 | 2026-09-01T07:33:22.609Z | historical disqualified/global ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| 0f68e8aa-f93d-4189-be63-bac5f8fc6e4b / 2609319c-5578-4a37-99bb-1b0923a2f81f | ESCALATE_TO_HUMAN / 0/3 | 2026-09-01 18:19:23 | superseded by later same-kind success ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| 08a5c323-c83a-4fd6-8f95-9b44a27bfae0 / a97c4945-ece6-4590-9503-74180fe91f67 | RUN_RESEARCH_SWARM / 3/3 | 2026-08-31T22:35:55.217Z | historical disqualified/global ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| a3156182-39dc-4fe6-bd16-d13dd24335cd / 73443884-39de-4aae-a6e6-24a1433a12ee | RUN_RESEARCH_SWARM / 3/3 | 2026-08-31T22:35:55.099Z | historical disqualified/global ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| 4b175aa3-225d-439d-bc9a-dbbf32575cce / global | DISCOVER_PROSPECTS / 3/3 | 2026-08-31T18:42:22.008Z | superseded by later same-kind success ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |
| f697fe34-0f93-48e6-83af-b45ce3d12336 / global | DISCOVER_PROSPECTS / 2/3 | 2026-08-31T18:23:26.252Z | superseded by later same-kind success ; HISTORICAL / NO ACTION / P3 | Conserver preuve, aucune reprise Day-1 |

### WAIT / UCPA / external history

SAFETRANSPORT = EXPECTED WAIT P3 : le prédicat readiness accepte dry-run ou test-email+destinataire, pas disabled. Aucune raison d’activer le transport. NODEADLETTERS = EXPECTED WAIT P3 après décomposition : 7/21 supersédés, 14 restants dont6 historiques DISQUALIFIED et8 échecs actuels, déjà classés. Pas de P0 automatique.

OPCO job cf7d0122-2676-4e6c-a292-8d9de41127fb ESCALATE_TO_HUMAN PENDING0/3 : EXPECTED WAIT P2, date2026-09-02T00:10:01.471Z ; dossier NEEDS VERIFICATION P2. Son BUILD c99167c0-ca46-4fd3-a862-eab4d9d0d196 SUCCEEDED2/3 à00:10:01.475Z dépasse le timeout du1septembre ; QA inconnue donc aucune résolution automatique.

Trois WAITING_REPLY historiques P3 : SNEMM dd85cd4c-9348-45bb-bce8-84917b9bc76f (message290919cb-1d7b-4f8b-af10-1895d97465b0), E2E af8c9cc6-4c49-4aa5-9365-40fc79fa480d (a2576e2e-38d5-4ca9-a934-ccedceba870a), full fixture00000000-0000-4000-8000-000000000001 (00000000-0000-4000-8000-000000000003). Tous DRY_RUN et email.dry_run ; aucune réponse réelle attendue.

UCPA job f5bce6d9-7086-4b1f-86aa-2fcd43bb1412 : DEAD_LETTER3/3, dernière update2026-09-06T20:49:28.598Z ; événement terminal79f44219-d66b-4f6f-a36e-d87f8d6ae0b3 à20:49:28.634Z ; escalade17899c04-5bb2-4af9-b50c-c0f6c1d773d7. Prototype ea995900-d6e7-4936-8b82-5d5f7708d347 READY/QA PASS/URL NULL ; Web Design manquant. Mock uniquement, sans requête Cloudflare, selon preuve d’exécution déjà close dans local-runtime-safety-2026-09-07.md. Aucun replay.

SNEMM 2609319c-5578-4a37-99bb-1b0923a2f81f possède une ancienne URL et un Web Design PASS_WITH_NOTES au4septembre. Les sorties persistées du1septembre97e4979c-cfcc-497d-b865-7d84eed84298 et c256688b-8881-4e40-b309-3ef8f739f64c prouvent des uploads Wrangler historiques réels ; ils ne sont pas des actions de cette mission. Correspondance URL/build courant et disponibilité actuelle UNKNOWN.

## Safe startup matrix

| COMMAND | SERVICES | STACK ID | AUTOPILOT | SENDING / EMAIL | DEPLOY ADMISSION / RUNNER MODE | D1 / REMOTE BINDING | SAFE DEFAULT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| npm --workspace magic-script-control-center run dev -- --hostname 127.0.0.1 | Control Center seul | Aucun généré | N/A | N/A | N/A | API cible locale ; pas de DB propre | Oui en lecture ; commande standard dev:control-center seule ne force pas hostname |
| npm run dev:api:local | API 8787 seule | Absent par défaut : runner HTTP 503 | OFF | OFF / disabled | OFF / aucun runner | local / aucun remote:true | Oui, API-only ; runner refusé |
| npm run dev:runner | Runner seul | Header si env présent ; absent refusé par API | API dépendante | disabled par défaut | API dépendante / mock par défaut | API cible dépendante | Diagnostic uniquement ; endpoint/provider hérités à contrôler |
| npm run ms:start | API 8787 + runner + CC 3000 ; install/check/init/smoke | GUID partagé ; health vérifié | OFF | OFF / disabled | OFF forcé / mock forcé | local / aucun remote:true | Externe OFF ; modifie la base locale et peut consommer du travail |
| npm run ms:start -- -SkipInstall -SkipChecks -SkipSmoke | Même stack ; sans install/check/smoke explicites | GUID partagé | OFF | OFF / disabled | OFF forcé / mock forcé | local / aucun remote:true | Préféré après validation, provider local explicite ; init D1 et runner actifs |
| npm run ms:start -- -Full -SkipInstall -SkipChecks | Stack + smoke discovery et full funnel | GUID partagé | OFF ; smoke appelle tick | ON simulé / dry-run | OFF forcé / mock forcé | local / aucun remote:true | Diagnostic, écrit queue/lifecycle local ; pas Day-1 fondateur |
| npm run smoke:swarm / npm run smoke:full | Stack préexistante requise | Ne génère pas une stack | POST tick / plan / reconcile selon script | Selon stack ; Full dry-run requis | OFF sur stack supportée | D1 existante locale | Test mutateur ; interdit sur canonique pendant cette mission |
| npm run ms:status / npm run ms:doctor | Lecture état/health | Lit lock ; compare /health manuellement | Lecture | Lecture | Lecture | Pas de mutation D1 | Oui |

## Deck consistency and QA

Browser local3000 : dix actions correspondent aux dix OPEN, liens vers IDs prospects, 57prospects pipeline ; trois WAITING_REPLY affichent vérification de preuve d’envoi ; UCPA HUMAN_ACTION_REQUIRED et prototype READY/QA PASS/Web Design UNKNOWN, sans lien de déploiement ; OPCO BUILT/QA UNKNOWN, motif ancien identifié ; ARTUS/QUALICONSULT QA_FAILED/FAIL. Les20 prototypes sont désormais listés. Runtime IDLE avec un runner récent ; diagnostic-runner ancien OFFLINE. UNKNOWN sur déconnexion/D1 absente vérifié au code/typecheck, sans provoquer une panne sur la stack canonique. Aucun clic sur les URLs externes ni workflows mutateurs.

Les liens Sales Room peuvent exister avant un prototype commercial admissible ; leur présence ne vaut pas disponibilité serveur4173, autorisation de contact ou publication actuelle. Le compteur «démo avec lien» reflète les liens dérivés des états persistés, sans nouvelle vérification externe.

## Verification

- runner-admission.integration.test.mjs :27/27 PASS, SQLite :memory:, API handler réel, pas de requête réseau ; identité manquante/mismatch pré-D1, revue missing/malformed/failed, PASS/PASS_WITH_NOTES, cycle/affinité, absence starvation, invalidation du snapshot et deploy switch OFF.
- prototype-cost-gate-api.integration.test.mjs :18/18 PASS après ajout stack aux fixtures.
- core/tests/orchestrator.test.ts + runner deploy-mode.test.ts :16/16 PASS.
- typecheck core, API, Control Center (--noEmit --incremental false) :PASS.
- Parser PowerShell et exécution des seules deux affectations deploy avec env true/cloudflare :PASS false/mock ; aucune fonction de startup exécutée.
- ms:status :API/Runner/Control Center tracked,8787/3000 LISTENING, health ok/database true, provider disabled/sending false. GET /health confirme stackID et deploy false.
- Test funnel-lifecycle supplémentaire :FAIL sur COMMITTED undefined, après callback runner réussi. Reproduit sur copie originale de l’API et du test d’avant mission dans work/, SQLite mémoire :même FAIL. Hors scope, aucune réparation commerciale.
- git diff --check :PASS ; hashes des fichiers suivis comparés aux220 entrées initiales.
- Canonique métier lu seulement ; tables prospects/jobs/prototypes/human_escalations/events/job_results/outreach_messages comparées par hashes avant/après. Le runner préexistant continue ses heartbeats, donc aucune promesse de base physique immuable n’est faite.

Final preservation proof: tables métier identiques par SHA-256 entre 2026-09-07T04:10:59.322Z et 2026-09-07T09:14:04.329Z (prospects, jobs, prototypes, human_escalations, events, job_results, outreach_messages). Aucun événement métier postérieur au 6 septembre20:49Z. Heartbeats runner seuls continuent. GET /health final confirme le même GUID, OFF/disabled et listeners3000/3002/8787 identiques.

Console navigateur : une erreur React d’hydratation a été enregistrée à09:08Z pour l’attribut open du panneau diagnostics lors de l’entrée directe #prospection. Les données/états/ancres contrôlés sont corrects ; ce warning n’est pas présenté comme résolu. Pas de redesign du panneau.

## Acceptance matrix

| ID | RESULT | EVIDENCE / LIMIT |
| --- | --- | --- |
| M1 | PASS | Lecture D1 readOnly/query_only + snapshot primaire et audit A ; 57 prospects, 252 jobs, 10 OPEN. |
| M2 | PASS | Registre ci-dessous couvre chaque prospect et chaque DEAD_LETTER/PENDING pertinent. |
| M3 | PASS | Une classification et une priorité P0-P3 par ligne ; aucun P0 humain actuel. |
| M4 | PASS | SAFETRANSPORT est un check : WAIT attendu avec disabled, P3. |
| M5 | PASS | NODEADLETTERS : 21 bruts, 7 supersédés, 14 restants (6 historiques + 8 actuels), P3. |
| M6 | PASS | UCPA 3/3 DEAD_LETTER, HUMAN_ACTION_REQUIRED, prototype READY/QA PASS, URL NULL, revue manquante ; aucun replay. |
| M7 | PASS | GUID lifecycle -> env -> var API/header runner -> vérification avant D1. |
| M8 | PASS | Identité API absente/blanche => 503, aucun accès D1 testé. |
| M9 | PASS | Identité correspondante => 204 vide ou 200 claim autorisé en mémoire. |
| M10 | PASS | Identité différente =>409 avant D1. |
| M11 | PASS | Identité runner absente/blanche =>409 ; aucun mode unfenced autorisé. |
| M12 | PASS | Commande et propagation préservées ; preuve de démarrage antérieure conservée, syntaxe/valeurs testées, stack existante tracked/healthy. Pas de redémarrage mutateur. |
| M13 | PASS | Fenêtre callback après exécution tracée puis fermée au claim. |
| M14 | PASS | canPromoteWithWebDesignReview, core/prototypes/web-design-review.ts ; aucune seconde définition. |
| M15 | PASS | D1JobQueue.next filtre les candidats avant UPDATE atomique et compare le snapshot QA au dernier état ; tests y compris invalidation concurrente. |
| M16 | PASS | Health deploy false ; startup force false/mock ; tests aucun fetch externe. |
| M17 | PASS | Matrice complète commandes/services/identité/flags/D1/remote/safe default. |
| M18 | PASS | ms:status tracked x3 ; health API ok ; Deck navigateur ; runner heartbeat IDLE. |
| M19 | PASS | 8787 supporté ; ports alternatifs multi-instance diagnostic-only, investigation DEFERRED. |
| M20 | PASS | Deck comparé aux 10 OPEN, 57 prospects et 20 prototypes, runtime et WAIT. |
| M21 | PASS | Libellés historique/dry-run/UNKNOWN corrigés ; 20 prototypes affichés avec QA et Web Design distincts. |
| M22 | PASS | 21 DEAD_LETTER : 8 échecs de dossiers actuels +13 historiques, sous-catégories explicites. |
| M23 | PASS | Trois WAITING_REPLY simulés, attente humaine OPCO et checks readiness explicités. |
| M24 | PASS | Aucun endpoint live claim/replay/retry/résolution appelé. |
| M25 | PASS | Lectures canonique readOnly/query_only uniquement ; tests en mémoire ; comparaisons hashes des tables métier. Heartbeat préexistant conservé. |
| M26 | PASS | Aucun contact/provider payé/déploiement ni requête externe de mission. |
| M27 | PASS | Aucune mutation Cloudflare/Amen/DNS/production. |
| M28 | PASS | Hashes initiaux des fichiers suivis comparés ; seules surfaces listées modifiées ; aucun Git mutateur. |
| M29 | PASS | Pack A-I produit avec commandes, santé, file et arrêt. |
| M30 | PASS (scope) | 61 tests ciblés passent ; core/API/Deck types PASS ; startup AST PASS. Test funnel supplémentaire échoue COMMITTED, reproduit avant mission, DEFERRED hors scope. |
| M31 | PASS | git diff --check exit 0 ; warnings normalisation CRLF seulement. |

## Deferrals / remaining risks

1. Échec commercial historique COMMITTED :hors périmètre, pas de claim de validation commerciale E2E complète.
2. Alternate-port multi-instance Wrangler :diagnostic-only, investigation DEFERRED ; pas nécessaire au8787 supporté.
3. Démarrage/arrêt complet non rejoué ici :init/recovery/runner mutent le canonique ; preuve antérieure conservée + contrôle code/AST et stack actuelle saine.
4. Le nouveau gate fige une approbation au claim ; il ne remplace pas une future politique de révocation après claim ni une liaison cryptographique à l’artefact réellement déployé. Callback conservé, REAL DEPLOY OFF ; aucune autorisation réelle accordée.
5. La revue additionnelle après code par sous-agent n’a pas abouti (quota). Investigations initiales complètes ; validation finale primaire.
6. Warning hydratation du panneau diagnostics sur entrée par ancre : limitation QA documentée, sans incohérence métier constatée.
7. Amen apex/ticket527041 :dernier état documenté WAIT, actuel externe UNKNOWN ; pas ré-investigué et non bloquant local.

## Files changed by this mission

- apps/api-worker/src/index.ts
- core/persistence/d1-job-queue.ts
- scripts/start-local-swarm.ps1
- apps/control-center/app/page.tsx
- apps/api-worker/src/runner-admission.integration.test.mjs (new)
- apps/api-worker/src/prototype-cost-gate-api.integration.test.mjs
- apps/api-worker/src/funnel-lifecycle.integration.test.mjs
- docs/local-lifecycle.md
- bulk/reports/day-1-operating-pack-2026-09-07.md (new)
- bulk/reports/morning-full-window-2026-09-07.md (new)

## Safety / verdict

Aucun email/contact, provider payé, déploiement, mutation production/Cloudflare/Amen/DNS, claim/replay/retry/cancel/résolution de job live. Aucun nettoyage, installation, refactor global, Git history/staging change, ni démarrage/arrêt de runtime. Etat sale et behind1 conservés. Aucun processus temporaire de service à nettoyer.

REAL EMAIL = OFF
REAL CONTACT = OFF
REAL DEPLOY = OFF
PRODUCTION WRITE = OFF

LOCAL STACK ISOLATION = PASS
WEB DESIGN PRE-DEPLOY GATE = PASS
DECK OPERATIONAL CONSISTENCY = PASS
HUMAN QUEUE = UNDERSTOOD
DAY-1 OPERATING READINESS = PASS

BLOCK COMPLETION: 100%
MAGIC SCRIPT PROJECT COMPLETION: 97%
ETA TO NEXT MEANINGFUL STEP: 10–15 minutes de revue humaine UCPA / sélection d’un dossier

Le97% reprend l’estimation du rapport Deck précédent, non recalculée ni certifiée par cette mission limitée. PASS signifie exploitation locale sûre et comprise, pas produit commercial ou déploiement réel intégralement validé. STOP à cette couche.
