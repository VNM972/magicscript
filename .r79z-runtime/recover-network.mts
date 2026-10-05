import fs from 'node:fs';
import assert from 'node:assert/strict';
import {acceptPainFirstSearchCandidate} from '../core/research/pain-first-staging.ts';
import {createPainFirstLiveHomepageInspector,createPainFirstLiveIdentityEnricher} from '../core/research/pain-first-homepage-transport.ts';
import {extractSuppliedFirstPartyIdentity} from '../core/research/website-seed.ts';
const dir='.r79z-runtime/';
const read=(n:string)=>JSON.parse(fs.readFileSync(dir+n,'utf8'));
const write=(n:string,v:unknown)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
assert.equal(read('candidate-1-result.json').httpResultClass,'NETWORK_ERROR');
assert(!fs.existsSync(dir+'candidate-1-network-recovery-invocation.json'));
const item=read('selection.json').pool[0];
const accepted=acceptPainFirstSearchCandidate(item.candidate);assert.equal(accepted.state,'URL_ACCEPTED');if(accepted.state!=='URL_ACCEPTED')throw new Error('URL_REJECTED');
write('candidate-1-network-recovery-invocation.json',{at:new Date().toISOString(),canonicalInvocation:2,reason:'Initial sandbox TCP EACCES; fresh authorized live inspection',url:item.url});
const inspection=await createPainFirstLiveHomepageInspector()(accepted);
write('candidate-1-network-recovery-inspection.json',inspection);
let identity:any=null,enrichment:any=null;
if(inspection.staging.state==='PAIN_SIGNAL_CONFIRMED'){
 identity=extractSuppliedFirstPartyIdentity(inspection.observation.suppliedHtml??'');
 enrichment=await createPainFirstLiveIdentityEnricher()(accepted,inspection,identity);
 write('candidate-1-network-recovery-identity.json',{identity,enrichment});
}
const result={index:1,name:item.name,url:item.url,canonicalInvocation:2,pageState:inspection.pageState,httpResultClass:inspection.observation.httpResultClass,title:inspection.observation.boundedTitle,h1:inspection.observation.boundedH1,qualification:inspection.staging.state,identity:enrichment?.finalIdentity.state??null,enrichment:enrichment?.outcome??null};
write('candidate-1-network-recovery-result.json',result);
if(enrichment?.finalIdentity.state==='IDENTITY_STRONG')write('qualification-ready.json',result);
console.log(JSON.stringify(result));
