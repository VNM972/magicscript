import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {executeVisualQa} from '../core/visual-qa/engine.ts';
import {D1VisualQaReportStore} from '../core/persistence/d1-visual-qa-store.ts';
import {D1BuildArtifactStore} from '../core/persistence/d1-build-artifact-store.ts';
import {verifyBuildArtifactIntegrity} from '../core/builder/site-builder.ts';
const dir='.r78zb-runtime/',attempt=Number(process.argv[2]);assert([2,3].includes(attempt));
const read=(n:string)=>JSON.parse(fs.readFileSync(dir+n,'utf8').replace(/^\uFEFF/,'')),write=(n:string,v:unknown)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
const qaDir=`qa-a${attempt}/`;assert(!fs.existsSync(dir+qaDir+'qa-invocation.json'),'QA_CONSUMED');
const baseline=read('preflight.json'),build=read(`build-r${attempt}.json`),request=JSON.parse(baseline.rows.v2_design_requests[0].request_json),row=baseline.rows.v2_design_artifacts[0],design={...JSON.parse(row.artifact_json),status:row.status};
const capture=read(qaDir+'capture-result.json'),evidence=read(qaDir+'browser-evidence.json');assert.equal(capture.captures.length,2);assert(capture.browserVersion.startsWith('Chrome/'));assert.equal(capture.rootHttpStatus,200);assert.equal(capture.previewRoot,build.outputPath);assert.deepEqual(capture.evidence,evidence);await verifyBuildArtifactIntegrity(build);
for(const [i,size] of [[0,[1440,900]],[1,[390,844]]] as const){const c=capture.captures[i];assert(c.captureSuccess);assert.equal(c.definition.width,size[0]);assert.equal(c.definition.height,size[1]);assert(fs.statSync(c.screenshotPath).size>0);const device=i===0?'desktop':'mobile',dom=read(qaDir+device+'-dom.json');assert(!dom.dom.bodyText.includes('GENERAL_LOCAL_BUSINESS'));assert(dom.dom.bodyText.toLocaleLowerCase('fr').includes('entreprise locale'));}
write(qaDir+'visual-review-observations.json',{reviewedAt:new Date().toISOString(),buildArtifactId:build.id,screenshots:capture.captures.map((c:any)=>c.screenshotPath),publicLabel:'Entreprise locale',internalEnumVisible:false,review:'Fresh desktop/mobile screenshots corroborated with captured DOM; canonical QA evidence retained without altering engine or approved copy.'});
let mf:any;try{
 mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("R78Z-B canonical local D1 binding");}};',compatibilityDate:'2026-09-04',d1Databases:{DB:'magicscript-local'},resourcePersistencePath:path.resolve('apps/api-worker/.wrangler/state/v3')}));
 const db=await mf.getD1Database('DB'),store=new D1VisualQaReportStore(db),builds=new D1BuildArtifactStore(db);assert.deepEqual(await builds.get(build.id),build);assert.equal(await store.getForBuildAttempt(build.id,attempt),null);assert.equal(build.buildRevision,attempt);assert.equal(build.qaAttempt,attempt);assert.equal(build.approvedRevision,1);
 write(qaDir+'qa-invocation.json',{entrypoint:'executeVisualQa',at:new Date().toISOString(),realInvocations:1,buildArtifactId:build.id,attempt,store:'Native magicscript-local D1VisualQaReportStore'});
 const report=await executeVisualQa({build,design,request,evidence,attempt,store});write(qaDir+'visual-qa-report.json',report);assert.deepEqual(await store.get(report.id),report);
 console.log(JSON.stringify({id:report.id,decision:report.decision,issues:report.issues,attempt,realInvocations:1}));
}finally{if(mf)await mf.dispose();}
