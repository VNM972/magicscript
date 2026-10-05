const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {DatabaseSync} = require('node:sqlite');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));
const baseline = read('preflight.json');
const invocation = read('inspection-invocation.json');
const inspection = read('inspection.json');
const diagnostic = read('transport-diagnostics.json');
assert.equal(invocation.canonicalFetchRetryCount,1);
assert.equal(inspection.pageState,'FETCH_FAILED');
assert.equal(inspection.observation.httpResultClass,'UNSUPPORTED');
assert.equal(diagnostic.filter(x=>x.stage==='HTTPS_REQUEST').length,1);
assert.equal(diagnostic.find(x=>x.stage==='TLS').authorized,true);
assert.equal(diagnostic.find(x=>x.stage==='HTTP_RESPONSE').status,200);
const db = new DatabaseSync(baseline.dbPath,{readOnly:true});
const current = {};
try { for (const table of Object.keys(baseline.snapshot)) current[table] = db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all(); }
finally { db.close(); }
assert.equal(JSON.stringify(current),JSON.stringify(baseline.snapshot),'Canonical D1 drift');
const diff = execFileSync('git',['diff','--binary'],{maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']});
assert.equal(createHash('sha256').update(diff).digest('hex'),baseline.trackedDiffSha256,'Tracked diff drift');
const statePath = path.resolve('MAGICSCRIPT_CURRENT_STATE.md');
const previous = fs.readFileSync(statePath,'utf8');
assert(previous.includes('R75Z SECOND REAL PROSPECT — BLOCKED_ENVIRONMENT'));
assert(previous.includes('R74Z CONTINUATION — CLOSED / ACCEPTANCE_COMPLETE'));
const now = new Date().toISOString();
const report = {
  verifiedAt:now,status:'BLOCKED_ENVIRONMENT',selectedProspect:'Zakari',prospectId:null,
  sourceUrl:'https://www.zakari.fr/site-en-construction',canonicalHomepage:'https://www.zakari.fr/',
  previousTransportCause:'LIKELY restricted execution sandbox; native connect EACCES reproduced on same DNS-selected IPv4/443. Original invocation did not retain native error.',
  transportFix:'Execute one corrected canonical native inspection outside restricted sandbox; no configuration or product-source change.',
  remainingBlocker:'FETCH_FAILED / UNSUPPORTED after verified TLSv1.3 and HTTP 200 text/html; exact rejecting validation criterion UNKNOWN because canonical inspector collapses multiple validation failures.',
  canonicalFetchRetryCount:1,canonicalFetchFinalResult:'FAIL',additionalRetries:0,
  lastProvenStage:'DNS, authorized TLS and HTTP 200 from canonical native HTTPS request',
  firstBrokenStage:'Canonical homepage observation/content acceptance before qualification or admission',
  counts:{admissions:0,slotAcquisitions:0,designJobs:0,designReviews:0,buildJobs:0,visualQaInvocations:0,correctionCycles:0},
  canonicalD1RowsUnchanged:true,trackedDiffUnchanged:true,villaHistoryUnchanged:true,
  prospectState:'NOT_ADMITTED',jobState:'NONE',attemptCount:0,slotState:'No Zakari slot; all slot rows unchanged',
  newProductDefect:'NONE established',productSourceFilesModified:[],reproducibilityResult:'NOT_PROVEN',
  nextAllowedAction:'Separately authorize a bounded diagnosis of Zakari canonical UNSUPPORTED content acceptance.',
  usage:{credits:'USAGE_NOT_EXPOSED',modelReasoning:'USAGE_NOT_EXPOSED',codebaseMemoryTools:['list_projects','search_graph (Transport closed)'],shellFallback:true,subagents:0}
};
fs.writeFileSync(path.join(__dirname,'postflight.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(statePath,`# MAGIC SCRIPT CURRENT STATE

LAST_AUTHORITATIVE_RESULT
R75Z CONTINUATION — ZAKARI / BLOCKED_ENVIRONMENT, verified ${now}. One corrected canonical inspection: FETCH_FAILED / UNSUPPORTED. Native TLS verified and HTTP 200 text/html; precise content rejection criterion UNKNOWN. No product defect established.

CURRENT_REAL_PROSPECT
Zakari — NOT_ADMITTED; prospect ID NONE. Source https://www.zakari.fr/site-en-construction; canonical inspected homepage https://www.zakari.fr/.

CURRENT_PIPELINE_POSITION
Last proven: DNS → verified TLSv1.3 → HTTP 200. First broken: canonical homepage content acceptance before qualification/admission. No prospect, slot, design, review, build or QA created; jobs NONE / attempts 0; correction NO. Canonical D1 rows and existing tracked diff unchanged.

ONE_ACTIVE_OBJECTIVE
NONE — continuation stopped; authorized corrected inspection consumed, no further retry.

ONE_OPEN_PRODUCT_DEFECT
NONE

NEXT_ALLOWED_ACTION
Separately authorize a bounded diagnosis of Zakari canonical UNSUPPORTED content acceptance.

IMPORTANT_REAL_IDS
- R75Z continuation prospect/design/review/build/QA/correction IDs: NONE.
- Previous native failure: sandbox connect EACCES reproduced to 162.159.143.12:443; original cause LIKELY, original native error unavailable. Environment action: one inspection outside restricted sandbox; no product/configuration patch.
- Villa Ancinel: v2-87988492200011; R74Z CONTINUATION — CLOSED / ACCEPTANCE_COMPLETE remains immutable. Original slot 1 HELD; slots 2–20 unchanged. Never reuse Villa or rerun consumed harnesses.

RECENT_PROOF
- .r75z-continuation-runtime/preflight.json: canonical D1 and tracked diff matched original R75Z baseline.
- transport-probe.json: same-host DNS and TCP EACCES; zero HTTP inspection calls during probe.
- inspection-invocation.json, inspection.json, transport-diagnostics.json: exactly one corrected canonical GET, verified TLS, HTTP 200, final UNSUPPORTED.
- postflight.json: zero pipeline mutations, original D1 rows/tracked diff/Villa preserved, no product source change. No outreach, paid service, deploy, API/runner/browser launch. REPRODUCIBILITY NOT_PROVEN. USAGE_NOT_EXPOSED.
`);
console.log(JSON.stringify({status:report.status,canonicalD1RowsUnchanged:true,trackedDiffUnchanged:true,canonicalFetchRetryCount:1,canonicalFetchFinalResult:'FAIL',currentStateUpdated:true}));
