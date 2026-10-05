const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {DB,P,A,B,fingerprints}=require('../.r71z-runtime/preflight.cjs');
const runtime=__dirname;
const C=`correction-qa-${B}-r1-a1`;
const J=`job-${P}-build-correction-${B}-r2`;
const Q=`qa-${B}-r1-a1`;
const B2=`${B}-br2`;
const Q2=`qa-${B2}-r2-a2`;
const write=(name,value)=>fs.writeFileSync(path.join(runtime,name),JSON.stringify(value,null,2)+'\n');
function snapshot(db){
  const rows={};
  for(const table of ['jobs','v2_build_artifacts','v2_build_corrections','v2_visual_qa_reports','v2_design_artifacts','v2_design_requests']) rows[table]=db.prepare(`SELECT * FROM ${table} WHERE prospect_id=? ORDER BY id`).all(P);
  rows.prospect=db.prepare('SELECT id,state,updated_at FROM prospects WHERE id=?').get(P);
  rows.slot=db.prepare('SELECT * FROM active_production_slots WHERE slot_id=1').get();
  return JSON.parse(JSON.stringify(rows));
}
function preflight(){
  const db=new DatabaseSync(DB,{readOnly:true});
  try{
    const previous=JSON.parse(fs.readFileSync(path.join(runtime,'../.r74z-runtime/postflight.json'),'utf8'));
    const original=JSON.parse(fs.readFileSync(path.join(runtime,'../.r74z-runtime/preflight.json'),'utf8'));
    const rows=snapshot(db);
    const schema=db.prepare("SELECT sql FROM sqlite_master WHERE name='v2_build_artifacts'").get().sql;
    assert(schema.includes('build_revision'));assert(schema.includes('UNIQUE(design_artifact_id, builder_version, build_revision)'));
    assert.equal(rows.v2_build_corrections.length,1);assert.deepEqual(rows.v2_build_corrections[0],previous.correctionRequest);assert.equal(rows.v2_build_corrections[0].id,C);
    const job=rows.jobs.find(x=>x.id===J);assert(job);assert.deepEqual(job,previous.job);assert.equal(job.status,'PENDING');assert.equal(job.attempts,0);assert.equal(job.max_attempts,2);assert.equal(job.claimed_by,null);assert.equal(job.claimed_at,null);
    assert.equal(rows.jobs.filter(x=>x.kind==='V2_BUILD_CORRECTION').length,1);
    assert.deepEqual(rows.v2_build_artifacts,previous.builds);assert.equal(rows.v2_build_artifacts[0].id,B);assert.equal(rows.v2_build_artifacts[0].build_revision,1);
    assert.deepEqual(rows.v2_visual_qa_reports,previous.qaReports);assert.equal(rows.v2_visual_qa_reports[0].id,Q);
    assert.deepEqual(rows.slot,previous.slot);assert.equal(rows.slot.prospect_id,P);
    const build=JSON.parse(rows.v2_build_artifacts[0].artifact_json);
    const fp=fingerprints(build);assert.deepEqual(fp,original.fingerprints);
    const ready=rows.jobs.filter(x=>x.status==='PENDING'&&x.run_after<=new Date().toISOString());assert.deepEqual(ready.map(x=>x.id),[J]);
    assert.equal(db.prepare("SELECT count(*) n FROM jobs WHERE status IN ('RUNNING','SENDING') AND claimed_at IS NOT NULL AND claimed_at<?").get(new Date(Date.now()-30*60000).toISOString()).n,0);
    assert(!fs.existsSync(path.join(path.dirname(build.outputPath),'build-r2')));
    const designRow=rows.v2_design_artifacts.find(x=>x.id===A);assert(designRow);assert.equal(designRow.status,'APPROVED');
    const design={...JSON.parse(designRow.artifact_json),status:designRow.status};const request=JSON.parse(rows.v2_design_requests[0].request_json);
    const result={verifiedAt:new Date().toISOString(),dbPath:DB,status:'PASS',rows,build,design,request,fingerprints:fp,jobId:J,correctionRequestId:C,expectedBuildId:B2,expectedReportId:Q2,migrationPresent:true,buildR1Immutable:true,qaA1Immutable:true};
    write('preflight.json',result);console.log(JSON.stringify({status:result.status,job:{id:J,state:job.status,attempts:job.attempts,claim:null},migrationPresent:true,buildR1Immutable:true,qaA1Immutable:true,slot:rows.slot,buildR2Count:0,qaA2Count:0}));
    return result;
  }finally{db.close();}
}
module.exports={DB,P,A,B,C,J,Q,B2,Q2,write,snapshot,fingerprints};
if(require.main===module)preflight();
