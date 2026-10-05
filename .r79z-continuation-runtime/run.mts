import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {painFirstQueryPlans,acceptPainFirstSearchCandidate} from '../core/research/pain-first-staging.ts';
import {createPainFirstLiveHomepageInspector,createPainFirstLiveIdentityEnricher} from '../core/research/pain-first-homepage-transport.ts';
import {extractSuppliedFirstPartyIdentity} from '../core/research/website-seed.ts';
const dir='.r79z-continuation-runtime/';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(n:string,v:unknown)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const hash=(v:any)=>createHash('sha256').update(v).digest('hex');
const dbPath=read('.r79z-runtime/preflight.json').dbPath;
const snapshot=()=>{const db=new DatabaseSync(dbPath,{readOnly:true});try{const rows:any={};for(const t of ['prospects','v2_admissions','active_production_slots','jobs','v2_design_requests','v2_design_artifacts','v2_design_reviews','v2_build_artifacts','v2_visual_qa_reports','v2_build_corrections'])rows[t]=db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all();return rows;}finally{db.close();}};
const tracked=()=>hash(execFileSync('git',['diff','--binary'],{maxBuffer:30*1024*1024,stdio:['ignore','pipe','ignore']}));
const paths=Object.keys(read('.r79z-runtime/preflight.json').canonicalFiles);
const canonical=()=>Object.fromEntries(paths.map((p:string)=>[p,hash(fs.readFileSync(p))]));
const candidates=[{name:'Bò Kay',url:'https://bokay-off.com/'},{name:'Mary and the Wax',url:'https://maryandthewax.com/'},{name:'Planète Quads Martinique',url:'https://www.planetequads.com/'},{name:'Maisons Alizéa',url:'https://maisons-alizea.com/'}];
const stage=process.argv[2];
if(stage==='preflight'){
 const snap=snapshot();write('preflight.json',{at:new Date().toISOString(),dbPath,snapshot:snap,snapshotSha256:hash(JSON.stringify(snap)),trackedDiffSha256:tracked(),canonicalFiles:canonical(),currentStateSha256:hash(fs.readFileSync('MAGICSCRIPT_CURRENT_STATE.md')),candidates,maxCandidates:4,maxCorrectedRetriesPerCandidate:1,webSourcing:false});console.log('PREFLIGHT_RECORDED');process.exit(0);
}
const pre=read(dir+'preflight.json');
assert.equal(tracked(),pre.trackedDiffSha256,'TRACKED_DRIFT');assert.deepEqual(canonical(),pre.canonicalFiles,'CANONICAL_DRIFT');assert.equal(hash(JSON.stringify(snapshot())),pre.snapshotSha256,'D1_DRIFT');
if(stage==='postflight'){write('postflight.json',{at:new Date().toISOString(),trackedDiffUnchanged:true,canonicalSourcesUnchanged:true,canonicalD1RowsUnchanged:true});console.log('POSTFLIGHT_PASS');process.exit(0);}
const index=Number(stage);assert(Number.isInteger(index)&&index>=1&&index<=4,'FIXED_SHORTLIST_ONLY');
assert(!fs.existsSync(dir+'qualification-ready.json'),'STOP_FOR_ADMISSION');
for(let n=1;n<index;n++)assert(fs.existsSync(dir+`candidate-${n}-disposition.json`),'PRIOR_UNRESOLVED');
assert(!fs.existsSync(dir+`candidate-${index}-invocation.json`),'INSPECTION_CONSUMED');
const item=candidates[index-1];const plan=painFirstQueryPlans()[0];
const candidate={schemaVersion:1 as const,queryPlanId:plan.planId,conditionClass:plan.conditionClass,providerClass:'USER_CURATED_SHORTLIST',providerRunId:`R79Z-CONTINUATION-candidate-${index}`,resultUrl:item.url,resultTitle:item.name,resultPosition:index,acquiredAt:pre.at,authority:'NONE' as const};
const accepted=acceptPainFirstSearchCandidate(candidate);assert.equal(accepted.state,'URL_ACCEPTED');if(accepted.state!=='URL_ACCEPTED')throw new Error('URL_REJECTED');
write(`candidate-${index}-invocation.json`,{index,...item,candidate,at:new Date().toISOString(),homepageInspections:1,retries:0});
const inspection=await createPainFirstLiveHomepageInspector()(accepted);write(`candidate-${index}-inspection.json`,inspection);
let identity:any=null,enrichment:any=null;
if(inspection.staging.state==='PAIN_SIGNAL_CONFIRMED'){
 identity=extractSuppliedFirstPartyIdentity(inspection.observation.suppliedHtml??'');
 enrichment=await createPainFirstLiveIdentityEnricher()(accepted,inspection,identity);write(`candidate-${index}-identity.json`,{identity,enrichment});
}
const result={index,...item,pageState:inspection.pageState,httpResultClass:inspection.observation.httpResultClass,title:inspection.observation.boundedTitle,h1:inspection.observation.boundedH1,qualification:inspection.staging.state,identity:enrichment?.finalIdentity.state??null,enrichment:enrichment?.outcome??null};
write(`candidate-${index}-result.json`,result);
if(enrichment?.finalIdentity.state==='IDENTITY_STRONG')write('qualification-ready.json',result);
else write(`candidate-${index}-disposition.json`,{...result,admission:'NOT_PERFORMED',reason:inspection.staging.state==='PAIN_SIGNAL_CONFIRMED'?enrichment.finalIdentity.state:inspection.staging.state==='FETCH_FAILED'?inspection.observation.httpResultClass:inspection.staging.state});
console.log(JSON.stringify(result));
