import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {acceptPainFirstSearchCandidate,painFirstQueryPlans} from '../core/research/pain-first-staging.ts';
import {createPainFirstLiveHomepageInspector} from '../core/research/pain-first-homepage-transport.ts';
const runtime=path.resolve('.r75z-runtime');
const write=(name:string,value:unknown)=>fs.writeFileSync(path.join(runtime,name),JSON.stringify(value,null,2)+'\n');
assert(!fs.existsSync(path.join(runtime,'inspection-invocation.json')),'Single-use inspection consumed');
const dbPath=path.resolve('apps/api-worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8d99d9a73b43bbdb8f14112bf19dd6ef1e9b7dc6151dc67a34b1807411d91355.sqlite');
const db=new DatabaseSync(dbPath,{readOnly:true});
const snapshot:Record<string,unknown>={};
try{
  for(const table of ['prospects','v2_admissions','v2_design_requests','v2_design_artifacts','v2_design_reviews','v2_build_artifacts','v2_visual_qa_reports','v2_build_corrections','jobs','active_production_slots']) snapshot[table]=db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all();
}finally{db.close();}
write('preflight.json',{verifiedAt:new Date().toISOString(),dbPath,snapshot,trackedDiffSha256:createHash('sha256').update(execFileSync('git',['diff','--binary'],{maxBuffer:20*1024*1024})).digest('hex'),sourceChangesAuthorized:false});
const plan=painFirstQueryPlans().find(p=>p.conditionClass==='SITE_UNDER_CONSTRUCTION')!;
const candidate={schemaVersion:1 as const,queryPlanId:plan.planId,conditionClass:plan.conditionClass,providerClass:'MANUAL_BROWSER_SEARCH',resultUrl:'https://www.zakari.fr/',resultTitle:'SARL ZAKARI',resultPosition:5,acquiredAt:new Date().toISOString(),providerRunId:'R75Z-manual-pain-first',authority:'NONE' as const};
write('candidate.json',{name:'Zakari',source:'Canonical manual PAIN_FIRST query intake; search result https://www.zakari.fr/site-en-construction; homepage alone evaluated',candidate,excludedProspect:'v2-87988492200011',existingCandidateReview:'No other V2 admission; examined persisted local candidates lacked accepted digital-pain/contact evidence.'});
const accepted=acceptPainFirstSearchCandidate(candidate);assert.equal(accepted.state,'URL_ACCEPTED');
if(accepted.state!=='URL_ACCEPTED')throw new Error('URL_REJECTED');
write('inspection-invocation.json',{entrypoint:'createPainFirstLiveHomepageInspector',invocations:1,retries:0,startedAt:new Date().toISOString(),homepage:accepted.homepageUrl});
const inspection=await createPainFirstLiveHomepageInspector()(accepted);
write('inspection.json',inspection);
console.log(JSON.stringify({name:'Zakari',homepage:accepted.homepageUrl,pageState:inspection.pageState,httpResultClass:inspection.observation.httpResultClass,title:inspection.observation.boundedTitle,h1:inspection.observation.boundedH1,staging:inspection.staging}));
