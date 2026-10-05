const fs=require('node:fs');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const dir='.r75z-continuation3-runtime/';
const read=n=>JSON.parse(fs.readFileSync(dir+n,'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const base=read('preflight.json');
const previous=JSON.parse(fs.readFileSync('.r75z-continuation-runtime/preflight.json','utf8'));
const db=new DatabaseSync(base.dbPath,{readOnly:true});
const current=Object.fromEntries(Object.keys(previous.snapshot).map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()]));
db.close();
assert.equal(hash(JSON.stringify(current)),base.d1Sha256,'Canonical D1 drift');
assert.equal(hash(execFileSync('git',['diff','--binary'],{maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']})),base.trackedDiffSha256,'Tracked diff drift');
execFileSync('git',['diff','--check'],{stdio:['ignore','pipe','pipe']});
const results=[1,2,3,4,5].map(i=>read(`candidate-${i}-disposition.json`));
assert.equal(results.length,5);assert.equal(new Set(results.map(r=>r.url)).size,5);
assert(results.every(r=>r.admission==='NOT_PERFORMED'));
assert(results.every(r=>!/villa-ancinel|zakari|evasionnautique972/i.test(r.url)));
assert.equal(read('selection.json').queryCount,3);
assert(!fs.existsSync(dir+'admitted.json'));
for(let i=1;i<=5;i++){const invocation=read(`candidate-${i}-invocation.json`);assert.equal(invocation.homepageInspections,1);assert.equal(invocation.environmentRetries,0);}
assert.equal(results[2].qualification,'PAIN_SIGNAL_CONFIRMED');
assert.equal(results[2].identity,'IDENTITY_ABSENT');
assert.equal(read('candidate-3-identity.json').enrichment.outcome,'NO_ELIGIBLE_LINK');
const now=new Date().toISOString();
const report={verifiedAt:now,status:'BLOCKED_NO_REAL_PROSPECT',candidatesInspected:5,liveSearchQueries:3,environmentRetries:0,candidateResults:results,selectedProspect:null,prospectId:null,admission:'NOT_PERFORMED',productionSlot:'NONE',designJob:'NONE',designArtifact:'NONE',designReview:'NONE',buildJob:'NONE',buildArtifact:'NONE',initialVisualQa:'NONE',correctionCycleUsed:false,correctedBuild:'NONE',finalVisualQa:'NONE',productSourceFilesModified:[],newProductDefect:'NONE',reproducibilityResult:'NOT_PROVEN',canonicalD1RowsUnchanged:true,trackedDiffUnchanged:true,villaUnchanged:true,noOutreach:true,noPaidProvider:true,checks:{budgetAssertions:'PASS',persistedResults:'PASS',d1AndDiffHashes:'PASS',gitDiffCheck:'PASS'},sourceSelectionLimitations:'Bounded stored-candidate/artifact checks, not an exhaustive audit. Fifth candidate is a real restaurant previously discovered in continuation 2 outside Martinique; no eligibility inferred, canonical NO_PAIN_SIGNAL ended it.',nextAllowedAction:'Improve prospect sourcing strategy as one bounded program-level task.',usage:{credits:'USAGE_NOT_EXPOSED',modelReasoning:'USAGE_NOT_EXPOSED',codebaseMemoryTools:['list_projects','search_graph','search_code','check_index_coverage'],shellFallback:'Bounded direct reads for changed coverage metadata and runtime evidence',subagents:0}};
fs.writeFileSync(dir+'postflight.json',JSON.stringify(report,null,2)+'\n');
const statePath='MAGICSCRIPT_CURRENT_STATE.md';
assert(fs.readFileSync(statePath,'utf8').includes('R75Z CONTINUATION 2 — BLOCKED_NO_REAL_PROSPECT'));
fs.writeFileSync(statePath,`# MAGIC SCRIPT CURRENT STATE

LAST_AUTHORITATIVE_RESULT
R75Z CONTINUATION 3 — BLOCKED_NO_REAL_PROSPECT, verified ${now}. Five new candidates inspected; three live discovery queries; zero retries; zero admissions. REPRODUCIBILITY: NOT_PROVEN.

CURRENT_REAL_PROSPECT
NONE selected or admitted. Prospect ID NONE.

CURRENT_PIPELINE_POSITION
Sourcing/qualification batch exhausted. Medi Conciergerie, LM Charpente and Chateau de Toulondit: SUCCESS / NO_PAIN_SIGNAL. Accent Immo: SUCCESS / PAIN_SIGNAL_CONFIRMED, then IDENTITY_ABSENT / NO_ELIGIBLE_LINK. RB Agency: FETCH_FAILED / REDIRECT. No registry reconciliation, admission, slot, design, review, build, Chrome evidence, Visual QA or correction performed.

ONE_ACTIVE_OBJECTIVE
Second distinct real prospect acceptance through Visual QA PASS — BLOCKED by sourcing; no execution active.

ONE_OPEN_PRODUCT_DEFECT
NONE. The batch proves a sourcing bottleneck, not five product defects.

NEXT_ALLOWED_ACTION
Improve prospect sourcing strategy as one bounded program-level task; no blind candidate-6 continuation.

IMPORTANT_REAL_IDS
- Current prospect/admission/slot/design/review/build/QA IDs: NONE.
- Villa Ancinel: v2-87988492200011; CLOSED / ACCEPTANCE_COMPLETE, untouched; slot 1 preserved.
- Zakari: EXPECTED_REJECTION, 250000-byte cap exceeded; do not retry.
- Evasion Nautique 972: SUCCESS / NO_PAIN_SIGNAL; do not retry.

RECENT_PROOF
.r75z-continuation3-runtime/postflight.json and candidate-1 through candidate-5 persisted observations/dispositions. Exactly five homepage inspections, no environment retries, three discovery queries. Canonical D1 rows and pre-existing tracked diff hashes unchanged; git diff --check PASS. No product source changes, outreach, paid provider, deployment or pipeline mutation. USAGE_NOT_EXPOSED.
`);
assert(fs.readFileSync(statePath,'utf8').includes('R75Z CONTINUATION 3 — BLOCKED_NO_REAL_PROSPECT'));
console.log(JSON.stringify({status:report.status,candidatesInspected:5,liveSearchQueries:3,canonicalD1RowsUnchanged:true,trackedDiffUnchanged:true,currentStateUpdated:true}));
