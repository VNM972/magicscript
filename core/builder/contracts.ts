import type { DesignRequestV1, DesignVertical } from '../design/design-request';
import type { DesignArtifactV1 } from '../design/design-artifact';
import type { BuildCorrectionRequestV1, VisualQaReportV1 } from '../visual-qa/contracts';
export const BUILD_ARTIFACT_VERSION = 'BUILD_ARTIFACT_V1' as const;
export const BUILDER_VERSION = 'builder-v1' as const;
export const V2_BUILD_JOB_KIND = 'V2_BUILD_SITE' as const;
export type BuildStatus = 'SUCCEEDED' | 'FAILED';
export type BuildFailureCode = 'INVALID_APPROVAL_STATE' | 'MISSING_DESIGN_ARTIFACT' | 'INVALID_DESIGN_ARTIFACT' | 'SOURCE_GENERATION_FAILED' | 'BUILD_FAILED' | 'OUTPUT_MISSING' | 'INVALID_CORRECTION_REQUEST' | 'UNSUPPORTED_CORRECTION' | 'BUILD_INTEGRITY_MISMATCH' | 'BUILD_REVISION_CONFLICT';
export interface BuildRequestV1 { id: string; version: typeof BUILD_ARTIFACT_VERSION; approvedDesignArtifactId: string; designRequestId: string; prospectId: string; approvedRevision: number; buildRevision?: number; vertical: DesignVertical; builderVersion: typeof BUILDER_VERSION; sourcePath: string; outputPath: string; }
export interface BuildOutputIntegrity { parentSourceFiles: Record<string, string>; sourceFiles: Record<string, string>; outputFiles: Record<string, string>; }
export interface BuildArtifactV1 { id: string; version: typeof BUILD_ARTIFACT_VERSION; approvedDesignArtifactId: string; designRequestId: string; prospectId: string; approvedRevision: number; buildRevision?: number; qaAttempt?: number; previousBuildArtifactId?: string; correctionRequestId?: string; builderVersion: typeof BUILDER_VERSION; sourcePath: string; outputPath: string; status: BuildStatus; framework: 'STATIC_HTML_CSS'; sourceHash?: string; createdAt: string; completedAt: string; metadata: { entryFile: string; buildCommand: string; missingAssetRequirements: string[]; failureCode?: BuildFailureCode; error?: string; outputIntegrity?: BuildOutputIntegrity; }; }
export interface BuildArtifactStore { get(id: string): Promise<BuildArtifactV1 | null>; save(artifact: BuildArtifactV1): Promise<void>; list?(): Promise<BuildArtifactV1[]> }
export type { DesignRequestV1 };

export class BuilderError extends Error { readonly code: BuildFailureCode; constructor(code: BuildFailureCode, message: string) { super(message); this.code = code; this.name = 'BuilderError'; } }
export const CANONICAL_FAVICON_LINK = '<link rel="icon" type="image/x-icon" href="./favicon.ico">';
export function deterministicFaviconBytes(): Uint8Array {
  // One 16x16 unbranded fully transparent BGRA image and its AND mask.
  const bytes = new Uint8Array(22 + 40 + 16 * 16 * 4 + 16 * 4); const view = new DataView(bytes.buffer);
  view.setUint16(2, 1, true); view.setUint16(4, 1, true); bytes[6] = 16; bytes[7] = 16;
  view.setUint16(10, 1, true); view.setUint16(12, 32, true); view.setUint32(14, bytes.length - 22, true); view.setUint32(18, 22, true);
  view.setUint32(22, 40, true); view.setInt32(26, 16, true); view.setInt32(30, 32, true); view.setUint16(34, 1, true); view.setUint16(36, 32, true); view.setUint32(42, 16 * 16 * 4, true);
  bytes.fill(255, 22 + 40 + 16 * 16 * 4); return bytes;
}
export function ensureLocalFaviconHtml(html: string): string {
  const head = html.match(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i);
  if (!head || html.match(/<head\b/gi)?.length !== 1) throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Source must contain one canonical HTML head');
  const cleaned = head[0].replace(/<link\b[^>]*>/gi, (tag) => { const rel = tag.match(/\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i); return rel && (rel[1] ?? rel[2] ?? rel[3]).toLowerCase().split(/\s+/).includes('icon') ? '' : tag; });
  return html.replace(head[0], () => cleaned.replace(/<\/head\s*>/i, `${CANONICAL_FAVICON_LINK}</head>`));
}
const PUBLIC_VERTICAL_LABELS = {
  GENERAL_LOCAL_BUSINESS: 'Entreprise locale',
  RESTAURANT: 'Restaurant',
  BEAUTY: 'Beauté',
  LOCAL_SERVICE: 'Services de proximité',
} as const satisfies Record<DesignVertical, string>;
export function publicVerticalLabel(vertical: DesignVertical): string {
  if (!Object.hasOwn(PUBLIC_VERTICAL_LABELS, vertical)) throw new BuilderError('INVALID_DESIGN_ARTIFACT', 'Unknown public vertical label');
  return PUBLIC_VERTICAL_LABELS[vertical];
}
export function normalizePublicVerticalLabelHtml(html: string, vertical: DesignVertical): string {
  const label = publicVerticalLabel(vertical);
  // Only the canonical hero eyebrow is eligible; all approved copy stays byte-identical.
  const hero = /(<section class="hero" aria-labelledby="hero-title"><p class="eyebrow">)([^<]*)(<\/p>)/g;
  const matches = [...html.matchAll(hero)];
  if (matches.length !== 1) throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Source must contain one canonical hero eyebrow');
  if (Object.hasOwn(PUBLIC_VERTICAL_LABELS, matches[0][2]) && matches[0][2] !== vertical) throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Hero vertical differs from approved design');
  return html.replace(hero, (_match, start: string, copy: string, end: string) => `${start}${copy === vertical ? label : copy}${end}`);
}
export function effectiveBuildRevision(build: Pick<BuildArtifactV1, 'buildRevision'>): number { const revision = build.buildRevision === undefined ? 1 : build.buildRevision; if (!Number.isSafeInteger(revision) || revision < 1) throw new BuilderError('BUILD_REVISION_CONFLICT', 'Invalid explicit build revision'); return revision; }
export function effectiveQaAttempt(build: Pick<BuildArtifactV1, 'qaAttempt'>): number { const attempt = build.qaAttempt === undefined ? 1 : build.qaAttempt; if (!Number.isInteger(attempt) || attempt < 1 || attempt > 3) throw new BuilderError('INVALID_CORRECTION_REQUEST', 'Invalid allocated QA attempt'); return attempt; }
export function buildArtifactIdFor(designArtifactId: string, builderVersion: string, revision: number): string { effectiveBuildRevision({ buildRevision: revision }); return `build-${designArtifactId}-${builderVersion}${revision === 1 ? '' : `-br${revision}`}`; }
export function canonicalBuildValue(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalBuildValue).join(',')}]`; if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalBuildValue(item)}`).join(',')}}`; return JSON.stringify(value); }
export interface BuildCorrectionContext { request: BuildCorrectionRequestV1 | null; targetBuild: BuildArtifactV1 | null; qaReport: VisualQaReportV1 | null; designRequest: DesignRequestV1 | null; approvedDesignArtifact: DesignArtifactV1 | null; existingCorrectedBuild?: BuildArtifactV1 | null; }
export function validateBuildCorrectionContext(context: BuildCorrectionContext): { targetBuildRevision: number; nextBuildRevision: number; qaAttempt: number; buildArtifactId: string } {
  const { request, targetBuild: build, qaReport: report, designRequest: designRequest, approvedDesignArtifact: design } = context;
  if (!request || !build || !report || !designRequest || !design) throw new BuilderError('INVALID_CORRECTION_REQUEST', 'Correction context is incomplete');
  if (design.status !== 'APPROVED') throw new BuilderError('INVALID_APPROVAL_STATE', 'Correction requires an approved design');
  if (request.operation !== 'ENSURE_LOCAL_FAVICON_V1' && request.operation !== 'NORMALIZE_PUBLIC_VERTICAL_LABEL_V1') throw new BuilderError('UNSUPPORTED_CORRECTION', 'Unsupported explicit correction operation');
  const targetBuildRevision = effectiveBuildRevision(build); const qaAttempt = effectiveQaAttempt(build);
  if (request.version !== 'BUILD_CORRECTION_REQUEST_V1' || request.id !== `correction-${report.id}` || build.version !== BUILD_ARTIFACT_VERSION || build.builderVersion !== BUILDER_VERSION || build.status !== 'SUCCEEDED' || design.version !== 'DESIGN_ARTIFACT_V1' || design.verticalProfile !== designRequest.designInput.businessVertical || !Number.isSafeInteger(design.revision) || design.revision < 1 || report.version !== 'VISUAL_QA_REPORT_V1' || report.decision !== 'CORRECTION_REQUIRED' || report.attempt !== qaAttempt || report.attempt >= 3 || request.createdAt !== report.createdAt || !request.issue || !Array.isArray(report.issues) || !report.issues.some((issue) => canonicalBuildValue(issue) === canonicalBuildValue(request.issue))) throw new BuilderError('INVALID_CORRECTION_REQUEST', 'Invalid source correction records');
  if (request.prospectId !== build.prospectId || report.prospectId !== build.prospectId || design.prospectId !== build.prospectId || designRequest.prospectId !== build.prospectId || request.buildArtifactId !== build.id || report.buildArtifactId !== build.id || request.qaReportId !== report.id || request.designArtifactId !== design.id || report.designArtifactId !== design.id || build.approvedDesignArtifactId !== design.id || build.designRequestId !== designRequest.id || design.designRequestId !== designRequest.id || report.designRequestId !== designRequest.id || (request.designRequestId !== undefined && request.designRequestId !== designRequest.id) || report.designArtifactRevision !== design.revision || build.approvedRevision !== design.revision || report.buildVersion !== build.version) throw new BuilderError('INVALID_CORRECTION_REQUEST', 'Correction linkage does not match persisted records');
  if (request.targetBuildRevision !== targetBuildRevision || report.buildRevision !== targetBuildRevision || request.nextBuildRevision !== targetBuildRevision + 1 || build.id !== buildArtifactIdFor(design.id, build.builderVersion, targetBuildRevision)) throw new BuilderError('BUILD_REVISION_CONFLICT', 'Correction build revision is inconsistent');
  if (request.operation === 'NORMALIZE_PUBLIC_VERTICAL_LABEL_V1' && (request.issue.category !== 'PLACEHOLDER' || request.issue.severity !== 'CRITICAL' || request.issue.message !== `Unresolved or unsafe rendered marker: ${design.verticalProfile}` || !report.inspection?.unresolvedMarkers?.includes(design.verticalProfile))) throw new BuilderError('INVALID_CORRECTION_REQUEST', 'Placeholder correction requires the approved vertical marker finding');
  const result = { targetBuildRevision, nextBuildRevision: targetBuildRevision + 1, qaAttempt: report.attempt + 1, buildArtifactId: buildArtifactIdFor(design.id, build.builderVersion, targetBuildRevision + 1) };
  if (context.existingCorrectedBuild) validateCorrectedBuildArtifact(context, context.existingCorrectedBuild, result);
  return result;
}
export function validateCorrectedBuildArtifact(context: BuildCorrectionContext, build: BuildArtifactV1, allocation = validateBuildCorrectionContext({ ...context, existingCorrectedBuild: null })): void {
  const parent = context.targetBuild!; const request = context.request!;
  if (build.id !== allocation.buildArtifactId || build.version !== BUILD_ARTIFACT_VERSION || build.status !== 'SUCCEEDED' || build.framework !== 'STATIC_HTML_CSS' || build.builderVersion !== parent.builderVersion || build.approvedDesignArtifactId !== parent.approvedDesignArtifactId || build.designRequestId !== parent.designRequestId || build.prospectId !== parent.prospectId || build.approvedRevision !== parent.approvedRevision || build.buildRevision !== allocation.nextBuildRevision || build.qaAttempt !== allocation.qaAttempt || build.previousBuildArtifactId !== parent.id || build.correctionRequestId !== request.id) throw new BuilderError('BUILD_REVISION_CONFLICT', 'Corrected build identity or lineage conflicts');
  if (typeof parent.sourcePath !== 'string' || typeof build.sourcePath !== 'string' || typeof build.outputPath !== 'string') throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Corrected build paths are missing');
  const normalize = (path: string) => path.replaceAll('\\', '/').replace(/\/$/, ''); const source = normalize(parent.sourcePath); const parentBase = source.replace(/\/source$/, '').replace(/\/build-r\d+$/, '');
  if (source === parentBase || normalize(build.sourcePath) !== `${parentBase}/build-r${allocation.nextBuildRevision}/source` || normalize(build.outputPath) !== `${parentBase}/build-r${allocation.nextBuildRevision}/dist` || !/^[a-f0-9]{64}$/.test(build.sourceHash ?? '') || build.metadata?.entryFile !== 'index.html') throw new BuilderError('BUILD_INTEGRITY_MISMATCH', 'Corrected build output metadata is invalid');
  if (context.existingCorrectedBuild && canonicalBuildValue(build) !== canonicalBuildValue(context.existingCorrectedBuild)) throw new BuilderError('BUILD_REVISION_CONFLICT', 'Existing corrected build is immutable');
}
