const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const dns = require('node:dns/promises');
const net = require('node:net');
const {DatabaseSync} = require('node:sqlite');
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
(async () => {
  const previous = JSON.parse(fs.readFileSync('.r75z-runtime/preflight.json', 'utf8'));
  const db = new DatabaseSync(previous.dbPath, {readOnly:true});
  const snapshot = {};
  try { for (const table of Object.keys(previous.snapshot)) snapshot[table] = db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all(); }
  finally { db.close(); }
  assert.equal(JSON.stringify(snapshot), JSON.stringify(previous.snapshot), 'R75Z canonical state drift');
  const diff = execFileSync('git', ['diff','--binary'], {maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']});
  const sha = createHash('sha256').update(diff).digest('hex');
  assert.equal(sha, previous.trackedDiffSha256, 'Tracked diff drift');
  const record = {verifiedAt:new Date().toISOString(),dbPath:previous.dbPath,snapshot,trackedDiffSha256:sha,canonicalStateUnchanged:true};
  fs.writeFileSync(path.join(__dirname,'preflight.json'), JSON.stringify(record,null,2)+'\n');
  const answers = await dns.lookup('www.zakari.fr',{all:true,verbatim:true});
  const selected = answers[0];
  const tcp = await new Promise(resolve => {
    const socket = net.connect({host:selected.address,port:443,family:selected.family,autoSelectFamily:false});
    socket.setTimeout(5000);
    socket.once('connect',()=>{resolve({state:'CONNECTED'});socket.destroy();});
    socket.once('error',e=>resolve({state:'FAILED',name:e.name,code:e.code,syscall:e.syscall,address:e.address,port:e.port,message:e.message}));
    socket.once('timeout',()=>{resolve({state:'TIMEOUT'});socket.destroy();});
  });
  const probe = {at:new Date().toISOString(),hostname:'www.zakari.fr',answers,selected,tcp,httpRequests:0,tlsRequests:0,canonicalInspections:0};
  fs.writeFileSync(path.join(__dirname,'transport-probe.json'),JSON.stringify(probe,null,2)+'\n');
  console.log(JSON.stringify({canonicalStateUnchanged:true,trackedDiffUnchanged:true,...probe}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
