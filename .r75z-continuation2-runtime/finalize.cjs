const fs=require('node:fs');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const dir='.r75z-continuation2-runtime/';
const read=n=>JSON.parse(fs.readFileSync(dir+n,'utf8'));
const hash=x=>createHash('sha256').update(x).digest('hex');
const base=read('preflight.json');
const prior=JSON.parse(fs.readFileSync('.r75z-continuation-runtime/preflight.json','utf8'));
const db=new DatabaseSync(base.dbPath,{readOnly:true});
const snapshot=Object.fromEntries(Object.keys(prior.snapshot).map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()]));
db.close();
assert.equal(hash(JSON.stringify(snapshot)),base.d1Sha256,'D1 drift');
assert.equal(hash(execFileSync('git',['diff','--binary'],{maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']})),base.trackedDiffSha256,'Tracked diff drift');
const zakari=read('zakari-inspection.json');
const diagnostic=read('zakari-diagnostics.json');
const replacement=read('replacement-inspection.json');
const bytes=fs.readFileSync(dir+'zakari-response.bin');
assert.equal(zakari.observation.httpResultClass,'UNSUPPORTED');
assert.equal(diagnostic.diagnostics.filter(x=>x.stage==='REQUEST').length,1);
assert.equal(diagnostic.bytesObserved,252625);
assert.equal(bytes.length,252625);
const html=new TextDecoder('utf-8',{fatal:true}).decode(bytes,{stream:true});
assert(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(html));
assert.equal(replacement.observation.httpResultClass,'SUCCESS');
assert.equal(replacement.staging.state,'NO_PAIN_SIGNAL');
const source=fs.readFileSync('core/research/pain-first-homepage-transport.ts','utf8');
assert(source.includes('if (bytes > PAIN_FIRST_MAX_BODY_BYTES)'));
assert(source.includes('export const PAIN_FIRST_MAX_BODY_BYTES = 250_000;'));
const now=new Date().toISOString();
const report={verifiedAt:now,status:'BLOCKED_NO_REAL_PROSPECT',zakariClassification:'EXPECTED_REJECTION',zakariRootCause:{function:'boundedHtml',file:'core/research/pain-first-homepage-transport.ts',line:69,condition:'bytes > PAIN_FIRST_MAX_BODY_BYTES',limit:250000,bytesObserved:252625,completeBodySize:'UNKNOWN; stream cancelled at overflow',mapping:'null -> observeSinglePage UNSUPPORTED (line 114) -> FETCH_FAILED',intent:'Explicit R55/R58Z body bound; existing tests reject streamed overflow',utf8PrefixValid:true,binaryControls:false},sourceFixApplied:false,zakariDiagnosisRequests:1,zakariRepairRetries:0,selectedProspect:'Evasion Nautique 972',prospectUrl:'https://evasionnautique972.com/',replacementRequests:1,replacementResult:{pageState:replacement.pageState,httpResultClass:replacement.observation.httpResultClass,title:replacement.observation.boundedTitle,h1:replacement.observation.boundedH1,staging:replacement.staging.state},prospectId:null,admission:'NOT_PERFORMED',slot:'NONE',design:'NONE',review:'NONE',build:'NONE',initialQa:'NONE',correctionCycle:false,finalQa:'NONE',newProductDefect:'NONE proven',reproducibility:'NOT_PROVEN',lastProvenStage:'Replacement PAGE_OBSERVED / SUCCESS',firstBrokenStage:'Replacement canonical digital-pain qualification: NO_PAIN_SIGNAL',d1RowsUnchanged:true,trackedDiffUnchanged:true,villaUnchanged:true,tests:'NONE; no source change',typecheck:'NONE; no source change',diffCheck:'PASS',nextAllowedAction:'Authorize one new distinct prospect selection and canonical inspection; advance only if canonical qualification succeeds.',usage:{credits:'USAGE_NOT_EXPOSED',modelReasoning:'USAGE_NOT_EXPOSED',codebaseMemoryTools:['list_projects','search_graph','get_code_snippet','check_index_coverage'],directCodeFilesRead:10,shellFallback:'Bounded source reads because coverage metadata changed',webSearchCalls:2,webSearchQueries:5,discoveryDeviation:'Manual discovery used five search queries rather than the canonical two query strings; no result metadata promoted to evidence. Only one replacement was selected and inspected.'}};
const statePath='MAGICSCRIPT_CURRENT_STATE.md';
assert(fs.readFileSync(statePath,'utf8').includes('R75Z CONTINUATION — ZAKARI / BLOCKED_ENVIRONMENT'));
fs.writeFileSync(dir+'postflight.json',JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(statePath,`# MAGIC SCRIPT CURRENT STATE

LAST_AUTHORITATIVE_RESULT
R75Z CONTINUATION 2 — BLOCKED_NO_REAL_PROSPECT, verified ${now}. Zakari EXPECTED_REJECTION resolved; one distinct replacement inspected, not qualified. REPRODUCIBILITY NOT_PROVEN.

CURRENT_REAL_PROSPECT
Evasion Nautique 972 — https://evasionnautique972.com/; NOT_ADMITTED; prospect ID NONE. Canonical homepage PAGE_OBSERVED / SUCCESS; title “Évasion Nautique 972 — nouveau site en construction”; H1 “Nouveau site en construction”; canonical staging NO_PAIN_SIGNAL.

CURRENT_PIPELINE_POSITION
LAST_PROVEN_STAGE: replacement homepage inspection succeeds.
FIRST_BROKEN_STAGE: canonical digital-pain qualification returns NO_PAIN_SIGNAL; identity/admission not performed. No slot, design, review, build, Chrome evidence or Visual QA; correction NO. The one replacement selection is consumed.

ONE_ACTIVE_OBJECTIVE
Second distinct real prospect acceptance through Visual QA PASS — BLOCKED, no execution active.

ONE_OPEN_PRODUCT_DEFECT
NONE proven. No second diagnostic or source repair attempted.

NEXT_ALLOWED_ACTION
Authorize one new distinct prospect selection and canonical inspection; advance only if canonical qualification succeeds.

IMPORTANT_REAL_IDS
- Current prospect/admission/slot/design/review/build/QA IDs: NONE.
- Villa Ancinel: v2-87988492200011; R74Z CONTINUATION — CLOSED / ACCEPTANCE_COMPLETE remains immutable; slot 1 HELD, all canonical rows preserved. Never reuse Villa.
- Zakari abandoned: boundedHtml rejects bytes > PAIN_FIRST_MAX_BODY_BYTES (250000); 252625 valid UTF-8 bytes observed before cancellation. HTTP 200, valid TLS, accepted HTML headers. Intentional streamed-size guard; no source fix, no repair retry.

RECENT_PROOF
.r75z-continuation2-runtime/postflight.json records exact predicate, both inspection results, and unchanged canonical D1/tracked diff hashes. Runtime contains the bounded Zakari response and one replacement observation. No paid API, outreach, deploy or pipeline mutation. Manual discovery used five search queries rather than the canonical two query strings; only one replacement inspected. USAGE_NOT_EXPOSED.
`);
assert(fs.readFileSync(statePath,'utf8').includes('R75Z CONTINUATION 2 — BLOCKED_NO_REAL_PROSPECT'));
console.log(JSON.stringify({status:report.status,d1RowsUnchanged:true,trackedDiffUnchanged:true,villaUnchanged:true,currentStateUpdated:true}));
