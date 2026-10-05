const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const prior=require('../.r78z-runtime/preflight.cjs');
const write=(name,value)=>fs.writeFileSync(path.join(__dirname,name),JSON.stringify(value,null,2)+'\n');
module.exports={...prior,write};
if(require.main===module){
 const old=JSON.parse(fs.readFileSync('.r78z-runtime/preflight.json','utf8')),rows=prior.snapshot();
 const job=rows.jobs.find(j=>j.kind==='V2_BUILD_CORRECTION');
 assert(job);assert.equal(job.status,'PENDING');assert.equal(job.attempts,1);assert.equal(job.max_attempts,2);assert.equal(job.claimed_by,null);assert.equal(job.claimed_at,null);assert(job.run_after<=new Date().toISOString());
 assert.equal(rows.v2_build_corrections.length,1);const correction=JSON.parse(rows.v2_build_corrections[0].correction_json);
 const payload=JSON.parse(job.payload_json);assert.equal(payload.correctionRequestId,correction.id);assert.equal(correction.operation,'NORMALIZE_PUBLIC_VERTICAL_LABEL_V1');assert.equal(correction.nextBuildRevision,2);
 assert.equal(job.id,`job-${prior.P}-build-correction-${correction.buildArtifactId}-r2`);
 assert.deepEqual(rows.v2_build_artifacts,old.rows.v2_build_artifacts);assert.deepEqual(rows.v2_visual_qa_reports,old.rows.v2_visual_qa_reports);assert.deepEqual(rows.slot,old.rows.slot);
 for(const table of ['v2_admissions','v2_design_requests','v2_design_artifacts','v2_design_reviews'])assert.deepEqual(rows[table],old.rows[table]);
 assert.deepEqual(prior.fingerprint(old.build.sourcePath),old.r1Source);assert.deepEqual(prior.fingerprint(old.build.outputPath),old.r1Output);
 write('preflight.json',{at:new Date().toISOString(),dbPath:prior.DB,rows,build:old.build,r1Source:old.r1Source,r1Output:old.r1Output,trackedFiles:prior.files()});
 write('correction-r2-request.json',correction);write('correction-r2-job.json',{id:job.id,status:job.status,attempts:job.attempts,maxAttempts:job.max_attempts,payload});
 console.log(JSON.stringify({job:job.id,status:job.status,attempts:job.attempts,maxAttempts:job.max_attempts,claimedBy:job.claimed_by,claimedAt:job.claimed_at,runAfter:job.run_after,r2Canonical:false,r1Immutable:true,a1Immutable:true,slot:rows.slot}));
}
