import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {verifyBuildArtifactIntegrity} from '../core/builder/site-builder.ts';
import {CANONICAL_FAVICON_LINK,deterministicFaviconBytes,ensureLocalFaviconHtml} from '../core/builder/contracts.ts';
const require=createRequire(import.meta.url);
const {DB,P,B,C,J,B2,Q2,write,snapshot,fingerprints}=require('./preflight.cjs');
const runtime=path.resolve('.r74z-continuation-runtime');
const read=(name:string)=>JSON.parse(fs.readFileSync(path.join(runtime,name),'utf8').replace(/^\uFEFF/,''));
const baseline=read('preflight.json');const stack=read('stack.json');
assert(!fs.existsSync(path.join(runtime,'runner-invocation.json')),'Runner continuation already attempted; never rerun');
const counts={runnerInvocations:0,claimRequests:0,realClaims:0,executorRuns:0,successCallbacks:0,failCallbacks:0,qaInvocations:0};
const originalFetch=globalThis.fetch;const apiCalls:any[]=[];
const db=new DatabaseSync(DB,{readOnly:true});try{assert.deepEqual(snapshot(db),baseline.rows);assert.deepEqual(fingerprints(baseline.build),baseline.fingerprints);}finally{db.close();}
const health=await (await originalFetch(`${stack.apiUrl}/health`)).json();assert.equal(health.stackId,stack.stackId);assert.equal(health.effectiveOutboundMode,'disabled');assert.equal(health.prototypeDeployEnabled,false);
process.env.MAGICSCRIPT_STACK_ID=stack.stackId;
process.env.MAGICSCRIPT_API_BASE_URL=stack.apiUrl;
process.env.MAGICSCRIPT_RUNNER_TOKEN='dev-runner-token';
process.env.MAGICSCRIPT_RUNNER_ID='r74z-continuation-villa-ancinel';
process.env.MAGICSCRIPT_RUNNER_WORK_DIR=path.join(runtime,'runner');
process.env.MAGICSCRIPT_SENDING_ENABLED='false';process.env.MAGICSCRIPT_EMAIL_PROVIDER='disabled';process.env.MAGICSCRIPT_PROTOTYPE_DEPLOY_ENABLED='false';process.env.MAGICSCRIPT_PROTOTYPE_DEPLOY_MODE='mock';
globalThis.fetch=async(input:any,init:any)=>{
  const request=new Request(input,init);const url=new URL(request.url);
  assert.equal(url.origin,stack.apiUrl,'Only the bounded local API may be accessed');
  assert.equal(request.headers.get('x-magicscript-stack-id'),stack.stackId);
  const record:any={path:url.pathname,method:request.method,startedAt:new Date().toISOString(),stackId:request.headers.get('x-magicscript-stack-id')};apiCalls.push(record);
  if(url.pathname==='/api/runner/jobs/claim'){assert.equal(++counts.claimRequests,1,'Second claim forbidden');}
  if(url.pathname.endsWith('/succeed')){assert.equal(++counts.successCallbacks,1);record.output=JSON.parse(await request.clone().text());}
  if(url.pathname.endsWith('/fail')){counts.failCallbacks++;record.failure=await request.clone().text();}
  const response=await originalFetch(request);record.status=response.status;
  if(url.pathname==='/api/runner/jobs/claim'&&response.ok&&response.status!==204){
    const claim=await response.clone().json();assert.equal(claim.job.id,J);assert.equal(claim.job.kind,'V2_BUILD_CORRECTION');assert.equal(claim.buildCorrectionContext.correctionRequest.id,C);
    counts.realClaims++;write('claim.json',claim);
  }
  if(response.status>=400)record.error=await response.clone().text();
  write('api-calls.json',apiCalls);write('counts.json',counts);return response;
};
try{
  const {runOne}=await import('../apps/agent-runner/src/index.ts');
  counts.runnerInvocations=1;write('runner-invocation.json',{startedAt:new Date().toISOString(),realInvocations:1,jobId:J,stackId:stack.stackId,apiUrl:stack.apiUrl});
  assert.equal(await runOne(),true);
  const verify=new DatabaseSync(DB,{readOnly:true});
  try{
    const rows=snapshot(verify);write('post-correction-rows.json',rows);
    const job=rows.jobs.find((x:any)=>x.id===J);write('correction-job-final.json',job);
    assert.equal(job.status,'SUCCEEDED',job.last_error);assert.equal(job.attempts,1);assert.equal(job.max_attempts,2);assert.equal(job.payload_json,baseline.rows.jobs.find((x:any)=>x.id===J).payload_json);
    assert.equal(counts.realClaims,1);assert.equal(counts.successCallbacks,1);assert.equal(counts.failCallbacks,0);
    const resultRows=verify.prepare('SELECT * FROM job_results WHERE job_id=?').all(J);assert.equal(resultRows.length,1);write('job-result.json',resultRows[0]);
    counts.executorRuns=1;write('counts.json',counts);
    const builds=rows.v2_build_artifacts.filter((x:any)=>x.id===B2);assert.equal(builds.length,1);const r2=JSON.parse(builds[0].artifact_json);
    await verifyBuildArtifactIntegrity(r2);assert.equal(r2.buildRevision,2);assert.equal(builds[0].build_revision,2);assert.equal(r2.approvedRevision,1);assert.equal(r2.qaAttempt,2);assert.equal(r2.previousBuildArtifactId,B);assert.equal(r2.correctionRequestId,C);
    const expected=path.join(path.dirname(baseline.build.outputPath),'build-r2','dist');assert.equal(path.resolve(r2.outputPath),expected);assert.notEqual(r2.sourcePath,baseline.build.sourcePath);
    assert.deepEqual(fs.readdirSync(r2.outputPath).sort(),['build-manifest.json','favicon.ico','index.html','styles.css']);
    assert.deepEqual(fs.readFileSync(path.join(r2.outputPath,'favicon.ico')),Buffer.from(deterministicFaviconBytes()));
    const html=fs.readFileSync(path.join(r2.outputPath,'index.html'),'utf8');assert.equal(html.split(CANONICAL_FAVICON_LINK).length-1,1);assert.equal(html,ensureLocalFaviconHtml(fs.readFileSync(path.join(baseline.build.outputPath,'index.html'),'utf8')));
    assert.deepEqual(fs.readFileSync(path.join(r2.outputPath,'styles.css')),fs.readFileSync(path.join(baseline.build.outputPath,'styles.css')));
    assert.deepEqual(fingerprints(baseline.build),baseline.fingerprints);assert.deepEqual(rows.v2_build_artifacts.find((x:any)=>x.id===B),baseline.rows.v2_build_artifacts[0]);
    for(const table of ['v2_visual_qa_reports','v2_build_corrections','v2_design_artifacts','v2_design_requests','prospect','slot'])assert.deepEqual(rows[table],baseline.rows[table]);
    assert.equal(rows.v2_visual_qa_reports.filter((x:any)=>x.id===Q2).length,0);assert.equal(rows.jobs.filter((x:any)=>x.kind==='V2_VISUAL_QA').length,0);
    write('build-r2.json',r2);write('runtime-result.json',{status:'PASS',counts,buildId:r2.id,buildRevision:2,qaAttempt:2,approvedRevision:1,outputPath:r2.outputPath,sourceHash:r2.sourceHash,buildR1Immutable:true,qaA1Immutable:true,faviconPresent:true,faviconLinkCount:1,stylesAndPageContentPreserved:true,requestReused:true,jobReused:true,slot:rows.slot});
    console.log(JSON.stringify({status:'PASS',counts,jobState:job.status,attempts:job.attempts,buildId:r2.id,buildRevision:2,qaAttempt:2,buildR1Immutable:true,outputPath:r2.outputPath}));
  }finally{verify.close();}
}catch(error){write('execution-error.json',{at:new Date().toISOString(),counts,error:error instanceof Error?error.stack:String(error)});throw error;}finally{globalThis.fetch=originalFetch;}
