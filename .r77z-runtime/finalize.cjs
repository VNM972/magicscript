const fs=require('node:fs');const assert=require('node:assert/strict');const crypto=require('node:crypto');const {execFileSync}=require('node:child_process');const {DatabaseSync}=require('node:sqlite');
const dir='.r77z-runtime/';const read=n=>JSON.parse(fs.readFileSync(dir+n,'utf8').replace(/^\uFEFF/,''));const write=(n,v)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const pre=read('preflight.json');const P=read('admitted.json').prospectId;const prior=JSON.parse(fs.readFileSync('.r75z-continuation-runtime/preflight.json','utf8'));const qa=read('qa-a1/visual-qa-report.json');
assert.equal(read('final-disposition.json').status,'CLOSED / UNSUPPORTED_QA_FINDING');assert.equal(qa.decision,'CORRECTION_REQUIRED');
assert.equal(hash(execFileSync('git',['diff','--binary'],{maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']})),pre.trackedDiffSha256);
for(const [file,digest] of Object.entries(pre.canonicalFiles))assert.equal(hash(fs.readFileSync(file)),digest,file);
assert.equal(hash(fs.readFileSync('core/research/manual-pain-first-intake.ts')),pre.sourcingSha256);assert.equal(hash(fs.readFileSync('core/research/manual-pain-first-intake.test.ts')),pre.testSha256);
const db=new DatabaseSync(pre.dbPath,{readOnly:true});let summary;
try{
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 const counts={};
 // Baseline before R77Z is the R76Z snapshot digest, not the older rows.
 const oldKeys=Object.keys(prior.snapshot);
 const before76=JSON.parse(fs.readFileSync('.r75z-continuation-runtime/preflight.json','utf8')).snapshot;
 assert.equal(hash(JSON.stringify(before76)),pre.d1Sha256);
 for(const table of oldKeys){
  const actual=JSON.parse(JSON.stringify(db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()));const original=before76[table];
  if(table==='active_production_slots'){
   const affected=actual.find(r=>r.prospect_id===P);assert(affected);assert.equal(affected.slot_id,2);
   for(const old of original){const row=actual.find(r=>r.slot_id===old.slot_id);if(old.slot_id===2){assert.equal(old.prospect_id,null);assert.equal(row.prospect_id,P);}else assert.deepEqual(row,old);}
  }else{
   const remaining=actual.filter(r=>r[table==='prospects'?'id':'prospect_id']!==P);assert.deepEqual(remaining,original,table+'_UNRELATED_ROWS_CHANGED');
   counts[table]=actual.length-original.length;
  }
 }
 assert.equal(counts.prospects,1);assert.equal(counts.v2_admissions,1);assert.equal(counts.v2_design_requests,1);assert.equal(counts.v2_design_artifacts,1);assert.equal(counts.v2_design_reviews,1);assert.equal(counts.v2_build_artifacts,1);assert.equal(counts.v2_visual_qa_reports,1);assert.equal(counts.v2_build_corrections,0);assert.equal(counts.jobs,3);
 const jobs=db.prepare('SELECT kind,status,attempts FROM jobs WHERE prospect_id=? ORDER BY kind').all(P);assert(jobs.every(j=>j.status==='SUCCEEDED'&&j.attempts===1));
 const stored=db.prepare('SELECT report_json FROM v2_visual_qa_reports WHERE id=?').get(qa.id);assert.equal(stored.report_json,JSON.stringify(qa));
 const capture=read('qa-a1/capture-result.json');assert(capture.serverTerminated&&capture.browserTerminated);assert(read('api-cleanup.json').apiPortClosed);
 const baseVilla=JSON.parse(fs.readFileSync('.r74z-continuation-runtime/preflight.json','utf8'));
 for(const [file,digest] of Object.entries(baseVilla.fingerprints.files))assert.equal(hash(fs.readFileSync(file)),digest,'VILLA_FILE_CHANGED:'+file);
 assert.equal(fs.existsSync(dir+'candidate-2-invocation.json'),false);assert.equal(fs.existsSync(dir+'qa-a2'),false);assert.equal(fs.existsSync(dir+'correction-invocation.json'),false);
 summary={verifiedAt:new Date().toISOString(),status:'CLOSED / UNSUPPORTED_QA_FINDING',rankedPoolSize:read('selection.json').pool.length,discoveryQueries:5,canonicalInspections:1,outcomeDistribution:{ADMITTED:1,NOT_INSPECTED_AFTER_ADMISSION:9,NO_PAIN_SIGNAL:0,IDENTITY_ABSENT:0,NO_ELIGIBLE_LINK:0,EXPECTED_REJECTION:0,TRANSPORT:0},prospectId:P,productionSlot:2,design:'SUCCEEDED',designReview:'APPROVE',build:'SUCCEEDED',visualQa:qa.decision,qaInvocations:1,correctionCycleUsed:false,qaRetests:0,reportId:qa.id,d1Mutations:counts,unrelatedD1RowsPreserved:true,villaSlot1Preserved:true,villaBuildR1FilesPreserved:true,preexistingTrackedDiffPreserved:true,canonicalSourcesPreserved:true,sourcingAndTestsPreserved:true,chromeVersion:capture.browserVersion,viewports:capture.evidence.viewports,screenshotPaths:capture.captures.map(c=>c.screenshotPath),browserAndPreviewStopped:true,apiStopped:true,sourcePatch:false,tests:'NONE; no implementation change',typecheck:'NONE; no implementation change',outreach:false,paidApi:false,deploy:false,reproducibility:'NOT_PROVEN',usage:'USAGE_NOT_EXPOSED'};
}finally{db.close();}
write('candidate-1-disposition.json',{name:'Androcam Productions',admission:'ADMITTED',prospectId:P,pipelineOutcome:'CLOSED / UNSUPPORTED_QA_FINDING',qa:qa.decision});write('postflight.json',summary);console.log(JSON.stringify(summary));
