SELECT p.id, p.company_name, p.legal_name, p.siren, p.siret, p.city, p.state, p.score, p.commercial_eligibility, p.website_url, p.phone, p.updated_at,
  (SELECT COUNT(*) FROM events e WHERE e.prospect_id=p.id AND e.type='research.scored') AS research_scored_count,
  (SELECT MAX(e.created_at) FROM events e WHERE e.prospect_id=p.id AND e.type='research.scored') AS latest_research_at,
  (SELECT MAX(e.created_at) FROM events e WHERE e.prospect_id=p.id AND e.type='contact_presence.enriched') AS latest_presence_at,
  (SELECT COUNT(*) FROM events e WHERE e.prospect_id=p.id AND e.type='contact_presence.enriched') AS presence_event_count,
  (SELECT MAX(e.created_at) FROM events e WHERE e.prospect_id=p.id) AS latest_event_at
FROM prospects p ORDER BY p.created_at, p.id;
SELECT e.prospect_id, e.id, e.type, e.created_at, substr(e.payload_json,1,500) AS payload_preview
FROM events e WHERE e.type IN ('research.scored','contact_presence.enriched') ORDER BY e.prospect_id, e.created_at;
SELECT type, COUNT(*) AS count FROM events GROUP BY type ORDER BY type;
