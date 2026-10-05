import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {intakeManualPainFirstUrls} from '../core/research/manual-pain-first-intake.ts';
import {acceptPainFirstSearchCandidate,registryRequestFromIdentity} from '../core/research/pain-first-staging.ts';
import {createPainFirstLiveHomepageInspector,createPainFirstLiveIdentityEnricher} from '../core/research/pain-first-homepage-transport.ts';
import {extractSuppliedFirstPartyIdentity} from '../core/research/website-seed.ts';
const dir='.r75z-continuation3-runtime/';
const write=(n:string,v:unknown)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
const candidates=[
  {name:'Medi Conciergerie',url:'https://medi-conciergerie.com/',discovery:'https://medi-conciergerie.com/accueil-en-construction/'},
  {name:'LM Charpente',url:'https://lmcharpente.com/',discovery:'https://lmcharpente.com/lm-charpente-en-construction/'},
  {name:'Accent Immo',url:'https://accentimmo.fr/',discovery:'https://accentimmo.fr/'},
  {name:'RB Agency',url:'https://rb-agency.fr/',discovery:'https://rb-agency.fr/fr/'},
  {name:'Chateau de Toulondit',url:'https://www.toulondit.fr/',discovery:'Previously discovered public restaurant result in R75Z continuation 2; not previously canonically inspected; outside Martinique, eligibility remains canonical'},
];
const index=Number(process.argv[2]);assert(Number.isInteger(index)&&index>=1&&index<=5);
assert(!fs.existsSync(dir+'admitted.json'),'STOP_AFTER_ADMISSION');
assert(!fs.existsSync(dir+`candidate-${index}-invocation.json`),'CANDIDATE_ALREADY_CONSUMED');
if(!fs.existsSync(dir+'preflight.json')){
 const prior=JSON.parse(fs.readFileSync('.r75z-continuation-runtime/preflight.json','utf8'));
 const db=new DatabaseSync(prior.dbPath,{readOnly:true});
 const snapshot=Object.fromEntries(Object.keys(prior.snapshot).map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()]));db.close();
 assert.equal(JSON.stringify(snapshot),JSON.stringify(prior.snapshot),'D1 baseline drift');
 write('preflight.json',{verifiedAt:new Date().toISOString(),dbPath:prior.dbPath,d1Sha256:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),trackedDiffSha256:createHash('sha256').update(execFileSync('git',['diff','--binary'],{maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']})).digest('hex')});
 write('selection.json',{candidates,excluded:['Villa Ancinel','Zakari','Evasion Nautique 972'],sourcePriorityCheck:'89 stored non-null websites; only Villa had a construction/refonte friction. Bounded existing artifacts also Villa. No new eligible candidate selected from those records.',queries:['"site en construction" Martinique','"site en cours de refonte" Martinique','"Martinique" "site en construction" (restaurant OR salon OR artisan OR location) -zakari -evasionnautique972 -villa-ancinel'],queryCount:3});
}
for(let n=1;n<index;n++)assert(fs.existsSync(dir+`candidate-${n}-disposition.json`),'PRIOR_CANDIDATE_NOT_DISPOSED');
const item=candidates[index-1];
const intake=intakeManualPainFirstUrls([{conditionClass:'SITE_UNDER_CONSTRUCTION',urlsText:item.url}],new Date().toISOString());assert.equal(intake.acceptedCount,1);
const candidate=intake.candidates[0];const accepted=acceptPainFirstSearchCandidate(candidate);assert.equal(accepted.state,'URL_ACCEPTED');if(accepted.state!=='URL_ACCEPTED')throw new Error('URL_REJECTED');
write(`candidate-${index}-invocation.json`,{...item,candidate,startedAt:new Date().toISOString(),homepageInspections:1,environmentRetries:0,environment:'Known unrestricted native HTTPS execution'});
const inspection=await createPainFirstLiveHomepageInspector()(accepted);write(`candidate-${index}-inspection.json`,inspection);
let identity:any=null,enrichment:any=null,registryRequest:any=null;
if(inspection.staging.state==='PAIN_SIGNAL_CONFIRMED'){
 identity=extractSuppliedFirstPartyIdentity(inspection.observation.suppliedHtml??'');
 enrichment=await createPainFirstLiveIdentityEnricher()(accepted,inspection,identity);
 if(enrichment.finalIdentity.state==='IDENTITY_STRONG')registryRequest=registryRequestFromIdentity(`r75z3-${index}`,new Date().toISOString(),enrichment.finalIdentity.identity);
 write(`candidate-${index}-identity.json`,{identity,enrichment,registryRequest});
}
const result={index,...item,pageState:inspection.pageState,httpResultClass:inspection.observation.httpResultClass,title:inspection.observation.boundedTitle,h1:inspection.observation.boundedH1,qualification:inspection.staging.state,identity:enrichment?.finalIdentity.state??null,enrichment:enrichment?.outcome??null,registryRequest};
write(`candidate-${index}-result.json`,result);
if(inspection.staging.state!=='PAIN_SIGNAL_CONFIRMED'||(enrichment&&enrichment.finalIdentity.state!=='IDENTITY_STRONG'))write(`candidate-${index}-disposition.json`,{...result,admission:'NOT_PERFORMED',reason:inspection.staging.state==='PAIN_SIGNAL_CONFIRMED'?enrichment.finalIdentity.state:inspection.staging.state==='FETCH_FAILED'?inspection.observation.httpResultClass:inspection.staging.state});
console.log(JSON.stringify(result));
