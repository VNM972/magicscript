-- Session A: explicitly approved operator exclusions, local magicscript-dev only.
-- Run every statement in ONE transaction (Wrangler atomic batch, or direct SQLite
-- BEGIN IMMEDIATE / COMMIT with ROLLBACK on any error). No schema change or deletion.
-- Fail closed on identity/state drift, admissions, slots, or replay.
WITH expected(id, company_name, siren, siret, state) AS (
 VALUES
  ('dd85cd4c-9348-45bb-bce8-84917b9bc76f', 'SOCIETE NATIONALE D''ENTRAIDE DE LA MEDAILLE MILITAIRE (SNEMM)', NULL, NULL, 'WAITING_REPLY'),
  ('bbd73175-accc-40a4-a24b-a9d147bfdfff', 'La Balade du Soleil', NULL, NULL, 'HUMAN_ACTION_REQUIRED'),
  ('cf8479be-7c9b-46ce-9bc3-eea3b46223cb', 'Aux Deux Gouttes d''Eau', NULL, NULL, 'DISQUALIFIED'),
  ('fad22438-7200-4bf1-92ec-437a5396e131', 'SNEMM', NULL, NULL, 'HUMAN_ACTION_REQUIRED'),
  ('c349c8cf-ccad-4580-b210-49ebfd2d1d8f', 'SNEMM', NULL, NULL, 'HUMAN_ACTION_REQUIRED'),
  ('65271cb1-77be-40a5-8aa3-83aa3328391a', 'SNEMM', NULL, NULL, 'HUMAN_ACTION_REQUIRED'),
  ('2609319c-5578-4a37-99bb-1b0923a2f81f', 'SNEMM', NULL, NULL, 'OUTREACH_VERIFIED'),
  ('da0d4664-6a21-4a47-a0b3-daab7bd13b9d', 'APAVE EXPLOITATION FRANCE', NULL, NULL, 'DISQUALIFIED'),
  ('3f3dfce6-697e-4ec0-b1b2-ead53c468709', 'APAVE INFRASTRUCTURES ET CONSTRUCTION FRANCE', NULL, NULL, 'DISQUALIFIED'),
  ('f401d5ae-49d0-46b0-97c4-8846d05cb25d', 'SOC FIDUCIAIRE NAT JURIDIQUE FISCALE (FIDUCIAL SOFIRAL AVOCATS)', NULL, NULL, 'DISQUALIFIED'),
  ('e1182a15-88f4-4ce1-8071-19cf0b078fd2', 'STATION VITO', NULL, NULL, 'DISQUALIFIED'),
  ('ec045b5e-00be-44a3-a556-cfbc88cf56bb', 'JEAN-PIERRE EUVRARD', '411134281', '41113428100012', 'DISCOVERED'),
  ('d0dafaae-aebe-46c2-a532-5264a5a0d4f4', 'SASU-YOUYOU-MARKET', '842741621', '84274162100010', 'DISQUALIFIED'),
  ('fb951634-6f69-46f8-9f46-8db04e780e69', 'ENVIE D AILLEURS', '513919704', '51391970400017', 'DISQUALIFIED'),
  ('d2c22cec-1091-4e81-8c50-cc90cb0f7216', 'GUY HOQUET L''IMMOBILIER', '518705447', '51870544700010', 'PROTOTYPE_REQUIRED'),
  ('f5eedd9c-2e39-46eb-9663-1d9b3a7f6cad', 'L''UNIVERS DU PNEU', '521924241', '52192424100016', 'DISQUALIFIED'),
  ('cc39f49b-3306-44b5-af7c-7fd1dc9633d1', 'SOCIETE MARTINIQUAISE DE LOCATION (SOMARLOC)', '444714745', '44471474500015', 'DISQUALIFIED'),
  ('fa6850d4-8664-4429-8971-a67042a16a6f', 'BEAUTY_FIXTURE', '623456789', '62345678900003', 'DISQUALIFIED'),
  ('d12e10f8-6252-4f28-9c50-aa2742aa74c0', 'KAY JUJU', '920247814', '92024781400014', 'DISQUALIFIED'),
  ('d2d789c3-069d-4b6d-bd38-c8c6a3793453', 'LADYBUG', '821132156', '82113215600018', 'DISQUALIFIED'),
  ('d527af9a-735b-4ef8-8ef0-01b2880de8d3', 'GROUPE FONTAINE COMPTABILITE ET ADMINISTRATION', '753552421', '75355242100012', 'DISQUALIFIED'),
  ('d11e064f-9a56-467a-933d-1142a210474e', 'RODOLPHO ALEXANDER', '830302402', '83030240200011', 'DISQUALIFIED')
)
SELECT CASE WHEN
  (SELECT COUNT(*) FROM expected e JOIN prospects p ON p.id = e.id
   WHERE p.company_name = e.company_name AND p.siren IS e.siren
     AND p.siret IS e.siret AND p.state = e.state) = 22
  AND NOT EXISTS (SELECT 1 FROM v2_admissions WHERE prospect_id IN (SELECT id FROM expected))
  AND NOT EXISTS (SELECT 1 FROM active_production_slots WHERE prospect_id IN (SELECT id FROM expected))
  AND NOT EXISTS (SELECT 1 FROM events WHERE id IN (SELECT 'session-a-operator-exclusion:' || id FROM expected))
THEN 1 ELSE json('SESSION_A_PRESTATE_MISMATCH_OR_REPLAY') END AS preflight;

INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at)
SELECT 'session-a-operator-exclusion:' || id, id, 'human', 'prospect.state_changed',
  json_object('from', state, 'to', 'DO_NOT_CONTACT', 'reason', 'OPERATOR_EXCLUDED',
              'mission', 'SESSION_A', 'operatorApproved', json('true'),
              'exceptionalTransition', json(CASE WHEN state IN ('WAITING_REPLY', 'OUTREACH_VERIFIED') THEN 'false' ELSE 'true' END)),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM prospects WHERE id IN (
  'dd85cd4c-9348-45bb-bce8-84917b9bc76f',
  'bbd73175-accc-40a4-a24b-a9d147bfdfff',
  'cf8479be-7c9b-46ce-9bc3-eea3b46223cb',
  'fad22438-7200-4bf1-92ec-437a5396e131',
  'c349c8cf-ccad-4580-b210-49ebfd2d1d8f',
  '65271cb1-77be-40a5-8aa3-83aa3328391a',
  '2609319c-5578-4a37-99bb-1b0923a2f81f',
  'da0d4664-6a21-4a47-a0b3-daab7bd13b9d',
  '3f3dfce6-697e-4ec0-b1b2-ead53c468709',
  'f401d5ae-49d0-46b0-97c4-8846d05cb25d',
  'e1182a15-88f4-4ce1-8071-19cf0b078fd2',
  'ec045b5e-00be-44a3-a556-cfbc88cf56bb',
  'd0dafaae-aebe-46c2-a532-5264a5a0d4f4',
  'fb951634-6f69-46f8-9f46-8db04e780e69',
  'd2c22cec-1091-4e81-8c50-cc90cb0f7216',
  'f5eedd9c-2e39-46eb-9663-1d9b3a7f6cad',
  'cc39f49b-3306-44b5-af7c-7fd1dc9633d1',
  'fa6850d4-8664-4429-8971-a67042a16a6f',
  'd12e10f8-6252-4f28-9c50-aa2742aa74c0',
  'd2d789c3-069d-4b6d-bd38-c8c6a3793453',
  'd527af9a-735b-4ef8-8ef0-01b2880de8d3',
  'd11e064f-9a56-467a-933d-1142a210474e'
);

UPDATE prospects
SET state = 'DO_NOT_CONTACT',
    updated_at = (SELECT created_at FROM events WHERE events.id = 'session-a-operator-exclusion:' || prospects.id)
WHERE id IN (
  'dd85cd4c-9348-45bb-bce8-84917b9bc76f',
  'bbd73175-accc-40a4-a24b-a9d147bfdfff',
  'cf8479be-7c9b-46ce-9bc3-eea3b46223cb',
  'fad22438-7200-4bf1-92ec-437a5396e131',
  'c349c8cf-ccad-4580-b210-49ebfd2d1d8f',
  '65271cb1-77be-40a5-8aa3-83aa3328391a',
  '2609319c-5578-4a37-99bb-1b0923a2f81f',
  'da0d4664-6a21-4a47-a0b3-daab7bd13b9d',
  '3f3dfce6-697e-4ec0-b1b2-ead53c468709',
  'f401d5ae-49d0-46b0-97c4-8846d05cb25d',
  'e1182a15-88f4-4ce1-8071-19cf0b078fd2',
  'ec045b5e-00be-44a3-a556-cfbc88cf56bb',
  'd0dafaae-aebe-46c2-a532-5264a5a0d4f4',
  'fb951634-6f69-46f8-9f46-8db04e780e69',
  'd2c22cec-1091-4e81-8c50-cc90cb0f7216',
  'f5eedd9c-2e39-46eb-9663-1d9b3a7f6cad',
  'cc39f49b-3306-44b5-af7c-7fd1dc9633d1',
  'fa6850d4-8664-4429-8971-a67042a16a6f',
  'd12e10f8-6252-4f28-9c50-aa2742aa74c0',
  'd2d789c3-069d-4b6d-bd38-c8c6a3793453',
  'd527af9a-735b-4ef8-8ef0-01b2880de8d3',
  'd11e064f-9a56-467a-933d-1142a210474e'
);

SELECT CASE WHEN changes() = 22
  AND (SELECT COUNT(*) FROM prospects WHERE state = 'DO_NOT_CONTACT' AND id IN (
  'dd85cd4c-9348-45bb-bce8-84917b9bc76f',
  'bbd73175-accc-40a4-a24b-a9d147bfdfff',
  'cf8479be-7c9b-46ce-9bc3-eea3b46223cb',
  'fad22438-7200-4bf1-92ec-437a5396e131',
  'c349c8cf-ccad-4580-b210-49ebfd2d1d8f',
  '65271cb1-77be-40a5-8aa3-83aa3328391a',
  '2609319c-5578-4a37-99bb-1b0923a2f81f',
  'da0d4664-6a21-4a47-a0b3-daab7bd13b9d',
  '3f3dfce6-697e-4ec0-b1b2-ead53c468709',
  'f401d5ae-49d0-46b0-97c4-8846d05cb25d',
  'e1182a15-88f4-4ce1-8071-19cf0b078fd2',
  'ec045b5e-00be-44a3-a556-cfbc88cf56bb',
  'd0dafaae-aebe-46c2-a532-5264a5a0d4f4',
  'fb951634-6f69-46f8-9f46-8db04e780e69',
  'd2c22cec-1091-4e81-8c50-cc90cb0f7216',
  'f5eedd9c-2e39-46eb-9663-1d9b3a7f6cad',
  'cc39f49b-3306-44b5-af7c-7fd1dc9633d1',
  'fa6850d4-8664-4429-8971-a67042a16a6f',
  'd12e10f8-6252-4f28-9c50-aa2742aa74c0',
  'd2d789c3-069d-4b6d-bd38-c8c6a3793453',
  'd527af9a-735b-4ef8-8ef0-01b2880de8d3',
  'd11e064f-9a56-467a-933d-1142a210474e'
  )) = 22
  AND (SELECT COUNT(*) FROM events WHERE id LIKE 'session-a-operator-exclusion:%') = 22
THEN 1 ELSE json('SESSION_A_POSTSTATE_MISMATCH') END AS postflight;
