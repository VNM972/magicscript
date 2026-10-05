import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {executeVisualQa} from '../core/visual-qa/engine.ts';
import {D1VisualQaReportStore} from '../core/persistence/d1-visual-qa-store.ts';
import {D1BuildArtifactStore} from '../core/persistence/d1-build-artifact-store.ts';
import {verifyBuildArtifactIntegrity} from '../core/builder/site-builder.ts';
const dir='.r77z-runtime/';const attempt=1;
const read=(n:string)=>JSON.parse(fs.readFileSync(dir+n,'utf8').replace(/^\uFEFF/,''));
const write=(n:string,v:unknown)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
assert(!fs.existsSync(dir+'qa-a1/qa-invocation.json'),'QA_CONSUMED');
const capture=read('qa-a1/capture-result.json');assert.equal(capture.captures.length,2);assert(capture.browserVersion.startsWith('Chrome/'));assert.equal(capture.rootHttpStatus,200);
const build=read('build-r1.json');const request=read('design-request.json');
const rows=read('build-rows.json');const design={...JSON.parse(rows.v2_design_artifacts[0].artifact_json),status:rows.v2_design_artifacts[0].status};assert.equal(design.status,'APPROVED');
await verifyBuildArtifactIntegrity(build);
const evidence=read('qa-a1/browser-evidence.json');assert.deepEqual(capture.evidence,evidence);
for(const [index,size] of [[0,[1440,900]],[1,[390,844]]] as const){const c=capture.captures[index];assert(c.captureSuccess);assert.equal(c.definition.width,size[0]);assert.equal(c.definition.height,size[1]);assert(fs.statSync(c.screenshotPath).size>0);}
// Human visual review of fresh screenshots corroborated against captured DOM.
// Pass the observed internal enum through the existing unresolvedMarkers field;
// retain raw extraction unchanged, and change no QA/admission semantics.
const marker='GENERAL_LOCAL_BUSINESS';
for(const device of ['desktop','mobile'])assert(read(`qa-a1/${device}-dom.json`).dom.bodyText.includes(marker));
evidence.unresolvedMarkers=[...new Set([...evidence.unresolvedMarkers,marker])];
write('qa-a1/visual-review-observations.json',{reviewedAt:new Date().toISOString(),buildArtifactId:build.id,screenshots:capture.captures.map((c:any)=>c.screenshotPath),findings:[{category:'PLACEHOLDER',observedText:marker,location:'Visible hero kicker on desktop and mobile',basis:'Internal canonical vertical identifier exposed as public-facing copy',supportedCorrectionOperation:null}],additionalObservation:'First mobile screen shows generic strategy wording rather than a concrete photography/video offer or Reims context. Not treated as source evidence or repaired.'});
write('qa-a1/visual-qa-evidence.json',evidence);
let mf:any;
try{
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("R77Z canonical local D1 binding");}};',compatibilityDate:'2026-09-04',d1Databases:{DB:'magicscript-local'},resourcePersistencePath:path.resolve('apps/api-worker/.wrangler/state/v3')}));
 const db=await mf.getD1Database('DB');const store=new D1VisualQaReportStore(db);const builds=new D1BuildArtifactStore(db);
 assert.deepEqual(await builds.get(build.id),build);assert.equal(await store.getForBuildAttempt(build.id,attempt),null);
 write('qa-a1/qa-invocation.json',{entrypoint:'executeVisualQa',at:new Date().toISOString(),realInvocations:1,buildArtifactId:build.id,attempt,store:'Native magicscript-local D1VisualQaReportStore'});
 const report=await executeVisualQa({build,design,request,evidence,attempt,store});write('qa-a1/visual-qa-report.json',report);assert.deepEqual(await store.get(report.id),report);
 assert.equal(report.decision,'CORRECTION_REQUIRED');assert(report.issues.some(i=>i.category==='PLACEHOLDER'&&i.message.includes(marker)));
 write('final-disposition.json',{status:'CLOSED / UNSUPPORTED_QA_FINDING',lastProvenStage:'BUILD + fresh Chrome desktop/mobile capture',firstBrokenStage:'VISUAL_QA',reason:'Rendered internal vertical identifier GENERAL_LOCAL_BUSINESS; existing correction operations expose only ENSURE_LOCAL_FAVICON_V1, which cannot resolve PLACEHOLDER findings.',correctionCycleUsed:false,qaInvocations:1,qaRetests:0,prospectId:build.prospectId,reportId:report.id,acceptanceComplete:false,reproducibility:'NOT_PROVEN'});
 console.log(JSON.stringify({decision:report.decision,reportId:report.id,issues:report.issues,status:'CLOSED / UNSUPPORTED_QA_FINDING',realInvocations:1,correctionCycleUsed:false}));
}finally{if(mf)await mf.dispose();}
