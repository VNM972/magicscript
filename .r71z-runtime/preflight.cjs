const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const ROOT = 'D:/MagicScript/repository';
const DB = path.join(ROOT, 'apps/api-worker/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/8d99d9a73b43bbdb8f14112bf19dd6ef1e9b7dc6151dc67a34b1807411d91355.sqlite');
const P = 'v2-87988492200011';
const A = 'artifact-dr-v2-87988492200011-DESIGN_REQUEST_V1-DESIGN_ARTIFACT_V1-r1';
const B = `build-${A}-builder-v1`;
const J = `job-${P}-build-${A}`;
const EXPECTED_HASH = 'f13de1a6577eee49a58e8ed87518980bb67b68dfc33282d0bb839c0403109ab3';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function snapshot(db) {
  const rows = {};
  for (const t of ['jobs', 'v2_build_artifacts', 'v2_design_artifacts', 'v2_design_requests', 'v2_design_reviews', 'v2_build_corrections', 'v2_visual_qa_reports', 'v2_proposals']) rows[t] = db.prepare(`SELECT * FROM ${t} WHERE prospect_id=? ORDER BY id`).all(P);
  rows.v2_design_corrections = db.prepare('SELECT * FROM v2_design_corrections WHERE design_request_id=? ORDER BY id').all(`dr-${P}-DESIGN_REQUEST_V1`);
  rows.prospect = db.prepare('SELECT * FROM prospects WHERE id=?').get(P);
  rows.slots = db.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all();
  rows.allJobs = db.prepare('SELECT * FROM jobs ORDER BY id').all();
  return rows;
}
function fingerprints(build) {
  const files = {};
  for (const dir of [build.sourcePath, build.outputPath]) {
    assert(fs.statSync(dir).isDirectory());
    const names = fs.readdirSync(dir).sort();
    assert.deepEqual(names, ['build-manifest.json','index.html','styles.css']);
    for (const n of names) files[path.join(dir,n)] = hash(fs.readFileSync(path.join(dir,n)));
  }
  const sourceHash = hash(fs.readdirSync(build.sourcePath).filter(n => n !== 'dist').sort().map(n => `${n}\n${fs.readFileSync(path.join(build.sourcePath,n),'utf8')}`).join('\n'));
  assert.equal(sourceHash, EXPECTED_HASH); assert.equal(build.sourceHash, sourceHash);
  for (const n of ['build-manifest.json','index.html','styles.css']) assert.equal(files[path.join(build.sourcePath,n)],files[path.join(build.outputPath,n)]);
  const manifest = JSON.parse(fs.readFileSync(path.join(build.outputPath,'build-manifest.json'),'utf8'));
  assert.equal(manifest.artifactId,A); assert.equal(manifest.prospectId,P); assert.equal(manifest.designRequestId,build.designRequestId); assert.equal(manifest.approvedRevision,build.approvedRevision);
  const sources = {};
  for (const f of ['core/visual-qa/engine.ts','core/visual-qa/contracts.ts','core/persistence/d1-visual-qa-store.ts','apps/api-worker/src/index.ts','apps/agent-runner/src/index.ts','scripts/qa-surface.cjs','scripts/local-preview-server.cjs']) sources[f] = hash(fs.readFileSync(path.join(ROOT,f)));
  const gitDiffHash = hash(execFileSync('git',['diff','--binary'],{cwd:ROOT,maxBuffer:30*1024*1024,stdio:['ignore','pipe','ignore']}));
  return {files,sourceHash,sources,gitDiffHash};
}
function preflight(db) {
  const rows = snapshot(db);
  assert.equal(rows.v2_build_artifacts.length,1); assert.equal(rows.v2_design_artifacts.length,1); assert.equal(rows.v2_design_requests.length,1); assert.equal(rows.v2_design_reviews.length,1);
  assert.equal(rows.v2_visual_qa_reports.length,0,'Unexpected existing QA report');
  const buildRow = rows.v2_build_artifacts[0]; const designRow = rows.v2_design_artifacts[0]; const requestRow = rows.v2_design_requests[0]; const reviewRow = rows.v2_design_reviews[0];
  const build = JSON.parse(buildRow.artifact_json); const request = JSON.parse(requestRow.request_json);
  const serialized = JSON.parse(designRow.artifact_json); const design = {...serialized,status:designRow.status};
  assert.equal(buildRow.id,B); assert.equal(build.id,B); assert.equal(buildRow.status,'SUCCEEDED'); assert.equal(build.status,'SUCCEEDED'); assert.equal(buildRow.source_hash,EXPECTED_HASH);
  assert.equal(buildRow.source_path,build.sourcePath); assert.equal(buildRow.output_path,build.outputPath);
  assert.equal(path.resolve(build.outputPath),path.resolve(ROOT,`artifacts/v2/sites/${P}/artifact-dr-v2-87988492200011-design_request_v1-design_artifact_v1-r1/dist`));
  const job=rows.jobs.find(j=>j.id===J); assert(job); assert.equal(job.status,'SUCCEEDED'); assert.equal(job.attempts,1);
  assert.equal(rows.jobs.find(j=>j.id===`job-${P}-design-review-r1`)?.status,'SUCCEEDED');
  assert.equal(designRow.id,A); assert.equal(design.id,A); assert.equal(design.status,'APPROVED'); assert.equal(serialized.status,'DRAFT');
  assert.equal(reviewRow.decision,'APPROVE'); const review=JSON.parse(reviewRow.review_json); assert.equal(review.decision,'APPROVE'); assert.equal(Object.values(review.assessment).filter(v=>v.status==='PASS').length,9); assert.equal(review.corrections.length,0);
  assert.equal(reviewRow.artifact_id,A); assert.equal(reviewRow.design_request_id,request.id); assert.equal(review.artifactId,A);
  assert.equal(build.approvedDesignArtifactId,design.id); assert.equal(build.designRequestId,request.id); assert.equal(design.designRequestId,request.id); assert.equal(build.approvedRevision,design.revision);
  for (const value of [build,design,request,review]) assert.equal(value.prospectId,P);
  assert.equal(rows.prospect.id,P); assert.equal(rows.prospect.state,'INGESTED');
  const slot=rows.slots.find(s=>s.slot_id===1); assert.equal(slot.prospect_id,P); assert.equal(rows.slots.filter(s=>s.prospect_id).length,1);
  return {status:'PASS',dbPath:DB,rows,build,design,request,projectedStatus:design.status,fingerprints:fingerprints(build),reportId:`qa-${build.id}-r${build.approvedRevision}-a1`,attempt:1};
}
module.exports={ROOT,DB,P,A,B,J,hash,snapshot,fingerprints,preflight};
if(require.main===module){ const db=new DatabaseSync(DB,{readOnly:true}); try { const result=preflight(db); fs.writeFileSync(path.join(__dirname,'preflight.json'),JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify({integrity:result.status,sourceHash:result.fingerprints.sourceHash,projectedStatus:result.projectedStatus,slot:result.rows.slots.find(s=>s.slot_id===1),reportCount:0,reportId:result.reportId})); } finally {db.close();} }
