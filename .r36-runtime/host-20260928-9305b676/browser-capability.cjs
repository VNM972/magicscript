const fs = require('node:fs');
const qa = require('../../scripts/qa-surface.cjs');
(async () => {
  let browser;
  try {
    browser = await qa.launchBrowser(qa.findChrome());
    fs.writeFileSync(`${process.env.R36_ROOT}/browser-capability.json`, JSON.stringify({ pass: true, browser: browser.version.Browser, ownedPid: browser.child.pid, cdp: true }));
    console.log('BROWSER_CDP_CAPABILITY=PASS');
  } finally {
    if (browser) await qa.closeBrowser(browser);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
