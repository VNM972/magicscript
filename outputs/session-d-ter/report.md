# Session D-ter — Ananke Tattoo

Verdict : PASS. Fiche vérifiée dans Chrome réel, puis capture enregistrée dans `fiche-ananke.png`. Données locales uniquement ; aucun envoi ni déclenchement de relance automatique.

## Schéma et décision

Pas d'extension du schéma. `prospects.phone` et `prospects.state` existent. L'email est enregistré dans `contacts.email`, avec `source_type = OPERATOR_MANUAL` et `is_validated = 1`. La date du mail est `outreach_messages.sent_at` ; le type de message est `kind`, sans colonne `channel` dans cette table. La trace du canal EMAIL est enregistrée dans `source_refs_json` et projetée sur la fiche.

Instagram provient ici du payload `agent1Context.evidence` de l'événement existant `discovery.prospect_created`. La projection privilégie, lorsqu'il existe, un contact `v2_admission_contacts` INSTAGRAM / DERIVED_VALID. Aucun nouvel événement de découverte ni nouvelle coordonnée Instagram n'a été créé.

`WAITING_REPLY` est projeté sur le statut commercial `RELANCES`. La date affichée J+3 est calculée en lecture seule depuis le dernier message INITIAL / SENT, en l'absence de réponse, pour les items MANUAL. Le calcul ne crée aucun message ni job. La machine à états et `scheduleDueFollowUps()` restent inchangés. Les items V2 conservent leur projection et leurs règles existantes.

## Données enregistrées

Le script `database/data-ananke-manual-outreach-20261005.sql` a été appliqué une seule fois sur D1 locale `magicscript-dev`. Il cible à la fois le SIRET et l'identifiant vérifiés. Ne pas le réappliquer : les inserts ont des identifiants fixes.

- Ananke : téléphone `+596696227605`, état `WAITING_REPLY`, date de mise à jour actualisée.
- Contact : `ananke-manual-email-20261005`, email `c.r.sorel@gmail.com`, provenance `OPERATOR_MANUAL`, validé.
- Message : `ananke-initial-mail-20261005`, INITIAL / SENT, `sent_at = 2026-10-05T13:45:00Z`.
- Événement : `ananke-outreach-manual-20261005`, acteur OPERATOR, type `outreach.sent_manual`, payload `{"source":"manual_email","client":"commercial@magicscript.fr"}`.

Le `body_text` exact est :

> [Mail initial envoyé manuellement depuis commercial@magicscript.fr le 05/10/2026 à 15h45 Paris — contenu non archivé dans Magic Script]

Cette trace documente la déclaration opérateur d'un mail historique. `provider_message_id` reste NULL ; aucune preuve de transport SMTP n'est fabriquée.

## Preuve SQL après mise à jour

Requête exécutée en lecture seule sur la base locale :

```sql
SELECT p.id, p.company_name, p.phone, c.email, c.source_type,
       p.state, m.sent_at, m.kind, m.status
FROM prospects p
JOIN contacts c ON c.prospect_id = p.id
JOIN outreach_messages m ON m.prospect_id = p.id AND m.contact_id = c.id
WHERE p.siret = '44971406200097';
```

Résultat unique :

```json
{
  "id": "26ea281c-6930-42d6-81da-553769dfd522",
  "company_name": "Ananke Tattoo",
  "phone": "+596696227605",
  "email": "c.r.sorel@gmail.com",
  "source_type": "OPERATOR_MANUAL",
  "state": "WAITING_REPLY",
  "sent_at": "2026-10-05T13:45:00Z",
  "kind": "INITIAL",
  "status": "SENT"
}
```

`verification.json` contient les résultats SQL détaillés, le payload API et les champs réellement lus dans Chrome. La comparaison aux SHA-256 de `baseline.json` confirme : autres prospects, leurs contacts/messages/événements, événement de découverte d'Ananke, tous les jobs, places de production et réponses inchangés. Les autres colonnes d'Ananke, dont `demo_url`, `demo_ready` et `entry_source`, sont inchangées. Les 22 lignes DO_NOT_CONTACT sont conservées.

## Vérification produit

- `/api/prospects` : HTTP 200, 86 prospects, aucun DO_NOT_CONTACT, Ananke MANUAL.
- `/api/v2/deck` : HTTP 200, un seul item, Ananke, état WAITING_REPLY / statut RELANCES.
- Fiche : `http://localhost:3000/prospects/26ea281c-6930-42d6-81da-553769dfd522`.
- Chrome/154.0.8037.93, CDP réel via `scripts/qa-surface.cjs`, viewport 1440 × 1400, capture pleine page.
- Email, mobile et lien Instagram présents ; lien de démo conservé.
- Contacté le : **05/10/2026 15:45**, fuseau Europe/Paris.
- Prochaine relance : **08/10/2026 15:45**, fuseau Europe/Paris (`2026-10-08T13:45:00.000Z`).
- Instagram et relance retirés de la liste des données manquantes.
- Aucune exception Runtime Chrome. Aucun bouton d'envoi ni lien externe actionné.

Le serveur UI existant du même répertoire a été utilisé sur le port 3000. Aucun processus UI tiers n'a été arrêté.

## Fichiers du commit

- `apps/api-worker/src/index.ts` : projection des détails MANUAL, Instagram et échéance J+3 en lecture seule.
- `apps/api-worker/src/deck-generic.integration.test.mjs` : test réel SQLite de la trace, du calcul, du repli Instagram, des dates invalides, de la réponse reçue et de la stabilité V2.
- `apps/control-center/lib/deck.ts` : deux champs optionnels.
- `apps/control-center/app/prospects/[id]/page.tsx` : deux champs affichés, lien Instagram et dates Paris.
- `database/data-ananke-manual-outreach-20261005.sql` : données locales autorisées.
- `outputs/session-d-ter/` : rapport, état initial, vérification, script et capture.

## Tests

Commande ciblée exécutée :

```text
node scripts/run-tsx-with-preload.cjs --test apps/api-worker/src/deck-generic.integration.test.mjs core/tests/persisted-agent1-evidence.test.ts core/tests/deck-commercial-pipeline.test.ts
```

**62 tests réussis, 0 échec**, dont le nouveau test MANUAL et les projections V2 existantes. Le test navigateur générique existant passe également.

Vérifications réussies :

```text
npm run typecheck:api
npx tsc --noEmit --incremental false -p apps/control-center/tsconfig.json
node outputs/session-d-ter/verify.cjs browser
git diff --check
```

## Commit

Commit unique demandé : `data(ananke): coordonnées + trace outreach + fiche étendue`. Son hash est communiqué dans le livrable final. Aucun push.

## USAGE REPORT

- Consommation de crédits propre à cette conversation : **USAGE_NOT_EXPOSED**.
- Quotas du compte au dernier relevé : fenêtre 5 heures utilisée à 16 % (84 % restants) ; fenêtre 7 jours utilisée à 3 % (97 % restants). Quotas partagés avec les autres conversations.
- Solde de crédits additionnels exposé : 0. Usage ordinaire autorisé.
- Famille de modèle : GPT-6 ; variante exacte et niveau de raisonnement non exposés.
- Nombre total d'appels de cette conversation : non exposé.
- codebase-memory-mcp : utilisé pour le diagnostic préalable ; aucune modification d'index. Découverte et état initial de Phase 0 conservés.
- Repli shell requis : lectures ciblées du schéma, des consommateurs et de la projection ; inspection SQLite locale ; tests et Chrome/CDP. Quatre fichiers source applicatifs modifiés, aucun élargissement du périmètre.
