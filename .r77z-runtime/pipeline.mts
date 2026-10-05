import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {verifyBuildArtifactIntegrity} from '../core/builder/site-builder.ts';
const dir='.r77z-runtime/';
const read=(n:string)=>JSON.parse(fs.readFileSync(dir+n,'utf8').replace(/^\uFEFF/,''));
const write=(n:string,v:unknown)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
const pre=read('preflight.json');const stack=read('stack.json');const P='v2-51972816600033';
const cfg=JSON.parse(fs.readFileSync('apps/api-worker/wrangler.local.jsonc','utf8'));
const rawFetch=globalThis.fetch;
const health=await (await rawFetch(stack.apiUrl+'/health')).json();assert.equal(health.stackId,stack.stackId);assert.equal(health.effectiveOutboundMode,'disabled');assert.equal(health.prototypeDeployEnabled,false);
const rows=()=>{const db=new DatabaseSync(pre.dbPath,{readOnly:true});try{const result:any={};for(const t of ['prospects','v2_admissions','v2_design_requests','v2_design_artifacts','v2_design_reviews','v2_build_artifacts','v2_visual_qa_reports','v2_build_corrections','jobs'])result[t]=db.prepare(`SELECT * FROM ${t} WHERE ${t==='prospects'?'id':'prospect_id'}=? ORDER BY 1`).all(P);result.slot=db.prepare('SELECT * FROM active_production_slots WHERE prospect_id=?').get(P)??null;return result;}finally{db.close();}};
const stage=process.argv[2];
if(stage==='admit'){
 assert(!fs.existsSync(dir+'admission-invocation.json'),'ADMISSION_CONSUMED');
 assert.equal(read('qualification.json').icp.outcome,'ADMIT');assert.equal(rows().prospects.length,0);
 write('admission-invocation.json',{at:new Date().toISOString(),route:'/api/v2/admission',realInvocations:1,stackId:stack.stackId});
 const response=await rawFetch(stack.apiUrl+'/api/v2/admission',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+cfg.vars.MAGICSCRIPT_API_TOKEN,'x-magicscript-stack-id':stack.stackId},body:JSON.stringify(read('pack.json'))});
 const admission=await response.json();write('admission-result.json',{httpStatus:response.status,admission});
 assert.equal(response.status,201,JSON.stringify(admission));assert.equal(admission.admitted,true);assert.equal(admission.canonicalProspectId,P);
 write('admitted.json',{name:'Androcam Productions',prospectId:P,admission});write('admission-rows.json',rows());
 console.log(JSON.stringify({admission:admission.reasonCode,prospectId:P,designJob:rows().jobs.map((j:any)=>({id:j.id,kind:j.kind,status:j.status}))}));process.exit(0);
}
const kinds:Record<string,string>={design:'V2_DESIGN_REQUEST',review:'V2_DESIGN_REVIEW',build:'V2_BUILD_SITE',correction:'V2_BUILD_CORRECTION'};
const kind=kinds[stage];assert(kind,'INVALID_STAGE');assert(fs.existsSync(dir+'admitted.json'));assert(!fs.existsSync(dir+stage+'-invocation.json'),'STAGE_CONSUMED');
const before=rows();const pending=before.jobs.filter((j:any)=>j.status==='PENDING'&&j.kind===kind);assert.equal(pending.length,1,'EXACT_PENDING_JOB_REQUIRED');const job=pending[0];
process.env.MAGICSCRIPT_STACK_ID=stack.stackId;process.env.MAGICSCRIPT_API_BASE_URL=stack.apiUrl;process.env.MAGICSCRIPT_RUNNER_TOKEN=cfg.vars.MAGICSCRIPT_RUNNER_TOKEN;process.env.MAGICSCRIPT_RUNNER_ID='r77z-androcam';process.env.MAGICSCRIPT_RUNNER_WORK_DIR=path.resolve(dir+'runner');process.env.MAGICSCRIPT_SENDING_ENABLED='false';process.env.MAGICSCRIPT_EMAIL_PROVIDER='disabled';process.env.MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED='false';process.env.MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE='mock';
let claims=0,success=0,fail=0;const calls:any[]=[];
globalThis.fetch=async(input:any,init:any)=>{
 const request=new Request(input,init);const url=new URL(request.url);assert.equal(url.origin,stack.apiUrl,'NONLOCAL_OPERATION_FORBIDDEN');assert.equal(request.headers.get('x-magicscript-stack-id'),stack.stackId);
 const record:any={path:url.pathname,method:request.method,at:new Date().toISOString()};calls.push(record);
 if(url.pathname==='/api/runner/jobs/claim')assert.equal(++claims,1);
 if(url.pathname.endsWith('/succeed'))assert.equal(++success,1);
 if(url.pathname.endsWith('/fail'))fail++;
 const response=await rawFetch(request);record.status=response.status;
 if(url.pathname==='/api/runner/jobs/claim'&&response.ok&&response.status!==204){const claim=await response.clone().json();write(stage+'-claim.json',claim);assert.equal(claim.job.id,job.id);assert.equal(claim.job.kind,kind);assert.equal(claim.job.prospectId,P);}
 if(response.status>=400)record.error=await response.clone().text();
 write(stage+'-api-calls.json',calls);return response;
};
try{
 const {runOne}=await import('../apps/agent-runner/src/index.ts');
 write(stage+'-invocation.json',{at:new Date().toISOString(),jobId:job.id,kind,realInvocations:1,stackId:stack.stackId});
 assert.equal(await runOne(),true,'NO_CLAIM');const after=rows();write(stage+'-rows.json',after);
 const final=after.jobs.find((j:any)=>j.id===job.id);write(stage+'-result.json',{job:final,counts:{claims,success,fail},slot:after.slot});assert.equal(final.status,'SUCCEEDED',final.last_error);assert.equal(claims,1);assert.equal(success,1);assert.equal(fail,0);assert(after.slot);
 if(stage==='review'){assert.equal(after.v2_design_reviews.at(-1).decision,'APPROVE');write('design-review.json',JSON.parse(after.v2_design_reviews.at(-1).review_json));}
 if(stage==='design'){write('design-artifact.json',JSON.parse(after.v2_design_artifacts[0].artifact_json));write('design-request.json',JSON.parse(after.v2_design_requests[0].request_json));}
 if(stage==='build'||stage==='correction'){const build=JSON.parse(after.v2_build_artifacts.at(-1).artifact_json);await verifyBuildArtifactIntegrity(build);write(stage==='build'?'build-r1.json':'build-r2.json',build);}
 console.log(JSON.stringify({stage,jobStatus:final.status,slot:after.slot,review:after.v2_design_reviews.at(-1)?.decision??null,build:after.v2_build_artifacts.map((b:any)=>({id:b.id,status:b.status,buildRevision:b.build_revision}))}));
}catch(error){write(stage+'-error.json',{at:new Date().toISOString(),error:error instanceof Error?error.stack:String(error)});throw error;}finally{globalThis.fetch=rawFetch;}
