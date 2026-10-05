-- Session D-ter: local-only trace of an operator-declared historical email.
-- Apply once, after verifying the SIRET/id and absence of these trace ids.
UPDATE prospects
SET phone = '+596696227605', state = 'WAITING_REPLY',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE siret = '44971406200097' AND id = '26ea281c-6930-42d6-81da-553769dfd522';

INSERT INTO contacts (id, prospect_id, email, source_type, is_validated, is_suppressed, created_at, updated_at)
SELECT 'ananke-manual-email-20261005', id, 'c.r.sorel@gmail.com', 'OPERATOR_MANUAL', 1, 0,
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM prospects WHERE siret = '44971406200097' AND id = '26ea281c-6930-42d6-81da-553769dfd522';

INSERT INTO outreach_messages (id, prospect_id, contact_id, kind, body_text, source_refs_json, status, sent_at, created_at, updated_at)
SELECT 'ananke-initial-mail-20261005', id, 'ananke-manual-email-20261005', 'INITIAL',
       '[Mail initial envoyé manuellement depuis commercial@magicscript.fr le 05/10/2026 à 15h45 Paris — contenu non archivé dans Magic Script]',
       '[{"source":"OPERATOR_MANUAL","channel":"EMAIL","client":"commercial@magicscript.fr"}]',
       'SENT', '2026-10-05T13:45:00Z',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM prospects WHERE siret = '44971406200097' AND id = '26ea281c-6930-42d6-81da-553769dfd522';

INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at)
SELECT 'ananke-outreach-manual-20261005', id, 'OPERATOR', 'outreach.sent_manual',
       '{"source":"manual_email","client":"commercial@magicscript.fr"}', '2026-10-05T13:45:00Z'
FROM prospects WHERE siret = '44971406200097' AND id = '26ea281c-6930-42d6-81da-553769dfd522';
