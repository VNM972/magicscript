import {readFile, writeFile} from 'node:fs/promises';
import {researchScoredAuthority, ownedWebsiteFromPresence} from '../../core/admission/persisted-agent1-evidence.ts';
const root=process.env.R36_ROOT!;
const before=JSON.parse(await readFile(`${root}/baseline.json`,'utf8'));
const state=JSON.parse(await readFile(`${root}/final-state.json`,'utf8'));
const oldIds=new Set(before.prospects.map((p:any)=>p.id));
const rows=[];
for(const p of state.prospects.filter((p:any)=>!oldIds.has(p.id))) {
 const job=state.jobs.find((j:any)=>j.prospect_id===p.id&&j.kind==='RUN_RESEARCH_SWARM');
 const scored=state.events.filter((e:any)=>e.prospect_id===p.id&&e.type==='research.scored').sort((a:any,b:any)=>b.created_at.localeCompare(a.created_at))[0];
 const payload=scored?JSON.parse(scored.payload_json):undefined;
 const authority=payload?researchScoredAuthority(payload):undefined;
 const website=authority?ownedWebsiteFromPresence(authority):undefined;
 const shadow=JSON.parse(await readFile(`${root}/shadow-${p.id}.json`,'utf8'));
 rows.push({prospectId:p.id,name:p.company_name,siren:p.siren,siret:p.siret,activity:p.activity,state:p.state,jobId:job?.id,jobStatus:job?.status,attempts:job?.attempts,scoredEventId:scored?.id,scoredPresent:Boolean(scored),evidenceIntegrity:payload?.evidenceIntegrity,acceptedSources:authority?.acceptedSources,websiteAuthority:website,typedPainPersisted:payload?.digitalPainEvidence,canonicalDigitalPain:authority?.digitalPainEvidence,operatingEvidence:authority?.operatingEvidence,researchScoredAuthorityPass:authority?.evidenceIntegrityPassed,shadow});
}
await writeFile(`${root}/research-results.json`,JSON.stringify(rows,null,2));
console.log(JSON.stringify(rows,null,2));
