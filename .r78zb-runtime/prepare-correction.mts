import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {D1BuildArtifactStore} from '../core/persistence/d1-build-artifact-store.ts';
import {D1VisualQaReportStore,D1BuildCorrectionStore} from '../core/persistence/d1-visual-qa-store.ts';
import {D1JobQueue} from '../core/persistence/d1-job-queue.ts';
import {createBuildCorrectionRequest} from '../core/visual-qa/engine.ts';
import {correctionJobFor} from '../core/visual-qa/contracts.ts';
import {verifyBuildArtifactIntegrity} from '../core/builder/site-builder.ts';
const require=createRequire(import.meta.url),{P,write,fingerprint,snapshot}=require('./preflight.cjs');
const dir='.r78zb-runtime/',attempt=Number(process.argv[2]);assert([2,3].includes(attempt));
const read=(n:string)=>JSON.parse(fs.readFileSync(dir+n,'utf8').replace(/^\uFEFF/,''));const baseline=read('preflight.json');
assert(!fs.existsSync(dir+`correction-r${attempt}-invocation.json`),'CORRECTION_PREPARATION_CONSUMED');
assert.deepEqual(fingerprint(baseline.build.sourcePath),baseline.r1Source);assert.deepEqual(fingerprint(baseline.build.outputPath),baseline.r1Output);
const before=snapshot();for(const t of ['v2_admissions','v2_design_requests','v2_design_artifacts','v2_design_reviews'])assert.deepEqual(before[t],baseline.rows[t]);assert.deepEqual(before.slot,baseline.rows.slot);
let mf:any;
try{
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("R78Z native D1 binding");}};',compatibilityDate:'2026-09-04',d1Databases:{DB:'magicscript-local'},resourcePersistencePath:path.resolve('apps/api-worker/.wrangler/state/v3')}));
 const db=await mf.getD1Database('DB'),builds=new D1BuildArtifactStore(db),reports=new D1VisualQaReportStore(db),corrections=new D1BuildCorrectionStore(db),queue=new D1JobQueue(db);
 const build=await builds.get(attempt===2?baseline.build.id:read('build-r2.json').id);assert(build);await verifyBuildArtifactIntegrity(build);assert.equal(build.buildRevision,attempt-1);assert.equal(build.qaAttempt,attempt-1);
 const qa=await reports.getForBuildAttempt(build.id,attempt-1);assert(qa);assert.equal(qa.decision,'CORRECTION_REQUIRED');
 const designRow=before.v2_design_artifacts[0],design={...JSON.parse(designRow.artifact_json),status:designRow.status},request=JSON.parse(before.v2_design_requests[0].request_json);
 const operation=attempt===2?'NORMALIZE_PUBLIC_VERTICAL_LABEL_V1':'ENSURE_LOCAL_FAVICON_V1';
 if(attempt===3){assert.equal(qa.issues.length,1);assert.equal(qa.issues[0].category,'BUILD_RENDER');assert.equal(qa.issues[0].severity,'MAJOR');assert(/404/.test(qa.issues[0].message));const capture=read('qa-a2/capture-result.json');for(const device of ['desktop','mobile']){const c=read(`qa-a2/${device}-dom.json`);assert(!c.dom.bodyText.includes('GENERAL_LOCAL_BUSINESS'));assert(c.network.filter((x:any)=>x.status>=400).every((x:any)=>new URL(x.url).pathname==='/favicon.ico'&&x.status===404));}assert.equal(read('qa-a2/favicon-http.json').status,404);}
 const finding=qa.issues.find((i:any)=>i.category===(attempt===2?'PLACEHOLDER':'BUILD_RENDER'));assert(finding);
 const correction=createBuildCorrectionRequest(qa,operation,{build,design,request},finding);assert.equal(correction.nextBuildRevision,attempt);
 write(`correction-r${attempt}-invocation.json`,{at:new Date().toISOString(),operation,sourceQaReport:qa.id,preparationInvocations:1});
 await corrections.save(correction);assert.deepEqual(await corrections.get(correction.id),correction);write(`correction-r${attempt}-request.json`,correction);
 const job=await queue.enqueue(correctionJobFor(correction));assert.equal(job.status,'PENDING');assert.equal(job.attempts,0);write(`correction-r${attempt}-job.json`,job);
 const ready=(await db.prepare("SELECT id,kind FROM jobs WHERE prospect_id=? AND status='PENDING' AND run_after<=?").bind(P,new Date().toISOString()).all()).results;assert.deepEqual(ready,[{id:job.id,kind:'V2_BUILD_CORRECTION'}]);
 console.log(JSON.stringify({operation,request:correction.id,job:job.id,status:job.status,nextBuildRevision:attempt}));
}finally{if(mf)await mf.dispose();}
