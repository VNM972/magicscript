import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { DesignArtifactV1 } from '../design/design-artifact';
import type { DesignRequestV1 } from '../design/design-request';
import { BUILD_ARTIFACT_VERSION, BUILDER_VERSION, V2_BUILD_JOB_KIND, BuilderError, buildArtifactIdFor, canonicalBuildValue, deterministicFaviconBytes, effectiveBuildRevision, effectiveQaAttempt, ensureLocalFaviconHtml, normalizePublicVerticalLabelHtml, publicVerticalLabel, validateBuildCorrectionContext, validateCorrectedBuildArtifact, type BuildCorrectionContext, type BuildArtifactStore, type BuildArtifactV1, type BuildFailureCode, type BuildRequestV1 } from './contracts';
export { BUILD_ARTIFACT_VERSION, BUILDER_VERSION, V2_BUILD_JOB_KIND, BuilderError } from './contracts';
export type { BuildArtifactStore, BuildArtifactV1, BuildFailureCode, BuildRequestV1 } from './contracts';
export class InMemoryBuildArtifactStore implements BuildArtifactStore { private values = new Map<string, BuildArtifactV1>(); async get(id: string) { return this.values.get(id) ?? null; } async save(value: BuildArtifactV1) { const existing = this.values.get(value.id); if (existing?.status === 'SUCCEEDED' && canonicalBuildValue(existing) !== canonicalBuildValue(value)) throw new BuilderError('BUILD_REVISION_CONFLICT', 'Build artifact is immutable'); this.values.set(value.id, value); } async list() { return [...this.values.values()]; } }

function esc(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function safeSegment(value: string): string { return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'unknown'; }
function textBlocks(page: DesignArtifactV1['pages'][number]): string { return page.content.map((block) => `<p class="content-block content-${block.kind.toLowerCase()}">${esc(block.text)}</p>`).join('\n'); }
function sourceFiles(artifact: DesignArtifactV1, request: DesignRequestV1): Record<string, string> {
  const pages = artifact.pages.map((page) => `<section id="${esc(page.id)}" aria-labelledby="heading-${esc(page.id)}"><p class="eyebrow">${esc(page.purpose)}</p><h2 id="heading-${esc(page.id)}">${esc(page.headingIntent)}</h2>${textBlocks(page)}<a class="cta cta-secondary" href="#contact">${esc(page.ctaIntent)}</a></section>`).join('\n');
  const approvedStructure = artifact.buildGuidance.sectionOrder.filter((section) => !artifact.pages.some((page) => page.id.toLowerCase() === section.toLowerCase())).map((section) => `<section class="approved-structure" data-approved-section="${esc(section)}" aria-labelledby="approved-${esc(section)}"><p class="eyebrow">Approved structure</p><h2 id="approved-${esc(section)}">${esc(section)}</h2><p class="content-design_placeholder">Approved structural placeholder; business content remains governed by the design artifact.</p></section>`).join('\n');
  const missing = artifact.buildGuidance.assetRequirements.filter((x) => !/no fabricated/i.test(x));
  const html = `<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(request.identity.businessName)}</title><meta name="description" content="${esc(artifact.strategy.siteObjective)}"><link rel="stylesheet" href="styles.css"></head><body><header class="site-header"><a class="brand" href="#top">${esc(request.identity.businessName)}</a><nav aria-label="Navigation principale"><a href="#${esc(artifact.pages[0]?.id ?? 'home')}">${esc(artifact.pages[0]?.headingIntent ?? 'Accueil')}</a><a href="#contact">${esc(artifact.strategy.primaryCta)}</a></nav></header><main id="top"><section class="hero" aria-labelledby="hero-title"><p class="eyebrow">${esc(publicVerticalLabel(artifact.verticalProfile))}</p><h1 id="hero-title">${esc(artifact.pages[0]?.headingIntent ?? request.identity.businessName)}</h1><p>${esc(artifact.strategy.primaryUserIntent)}</p><a class="cta cta-primary" href="#contact">${esc(artifact.strategy.primaryCta)}</a></section>${pages}${approvedStructure}<section id="contact" class="contact" aria-labelledby="contact-title"><h2 id="contact-title">${esc(artifact.strategy.primaryCta)}</h2><p>Cette démonstration présente la structure approuvée. Les coordonnées et actions opérationnelles restent à connecter.</p><a class="cta cta-primary" href="#top">${esc(artifact.strategy.primaryCta)}</a></section></main><footer><p>${esc(request.identity.businessName)}</p><p class="asset-note">${missing.length ? `Médias à fournir : ${missing.map(esc).join(' ; ')}` : 'Aucun média externe requis pour cette structure.'}</p></footer></body></html>\n`;
  const css = `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#17202a;background:#f7f4ef;line-height:1.6}*{box-sizing:border-box}body{margin:0}a{color:inherit}.site-header,main,footer{max-width:1120px;margin:auto;padding:1rem 1.25rem}.site-header{display:flex;justify-content:space-between;gap:1rem;align-items:center}.site-header nav{display:flex;gap:1rem;flex-wrap:wrap}.brand{font-weight:800;text-decoration:none}.hero{padding:5rem 1.25rem 4rem;background:#17202a;color:#fff;border-radius:0 0 2rem 2rem}.hero h1{font-size:clamp(2.25rem,8vw,5rem);line-height:1.05;max-width:12ch;margin:.5rem 0 1.25rem}.hero p{max-width:42rem}.eyebrow{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;opacity:.75}section:not(.hero){padding:3.5rem 0;border-bottom:1px solid #d9d2c8;max-width:760px}h2{font-size:clamp(1.7rem,5vw,3rem);line-height:1.1}.content-block{font-size:1.1rem}.content-design_placeholder{border:1px dashed #8d8275;padding:1rem;background:#eee8df}.cta{display:inline-block;padding:.8rem 1.1rem;border-radius:999px;font-weight:700;text-decoration:none;margin-top:1rem}.cta-primary{background:#e87945;color:#fff}.cta-secondary{border:1px solid currentColor}.contact{background:#ebe3d7;padding:2rem!important;margin-top:2rem;border-radius:1rem}footer{padding-block:2rem;font-size:.9rem}.asset-note{opacity:.7}@media(min-width:700px){.hero{padding:7rem 5rem}.site-header,main,footer{padding-inline:2rem}}`;
  return { 'index.html': html, 'styles.css': css, 'build-manifest.json': JSON.stringify({ version: BUILD_ARTIFACT_VERSION, artifactId: artifact.id, designRequestId: artifact.designRequestId, prospectId: artifact.prospectId, approvedRevision: artifact.revision, framework: 'STATIC_HTML_CSS' }, null, 2) + '\n' };
}
async function ensureDir(path: string) { await mkdir(path, { recursive: true }); }
async function readBuildFiles(root: string, prefix = ''): Promise<Record<string, Buffer>> {
  const files: Record<string, Buffer> = {};
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    if (!prefix && entry.name === 'dist') continue;
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Build source cannot contain symbolic links');
    if (entry.isDirectory()) Object.assign(files, await readBuildFiles(root, name));
    else if (entry.isFile()) files[name] = await readFile(join(root, name));
    else throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Unsupported build source entry');
  }
  return files;
}
function rawFilesHash(files: Record<string, Uint8Array>): string { const hash = createHash('sha256'); const names = Object.keys(files).sort(); names.forEach((name, index) => { if (index) hash.update('\n'); hash.update(`${name}\n`); hash.update(files[name]); }); return hash.digest('hex'); }
export async function filesHash(root: string): Promise<string> { return rawFilesHash(await readBuildFiles(root)); }
function filesEqual(a: Record<string, Buffer>, b: Record<string, Buffer>): boolean { const names = Object.keys(a).sort(); return names.join('\n') === Object.keys(b).sort().join('\n') && names.every((name) => a[name].equals(b[name])); }
export async function verifyBuildArtifactIntegrity(build: BuildArtifactV1): Promise<void> {
  try {
    const source = await readBuildFiles(build.sourcePath); const output = await readBuildFiles(build.outputPath); if (!source['index.html'] || !source['build-manifest.json'] || build.status !== 'SUCCEEDED' || rawFilesHash(source) !== build.sourceHash || !filesEqual(source, output)) throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Source hash or built output integrity mismatch');
    const manifest = JSON.parse(source['build-manifest.json'].toString('utf8'));
    if (!manifest || manifest.version !== build.version || manifest.artifactId !== build.approvedDesignArtifactId || manifest.designRequestId !== build.designRequestId || manifest.prospectId !== build.prospectId || manifest.approvedRevision !== build.approvedRevision || (manifest.buildRevision !== undefined && manifest.buildRevision !== effectiveBuildRevision(build)) || (manifest.qaAttempt !== undefined && manifest.qaAttempt !== effectiveQaAttempt(build)) || (manifest.buildArtifactId !== undefined && manifest.buildArtifactId !== build.id) || (manifest.builderVersion !== undefined && manifest.builderVersion !== build.builderVersion) || (effectiveBuildRevision(build) >= 2 && (manifest.previousBuildArtifactId !== build.previousBuildArtifactId || manifest.correctionRequestId !== build.correctionRequestId))) throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Build manifest linkage mismatch');
  }
  catch (error) { if (error instanceof BuilderError) throw error; throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Build files could not be verified'); }
}
async function outputExists(path: string): Promise<boolean> { try { return (await stat(join(path, 'index.html'))).isFile(); } catch { return false; } }

export function createBuildRequest(artifact: DesignArtifactV1, root = resolve('artifacts/v2/sites'), buildRevision = 1): BuildRequestV1 { effectiveBuildRevision({ buildRevision }); const base = join(root, safeSegment(artifact.prospectId), safeSegment(artifact.id), ...(buildRevision === 1 ? [] : [`build-r${buildRevision}`])); return { id: buildArtifactIdFor(artifact.id, BUILDER_VERSION, buildRevision), version: BUILD_ARTIFACT_VERSION, approvedDesignArtifactId: artifact.id, designRequestId: artifact.designRequestId, prospectId: artifact.prospectId, approvedRevision: artifact.revision, buildRevision, vertical: artifact.verticalProfile, builderVersion: BUILDER_VERSION, sourcePath: join(base, 'source'), outputPath: join(base, 'dist') }; }
export function buildJobFor(artifact: DesignArtifactV1, now = new Date().toISOString()) { const request = createBuildRequest(artifact); return { id: `job-${artifact.prospectId}-build-${artifact.id}`, kind: V2_BUILD_JOB_KIND, prospectId: artifact.prospectId, payload: { buildRequestId: request.id, approvedDesignArtifactId: artifact.id, designRequestId: artifact.designRequestId, approvedRevision: artifact.revision, builderVersion: BUILDER_VERSION }, maxAttempts: 2, runAfter: now }; }

export async function executeBuilder(input: { artifact: DesignArtifactV1 | null; designRequest: DesignRequestV1 | null; root?: string; now?: () => Date; store?: BuildArtifactStore }): Promise<BuildArtifactV1> {
  const now = (input.now ?? (() => new Date()))().toISOString();
  if (!input.artifact) throw new BuilderError('MISSING_DESIGN_ARTIFACT', 'Approved design artifact is missing');
  if (!input.designRequest || input.artifact.designRequestId !== input.designRequest.id || input.artifact.prospectId !== input.designRequest.prospectId || input.artifact.verticalProfile !== input.designRequest.designInput.businessVertical) throw new BuilderError('INVALID_DESIGN_ARTIFACT', 'Design artifact linkage is invalid');
  if (input.artifact.version !== 'DESIGN_ARTIFACT_V1' || input.artifact.status !== 'APPROVED') throw new BuilderError('INVALID_APPROVAL_STATE', `Artifact status ${input.artifact.status} is not APPROVED`);
  const request = createBuildRequest(input.artifact, input.root ?? resolve('artifacts/v2/sites'));
  const existing = await input.store?.get(request.id);
  if (existing?.status === 'SUCCEEDED') { effectiveBuildRevision(existing); effectiveQaAttempt(existing); await verifyBuildArtifactIntegrity(existing); return { ...existing, buildRevision: effectiveBuildRevision(existing), qaAttempt: effectiveQaAttempt(existing) }; }
  const started = now;
  try {
    await rm(request.sourcePath, { recursive: true, force: true }); await rm(request.outputPath, { recursive: true, force: true }); await ensureDir(request.sourcePath); await ensureDir(request.outputPath);
    const initialFiles = sourceFiles(input.artifact, input.designRequest);
    initialFiles['build-manifest.json'] = JSON.stringify({ ...JSON.parse(initialFiles['build-manifest.json']), buildArtifactId: request.id, builderVersion: BUILDER_VERSION, buildRevision: 1, qaAttempt: 1 }, null, 2) + '\n';
    for (const [name, content] of Object.entries(initialFiles)) await writeFile(join(request.sourcePath, name), content, 'utf8');
    const hash = await filesHash(request.sourcePath);
    const generated = await readdir(request.sourcePath); if (!generated.includes('index.html')) throw new BuilderError('SOURCE_GENERATION_FAILED', 'Entry file was not generated');
    for (const name of generated) await writeFile(join(request.outputPath, name), await readFile(join(request.sourcePath, name), 'utf8'), 'utf8');
    const output = await readFile(join(request.outputPath, 'index.html'), 'utf8'); if (/lorem ipsum|{{|}}|<%/.test(output.toLowerCase()) || !await outputExists(request.outputPath)) throw new BuilderError('OUTPUT_MISSING', 'Built output is missing or contains unresolved markers');
    const result: BuildArtifactV1 = { id: request.id, version: BUILD_ARTIFACT_VERSION, approvedDesignArtifactId: input.artifact.id, designRequestId: input.artifact.designRequestId, prospectId: input.artifact.prospectId, approvedRevision: input.artifact.revision, buildRevision: 1, qaAttempt: 1, builderVersion: BUILDER_VERSION, sourcePath: request.sourcePath, outputPath: request.outputPath, status: 'SUCCEEDED', framework: 'STATIC_HTML_CSS', sourceHash: hash, createdAt: started, completedAt: (input.now ?? (() => new Date()))().toISOString(), metadata: { entryFile: 'index.html', buildCommand: 'builder-v1 static build', missingAssetRequirements: input.artifact.buildGuidance.assetRequirements } };
    if (input.store) await input.store.save(result); return result;
  } catch (error) {
    const failure = error instanceof BuilderError ? error : new BuilderError('BUILD_FAILED', error instanceof Error ? error.message : String(error));
    const result: BuildArtifactV1 = { id: request.id, version: BUILD_ARTIFACT_VERSION, approvedDesignArtifactId: input.artifact.id, designRequestId: input.artifact.designRequestId, prospectId: input.artifact.prospectId, approvedRevision: input.artifact.revision, buildRevision: 1, qaAttempt: 1, builderVersion: BUILDER_VERSION, sourcePath: request.sourcePath, outputPath: request.outputPath, status: 'FAILED', framework: 'STATIC_HTML_CSS', createdAt: started, completedAt: (input.now ?? (() => new Date()))().toISOString(), metadata: { entryFile: 'index.html', buildCommand: 'builder-v1 static build', missingAssetRequirements: input.artifact.buildGuidance.assetRequirements, failureCode: failure.code, error: failure.message } };
    if (input.store) await input.store.save(result); throw failure;
  }
}

export async function executeBuildCorrection(input: BuildCorrectionContext & { now?: () => Date; store?: BuildArtifactStore }): Promise<BuildArtifactV1> {
  const allocation = validateBuildCorrectionContext(input); const parent = input.targetBuild!; const request = input.request!;
  await verifyBuildArtifactIntegrity(parent);
  const parentFiles = await readBuildFiles(parent.sourcePath); const correctedFiles = { ...parentFiles };
  if (request.operation === 'ENSURE_LOCAL_FAVICON_V1') {
    correctedFiles['index.html'] = Buffer.from(ensureLocalFaviconHtml(parentFiles['index.html'].toString('utf8')));
    correctedFiles['favicon.ico'] = Buffer.from(deterministicFaviconBytes());
  } else {
    correctedFiles['index.html'] = Buffer.from(normalizePublicVerticalLabelHtml(parentFiles['index.html'].toString('utf8'), input.approvedDesignArtifact!.verticalProfile));
  }
  let manifest: Record<string, unknown>; try { manifest = JSON.parse(parentFiles['build-manifest.json'].toString('utf8')); } catch { throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Parent build manifest is invalid'); }
  delete manifest.sourceHash;
  Object.assign(manifest, { buildArtifactId: allocation.buildArtifactId, builderVersion: parent.builderVersion, buildRevision: allocation.nextBuildRevision, approvedRevision: parent.approvedRevision, previousBuildArtifactId: parent.id, correctionRequestId: request.id, qaAttempt: allocation.qaAttempt });
  correctedFiles['build-manifest.json'] = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  const parentBase = effectiveBuildRevision(parent) === 1 ? dirname(parent.sourcePath) : dirname(dirname(parent.sourcePath));
  const revisionBase = join(parentBase, `build-r${allocation.nextBuildRevision}`); const sourcePath = join(revisionBase, 'source'); const outputPath = join(revisionBase, 'dist');
  const existing = input.existingCorrectedBuild ?? await input.store?.get(allocation.buildArtifactId);
  if (existing) {
    validateCorrectedBuildArtifact({ ...input, existingCorrectedBuild: existing }, existing, allocation); await verifyBuildArtifactIntegrity(existing);
    if (!filesEqual(correctedFiles, await readBuildFiles(existing.sourcePath))) throw new BuilderError('BUILD_REVISION_CONFLICT', 'Persisted corrected build differs from deterministic correction');
    return existing;
  }
  // Reuse only a completely matching orphan output; never overwrite any revision.
  for (const destination of [sourcePath, outputPath]) {
    let alreadyExists = false; try { alreadyExists = (await stat(destination)).isDirectory(); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Correction destination cannot be inspected'); }
    if (alreadyExists) { if (!filesEqual(correctedFiles, await readBuildFiles(destination))) throw new BuilderError('BUILD_REVISION_CONFLICT', 'Correction destination already contains conflicting files'); continue; }
    await ensureDir(destination);
    for (const name of Object.keys(correctedFiles).sort()) { await ensureDir(dirname(join(destination, name))); await writeFile(join(destination, name), correctedFiles[name], { flag: 'wx' }); }
  }
  await verifyBuildArtifactIntegrity(parent);
  const encode = (files: Record<string, Buffer>) => Object.fromEntries(Object.keys(files).sort().map((name) => [name, files[name].toString('base64')])); const now = (input.now ?? (() => new Date()))().toISOString();
  const result: BuildArtifactV1 = { id: allocation.buildArtifactId, version: BUILD_ARTIFACT_VERSION, approvedDesignArtifactId: parent.approvedDesignArtifactId, designRequestId: parent.designRequestId, prospectId: parent.prospectId, approvedRevision: parent.approvedRevision, buildRevision: allocation.nextBuildRevision, qaAttempt: allocation.qaAttempt, previousBuildArtifactId: parent.id, correctionRequestId: request.id, builderVersion: parent.builderVersion, sourcePath, outputPath, status: 'SUCCEEDED', framework: 'STATIC_HTML_CSS', sourceHash: rawFilesHash(correctedFiles), createdAt: now, completedAt: now, metadata: { entryFile: 'index.html', buildCommand: `builder-v1 static correction ${request.operation}`, missingAssetRequirements: [...parent.metadata.missingAssetRequirements], outputIntegrity: { parentSourceFiles: encode(parentFiles), sourceFiles: encode(correctedFiles), outputFiles: encode(await readBuildFiles(outputPath)) } } };
  validateCorrectedBuildArtifact(input, result, allocation); await verifyBuildArtifactIntegrity(result); if (input.store) await input.store.save(result); return result;
}
