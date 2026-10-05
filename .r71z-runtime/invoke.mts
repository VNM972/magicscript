import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { executeVisualQa } from '../core/visual-qa/engine.ts';
import { D1VisualQaReportStore } from '../core/persistence/d1-visual-qa-store.ts';
const require=createRequire(import.meta.url);
const {DB,preflight,snapshot,fingerprints,hash}=require('./preflight.cjs');
const runtime=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const read=(n:string)=>JSON.parse(fs.readFileSync(path.join(runtime,n),'utf8'));
const write=(n:string,v:unknown)=>fs.writeFileSync(path.join(runtime,n),JSON.stringify(v,null,2)+'\n');
const baseline=read('preflight.json');const capture=read('capture-result.json');const evidence=read('browser-evidence.json');
assert(!fs.existsSync(path.join(runtime,'invocation.json')),'Invocation already attempted; never rerun');
assert.equal(JSON.stringify(capture.evidence),JSON.stringify(evidence));
assert.equal(capture.rootHttpStatus,200);assert.equal(capture.captures.length,2);
for(const c of capture.captures){assert(c.captureSuccess);assert(fs.statSync(c.screenshotPath).size>0);}
const db=new DatabaseSync(DB);
let committed=false;
let invocations=0;
try {
  db.exec('PRAGMA foreign_keys=ON');db.exec('BEGIN IMMEDIATE');
  const current=preflight(db);assert.equal(JSON.stringify(current),JSON.stringify(baseline),'Pre-execution integrity changed');
  const triggers=db.prepare('SELECT name FROM sqlite_master WHERE type=? AND tbl_name=?').all('trigger','v2_visual_qa_reports');assert.equal(triggers.length,0);
  const mutations:unknown[]=[];
  const adapter={prepare(query:string){
    assert(query==='SELECT report_json FROM v2_visual_qa_reports WHERE id = ? LIMIT 1'||query.startsWith('INSERT INTO v2_visual_qa_reports (id, qa_version, build_artifact_id, design_artifact_id, design_request_id, prospect_id, attempt, decision, report_json, created_at) VALUES '),'Unexpected store query');
    const stmt=db.prepare(query);let args:any[]=[];
    return {bind(...values:any[]){args=values;return this;},async first(){return stmt.get(...args)??null;},async all(){return {results:stmt.all(...args),success:true};},async run(){assert(query.startsWith('INSERT INTO v2_visual_qa_reports '));const result=stmt.run(...args);mutations.push({table:'v2_visual_qa_reports',reportId:args[0],changes:Number(result.changes)});return {success:true,meta:{changes:Number(result.changes)}};}};
  }};
  const store=new D1VisualQaReportStore(adapter as any);
  assert.equal(await store.get(current.reportId),null);
  const inputFingerprints={build:hash(JSON.stringify(current.build)),design:hash(JSON.stringify(current.design)),request:hash(JSON.stringify(current.request)),evidence:hash(JSON.stringify(evidence))};
  write('invocation.json',{entrypoint:'core/visual-qa/engine.ts::executeVisualQa',realInvocations:1,startedAt:new Date().toISOString(),reportId:current.reportId,attempt:1,inputFingerprints,evidencePath:path.join(runtime,'browser-evidence.json')});
  invocations=1;
  const report=await executeVisualQa({build:current.build,design:current.design,request:current.request,evidence,attempt:1,store});
  write('visual-qa-report.json',report);
  assert.equal(report.id,current.reportId);
  assert.equal(JSON.stringify(await store.get(report.id)),JSON.stringify(report),'Store readback differs');
  assert.equal(mutations.length,1);assert.equal((mutations[0] as any).changes,1);
  const after=snapshot(db);
  for(const key of Object.keys(current.rows).filter(k=>k!=='v2_visual_qa_reports'))assert.equal(JSON.stringify(after[key]),JSON.stringify(current.rows[key]),`Unexpected mutation: ${key}`);
  assert.equal(after.v2_visual_qa_reports.length,1);assert.equal(after.v2_visual_qa_reports[0].id,report.id);
  assert.equal(JSON.stringify(fingerprints(current.build)),JSON.stringify(current.fingerprints),'Source/build mutated');
  db.exec('COMMIT');committed=true;
  const verify=new DatabaseSync(DB,{readOnly:true});
  try {
    const persisted=verify.prepare('SELECT * FROM v2_visual_qa_reports WHERE id=?').get(report.id) as any;
    assert.equal(persisted.report_json,JSON.stringify(report));
    const final=snapshot(verify);
    for(const key of Object.keys(current.rows).filter(k=>k!=='v2_visual_qa_reports'))assert.equal(JSON.stringify(final[key]),JSON.stringify(current.rows[key]),`Post-commit mutation: ${key}`);
    const result={status:'CLOSED / VISUAL_QA_COMPLETED',realInvocations:invocations,report,reportPersisted:true,reportStore:'D1VisualQaReportStore / v2_visual_qa_reports',dbPath:DB,d1Mutations:mutations,preExecutionIntegrity:'PASS',sourceBuildIntegrity:'PASS',unchangedSnapshots:Object.keys(current.rows).filter(k=>k!=='v2_visual_qa_reports'),queueJobsCreated:0,prospectFinalState:final.prospect.state,productionSlotFinalState:'HELD',productionSlot:final.slots.find((s:any)=>s.slot_id===1),heldCapacity:final.slots.filter((s:any)=>s.prospect_id).length,sourceHash:current.fingerprints.sourceHash,evidenceReferences:capture.captures,serverTerminated:capture.serverTerminated,browserTerminated:capture.browserTerminated};
    write('result.json',result);write('postflight.json',{rows:final,fingerprints:fingerprints(current.build),persistedReport:persisted});
    console.log(JSON.stringify(result));
  } finally {verify.close();}
} catch(error) {
  if(!committed){try{db.exec('ROLLBACK');}catch{}}
  write('execution-error.json',{realInvocations:invocations,committed,error:error instanceof Error?error.stack:String(error)});
  throw error;
} finally {db.close();}
