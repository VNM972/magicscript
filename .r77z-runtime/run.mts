import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {preselectPainFirstSearchResults} from '../core/research/manual-pain-first-intake.ts';
import {painFirstQueryPlans,acceptPainFirstSearchCandidate,registryRequestFromIdentity} from '../core/research/pain-first-staging.ts';
import {createPainFirstLiveHomepageInspector,createPainFirstLiveIdentityEnricher} from '../core/research/pain-first-homepage-transport.ts';
import {extractSuppliedFirstPartyIdentity} from '../core/research/website-seed.ts';
const dir='.r77z-runtime/';
const write=(n:string,v:unknown)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
const hash=(v:any)=>createHash('sha256').update(v).digest('hex');
const prior=JSON.parse(fs.readFileSync('.r76z-runtime/preflight.json','utf8'));
const baseline=JSON.parse(fs.readFileSync('.r75z-continuation-runtime/preflight.json','utf8'));
const snapshot=()=>{const db=new DatabaseSync(prior.dbPath,{readOnly:true});try{return Object.fromEntries(Object.keys(baseline.snapshot).map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()]));}finally{db.close();}};
const tracked=()=>hash(execFileSync('git',['diff','--binary'],{maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']}));
const canonical=()=>Object.fromEntries(Object.keys(prior.canonicalFiles).map(p=>[p,hash(fs.readFileSync(p))]));
const verify=()=>{assert.equal(hash(JSON.stringify(snapshot())),prior.d1Sha256,'D1_DRIFT');assert.equal(tracked(),prior.trackedDiffSha256,'TRACKED_DRIFT');assert.deepEqual(canonical(),prior.canonicalFiles,'CANONICAL_DRIFT');};
const queries=[
'"site en construction" "mentions légales" restaurant',
'"site en construction" "contact" "SIRET" salon coiffure',
'intitle:"site en construction" (restaurant OR brasserie OR café OR coiffure OR institut) "contact"',
'"site en cours de refonte" (restaurant OR salon OR gîte OR Martinique) "mentions légales"',
'"site en construction" (restaurant OR coiffure OR beauté) "raison sociale"',
];
// Discovery features only: p=notice plausibility (3 exact heading, 2 copy,
// 1 stale/deep copy); i=registration (3), name/address (2), name only (1).
// l=explicit legal/contact navigation suggestion, c=consumer-facing ICP.
// These values NEVER enter canonical identity, qualification or admission.
const records=[
{name:'Androcam Productions',url:'https://androcam-productions.com/',q:4,p:3,i:3,l:0,c:1,n:1,notice:'Site en cours de refonte',pain:'Exact discovery H1 rebuilding notice',identity:'Stéphane KRAWCZYK; SIRET 51972816600033; Reims address',navigation:'Mentions légales is a button, not an eligible anchor',negative:'Modal/inert identity risk; no eligible-link evidence',source:'https://androcam-productions.com/'},
{name:'Auberge de l’Est à l’Ouest',url:'https://delestalouest.bzh/',q:1,p:2,i:2,l:0,c:1,n:1,notice:'SITE EN CONSTRUCTION',pain:'Discovery reports standalone construction text',identity:'Named restaurant/operator; 29246 Poullaouen address',navigation:'Legal heading on same page, no link demonstrated',negative:'Heading level unknown; Éditeur is not an accepted field label; discovery URL has lang query',source:'https://delestalouest.bzh/?lang=en'},
{name:'Le Wood Maubeuge',url:'https://lewoodmaubeuge.fr/',q:1,p:1,i:2,l:1,c:1,n:1,notice:'Site en construction',pain:'Construction notice in search legal-page excerpt',identity:'SAS CAP FOOD; Mairieux address',navigation:'Real legal page and explicit homepage hyperlink',negative:'Deep/stale notice; Propriétaire label not accepted; no structured operator proof',source:'https://lewoodmaubeuge.fr/mentions-legales/'},
{name:'Restaurant Le Panoramique',url:'https://www.restaurant-panoramique-bugey.fr/',q:1,p:1,i:2,l:1,c:1,n:1,notice:'Site en construction',pain:'Construction text on a service page, heading is service name',identity:'Restaurant name and 01450 Cerdon address',navigation:'Explicit Mentions légales link in page footer',negative:'Notice not title/H1 on discovery page; homepage unknown',source:'https://www.restaurant-panoramique-bugey.fr/la-potence-dans-le-cerdon'},
{name:'FiliFORME Côte Ouest',url:'https://www.filiforme-coteouest.com/index.html',q:4,p:1,i:2,l:1,c:1,n:1,notice:'Site en cours de refonte',pain:'Refonte notice in H6 with decorative hyphens',identity:'Named wellbeing centre; 79000 Niort address',navigation:'Mentions légales shown in footer',negative:'Notice H6 is not canonical title/H1; no labeled identity block demonstrated',source:'https://www.filiforme-coteouest.com/index.html'},
{name:'Palais Impérial',url:'https://www.palaisimperial.fr/',q:1,p:2,i:2,l:1,c:1,n:2,notice:'Site en construction',pain:'Discovery page title includes construction notice',identity:'Named operator; 493357008 registration and Gennevilliers address',navigation:'First-party mentions-legales.html result',negative:'10-year crawl; timeout on legal discovery; heading unknown',source:'https://www.palaisimperial.fr/mentions-legales.html'},
{name:'Islamobile',url:'https://islamobile.fr/',q:2,p:3,i:1,l:1,c:0,n:1,notice:'Site en construction',pain:'Exact discovery H1 construction notice',identity:'Named brand only',navigation:'Accueil, Mentions légales, Contact in discovery menu',negative:'Business activity and legal identity unknown; thin page',source:'https://islamobile.fr/'},
{name:'Thémis Formalités',url:'https://www.themisformalites.fr/',q:1,p:1,i:3,l:1,c:0,n:2,notice:'Site en construction',pain:'Standalone notice above unrelated welcome H1',identity:'SAS Thémis Formalités; RCS 928178631; Chelles address',navigation:'Explicit homepage and Mentions légales links',negative:'B2B outside core ICP; designer/operator distinction; notice not title/H1',source:'https://www.themisformalites.fr/mentions-legales'},
{name:'Emilie Koechlin',url:'https://e.koechlin.koocotte.org/',q:5,p:1,i:1,l:1,c:1,n:2,notice:'Site en construction',pain:'Notice in legal-page quotation',identity:'Named psychologist Strasbourg; ADELI only, not accepted registration',navigation:'First-party legal page discovered',negative:'Gateway failure; subdomain; ADELI not SIRET; deep notice',source:'https://e.koechlin.koocotte.org/mentions-legales/'},
{name:'Le Studio Sport',url:'https://lestudiosport.fr/',q:1,p:1,i:2,l:1,c:1,n:3,notice:'Site en construction',pain:'Old footer construction text persists; homepage discovery now active',identity:'LE STUDIO SPORT; Tours street/address',navigation:'Explicit Contact and Mentions légales links',negative:'Current discovery contradicts title/H1 pain; active 2026 offer; low priority',source:'https://lestudiosport.fr/mentions/'},
];
if(process.argv[2]==='select'){
 assert(!fs.existsSync(dir+'selection.json'),'SELECTION_FROZEN');verify();
 const exclusions=[...prior?JSON.parse(fs.readFileSync('.r76z-runtime/selection.json','utf8')).exclusions:[],...JSON.parse(fs.readFileSync('.r76z-runtime/selection.json','utf8')).hints.map((h:any)=>h.candidate.resultUrl)];
 const ranked=records.map(r=>({...r,score:r.p*r.i*4+r.l*2+r.c*3-r.n*2})).sort((a,b)=>b.score-a.score);
 const acquiredAt=new Date().toISOString();
 const pool=ranked.map((r,index)=>{
  const plan=painFirstQueryPlans().find(p=>p.conditionClass===(r.notice.toLowerCase().includes('refonte')?'SITE_REBUILDING':'SITE_UNDER_CONSTRUCTION'))!;
  const candidate={schemaVersion:1 as const,queryPlanId:plan.planId,conditionClass:plan.conditionClass,providerClass:'MANUAL_OPERATOR_DISCOVERY',providerRunId:'R77Z-bounded-manual-batch',resultUrl:r.url,resultTitle:r.name,resultPosition:index+1,acquiredAt,authority:'NONE' as const};
  // Operator explicitly supplies homepage URLs. Discovery deep URLs are kept
  // separately, never passed to preselection and rewritten by it.
  const result=preselectPainFirstSearchResults([{candidate,noticeText:r.notice,identityHint:r.identity,localityHint:r.identity}],exclusions,1);
  assert.equal(result.candidates.length,1,JSON.stringify(result));
  return {rank:index+1,...r,candidate:result.candidates[0],authority:'NONE'};
 });
 write('preflight.json',{verifiedAt:acquiredAt,dbPath:prior.dbPath,d1Sha256:prior.d1Sha256,trackedDiffSha256:tracked(),canonicalFiles:canonical(),sourcingSha256:hash(fs.readFileSync('core/research/manual-pain-first-intake.ts')),testSha256:hash(fs.readFileSync('core/research/manual-pain-first-intake.test.ts')),sourceChanges:false});
 write('selection.json',{queries,queryCount:5,exclusions,pool,scoreRule:'p*i*4 + explicit navigation suggestion*2 + consumer ICP*3 - negative weight*2',scope:'Discovery-only score; live parser/admission authoritative. No geography authority inferred. Manual batch max10, one homepage per business; no outreach.'});
 console.log(JSON.stringify(pool.map(({rank,name,score})=>({rank,name,score}))));process.exit(0);
}
if(process.argv[2]==='postflight'){verify();write('postflight.json',{verifiedAt:new Date().toISOString(),d1Unchanged:true,trackedDiffUnchanged:true,canonicalFilesUnchanged:true,sourcingUnchanged:true});console.log('POSTFLIGHT=PASS');process.exit(0);}
const index=Number(process.argv[2]);assert(Number.isInteger(index)&&index>=1&&index<=10);
verify();assert(!fs.existsSync(dir+'admitted.json'),'STOP_ADMITTED');assert(!fs.existsSync(dir+'qualification-ready.json'),'QUALIFICATION_REQUIRED');
assert(!fs.existsSync(dir+`candidate-${index}-invocation.json`),'INSPECTION_CONSUMED');
for(let n=1;n<index;n++)assert(fs.existsSync(dir+`candidate-${n}-disposition.json`),'PRIOR_UNRESOLVED');
const item=JSON.parse(fs.readFileSync(dir+'selection.json','utf8')).pool[index-1];
const accepted=acceptPainFirstSearchCandidate(item.candidate);assert.equal(accepted.state,'URL_ACCEPTED');if(accepted.state!=='URL_ACCEPTED')throw new Error('URL_REJECTED');
write(`candidate-${index}-invocation.json`,{name:item.name,url:item.url,startedAt:new Date().toISOString(),homepageInspections:1,retries:0});
const inspection=await createPainFirstLiveHomepageInspector()(accepted);write(`candidate-${index}-inspection.json`,inspection);
let identity:any=null,enrichment:any=null,registryRequest:any=null;
if(inspection.staging.state==='PAIN_SIGNAL_CONFIRMED'){
 identity=extractSuppliedFirstPartyIdentity(inspection.observation.suppliedHtml??'');
 enrichment=await createPainFirstLiveIdentityEnricher()(accepted,inspection,identity);
 if(enrichment.finalIdentity.state==='IDENTITY_STRONG')registryRequest=registryRequestFromIdentity(`r77z-${index}`,new Date().toISOString(),enrichment.finalIdentity.identity);
 write(`candidate-${index}-identity.json`,{identity,enrichment,registryRequest});
}
const result={index,name:item.name,url:item.url,pageState:inspection.pageState,httpResultClass:inspection.observation.httpResultClass,title:inspection.observation.boundedTitle,h1:inspection.observation.boundedH1,qualification:inspection.staging.state,identity:enrichment?.finalIdentity.state??null,enrichment:enrichment?.outcome??null,registryRequest};
write(`candidate-${index}-result.json`,result);
if(registryRequest)write('qualification-ready.json',result);
else write(`candidate-${index}-disposition.json`,{...result,admission:'NOT_PERFORMED',reason:inspection.staging.state==='PAIN_SIGNAL_CONFIRMED'?enrichment.finalIdentity.state:inspection.staging.state==='FETCH_FAILED'?inspection.observation.httpResultClass:inspection.staging.state});
console.log(JSON.stringify(result));
