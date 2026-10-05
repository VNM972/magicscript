import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {preselectPainFirstSearchResults} from '../core/research/manual-pain-first-intake.ts';
import {painFirstQueryPlans,acceptPainFirstSearchCandidate} from '../core/research/pain-first-staging.ts';
import {createPainFirstLiveHomepageInspector,createPainFirstLiveIdentityEnricher} from '../core/research/pain-first-homepage-transport.ts';
import {extractSuppliedFirstPartyIdentity} from '../core/research/website-seed.ts';
const dir='.r79z-runtime/';
const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(n:string,v:unknown)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
const hash=(v:any)=>createHash('sha256').update(v).digest('hex');
const dbPath=read('.r78zb-runtime/preflight.json').dbPath;
const snapshot=()=>{const db=new DatabaseSync(dbPath,{readOnly:true});try{return {prospects:db.prepare('SELECT id,company_name,website_url FROM prospects ORDER BY id').all(),slots:db.prepare('SELECT * FROM active_production_slots ORDER BY slot_id').all(),admissions:db.prepare('SELECT * FROM v2_admissions ORDER BY prospect_id').all()};}finally{db.close();}};
const tracked=()=>hash(execFileSync('git',['diff','--binary'],{maxBuffer:30*1024*1024,stdio:['ignore','pipe','ignore']}));
const canonicalPaths=['core/research/manual-pain-first-intake.ts','core/research/pain-first-staging.ts','core/research/pain-first-homepage-transport.ts','core/research/pain-first-homepage-network.ts','core/research/pain-first-identity-enrichment.ts','core/research/website-seed.ts'];
const canonical=()=>Object.fromEntries(canonicalPaths.map(p=>[p,hash(fs.readFileSync(p))]));
const stage=process.argv[2];
if(stage==='select'){
 assert(!fs.existsSync(dir+'selection.json'),'FROZEN');
 const snap=snapshot();
 const exclusions=[...read('.r77z-runtime/selection.json').exclusions,'https://androcam-productions.com/',...snap.prospects.map((p:any)=>p.website_url).filter(Boolean)];
 // R77Z discovery-only priority; no search hint is canonical evidence.
 const records=[
 {name:'ProDiscount / BTRG Services',url:'https://www.prodiscount.fr/',p:3,i:2,l:1,c:1,n:1,notice:'Site en construction',identity:'BTRG SERVICES; registration text 824557995 (label length inconsistent)',locality:'91600 Savigny-sur-Orge',contact:'contact@prodiscount.fr',value:'Consumer discount retailer offering local pickup; clear presentation and pickup enquiry journey',source:'https://www.prodiscount.fr/'},
 {name:'Palais Impérial',url:'https://www.palaisimperial.fr/',p:2,i:2,l:1,c:1,n:2,notice:'Site en construction',identity:'Palais Impérial; registration 493357008 in prior uninspected discovery',locality:'Gennevilliers',contact:'Not yet verified',value:'Local restaurant: present menu and reservation contact',source:'https://www.palaisimperial.fr/mentions-legales.html'},
 {name:'Auberge de l’Est à l’Ouest',url:'https://delestalouest.bzh/',p:2,i:2,l:0,c:1,n:1,notice:'SITE EN CONSTRUCTION',identity:'Auberge de l’Est à l’Ouest / Erwann LE ROUX',locality:'29246 Poullaouen',contact:'06 52 79 73 21 discovery only',value:'Restaurant, catering, takeaway and 24/7 meal dispenser: clarify distinct ordering journeys',source:'https://delestalouest.bzh/?lang=en'},
 {name:'David Guitton',url:'https://www.davidguitton.com/',p:2,i:2,l:0,c:1,n:2,notice:'Site en construction',identity:'David Guitton Coiffeur Visagiste',locality:'22 rue de Bourgogne 75007 Paris',contact:'Landline only in discovery',value:'Local hair salon: service discovery and appointment contact',source:'https://www.davidguitton.com/photos/coiffeurvisagiste'},
 {name:'Julien Honoré Artisan Coiffeur',url:'https://www.julienhonore.com/',p:3,i:1,l:0,c:1,n:1,notice:'Site en construction',identity:'Julien Honoré Artisan Coiffeur',locality:'',contact:'contact@julienhonore.com',value:'Hairdresser: service presentation and appointment request',source:'https://www.julienhonore.com/'},
 {name:'Arc Institut',url:'https://www.arcinstitut.com/',p:3,i:1,l:0,c:1,n:2,notice:'Site en cours de refonte',identity:'Arc Institut',locality:'',contact:'07 84 10 52 05 discovery only; WhatsApp unproven',value:'Institute: restore service presentation beyond temporary phone-only page; activity to verify',source:'https://www.arcinstitut.com/'},
 {name:'Escale Zen Spa',url:'https://escalezen-marseille.fr/',p:1,i:2,l:0,c:1,n:2,notice:'Site en cours de refonte',identity:'Escale Zen Spa',locality:'Marseille 13007 Endoume',contact:'Not yet verified',value:'Beauty institute, massages and hammam: make services and appointment journey accessible',source:'https://escalezen-marseille.fr/'},
 {name:'Le Wood Maubeuge',url:'https://lewoodmaubeuge.fr/',p:1,i:2,l:1,c:1,n:2,notice:'Site en construction',identity:'SAS CAP FOOD from uninspected R77Z discovery',locality:'Mairieux',contact:'Not yet verified',value:'Local restaurant: menu and booking journey; deep notice may be stale',source:'https://lewoodmaubeuge.fr/mentions-legales/'},
 {name:'Restaurant Le Panoramique',url:'https://www.restaurant-panoramique-bugey.fr/',p:1,i:2,l:1,c:1,n:3,notice:'Site en construction',identity:'Restaurant Le Panoramique',locality:'01450 Cerdon',contact:'04 74 37 38 20 landline only in discovery',value:'Local restaurant: show dishes and reservation options; service-page notice may be stale',source:'https://www.restaurant-panoramique-bugey.fr/la-potence-dans-le-cerdon'},
 {name:'K5 Lorient',url:'https://k5-lorient.com/',p:1,i:2,l:0,c:1,n:3,notice:'Site en construction',identity:'K5 by Paul',locality:'56100 Lorient',contact:'accueil@k5-lorient.com discovery only',value:'Restaurant and caterer: distinguish restaurant and event enquiries; old notice risk',source:'https://k5-lorient.com/'},
 ];
 const ranked=records.map(r=>({...r,score:r.p*r.i*4+r.l*2+r.c*3-r.n*2})).sort((a,b)=>b.score-a.score);
 const acquiredAt=new Date().toISOString();
 const pool=ranked.map((r,index)=>{
 const plan=painFirstQueryPlans().find(p=>p.conditionClass===(r.notice.toLowerCase().includes('refonte')?'SITE_REBUILDING':'SITE_UNDER_CONSTRUCTION'))!;
 const candidate={schemaVersion:1 as const,queryPlanId:plan.planId,conditionClass:plan.conditionClass,providerClass:'MANUAL_OPERATOR_DISCOVERY',providerRunId:'R79Z-bounded-manual-batch',resultUrl:r.url,resultTitle:r.name,resultPosition:index+1,acquiredAt,authority:'NONE' as const};
 const selected=preselectPainFirstSearchResults([{candidate,noticeText:r.notice,identityHint:r.identity,localityHint:r.locality}],exclusions,1);
 assert.equal(selected.candidates.length,1,JSON.stringify(selected));
 return {rank:index+1,...r,candidate:selected.candidates[0],authority:'NONE'};
 });
 write('preflight.json',{at:acquiredAt,dbPath,snapshot:snap,snapshotSha256:hash(JSON.stringify(snap)),trackedDiffSha256:tracked(),canonicalFiles:canonical()});
 write('selection.json',{pool,exclusions,rankedCount:pool.length,maxInspections:8,scoreRule:'Existing R77Z p*i*4 + l*2 + c*3 - n*2; discovery only',canonicalAuthority:false});
 console.log(JSON.stringify(pool.map(({rank,name,score})=>({rank,name,score}))));process.exit(0);
}
const pre=read(dir+'preflight.json');
assert.equal(tracked(),pre.trackedDiffSha256,'TRACKED_DRIFT');assert.deepEqual(canonical(),pre.canonicalFiles,'CANONICAL_DRIFT');assert.equal(hash(JSON.stringify(snapshot())),pre.snapshotSha256,'D1_DRIFT');
if(stage==='postflight'){write('postflight.json',{at:new Date().toISOString(),trackedDiffUnchanged:true,canonicalSourcesUnchanged:true,prospectsAdmissionsSlotsUnchanged:true});console.log('POSTFLIGHT_PASS');process.exit(0);}
const index=Number(stage);assert(Number.isInteger(index)&&index>=1&&index<=8);
assert(!fs.existsSync(dir+'qualification-ready.json'),'STOP_FOR_QUALIFICATION');assert(!fs.existsSync(dir+'selected.json'),'STOP_SELECTED');assert(!fs.existsSync(dir+`candidate-${index}-invocation.json`),'INSPECTION_CONSUMED');
for(let n=1;n<index;n++)assert(fs.existsSync(dir+`candidate-${n}-disposition.json`),'PRIOR_UNRESOLVED');
const item=read(dir+'selection.json').pool[index-1];
const accepted=acceptPainFirstSearchCandidate(item.candidate);assert.equal(accepted.state,'URL_ACCEPTED');if(accepted.state!=='URL_ACCEPTED')throw new Error('URL_REJECTED');
write(`candidate-${index}-invocation.json`,{index,name:item.name,url:item.url,at:new Date().toISOString(),homepageInspections:1,retries:0});
const inspection=await createPainFirstLiveHomepageInspector()(accepted);write(`candidate-${index}-inspection.json`,inspection);
let identity:any=null,enrichment:any=null;
if(inspection.staging.state==='PAIN_SIGNAL_CONFIRMED'){
 identity=extractSuppliedFirstPartyIdentity(inspection.observation.suppliedHtml??'');
 enrichment=await createPainFirstLiveIdentityEnricher()(accepted,inspection,identity);
 write(`candidate-${index}-identity.json`,{identity,enrichment});
}
const result={index,name:item.name,url:item.url,pageState:inspection.pageState,httpResultClass:inspection.observation.httpResultClass,title:inspection.observation.boundedTitle,h1:inspection.observation.boundedH1,qualification:inspection.staging.state,identity:enrichment?.finalIdentity.state??null,enrichment:enrichment?.outcome??null};
write(`candidate-${index}-result.json`,result);
if(enrichment?.finalIdentity.state==='IDENTITY_STRONG')write('qualification-ready.json',result);
else write(`candidate-${index}-disposition.json`,{...result,admission:'NOT_PERFORMED',reason:inspection.staging.state==='PAIN_SIGNAL_CONFIRMED'?enrichment.finalIdentity.state:inspection.staging.state==='FETCH_FAILED'?inspection.observation.httpResultClass:inspection.staging.state});
console.log(JSON.stringify(result));
