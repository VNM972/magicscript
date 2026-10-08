import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { acquireContactSources, fetchAndVerifyCandidates } from '../core/contact-acquisition/agent.ts';
import { TavilySearchProvider } from '../core/contact-acquisition/tavily.ts';
import { fetchSourcePage } from '../core/research/source-fetcher.ts';

const db = new DatabaseSync(process.env.MAGICSCRIPT_D1_PATH || 'apps/api-worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8d99d9a73b43bbdb8f14112bf19dd6ef1e9b7dc6151dc67a34b1807411d91355.sqlite');
const blocked = /SUNELEK|Magic Script|FIXTURE|UCPA|La Balade du Soleil/i;
const rows = db.prepare(`SELECT * FROM prospects ORDER BY id`).all();
const eligible = rows.filter((p) => ['HIGH_PRIORITY', 'RESEARCH'].includes(p.commercial_eligibility) && !blocked.test(p.company_name));
const now = new Date().toISOString(); const results=[];
const tavilyKey = process.env.TAVILY_API_KEY?.trim();
if (!tavilyKey) throw new Error('TAVILY_API_KEY is required in the current process environment');
const provider = new TavilySearchProvider({ apiKey: tavilyKey, maxQueries: Number(process.env.TAVILY_MAX_QUERIES ?? 300) });
for (const p of eligible) {
  const identity={companyName:p.company_name,legalName:p.legal_name||undefined,siren:p.siren||undefined,siret:p.siret||undefined,address:p.location||undefined,city:p.city||p.location||undefined,activity:p.activity||undefined,websiteUrl:p.website_url||undefined};
  const acquisition=await acquireContactSources(identity,{prospectId:p.id,provider,now});
  const fetched=acquisition.sources.length ? await fetchAndVerifyCandidates(identity,acquisition.sources,async(url)=>{const r=await fetchSourcePage(url); return r.ok?{ok:true,text:r.text}:{ok:false};}) : acquisition.sources;
  const final={...acquisition,sources:fetched,completedAt:now,sourceCounts:{...acquisition.sourceCounts,fetchAttempted:fetched.length,fetchSucceeded:fetched.filter(s=>s.fetchStatus==='FETCHED').length,identityVerified:fetched.filter(s=>s.identityStatus==='IDENTITY_VERIFIED').length}};
  const hash=createHash('sha256').update(JSON.stringify({...final,startedAt:'<run>',completedAt:'<run>'})).digest('hex');
  const id=`cav1-${p.id}-${hash.slice(0,24)}`;
  db.prepare(`INSERT INTO events (id,prospect_id,actor,type,payload_json,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).run(id,p.id,'contact-acquisition-agent','contact_acquisition.completed',JSON.stringify({...final,schemaVersion:'contact-acquisition.v1',fingerprint:hash,idempotencyKey:`contact-acquisition:v1:${p.id}:${hash}`}),now);
  results.push({id:p.id,name:p.company_name,status:final.status,queries:final.queries.length,sources:fetched.length,fetchSucceeded:final.sourceCounts.fetchSucceeded,identityVerified:final.sourceCounts.identityVerified,blocker:final.blocker});
}
console.log(JSON.stringify({total:rows.length,eligible:eligible.length,replayed:results.length,results},null,2)); db.close();
