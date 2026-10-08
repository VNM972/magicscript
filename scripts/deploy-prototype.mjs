import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { setTimeout as delay } from 'node:timers/promises';

const token = process.env.NETLIFY_AUTH_TOKEN?.trim();
const redact = (value) => token ? String(value).split(token).join('<redacted>') : String(value);
const log = (value) => console.log(redact(value));
const api = 'https://api.netlify.com/api/v1';

async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body}`);
  return JSON.parse(body);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Classic ZIP: native compression, UTF-8 paths, no temporary archive or dependency.
async function zipDirectory(root) {
  const local = [], central = [];
  let offset = 0, count = 0;
  async function walk(dir, prefix = '') {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name), relative = `${prefix}${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symlink refused: ${relative}`);
      if (entry.isDirectory()) { await walk(path, `${relative}/`); continue; }
      if (!entry.isFile()) throw new Error(`Unsupported entry: ${relative}`);
      const name = Buffer.from(relative), data = await readFile(path), compressed = deflateRawSync(data);
      if (++count > 65535 || name.length > 65535 || data.length > 0xffffffff ||
          offset + 30 + name.length + compressed.length > 0xffffffff) throw new Error('ZIP64 required; archive too large');
      const crc = crc32(data), header = Buffer.alloc(30), record = Buffer.alloc(46);
      header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
      header.writeUInt16LE(0x0800, 6); header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12);
      header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18);
      header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
      record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6);
      record.writeUInt16LE(0x0800, 8); record.writeUInt16LE(8, 10); record.writeUInt16LE(33, 14);
      record.writeUInt32LE(crc, 16); record.writeUInt32LE(compressed.length, 20);
      record.writeUInt32LE(data.length, 24); record.writeUInt16LE(name.length, 28);
      record.writeUInt32LE(offset, 42);
      local.push(header, name, compressed); central.push(record, name);
      offset += header.length + name.length + compressed.length;
    }
  }
  await walk(root);
  if (!count) throw new Error('out/ is empty');
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

try {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/deploy-prototype.mjs <prototype-folder>');
  if (!token) throw new Error('NETLIFY_AUTH_TOKEN is required');
  const prototype = resolve(process.argv[2]), out = join(prototype, 'out');
  if (!(await stat(join(out, 'index.html'))).isFile()) throw new Error('out/index.html is required');
  const archive = await zipDirectory(out), link = join(prototype, '.netlify-site-id');
  let siteId;
  try { siteId = (await readFile(link, 'utf8')).trim(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (siteId !== undefined && !/^[a-f0-9-]{36}$/i.test(siteId)) throw new Error('Invalid .netlify-site-id');
  if (siteId === undefined) {
    const site = await request('/sites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!site.id) throw new Error('Site creation returned no id');
    siteId = site.id;
    await writeFile(link, `${siteId}\n`, { flag: 'wx' });
    log(`Created Netlify site ${siteId}`);
  } else log(`Reusing Netlify site ${siteId}`);
  log(`Uploading out/ (${archive.length} ZIP bytes)`);
  let deploy = await request(`/sites/${encodeURIComponent(siteId)}/deploys`, {
    method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: archive,
  });
  if (!deploy.id) throw new Error('Deployment returned no id');
  const deployId = deploy.id, deadline = Date.now() + 120_000;
  const saveResult = () => writeFile(join(prototype, '.deploy-result.json'), JSON.stringify({
    site_id: siteId, deploy_id: deployId,
    url: deploy.ssl_url || deploy.url || deploy.deploy_ssl_url || deploy.deploy_url || null,
    deployed_at: deploy.published_at || (deploy.state === 'ready' ? new Date().toISOString() : null),
    status: deploy.state,
  }, null, 2) + '\n');
  await saveResult();
  // Poll asynchronous state; failed HTTP requests are never retried.
  while (deploy.state !== 'ready') {
    if (['error', 'rejected', 'canceled'].includes(deploy.state)) throw new Error(`Deploy ${deployId}: ${deploy.state} ${deploy.error_message || ''}`);
    if (Date.now() >= deadline) throw new Error(`Deploy ${deployId} readiness timeout (${deploy.state})`);
    await delay(2_000);
    deploy = await request(`/deploys/${encodeURIComponent(deployId)}`);
    await saveResult();
  }
  const url = deploy.ssl_url || deploy.url || deploy.deploy_ssl_url || deploy.deploy_url;
  if (!url) throw new Error('Ready deployment returned no URL');
  log(`Netlify deploy READY: ${url}`);
} catch (error) {
  console.error(redact(`Netlify deploy failed: ${error.message || error}`));
  process.exitCode = 1;
}
