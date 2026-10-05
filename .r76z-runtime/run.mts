import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {preselectPainFirstSearchResults} from '../core/research/manual-pain-first-intake.ts';
import {painFirstQueryPlans,acceptPainFirstSearchCandidate,registryRequestFromIdentity} from '../core/research/pain-first-staging.ts';
import {createPainFirstLiveHomepageInspector,createPainFirstLiveIdentityEnricher} from '../core/research/pain-first-homepage-transport.ts';
import {extractSuppliedFirstPartyIdentity} from '../core/research/website-seed.ts';
const dir='.r76z-runtime/';
const write=(n:string,v:unknown)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
const prior=JSON.parse(fs.readFileSync('.r75z-continuation3-runtime/preflight.json','utf8'));
const old=JSON.parse(fs.readFileSync('.r75z-continuation-runtime/preflight.json','utf8'));
const hash=(x:any)=>createHash('sha256').update(x).digest('hex');
const exclusions=['https://villa-ancinel.com/','https://www.zakari.fr/','https://evasionnautique972.com/',...JSON.parse(fs.readFileSync('.r75z-continuation3-runtime/selection.json','utf8')).candidates.map((x:any)=>x.url)];
const queries=['intitle:"site en construction" Martinique -site:zakari.fr -site:evasionnautique972.com -site:accentimmo.fr -site:rb-agency.fr -site:medi-conciergerie.com -site:lmcharpente.com','intitle:"site en cours de refonte" Martinique -site:villa-ancinel.com','"site en construction" "SIRET" restaurant'];
const records=[
 ['PAGD Bâtiment','https://www.pagd.fr/','Site en construction','SIRET 379 216 526 000 28','75017 PARIS'],
 ['Amel Martin Photographe','https://amelmartin.com/','SITE EN CONSTRUCTION','SIRET: 87829394300022',''],
 ['NAJMUDDIN directory','https://app.dataprospects.fr/entreprises/NAJMUDDIN/902475227','Entreprise NAJMUDDIN à LYON (69001)','90247522700028','LYON'],
 ['CHA Consultant','https://www.chaconsultant.fr/','CHA CONSULTANT','998 969 067 00011','MONTAGNOLE'],
 ['Psychologue Voiron','https://www.psychologuevoiron.fr/',"... SITE EN CONSTRUCTION d'autres infos à venir...",'92303637000016','Voiron'],
 ['EARL des Borderies','https://www.earl-des-borderies.fr/','EARL DES BORDERIES','801.739.244.00011','Bussière-Poitevine'],
 ['Imprimerie Marcos','https://www.imprimerie-marcos.fr/',"Nos presses s'activent — Site en construction",'','Anglet'],
 ['Chatterie L’écume bleue','https://lecumebleue.elevage-familial.com/','Accueil','820.804.995.00018','Le Mans'],
];
if(!fs.existsSync(dir+'selection.json')){
 const plan=painFirstQueryPlans()[0];const acquiredAt=new Date().toISOString();
 const hints=records.map(([name,url,noticeText,identityHint,localityHint],i)=>({candidate:{schemaVersion:1 as const,queryPlanId:plan.planId,conditionClass:plan.conditionClass,providerClass:'MANUAL_BROWSER_SEARCH',providerRunId:'R76Z-query-3',resultUrl:url,resultTitle:name,resultPosition:i+1,acquiredAt,authority:'NONE' as const},noticeText,identityHint,localityHint}));
 const selection=preselectPainFirstSearchResults(hints,exclusions,5);
 write('selection.json',{queries,queryCount:3,query1And2:'No returned result had a matching notice hint; no homepage inspection triggered',geography:'First two queries Martinique; third has no geography filter. No location or ICP authority inferred from metadata.',hints,exclusions,selection});
 const db=new DatabaseSync(prior.dbPath,{readOnly:true});const snapshot=Object.fromEntries(Object.keys(old.snapshot).map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()]));db.close();
 assert.equal(hash(JSON.stringify(snapshot)),prior.d1Sha256);
 write('preflight.json',{verifiedAt:acquiredAt,dbPath:prior.dbPath,d1Sha256:hash(JSON.stringify(snapshot)),trackedDiffSha256:hash(execFileSync('git',['diff','--binary'],{maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']})),canonicalFiles:Object.fromEntries(['core/research/pain-first-homepage-transport.ts','core/research/pain-first-homepage-network.ts','core/research/pain-first-staging.ts','core/research/website-seed.ts','core/research/digital-pain-evidence.ts','core/admission/pain-first-agent1-projection.ts','core/admission/v2-admission.ts'].map(p=>[p,hash(fs.readFileSync(p))]))});
}
const selection=JSON.parse(fs.readFileSync(dir+'selection.json','utf8')).selection;
if(process.argv[2]==='select'){console.log(JSON.stringify(selection));process.exit(0);}
const index=Number(process.argv[2]);assert(Number.isInteger(index)&&index>=1&&index<=selection.candidates.length&&index<=5);
assert(!fs.existsSync(dir+'admitted.json'),'ADMITTED_STOP');
assert(!fs.existsSync(dir+`candidate-${index}-invocation.json`),'CONSUMED');
for(let n=1;n<index;n++)assert(fs.existsSync(dir+`candidate-${n}-disposition.json`),'PRIOR_CANDIDATE_UNRESOLVED');
const candidate=selection.candidates[index-1];const accepted=acceptPainFirstSearchCandidate(candidate);assert.equal(accepted.state,'URL_ACCEPTED');if(accepted.state!=='URL_ACCEPTED')throw new Error('REJECTED');
write(`candidate-${index}-invocation.json`,{candidate,startedAt:new Date().toISOString(),requests:1,retries:0});
const inspection=await createPainFirstLiveHomepageInspector()(accepted);write(`candidate-${index}-inspection.json`,inspection);
let identity:any=null,enrichment:any=null,registryRequest:any=null;
if(inspection.staging.state==='PAIN_SIGNAL_CONFIRMED'){
 identity=extractSuppliedFirstPartyIdentity(inspection.observation.suppliedHtml??'');
 enrichment=await createPainFirstLiveIdentityEnricher()(accepted,inspection,identity);
 if(enrichment.finalIdentity.state==='IDENTITY_STRONG')registryRequest=registryRequestFromIdentity(`r76z-${index}`,new Date().toISOString(),enrichment.finalIdentity.identity);
 write(`candidate-${index}-identity.json`,{identity,enrichment,registryRequest});
}
const result={name:candidate.resultTitle,url:candidate.resultUrl,pageState:inspection.pageState,httpResultClass:inspection.observation.httpResultClass,title:inspection.observation.boundedTitle,h1:inspection.observation.boundedH1,qualification:inspection.staging.state,identity:enrichment?.finalIdentity.state??null,enrichment:enrichment?.outcome??null,registryRequest};
write(`candidate-${index}-result.json`,result);
if(inspection.staging.state!=='PAIN_SIGNAL_CONFIRMED'||enrichment?.finalIdentity.state!=='IDENTITY_STRONG')write(`candidate-${index}-disposition.json`,{...result,admission:'NOT_PERFORMED'});
console.log(JSON.stringify(result));
