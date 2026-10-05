import { DatabaseSync } from 'node:sqlite';
const d=new DatabaseSync('apps/api-worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8d99d9a73b43bbdb8f14112bf19dd6ef1e9b7dc6151dc67a34b1807411d91355.sqlite');
const rows=d.prepare(`SELECT e.prospect_id,e.created_at,e.payload_json FROM events e WHERE e.type='contact_acquisition.completed' ORDER BY e.created_at DESC`).all();
const seen=new Set(), out=[]; for(const r of rows){if(seen.has(r.prospect_id))continue;seen.add(r.prospect_id);const p=JSON.parse(r.payload_json);out.push({prospectId:r.prospect_id,createdAt:r.created_at,status:p.status,sourceCounts:p.sourceCounts,sources:(p.sources||[]).map(s=>({url:s.url,sourceType:s.sourceType,identityStatus:s.identityStatus,fetchStatus:s.fetchStatus,queryOrigin:s.queryOrigin}))});}
console.log(JSON.stringify(out,null,2)); d.close();
