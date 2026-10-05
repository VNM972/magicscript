import fs from 'node:fs';
import assert from 'node:assert/strict';
import {intakeManualPainFirstUrls} from '../core/research/manual-pain-first-intake.ts';
import {acceptPainFirstSearchCandidate,stagePainFirstSuppliedPage} from '../core/research/pain-first-staging.ts';
import {createPainFirstLiveHomepageInspector,createPainFirstLiveIdentityEnricher} from '../core/research/pain-first-homepage-transport.ts';
import {extractSuppliedFirstPartyIdentity} from '../core/research/website-seed.ts';
const dir='.r75z-continuation2-runtime/';
const write=(n:string,v:unknown)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
assert(!fs.existsSync(dir+'replacement-invocation.json'),'REPLACEMENT_ALREADY_CONSUMED');
const intake=intakeManualPainFirstUrls([{conditionClass:'SITE_UNDER_CONSTRUCTION',urlsText:'https://evasionnautique972.com/'}],new Date().toISOString());
assert.equal(intake.acceptedCount,1);
write('replacement-candidate.json',{name:'Evasion Nautique 972',source:'https://evasionnautique972.com/',selection:'One distinct local consumer-facing nautical rental business; public search title Site en construction; metadata non-authoritative',intake});
const candidate=intake.candidates[0];const accepted=acceptPainFirstSearchCandidate(candidate);
assert.equal(accepted.state,'URL_ACCEPTED');if(accepted.state!=='URL_ACCEPTED')throw new Error('REJECTED');
write('replacement-invocation.json',{startedAt:new Date().toISOString(),invocations:1,retries:0});
const inspection=await createPainFirstLiveHomepageInspector()(accepted);
write('replacement-inspection.json',inspection);
let identity:any=null,enrichment:any=null,staging:any=inspection.staging;
if(inspection.staging.state==='PAIN_SIGNAL_CONFIRMED'){
  staging=stagePainFirstSuppliedPage(candidate,inspection.observation);
  identity=extractSuppliedFirstPartyIdentity(inspection.observation.suppliedHtml??'');
  enrichment=await createPainFirstLiveIdentityEnricher()(accepted,inspection,identity);
  write('replacement-identity.json',{staging,identity,enrichment});
}
console.log(JSON.stringify({name:'Evasion Nautique 972',pageState:inspection.pageState,httpResultClass:inspection.observation.httpResultClass,title:inspection.observation.boundedTitle,h1:inspection.observation.boundedH1,staging,identity,enrichment}));
