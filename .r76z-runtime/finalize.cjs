const fs=require('node:fs');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {execFileSync,spawnSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const dir='.r76z-runtime/';
const read=n=>JSON.parse(fs.readFileSync(dir+n,'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const base=read('preflight.json');
const prior=JSON.parse(fs.readFileSync('.r75z-continuation-runtime/preflight.json','utf8'));
const db=new DatabaseSync(base.dbPath,{readOnly:true});
const current=Object.fromEntries(Object.keys(prior.snapshot).map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()]));db.close();
assert.equal(hash(JSON.stringify(current)),base.d1Sha256);
assert.equal(hash(execFileSync('git',['diff','--binary'],{maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']})),base.trackedDiffSha256);
for(const [p,h] of Object.entries(base.canonicalFiles))assert.equal(hash(fs.readFileSync(p)),h,p);
for(const [before,after] of [['intake-before.ts.txt','core/research/manual-pain-first-intake.ts'],['intake-test-before.ts.txt','core/research/manual-pain-first-intake.test.ts']]){
 const check=spawnSync('git',['diff','--no-index','--check','--',dir+before,after],{encoding:'utf8',windowsHide:true});
 // --no-index implies --exit-code: 1 also reports an ordinary content diff.
 assert([0,1].includes(check.status),check.stderr);assert.equal(check.stdout.trim(),'');
 assert(check.stderr.split(/\r?\n/).filter(Boolean).every(line=>line.startsWith('warning: in the working copy of ')),check.stderr);
}
execFileSync('git',['diff','--check'],{stdio:['ignore','pipe','pipe']});
const selection=read('selection.json');assert.equal(selection.queryCount,3);assert.equal(selection.selection.candidates.length,2);
const results=[1,2].map(i=>read(`candidate-${i}-disposition.json`));
assert(results.every(r=>r.admission==='NOT_PERFORMED'));
assert(!fs.existsSync(dir+'admitted.json'));
for(let i=1;i<=2;i++){assert.equal(read(`candidate-${i}-invocation.json`).requests,1);assert.equal(read(`candidate-${i}-invocation.json`).retries,0);}
const now=new Date().toISOString();
const report={verifiedAt:now,status:'BLOCKED_NO_REAL_PROSPECT',objective:'Second real acceptance',sourcingRootCause:['Deep search results were manually replaced with origin URLs, losing the location of the alleged notice','Past search hints were not checked against exact canonical notice recognition or prior evaluated exclusions','Search metadata and identity mentions do not guarantee live accepted signal or canonically extractable identity'],sourceChanges:['core/research/manual-pain-first-intake.ts','core/research/manual-pain-first-intake.test.ts'],implementation:'preselectPainFirstSearchResults; exact found URL through canonical validator; existing noticeType used for non-authoritative hints; evaluated exclusions; identity/locality hint ordering; stable deduplication; maximum 5 total, 3 per query; no changes to manual intake behavior or canonical qualification',integration:'Used by .r76z-runtime/run.mts for this live execution; not wired into Control Center UI',tests:{targeted:'38/38 PASS',typecheck:'core/tsconfig.json PASS',gitDiffCheck:'PASS',untrackedSourceDiffCheck:'PASS'},liveQueries:3,thirdQueryGeography:'Not restricted to Martinique; no canonical geographic or ICP override',preselection:{reviewedHints:8,selected:2,rejectedBeforeInspection:6},inspections:2,environmentRetries:0,results,selectedProspect:null,prospectId:null,admissions:0,slots:0,designs:0,reviews:0,builds:0,visualQaCalls:0,correctionCycles:0,reproducibility:'NOT_PROVEN',newProductDefect:'NONE proven',observedLimit:'One of two selected sites confirms PAIN_FIRST; identity remains absent. Other redirects. This small batch does not establish a general yield improvement.',canonicalFilesUnchanged:true,canonicalD1RowsUnchanged:true,preexistingTrackedDiffUnchanged:true,villaUnchanged:true,nextAllowedAction:'One bounded sourcing task to select homepage notice candidates with identity evidence compatible with the existing parser and a directly inspectable homepage; no parser or admission-rule weakening.',usage:{credits:'USAGE_NOT_EXPOSED',modelReasoning:'USAGE_NOT_EXPOSED',mcp:['list_projects','search_graph','get_code_snippet','trace_path','check_index_coverage'],shellFallback:'Targeted reads; coverage metadata changed',subagents:0}};
fs.writeFileSync(dir+'postflight.json',JSON.stringify(report,null,2)+'\n');
const statePath='MAGICSCRIPT_CURRENT_STATE.md';
assert(fs.readFileSync(statePath,'utf8').includes('R75Z CONTINUATION 3 — BLOCKED_NO_REAL_PROSPECT'));
fs.writeFileSync(statePath,`# MAGIC SCRIPT CURRENT STATE

LAST_AUTHORITATIVE_RESULT
R76Z — BLOCKED_NO_REAL_PROSPECT, verified ${now}. Sourcing preselection implemented and exercised; second real acceptance NOT achieved. REPRODUCIBILITY: NOT_PROVEN.

CURRENT_REAL_PROSPECT
NONE admitted; prospect ID NONE. PAGD Batiment: SUCCESS / PAIN_SIGNAL_CONFIRMED, then IDENTITY_ABSENT / NO_ELIGIBLE_LINK. Amel Martin Photographe: FETCH_FAILED / REDIRECT. No production pipeline execution.

CURRENT_PIPELINE_POSITION
Sourcing/identity qualification. Three focused queries; eight third-query hints assessed, six rejected before inspection, two inspected once each. No retries, admission, slot, design, review, build, Chrome, Visual QA or correction.

ONE_ACTIVE_OBJECTIVE
Second distinct real prospect acceptance through Visual QA PASS — BLOCKED by sourcing/identity readiness.

ONE_OPEN_PRODUCT_DEFECT
NONE proven.

NEXT_ALLOWED_ACTION
One bounded sourcing task selecting homepage notice candidates with identity evidence compatible with the existing parser and a directly inspectable homepage; do not weaken parser or admission rules.

IMPORTANT_REAL_IDS
- Current prospect/admission/slot/design/review/build/QA IDs: NONE.
- Villa Ancinel: v2-87988492200011; CLOSED / ACCEPTANCE_COMPLETE, untouched; slot 1 preserved.
- Exclude all already evaluated R75Z candidates, including Zakari, Evasion Nautique 972 and the five continuation-3 candidates, from blind retries.

RECENT_PROOF
.r76z-runtime/postflight.json and selection/inspection/disposition files. preselectPainFirstSearchResults added only in core/research/manual-pain-first-intake.ts with tests: no deep-result-to-origin rewriting, canonical notice hints, prior exclusions, bounded ranking. Used by R76Z harness; UI not changed. Tests 38/38 PASS, core typecheck PASS, diff checks PASS. Canonical inspector/qualification/admission source hashes, canonical D1 and pre-existing tracked diff unchanged. No production source changes outside sourcing/test. No outreach, paid service or deploy. Small batch is not general yield proof. USAGE_NOT_EXPOSED.
`);
console.log(JSON.stringify({status:report.status,currentStateUpdated:true,canonicalD1RowsUnchanged:true,canonicalFilesUnchanged:true,preexistingTrackedDiffUnchanged:true,inspections:2}));
