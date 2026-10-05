import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {executeVisualQa} from '../core/visual-qa/engine.ts';
import {D1VisualQaReportStore} from '../core/persistence/d1-visual-qa-store.ts';
import {D1BuildArtifactStore} from '../core/persistence/d1-build-artifact-store.ts';
import {verifyBuildArtifactIntegrity} from '../core/builder/site-builder.ts';
const require=createRequire(import.meta.url);
const {DB,P,B2,Q2,write,snapshot,fingerprints}=require('./preflight.cjs');
const runtime=path.resolve('.r74z-continuation-runtime');
const read=(n:string)=>JSON.parse(fs.readFileSync(path.join(runtime,n),'utf8').replace(/^\uFEFF/,''));
const baseline=read('preflight.json');const rows=read('post-correction-rows.json');const capture=read('capture-result.json');const evidence=read('browser-evidence.json');
assert(!fs.existsSync(path.join(runtime,'qa-invocation.json')),'QA invocation already attempted; never rerun');
assert.deepEqual(capture.evidence,evidence);assert.equal(capture.buildArtifactId,B2);assert.equal(capture.captures.length,2);assert.equal(capture.faviconHttpStatus,200);assert(capture.serverTerminated&&capture.browserTerminated);
for(const c of capture.captures){assert.equal(c.buildArtifactId,B2);assert(c.captureSuccess);assert.equal(c.favicon.status,200);assert(fs.statSync(c.screenshotPath).size>0);const dom=read(`${c.definition.name.toLowerCase()}-dom.json`);assert(dom.network.some((n:any)=>n.url.endsWith('/favicon.ico')&&n.status===200));assert.equal(c.definition.deviceScaleFactor,1);}
const pre=new DatabaseSync(DB,{readOnly:true});try{assert.deepEqual(snapshot(pre),rows);assert.deepEqual(fingerprints(baseline.build),baseline.fingerprints);}finally{pre.close();}
let mf:any;let invocations=0;
try{
  mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("R74Z continuation canonical local D1 binding");}};',compatibilityDate:'2026-09-04',d1Databases:{DB:'magicscript-local'},resourcePersistencePath:path.resolve('apps/api-worker/.wrangler/state/v3')}));
  const db=await mf.getD1Database('DB');const store=new D1VisualQaReportStore(db);const builds=new D1BuildArtifactStore(db);
  const build=await builds.get(B2);assert(build);assert.deepEqual(build,read('build-r2.json'));await verifyBuildArtifactIntegrity(build);assert.equal(build.buildRevision,2);assert.equal(build.qaAttempt,2);
  assert.equal(await store.get(Q2),null);assert.equal(await store.getForBuildAttempt(B2,2),null);
  const nativeR1=await db.prepare('SELECT * FROM v2_visual_qa_reports WHERE id=?').bind(baseline.rows.v2_visual_qa_reports[0].id).first();assert.deepEqual(nativeR1,baseline.rows.v2_visual_qa_reports[0]);
  write('qa-invocation.json',{entrypoint:'core/visual-qa/engine.ts::executeVisualQa',realInvocations:1,attempt:2,reportId:Q2,buildArtifactId:B2,store:'D1VisualQaReportStore / native magicscript-local binding',startedAt:new Date().toISOString(),evidencePath:path.join(runtime,'browser-evidence.json')});
  invocations=1;const report=await executeVisualQa({build,design:baseline.design,request:baseline.request,evidence,attempt:2,store});
  write('visual-qa-report.json',report);assert.equal(report.id,Q2);assert.equal(report.attempt,2);assert.equal(report.buildRevision,2);assert.deepEqual(await store.get(Q2),report);
  const verify=new DatabaseSync(DB,{readOnly:true});
  try{
    const final=snapshot(verify);const persisted=final.v2_visual_qa_reports.filter((x:any)=>x.id===Q2);assert.equal(persisted.length,1);assert.equal(persisted[0].report_json,JSON.stringify(report));assert.equal(final.v2_visual_qa_reports.length,2);
    assert.deepEqual(final.v2_visual_qa_reports.filter((x:any)=>x.id!==Q2),rows.v2_visual_qa_reports);
    for(const key of Object.keys(rows).filter(k=>k!=='v2_visual_qa_reports'))assert.deepEqual(final[key],rows[key]);
    assert.deepEqual(fingerprints(baseline.build),baseline.fingerprints);await verifyBuildArtifactIntegrity(build);
    const counts=read('counts.json');counts.qaInvocations=invocations;write('counts.json',counts);
    write('postflight.json',{verifiedAt:new Date().toISOString(),status:report.decision==='PASS'?'CLOSED / ACCEPTANCE_COMPLETE':'CLOSED / QA_CORRECTION_REQUIRED',report,rows:final,counts,buildR1Immutable:true,qaA1Immutable:true,productSourceUnchanged:true,prospectFinalState:final.prospect.state,slot:final.slot,correctionJob:final.jobs.find((x:any)=>x.id===baseline.jobId),browserVersion:capture.browserVersion,faviconHttpStatus:200,evidenceReferences:capture.captures,apiTerminated:read('api-cleanup.json').apiTerminated,browserTerminated:true,previewServerTerminated:true});
    console.log(JSON.stringify({status:report.decision==='PASS'?'CLOSED / ACCEPTANCE_COMPLETE':'CLOSED / QA_CORRECTION_REQUIRED',realInvocations:invocations,reportId:report.id,attempt:report.attempt,decision:report.decision,findings:report.issues,prospectFinalState:final.prospect.state,slot:final.slot,buildR1Immutable:true,qaA1Immutable:true}));
  }finally{verify.close();}
}catch(error){write('qa-error.json',{realInvocations:invocations,error:error instanceof Error?error.stack:String(error)});throw error;}finally{if(mf)await mf.dispose();}
