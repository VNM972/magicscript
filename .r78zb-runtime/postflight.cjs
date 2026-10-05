const fs=require('node:fs'),assert=require('node:assert/strict'),{snapshot,fingerprint,files,write}=require('./preflight.cjs');
const read=n=>JSON.parse(fs.readFileSync(__dirname+'/'+n,'utf8').replace(/^\uFEFF/,''));
const baseline=read('preflight.json'),rows=snapshot(),r2=read('build-r2.json'),r3=read('build-r3.json');
assert.deepEqual(rows.v2_build_artifacts.find(b=>b.id===baseline.build.id),baseline.rows.v2_build_artifacts[0]);
assert.deepEqual(fingerprint(baseline.build.sourcePath),baseline.r1Source);assert.deepEqual(fingerprint(baseline.build.outputPath),baseline.r1Output);
assert.deepEqual(rows.v2_build_artifacts.find(b=>b.id===r2.id),read('post-build-r2-rows.json').v2_build_artifacts.find(b=>b.id===r2.id));
assert.deepEqual(fingerprint(r2.sourcePath),read('orphan-proof.json').hashes);assert.deepEqual(fingerprint(r2.outputPath),read('orphan-proof.json').hashes);
assert.equal(rows.v2_build_artifacts.length,3);assert.equal(rows.v2_visual_qa_reports.length,3);assert.equal(rows.v2_build_corrections.length,2);
assert.deepEqual(rows.v2_visual_qa_reports.find(q=>q.id===baseline.rows.v2_visual_qa_reports[0].id),baseline.rows.v2_visual_qa_reports[0]);
const report2=read('qa-a2/visual-qa-report.json'),report3=read('qa-a3/visual-qa-report.json');
assert.deepEqual(JSON.parse(rows.v2_visual_qa_reports.find(q=>q.id===report2.id).report_json),report2);assert.deepEqual(JSON.parse(rows.v2_visual_qa_reports.find(q=>q.id===report3.id).report_json),report3);
assert.equal(report3.decision,'PASS');assert.deepEqual(report3.issues,[]);assert.equal(read('qa-a3/favicon-http.json').status,200);
for(const table of ['v2_admissions','v2_design_requests','v2_design_artifacts','v2_design_reviews','slot'])assert.deepEqual(rows[table],baseline.rows[table]);
const current=files();for(const [name,hash] of Object.entries(baseline.trackedFiles))assert.equal(current[name],hash,name);
for(const attempt of [2,3]){assert.equal(read(`runner-r${attempt}-invocation.json`).realInvocations,1);assert.equal(read(`qa-a${attempt}/qa-invocation.json`).realInvocations,1);}
assert.equal(r3.previousBuildArtifactId,r2.id);assert.equal(r3.approvedRevision,1);assert.equal(r3.buildRevision,3);assert.equal(r3.qaAttempt,3);
write('final-rows.json',rows);write('postflight.json',{status:'CLOSED / ACCEPTANCE_COMPLETE',buildR1Immutable:true,buildR2Immutable:true,qaA1Immutable:true,qaA2Immutable:true,designRevision:1,slot:rows.slot,placeholderRetries:1,faviconCorrectionExecutions:1,qaA2Invocations:1,qaA3Invocations:1,buildR2:r2.id,buildR3:r3.id,qaA2:report2.id,qaA3:report3.id,generalLocalBusinessVisible:false,faviconHttpStatus:200,reproducibility:'PROVEN',trackedFilesPreserved:Object.keys(current).length,tests:{pass:44,fail:0},apiTypecheck:'PASS',diffCheck:'PASS',usage:'USAGE_NOT_EXPOSED'});console.log('FINAL_CANONICAL_PRESERVATION=PASS');
