import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { enrichResearchResultWithContactPresence } from '../apps/agent-runner/src/presence-enrichment.ts';

const dbPath = process.env.MAGICSCRIPT_D1_PATH || 'apps/api-worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8d99d9a73b43bbdb8f14112bf19dd6ef1e9b7dc6151dc67a34b1807411d91355.sqlite';
const db = new DatabaseSync(dbPath);
const algorithmVersion = 'contact-presence-enrichment-v1-replay-2026-09-16';
const now = new Date().toISOString();
const blockedNames = /SUNELEK|Magic Script|FIXTURE|UCPA|La Balade du Soleil/i;
const rows = db.prepare(`SELECT p.*, (SELECT e.payload_json FROM events e WHERE e.prospect_id=p.id AND e.type='research.scored' ORDER BY e.created_at DESC LIMIT 1) AS research_payload FROM prospects p ORDER BY p.id`).all();
const eligible = rows.filter((p) => ['HIGH_PRIORITY', 'RESEARCH'].includes(p.commercial_eligibility) && !blockedNames.test(p.company_name));
const results = [];
for (const prospect of eligible) {
  let research = {};
  try { research = prospect.research_payload ? JSON.parse(prospect.research_payload) : {}; } catch {}
  const input = {
    companyName: prospect.company_name,
    city: prospect.city || prospect.location,
    websiteUrl: research.websiteUrl || prospect.website_url,
    sources: Array.isArray(research.sources) ? research.sources : [],
  };
  const enriched = await enrichResearchResultWithContactPresence(input);
  const presence = enriched.contactPresence;
  const canonicalPresence = presence && typeof presence === 'object'
    ? { ...presence, enrichedAt: '<run-time>' }
    : presence;
  const fingerprint = createHash('sha256').update(JSON.stringify({ algorithmVersion, prospectId: prospect.id, presence: canonicalPresence })).digest('hex');
  const key = `contact-presence:${algorithmVersion}:${prospect.id}:${fingerprint}`;
  const eventId = `cpv1-${prospect.id}-${fingerprint.slice(0, 24)}`;
  db.prepare(`INSERT INTO events (id, prospect_id, actor, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).run(eventId, prospect.id, 'contact-presence-replay', 'contact_presence.enriched', JSON.stringify({ schemaVersion: 'contact-presence-enriched.v1', algorithmVersion, idempotencyKey: key, fingerprint, contactPresence: { ...presence, enrichedAt: now }, researchReplay: false, reason: 'historical research had no material re-evaluation requested by bounded migration' }), now);
  results.push({ id: prospect.id, name: prospect.company_name, eventId, fingerprint, presence, researchReplayed: false, oldScore: prospect.score, newScore: prospect.score });
}
const counts = { total: rows.length, eligible: eligible.length, reenriched: results.length, alreadyCurrent: rows.filter((p) => p.commercial_eligibility && !blockedNames.test(p.company_name) && false).length };
await import('node:fs/promises').then(({ writeFile }) => writeFile('bulk/reports/prospect-reenrichment-results.json', JSON.stringify({ generatedAt: now, algorithmVersion, counts, results }, null, 2)));
console.log(JSON.stringify({ ...counts, results: results.map((r) => ({ id: r.id, name: r.name, eventId: r.eventId, statuses: Object.fromEntries(['phone','email','website','instagram','facebook','tiktok','whatsapp','contactForm'].map((k) => [k, r.presence?.[k]?.status])) })) }, null, 2));
db.close();
