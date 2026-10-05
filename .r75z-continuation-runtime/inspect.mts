import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {acceptPainFirstSearchCandidate} from '../core/research/pain-first-staging.ts';
import {createPainFirstLiveHomepageInspector} from '../core/research/pain-first-homepage-transport.ts';
const runtime = path.resolve('.r75z-continuation-runtime');
const write = (name:string,value:unknown) => fs.writeFileSync(path.join(runtime,name),JSON.stringify(value,null,2)+'\n');
assert(!fs.existsSync(path.join(runtime,'inspection-invocation.json')), 'R75Z continuation retry consumed');
const previous = JSON.parse(fs.readFileSync('.r75z-runtime/candidate.json','utf8'));
const candidate = {...previous.candidate,providerRunId:'R75Z-continuation-Zakari',acquiredAt:new Date().toISOString()};
const accepted = acceptPainFirstSearchCandidate(candidate);
assert.equal(accepted.state,'URL_ACCEPTED');
if (accepted.state !== 'URL_ACCEPTED') throw new Error('URL_REJECTED');
const diagnostics:unknown[] = [];
const inspector = createPainFirstLiveHomepageInspector({
  resolveHost: async (hostname, options) => {
    try { const answers = await lookup(hostname,options); diagnostics.push({stage:'DNS',hostname,answers}); return answers; }
    catch (e:any) { diagnostics.push({stage:'DNS',name:e.name,code:e.code,message:e.message}); throw e; }
  },
  httpsRequest: (options, response) => {
    diagnostics.push({stage:'HTTPS_REQUEST',hostname:options.hostname,port:options.port,path:options.path,family:options.family,autoSelectFamily:options.autoSelectFamily});
    const request = https.request(options,message => {
      diagnostics.push({stage:'HTTP_RESPONSE',status:message.statusCode,contentType:message.headers['content-type']});
      response(message);
    });
    request.once('socket',socket => { socket.once('secureConnect',()=>diagnostics.push({stage:'TLS',authorized:(socket as any).authorized,protocol:(socket as any).getProtocol?.()})); });
    request.once('error',(e:any)=>diagnostics.push({stage:'HTTPS_ERROR',name:e.name,code:e.code,syscall:e.syscall,address:e.address,port:e.port,message:e.message}));
    return request;
  }
});
write('inspection-invocation.json',{startedAt:new Date().toISOString(),canonicalEntryPoint:'createPainFirstLiveHomepageInspector',homepage:accepted.homepageUrl,sourceUrl:'https://www.zakari.fr/site-en-construction',invocations:1,canonicalFetchRetryCount:1,additionalRetries:0,environmentAction:'Run native canonical inspection outside restricted execution sandbox; no transport overrides beyond native diagnostic listeners'});
const result = await inspector(accepted);
write('inspection.json',result);
write('transport-diagnostics.json',diagnostics);
console.log(JSON.stringify({pageState:result.pageState,httpResultClass:result.observation.httpResultClass,title:result.observation.boundedTitle,h1:result.observation.boundedH1,staging:result.staging,diagnostics}));
