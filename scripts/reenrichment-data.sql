SELECT p.id, p.company_name, p.legal_name, p.siren, p.siret, p.city, p.location, p.website_url, p.source_url, p.commercial_eligibility, p.state, p.score, p.updated_at,
 (SELECT e.payload_json FROM events e WHERE e.prospect_id=p.id AND e.type='research.scored' ORDER BY e.created_at DESC LIMIT 1) AS latest_research_payload,
 (SELECT e.created_at FROM events e WHERE e.prospect_id=p.id AND e.type='research.scored' ORDER BY e.created_at DESC LIMIT 1) AS latest_research_at
FROM prospects p ORDER BY p.id;
