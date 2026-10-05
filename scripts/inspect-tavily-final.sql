SELECT p.id,p.company_name,p.commercial_eligibility,p.score,p.state,
 (SELECT e.id FROM events e WHERE e.prospect_id=p.id AND e.type='contact_acquisition.completed' ORDER BY e.created_at DESC LIMIT 1) AS acquisition_event_id,
 (SELECT e.created_at FROM events e WHERE e.prospect_id=p.id AND e.type='contact_acquisition.completed' ORDER BY e.created_at DESC LIMIT 1) AS acquisition_at,
 (SELECT e.payload_json FROM events e WHERE e.prospect_id=p.id AND e.type='contact_acquisition.completed' ORDER BY e.created_at DESC LIMIT 1) AS acquisition_payload,
 (SELECT e.id FROM events e WHERE e.prospect_id=p.id AND e.type='contact_presence.enriched' ORDER BY e.created_at DESC LIMIT 1) AS presence_event_id,
 (SELECT e.payload_json FROM events e WHERE e.prospect_id=p.id AND e.type='contact_presence.enriched' ORDER BY e.created_at DESC LIMIT 1) AS presence_payload
FROM prospects p ORDER BY p.company_name;
