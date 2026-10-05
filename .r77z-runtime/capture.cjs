const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {DatabaseSync} = require('node:sqlite');
const {startPreviewServer} = require('../scripts/local-preview-server.cjs');
const {findChrome,launchBrowser,CdpConnection,evaluate,waitForCondition,closeBrowser} = require('../scripts/qa-surface.cjs');
const attempt=Number(process.argv[2]);assert([1,2].includes(attempt));const evidenceDir=path.join(__dirname,'qa-a'+attempt);fs.mkdirSync(evidenceDir,{recursive:true});assert(!fs.existsSync(path.join(evidenceDir,'capture-invocation.json')),'CAPTURE_CONSUMED');fs.writeFileSync(path.join(evidenceDir,'capture-invocation.json'),JSON.stringify({startedAt:new Date().toISOString(),attempt,realInvocations:1}));
const baseline={build:JSON.parse(fs.readFileSync(path.join(__dirname,'build-r'+attempt+'.json'),'utf8'))};
async function main() {
  const preview=await startPreviewServer({root:baseline.build.outputPath,preferredPort:0});
  let browser,controller,cdp;
  try {
    const rootResponse=await fetch(`${preview.url}/`); assert.equal(rootResponse.status,200);
    const executable=findChrome(); browser=await launchBrowser(executable);
    controller=new CdpConnection(browser.version.webSocketDebuggerUrl); await controller.ready;
    const target=await controller.send('Target.createTarget',{url:'about:blank'});
    const targets=await (await fetch(`http://127.0.0.1:${browser.debuggingPort}/json/list`)).json();
    const page=targets.find(t=>t.id===target.targetId); assert(page?.webSocketDebuggerUrl);
    cdp=new CdpConnection(page.webSocketDebuggerUrl); await cdp.ready;
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Log.enable'); await cdp.send('Network.enable');
    const captures=[];
    const definitions=[{name:'DESKTOP',width:1440,height:900},{name:'MOBILE',width:390,height:844}];
    for(const viewport of definitions) {
      const errors=[]; const network=[];
      const off=[cdp.on('Runtime.exceptionThrown',e=>errors.push(e.params.exceptionDetails.exception?.description||e.params.exceptionDetails.text)),cdp.on('Runtime.consoleAPICalled',e=>{if(e.params.type==='error')errors.push(e.params.args.map(a=>a.value??a.description??'').join(' '));}),cdp.on('Log.entryAdded',e=>{if(e.params.entry.level==='error')errors.push(e.params.entry.text);}),cdp.on('Network.responseReceived',e=>network.push({url:e.params.response.url,status:e.params.response.status,type:e.params.type})),cdp.on('Network.loadingFailed',e=>errors.push(`Network failure: ${e.params.errorText}`))];
      await cdp.send('Emulation.setDeviceMetricsOverride',{width:viewport.width,height:viewport.height,deviceScaleFactor:1,mobile:false,screenWidth:viewport.width,screenHeight:viewport.height});
      const loaded=cdp.waitFor('Page.loadEventFired'); await cdp.send('Page.navigate',{url:`${preview.url}/`}); await loaded;
      await waitForCondition(cdp,undefined,'document.readyState === "complete" && !!document.body && document.body.innerText.trim().length > 0');
      await evaluate(cdp,undefined,'document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))');
      const dom=await evaluate(cdp,undefined,`(() => {
        const box=e=>{if(!e)return null; const r=e.getBoundingClientRect();const s=getComputedStyle(e);return {tag:e.tagName,text:e.innerText?.trim()||'',left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,display:s.display,visibility:s.visibility,opacity:s.opacity};};
        const displayed=b=>b&&b.display!=='none'&&b.visibility!=='hidden'&&Number(b.opacity)>0&&b.width>0&&b.height>0;
        const visible=b=>!!(displayed(b)&&b.right>0&&b.left<innerWidth&&b.bottom>0&&b.top<innerHeight);
        const hero=box(document.querySelector('.hero'));const cta=box(document.querySelector('.hero .cta-primary'));
        const controls=[...document.querySelectorAll('a,button,input,textarea,form')].filter(e=>!e.matches('[aria-hidden="true"]')).map(box);
        const sections=[...document.querySelectorAll('main section')].map(e=>({id:e.id,approvedSection:e.dataset.approvedSection||null,className:e.className,box:box(e)}));
        const observedSections=sections.filter(s=>displayed(s.box)).map(s=>s.approvedSection||s.id||(s.className.split(/\\s+/).includes('hero')?'hero':s.className));
        const text=document.body.innerText;
        const markers=[...new Set(text.match(/lorem ipsum|{{|}}|<%|\\bdebug\\b/gi)||[])];
        const links=[...document.querySelectorAll('a[href]')].map(a=>({href:a.getAttribute('href'),targetExists:!a.hash||!!document.getElementById(decodeURIComponent(a.hash.slice(1)))}));
        const assets=[...document.querySelectorAll('img')].map(e=>({url:e.currentSrc||e.src,complete:e.complete,naturalWidth:e.naturalWidth}));
        return {url:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight,deviceScaleFactor:devicePixelRatio},bodyText:text,hero,primaryCta:cta,controls,sections,links,assets,view:{horizontalOverflow:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-innerWidth,heroVisible:visible(hero),primaryCtaVisible:visible(cta),contentVisible:text.trim().length>=40,controlsWithinViewport:controls.every(b=>!displayed(b)||(b.left>=-1&&b.right<=innerWidth+1))},observedSections,headings:[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(e=>e.tagName.toLowerCase()+' '+e.innerText.trim()),internalLinkErrors:links.filter(l=>!l.targetExists).map(l=>l.href),unresolvedMarkers:markers,brokenAssets:assets.filter(a=>!a.complete||a.naturalWidth===0).map(a=>a.url)};
      })()`);
      assert.equal(dom.viewport.width,viewport.width);assert.equal(dom.viewport.height,viewport.height);assert.equal(dom.viewport.deviceScaleFactor,1);assert.equal(dom.url,`${preview.url}/`);
      const screenshot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
      const screenshotPath=path.join(evidenceDir,`${viewport.name.toLowerCase()}.png`); fs.writeFileSync(screenshotPath,Buffer.from(screenshot.data,'base64'));
      for(const unsubscribe of off)unsubscribe();
      const capture={id:`r77z-androcam-${viewport.name.toLowerCase()}`,captureSuccess:true,capturedAt:new Date().toISOString(),definition:{...viewport,deviceScaleFactor:1,mobile:false},renderedUrl:dom.url,screenshotPath,dom,consoleErrors:[...new Set(errors)],network};
      fs.writeFileSync(path.join(evidenceDir,`${viewport.name.toLowerCase()}-dom.json`),JSON.stringify(capture,null,2)+'\n');captures.push(capture);
    }
    const union=field=>[...new Set(captures.flatMap(c=>c.dom[field]))];
    const evidence={viewports:captures.map(c=>({name:c.definition.name,width:c.definition.width,height:c.definition.height,...c.dom.view})),observedSections:union('observedSections'),brokenAssets:union('brokenAssets'),internalLinkErrors:union('internalLinkErrors'),consoleErrors:[...new Set(captures.flatMap(c=>c.consoleErrors))],unresolvedMarkers:union('unresolvedMarkers'),headings:captures[0].dom.headings};
    fs.writeFileSync(path.join(evidenceDir,'browser-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
    const result={browserExecutable:executable,browserVersion:browser.version.Browser,protocolVersion:browser.version['Protocol-Version'],localServeUrl:preview.url,previewRoot:preview.root,rootHttpStatus:rootResponse.status,captures:captures.map(({dom,network,consoleErrors,...c})=>c),evidence,serverTerminated:true,browserTerminated:true};
    fs.writeFileSync(path.join(evidenceDir,'capture-result.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({browserVersion:result.browserVersion,attempt,buildId:baseline.build.id,evidence:result.evidence}));
  } finally {
    if(cdp){try{await cdp.send('Page.close');}catch{}cdp.close();}
    if(controller)controller.close();await closeBrowser(browser);await preview.close();
  }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
