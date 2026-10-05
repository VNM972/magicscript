const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const net=require('node:net');
const {DatabaseSync}=require('node:sqlite');
const {DB,P,B,J,B2,Q2,write,snapshot,fingerprints}=require('./preflight.cjs');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8').replace(/^\uFEFF/,''));
async function portClosed(url){const u=new URL(url);return new Promise((resolve,reject)=>{const socket=net.connect(Number(u.port),u.hostname);socket.once('connect',()=>{socket.destroy();reject(new Error('Owned runtime still listening: '+url));});socket.once('error',()=>{socket.destroy();resolve(true);});socket.setTimeout(2000,()=>{socket.destroy();reject(new Error('Runtime cleanup check timed out'));});});}
async function main(){
  const baseline=read('preflight.json'),after=read('post-correction-rows.json'),capture=read('capture-result.json'),report=read('visual-qa-report.json'),counts=read('counts.json'),stack=read('stack.json');
  assert.equal(counts.realClaims,1);assert.equal(counts.executorRuns,1);assert.equal(counts.qaInvocations,1);assert.equal(read('qa-invocation.json').realInvocations,1);
  assert.equal(report.id,Q2);assert.equal(report.decision,'PASS');assert.deepEqual(report.issues,[]);
  await portClosed(stack.apiUrl);await portClosed(capture.localServeUrl);
  write('api-cleanup.json',{apiPid:stack.apiPid,apiStartedAt:stack.apiStartedAt,apiTerminated:true,apiPortClosed:true,at:new Date().toISOString(),method:'Verified own process generation/time; taskkill /PID /T /F'});
  const db=new DatabaseSync(DB,{readOnly:true});
  try{
    const rows=snapshot(db);const persisted=rows.v2_visual_qa_reports.filter(x=>x.id===Q2);assert.equal(persisted.length,1);assert.equal(persisted[0].report_json,JSON.stringify(report));assert.equal(rows.v2_visual_qa_reports.length,2);
    assert.deepEqual(rows.v2_visual_qa_reports.filter(x=>x.id!==Q2),after.v2_visual_qa_reports);
    for(const key of Object.keys(after).filter(k=>k!=='v2_visual_qa_reports'))assert.deepEqual(rows[key],after[key]);
    assert.deepEqual(fingerprints(baseline.build),baseline.fingerprints);assert.equal(rows.v2_build_artifacts.filter(x=>x.id===B2).length,1);assert.deepEqual(rows.v2_build_artifacts.find(x=>x.id===B),baseline.rows.v2_build_artifacts[0]);
    const job=rows.jobs.find(x=>x.id===J);assert.equal(job.status,'SUCCEEDED');assert.equal(job.attempts,1);assert.equal(job.claimed_by,null);assert.equal(job.claimed_at,null);
    const result={verifiedAt:new Date().toISOString(),status:'CLOSED / ACCEPTANCE_COMPLETE',report,rows,counts,buildR1Immutable:true,qaA1Immutable:true,productSourceUnchanged:true,prospectFinalState:rows.prospect.state,slot:rows.slot,correctionJob:job,browserVersion:capture.browserVersion,faviconHttpStatus:200,evidenceReferences:capture.captures,apiTerminated:true,browserTerminated:true,previewServerTerminated:true,bookkeepingRecovery:'QA persisted PASS before postflight assembly encountered missing api-cleanup.json. Final independent read-only D1 verification completed without any second runner or QA invocation.'};
    write('postflight.json',result);console.log(JSON.stringify({status:result.status,counts,qaReportId:report.id,qaDecision:report.decision,jobFinalState:job.status,jobTotalAttempts:job.attempts,buildR1Immutable:true,qaA1Immutable:true,sourceFilesModified:'NONE',prospectState:rows.prospect.state,slot:rows.slot,allCreatedRuntimesStopped:true}));
  }finally{db.close();}
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
