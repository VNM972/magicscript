const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const runtime=__dirname;
const read=name=>JSON.parse(fs.readFileSync(path.join(runtime,name),'utf8'));
const write=(name,value)=>fs.writeFileSync(path.join(runtime,name),JSON.stringify(value,null,2)+'\n');
const baseline=read('preflight.json');
const inspection=read('inspection.json');
assert.equal(inspection.observation.httpResultClass,'NETWORK_ERROR');
const db=new DatabaseSync(baseline.dbPath,{readOnly:true});
const current={};
try{for(const table of Object.keys(baseline.snapshot))current[table]=db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all();}finally{db.close();}
assert.ok(JSON.stringify(current)===JSON.stringify(baseline.snapshot),'Canonical D1 row bytes changed since preflight');
const diff=execFileSync('git',['diff','--binary'],{maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']});
assert.equal(createHash('sha256').update(diff).digest('hex'),baseline.trackedDiffSha256,'Pre-existing tracked diff changed');
const branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim();
assert.equal(branch,'magic-script-v2-recovery-20260919');
const now=new Date().toISOString();
const record={verifiedAt:now,status:'BLOCKED_ENVIRONMENT',selectedCandidate:'Zakari',prospectId:null,source:'Canonical manual PAIN_FIRST discovery/intake',lastProvenStage:'Accepted homepage URL bookkeeping',firstBrokenStage:'Canonical live homepage inspection before qualification/admission',exactError:'FETCH_FAILED / NETWORK_ERROR',rootCause:'UNKNOWN underlying native HTTP transport error; separate read-only DNS prerequisite check succeeded with two answers. Inspector does not expose native error.',counts:{homepageInspectorInvocations:1,inspectionRetries:0,admissions:0,slotAcquisitions:0,runnerClaims:0,executors:0,qaInvocations:0,correctionCycles:0},persistedMutations:'NONE in canonical D1',jobState:'NONE',attempts:0,prospectState:'NOT_ADMITTED / no canonical prospect created',slotState:'No slot acquired; original slot table unchanged',productSourceFilesModified:[],trackedDiffUnchanged:true,canonicalD1RowsUnchanged:true,villaHistoryUnchanged:true,processesStarted:0,reproducibility:'NOT_PROVEN',nextAllowedAction:'Restore canonical live homepage transport availability for the selected candidate in a separately authorized mission'};
write('postflight.json',record);
const statePath=path.resolve('MAGICSCRIPT_CURRENT_STATE.md');
const previous=fs.readFileSync(statePath,'utf8');
assert(previous.includes('R74Z CONTINUATION — CLOSED / ACCEPTANCE_COMPLETE'));
assert(!previous.includes('R75Z SECOND REAL PROSPECT'),'R75Z state already recorded');
const state=`# MAGIC SCRIPT CURRENT STATE

PROJECT
Magic Script V2

REPOSITORY
D:\\MagicScript\\repository

LAST_VERIFIED_AT
${now} — Europe/Paris; .r75z-runtime/postflight.json.

CURRENT_BRANCH
${branch}

CURRENT_VERIFIED_STATE
R75Z SECOND REAL PROSPECT — BLOCKED_ENVIRONMENT. One distinct real candidate, Zakari, selected through canonical manual PAIN_FIRST discovery/intake. Its accepted homepage URL was inspected once by createPainFirstLiveHomepageInspector: FETCH_FAILED / NETWORK_ERROR. No retry, admission, slot acquisition, runner claim, design/build/QA invocation or correction. No product source modifications. Canonical D1 rows and incoming tracked diff verified unchanged.

LAST_CLOSED_MILESTONE
R75Z — ended BLOCKED_ENVIRONMENT before qualification/admission. Prior accepted milestone remains R74Z CONTINUATION — CLOSED / ACCEPTANCE_COMPLETE; Villa Ancinel remains closed immutable history.

LAST_AUTHORITATIVE_RESULT
Zakari canonical homepage inspection: requestedUrl https://www.zakari.fr/, inspectedAt ${inspection.observation.inspectedAt}, FETCH_FAILED / NETWORK_ERROR; staging authority NON_AUTHORITATIVE. Search result alone does not establish current pain or admission eligibility. Separate read-only DNS prerequisite probe succeeded (two answers); underlying native HTTP failure remains UNKNOWN. No product defect established.

CURRENT_REAL_PROSPECT
Selected candidate: Zakari — NOT_ADMITTED; canonical prospect ID NONE. No new accepted prospect. First accepted prospect remains Villa Ancinel / v2-87988492200011, never reused or mutated.

CURRENT_PIPELINE_POSITION
Last proven: canonical URL acceptance bookkeeping. First broken: live homepage inspection before qualification/admission. Jobs NONE / attempts 0; design, review, build and QA NONE. No second-prospect slot. Original slot 1 remains HELD by v2-87988492200011; slots 2–20 remain unoccupied; all slot rows unchanged.

ONE_ACTIVE_OBJECTIVE
NONE. R75Z stopped on transport blocker.

ONE_OPEN_PRODUCT_DEFECT
NONE

NEXT_ALLOWED_ACTION
Restore canonical live homepage transport availability for Zakari in a separately authorized mission.

IMPORTANT_REAL_IDS
- Selected homepage: https://www.zakari.fr/
- Search-result provenance: https://www.zakari.fr/site-en-construction
- Discovery run: R75Z-manual-pain-first; condition SITE_UNDER_CONSTRUCTION.
- Canonical prospect/design/build/QA/correction IDs: NONE for R75Z.
- Historical accepted prospect: v2-87988492200011.
- Historical final QA: qa-build-artifact-dr-v2-87988492200011-DESIGN_REQUEST_V1-DESIGN_ARTIFACT_V1-r1-builder-v1-br2-r2-a2 / PASS.

RECENT_PROOF
- .r75z-runtime/preflight.json: real D1 snapshot and incoming tracked diff fingerprint.
- .r75z-runtime/candidate.json: selected real candidate and discovery provenance.
- .r75z-runtime/inspection-invocation.json: single-use canonical inspection guard, one invocation, zero retries.
- .r75z-runtime/inspection.json: exact failed transport/staging result.
- .r75z-runtime/postflight.json: all snapshotted canonical D1 rows byte-equivalent, original tracked diff fingerprint unchanged, zero pipeline mutations.
- API, runner, Chrome, preview and native D1 service were not started by R75Z. Canonical R74Z GUID/shared MAGICSCRIPT_STACK_ID launch mechanism remains unchanged and was not needed before admission.

INVARIANTS / DO_NOT_REOPEN
Villa Ancinel acceptance COMPLETE; historical r1/r2, QA a1/a2, correction and slot immutable. Do not execute consumed R71Z/R74Z/continuation harnesses, rerun Villa jobs, or create another Villa milestone. All earlier closed missions remain closed. Preserve dirty worktree; no paid API/service, invented company/family/authority, outreach, Proposal, deployment, source patch or automatic successor mission. R75Z single-use inspection guard is consumed; do not rerun discovery.mts.

USAGE_REPORT
USAGE_NOT_EXPOSED for conversation credits. Codebase-memory-mcp list_projects, search_graph, search_code and get_code_snippet used; graph insufficient for current persisted evidence and some source discovery, so bounded source/SQLite reads and shell fallback used. No subagent, installation or paid provider call.
`;
fs.writeFileSync(statePath,state);
console.log(JSON.stringify({status:record.status,currentStateUpdated:true,canonicalD1RowsUnchanged:true,trackedDiffUnchanged:true,pipelineMutations:0,qaInvocations:0,exactError:record.exactError}));
