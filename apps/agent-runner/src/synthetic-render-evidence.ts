import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import type { RenderEvidence } from './synthetic-creative-job';

const execFileAsync = promisify(execFile);
const chromeCandidates = [
  process.env.MAGICSCRIPT_CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter((value): value is string => Boolean(value));

export interface RenderEvidenceOptions { root: string; outputRoot: string; artifactFingerprint: string; capturedAt?: string; }

function evidenceId(viewport: string, fingerprint: string): string { return createHash('sha256').update(`${viewport}:${fingerprint}`).digest('hex').slice(0, 16); }

async function renderViewport(root: string, outputRoot: string, viewport: 'desktop' | 'mobile', width: number, height: number, fingerprint: string): Promise<{ viewport: string; width: number; height: number; artifactFingerprint: string; evidencePath: string; evidenceId: string; rendererMethod: string; timestamp: string; success: boolean }> {
  await mkdir(outputRoot, { recursive: true });
  const htmlPath = join(root, 'synthetic-render.html');
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;margin:0;padding:32px;background:#f7f7f2;color:#202020}main{max-width:900px;margin:auto}h1{font-size:clamp(2rem,6vw,4rem)}.proof{padding:24px;background:white;border-radius:16px}@media(max-width:640px){body{padding:16px}.proof{padding:16px}}</style></head><body><main><div class="proof"><h1>Synthetic fixture</h1><h2>Internal design validation</h2><p>Rendered local evidence only.</p></div></main></body></html>`;
  await writeFile(htmlPath, html, 'utf8');
  const outputPath = join(outputRoot, `${viewport}-${evidenceId(viewport, fingerprint)}.png`);
  const timestamp = new Date().toISOString();
  let lastError = '';
  const { server, port } = await serveRoot(root);
  try {
    for (const executable of chromeCandidates) {
      try {
        await execFileAsync(executable, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', `--window-size=${width},${height}`, `--screenshot=${outputPath}`, `http://127.0.0.1:${port}/synthetic-render.html`], { timeout: 30_000, windowsHide: true });
        const bytes = await readFile(outputPath);
        if (bytes.length > 0) return { viewport, width, height, artifactFingerprint: fingerprint, evidencePath: outputPath, evidenceId: evidenceId(viewport, fingerprint), rendererMethod: 'LOCAL_CHROME_HEADLESS', timestamp, success: true };
      } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
    }
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  throw new Error(`No safe local browser renderer succeeded for ${viewport}: ${lastError}`);
}

async function serveRoot(root: string): Promise<{ server: ReturnType<typeof createServer>; port: number }> {
  return await new Promise((resolve, reject) => {
    const server = createServer(async (_request, response) => { try { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(await readFile(join(root, 'synthetic-render.html'))); } catch { response.writeHead(404); response.end(); } });
    server.once('error', reject); server.listen(0, '127.0.0.1', () => { const address = server.address(); const port = typeof address === 'object' && address ? address.port : 0; resolve({ server, port }); });
  });
}

export async function captureLocalDesktopMobileEvidence(options: RenderEvidenceOptions): Promise<RenderEvidence & { desktopEvidence: unknown; mobileEvidence: unknown }> {
  const desktop = await renderViewport(options.root, options.outputRoot, 'desktop', 1440, 900, options.artifactFingerprint);
  const mobile = await renderViewport(options.root, options.outputRoot, 'mobile', 390, 844, options.artifactFingerprint);
  return { desktop: { viewport: `${desktop.width}x${desktop.height}`, checked: desktop.success, artifactPath: desktop.evidencePath }, mobile: { viewport: `${mobile.width}x${mobile.height}`, checked: mobile.success, artifactPath: mobile.evidencePath }, method: 'LOCAL_STATIC_RENDER_METADATA', capturedAt: options.capturedAt ?? new Date().toISOString(), desktopEvidence: desktop, mobileEvidence: mobile };
}
