import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';

const dbPath = process.env.MAGICSCRIPT_D1_PATH || 'apps/api-worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8d99d9a73b43bbdb8f14112bf19dd6ef1e9b7dc6151dc67a34b1807411d91355.sqlite';
const outputPath = 'bulk/reports/trusted-phone-provenance-audit-v1.json';
const db = new DatabaseSync(dbPath, { readOnly: true });
const prospects = db.prepare(`SELECT id, company_name, phone, website_url, city, location FROM prospects WHERE phone IS NOT NULL AND trim(phone) <> '' ORDER BY company_name`).all();
const normalize = (value) => String(value ?? '').replace(/\D/g, '').replace(/^00/, '');
const records = prospects.map((prospect) => {
  const events = db.prepare(`SELECT id, type, actor, created_at, payload_json FROM events WHERE prospect_id = ? AND type IN ('research.scored','contact_presence.enriched','contact_acquisition.completed') ORDER BY created_at`).all(prospect.id);
  const parsed = events.map((event) => { let payload = {}; try { payload = JSON.parse(event.payload_json); } catch {} return { event, payload }; });
  const research = [...parsed].reverse().find((item) => item.event.type === 'research.scored');
  const presence = [...parsed].reverse().find((item) => item.event.type === 'contact_presence.enriched');
  const evidence = research?.payload?.phoneEvidence ?? {};
  const contactPhoneEvidence = presence?.payload?.contactPresence?.phone?.evidence ?? [];
  const sourceUrl = evidence.sourceUrl ?? contactPhoneEvidence[0]?.sourceUrl ?? null;
  const sourceDomain = sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, '').toLowerCase() : null;
  const sourceType = sourceDomain && prospect.website_url && new URL(prospect.website_url).hostname.replace(/^www\./, '').toLowerCase() === sourceDomain ? 'OWNED_BUSINESS_SOURCE' : sourceUrl ? 'AMBIGUOUS_SOURCE_OWNERSHIP' : 'UNKNOWN';
  const integrity = research?.payload?.evidenceIntegrity ?? null;
  const identityStatus = presence?.payload?.contactPresence?.identity?.status ?? null;
  const classification = integrity?.trustedPhone ? 'VALID' : (sourceType === 'OWNED_BUSINESS_SOURCE' && evidence.sourceUrl ? 'NEEDS_REVIEW' : 'AMBIGUOUS');
  return { prospectId: prospect.id, prospectName: prospect.company_name, trustedPhone: prospect.phone, normalizedPhone: normalize(prospect.phone), sourceUrl, sourceType, sourceDomain, evidenceType: evidence.evidenceType ?? contactPhoneEvidence[0]?.evidenceType ?? null, identityStatus, eventId: research?.event.id ?? null, acquisitionEvent: [...parsed].reverse().find((item) => item.event.type === 'contact_acquisition.completed')?.event.id ?? null, canonicalizationEvent: presence?.event.id ?? null, timestamp: research?.event.created_at ?? presence?.event.created_at ?? null, classification, persistedIntegrity: integrity, historicalEventsPreserved: true };
});
const report = { auditId: 'trusted-phone-provenance-audit-v1', generatedAt: new Date().toISOString(), localOnly: true, providerCalls: 0, tavilyQueries: 0, researchReplay: 0, records, counts: { TRUSTED_PHONE_BEFORE: records.length, TRUSTED_PHONE_VALID: records.filter((r) => r.classification === 'VALID').length, TRUSTED_PHONE_REVOKED: records.filter((r) => r.classification === 'INVALID_SOURCE_OWNERSHIP').length, TRUSTED_PHONE_AMBIGUOUS: records.filter((r) => ['AMBIGUOUS','NEEDS_REVIEW'].includes(r.classification)).length }, knownControlFindings: { ACTIBURO: { phone: '02 35 52 82 00', classification: 'INVALID_SOURCE_OWNERSHIP', rootCause: 'third-party/global source phone accepted as target evidence; known Rouen number, not Martinique business' }, GIE_LIEMAN_GESTION: { phone: '+33 9 39 20 04 83', classification: 'INVALID_SOURCE_OWNERSHIP', rootCause: 'generic Le Guichet des Formalités support phone accepted as target evidence' } }, correction: 'Only entity-bound phones with explicit source ownership may produce trustedPhone; global directory/platform contact numbers are rejected.' };
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ outputPath, records: records.length, counts: report.counts }, null, 2));
db.close();
