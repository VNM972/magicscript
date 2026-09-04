'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const LOOPBACK_HOST = '127.0.0.1';
const HEALTH_PATH = '/_local-preview/health';
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function assertPreviewRoot(previewRoot) {
  const root = path.resolve(previewRoot);
  const stat = fs.statSync(root, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) {
    const error = new Error(`Preview root is not a directory: ${root}`);
    error.code = 'PREVIEW_ROOT_MISSING';
    throw error;
  }
  return root;
}

function isWithinRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function decodeRequestPath(requestUrl) {
  const rawPath = String(requestUrl || '/').split('?', 1)[0];
  try {
    return decodeURIComponent(rawPath);
  } catch {
    const error = new Error('Malformed URL encoding');
    error.code = 'MALFORMED_PATH';
    throw error;
  }
}

function isPersonalizedDocumentRoute(pathname) {
  return /^\/(?:p|demo|prototype)\/[^/.]+\/?$/.test(pathname);
}

function resolvePreviewPath(previewRoot, requestUrl) {
  const root = assertPreviewRoot(previewRoot);
  const pathname = decodeRequestPath(requestUrl);
  const isPersonalizedRoute = pathname === '/p' || pathname === '/demo' || pathname === '/prototype' || isPersonalizedDocumentRoute(pathname);
  const relativePath = pathname === '/' || isPersonalizedRoute
    ? 'index.html'
    : pathname.replace(/^[/\\]+/, '');
  const candidate = path.resolve(root, relativePath);
  if (!isWithinRoot(root, candidate)) {
    const error = new Error('Path is outside the preview root');
    error.code = 'PATH_TRAVERSAL';
    throw error;
  }
  return candidate;
}

function localPathToRoute(previewRoot, localPath) {
  const root = assertPreviewRoot(previewRoot);
  const candidate = path.resolve(localPath);
  if (!isWithinRoot(root, candidate)) {
    const error = new Error('Local path is outside the preview root');
    error.code = 'PATH_OUTSIDE_PREVIEW';
    throw error;
  }
  const relative = path.relative(root, candidate).split(path.sep).join('/');
  return relative ? `/${relative}` : '/';
}

function toLocalPreviewUrl({ port, pathname = '' } = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError('A valid local preview port is required');
  }
  if (pathname.includes('://') || (pathname && !pathname.startsWith('/'))) {
    throw new TypeError('Preview pathname must be local and absolute');
  }
  return `http://${LOOPBACK_HOST}:${port}${pathname}`;
}

function localPathToUrl(previewRoot, localPath, port) {
  return toLocalPreviewUrl({ port, pathname: localPathToRoute(previewRoot, localPath) });
}

function openLocalPreview(url, spawnProcess = spawn) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' || parsed.hostname !== LOOPBACK_HOST) {
    throw new Error('Only loopback preview URLs can be opened automatically');
  }
  if (process.platform === 'win32') {
    const child = spawnProcess('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Start-Process', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref?.();
    return;
  }
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawnProcess(command, [url], { detached: true, stdio: 'ignore' });
  child.unref?.();
}

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, body) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  });
}

function createPreviewServer(previewRoot) {
  const root = assertPreviewRoot(previewRoot);
  return http.createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeRequestPath(request.url);
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error.message);
      return;
    }

    if (pathname === HEALTH_PATH) {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ ok: true, service: 'magic-script-local-preview' }));
      return;
    }

    let filePath;
    try {
      filePath = resolvePreviewPath(root, request.url);
    } catch (error) {
      response.writeHead(error.code === 'PATH_TRAVERSAL' ? 403 : 400, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error.message);
      return;
    }
    sendFile(response, filePath);
  });
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(server.address().port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, LOOPBACK_HOST);
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function httpHealthCheck(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      response.resume();
      if (response.statusCode !== 200) {
        reject(new Error(`Preview health check returned HTTP ${response.statusCode}`));
        return;
      }
      resolve();
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('Preview health check timed out')));
    request.on('error', reject);
  });
}

async function startPreviewServer({ root, preferredPort = 4173, healthCheck = httpHealthCheck } = {}) {
  const previewRoot = assertPreviewRoot(root);
  const server = createPreviewServer(previewRoot);
  let port;
  try {
    port = await listen(server, preferredPort);
  } catch (error) {
    if (error.code !== 'EADDRINUSE') {
      await closeServer(server).catch(() => {});
      throw error;
    }
    port = await listen(server, 0);
  }

  const url = toLocalPreviewUrl({ port });
  const healthUrl = toLocalPreviewUrl({ port, pathname: HEALTH_PATH });
  try {
    await healthCheck(healthUrl);
  } catch (error) {
    await closeServer(server).catch(() => {});
    throw error;
  }
  return {
    root: previewRoot,
    port,
    url,
    healthUrl,
    server,
    close: () => closeServer(server),
  };
}

function parseArgs(argv) {
  const args = { root: path.resolve(process.cwd(), 'sites/magicscript-v2/public'), preferredPort: 4173 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--root') args.root = path.resolve(argv[++index]);
    else if (value === '--port') args.preferredPort = Number(argv[++index]);
    else if (value === '--open') args.open = true;
    else if (value === '--no-open') args.open = false;
    else if (value === '--help') args.help = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/local-preview-server.cjs [--root <directory>] [--port <port>]');
    return;
  }
  const preview = await startPreviewServer(args);
  console.log(`LOCAL_PREVIEW_URL=${preview.url}`);
  console.log(`LOCAL_PREVIEW_HEALTH=${preview.healthUrl}`);
  console.log(`LOCAL_PREVIEW_ROOT=${preview.root}`);
  if (args.open) openLocalPreview(preview.url);
  const shutdown = async () => {
    await preview.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`LOCAL_PREVIEW_ERROR=${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  HEALTH_PATH,
  LOOPBACK_HOST,
  closeServer,
  createPreviewServer,
  httpHealthCheck,
  localPathToRoute,
  localPathToUrl,
  openLocalPreview,
  resolvePreviewPath,
  startPreviewServer,
  toLocalPreviewUrl,
};
