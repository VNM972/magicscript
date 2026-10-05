import { effectiveBuildRevision, effectiveQaAttempt, validateBuildCorrectionContext, type BuildArtifactV1 } from '../builder/contracts';
import type { DesignArtifactV1 } from '../design/design-artifact';
import type { DesignRequestV1 } from '../design/design-request';
import { MAX_VISUAL_QA_ATTEMPTS, VISUAL_QA_REPORT_VERSION, type BrowserQaEvidence, type BuildCorrectionRequestV1, type VisualQaIssue, type VisualQaReportV1, type VisualQaReportStore } from './contracts';

export class VisualQaError extends Error { readonly code: 'INVALID_BUILD' | 'INVALID_APPROVAL' | 'MISSING_OUTPUT'; constructor(code: VisualQaError['code'], message: string) { super(message); this.code = code; } }
function hasOutput(build: BuildArtifactV1): Promise<boolean> { return Promise.resolve(Boolean(build.outputPath && build.outputPath.length > 0)); }
function issue(category: VisualQaIssue['category'], severity: VisualQaIssue['severity'], message: string, expectedCorrection: string, viewport?: string, section?: string): VisualQaIssue { return { category, severity, message, expectedCorrection, ...(viewport ? { viewport } : {}), ...(section ? { section } : {}) }; }
export async function executeVisualQa(input: { build: BuildArtifactV1 | null; design: DesignArtifactV1 | null; request: DesignRequestV1 | null; evidence: BrowserQaEvidence; attempt?: number; now?: () => Date; store?: VisualQaReportStore }): Promise<VisualQaReportV1> {
  const now = (input.now ?? (() => new Date()))().toISOString();
  if (!input.build || input.build.status !== 'SUCCEEDED') throw new VisualQaError('INVALID_BUILD', 'Visual QA requires a successful Build Artifact');
  const attempt = effectiveQaAttempt(input.build); const buildRevision = effectiveBuildRevision(input.build);
  if (input.attempt !== undefined && input.attempt !== attempt) throw new VisualQaError('INVALID_BUILD', 'QA attempt must equal the build allocated attempt');
  if (!input.design || input.design.status !== 'APPROVED' || !input.request || input.build.approvedDesignArtifactId !== input.design.id || input.build.approvedRevision !== input.design.revision || input.build.designRequestId !== input.request.id || input.build.prospectId !== input.request.prospectId || input.design.prospectId !== input.request.prospectId || input.design.designRequestId !== input.request.id) throw new VisualQaError('INVALID_APPROVAL', 'Build/design/request linkage or approval is invalid');
  if (!await hasOutput(input.build)) throw new VisualQaError('MISSING_OUTPUT', 'Built output entry file is missing');
  const canonical = input.store ? await input.store.getForBuildAttempt(input.build.id, attempt) : null;
  if (canonical) {
    if (canonical.buildArtifactId !== input.build.id || canonical.buildRevision !== buildRevision || canonical.attempt !== attempt || canonical.designArtifactId !== input.design.id || canonical.designArtifactRevision !== input.design.revision || canonical.designRequestId !== input.request.id || canonical.prospectId !== input.request.prospectId || canonical.buildVersion !== input.build.version) throw new VisualQaError('INVALID_BUILD', 'Persisted QA report linkage is invalid');
    return canonical;
  }
  const expectedSections = [...input.design.buildGuidance.sectionOrder]; const observed = input.evidence.observedSections;
  const issues: VisualQaIssue[] = [];
  for (const section of expectedSections) if (!observed.some((value) => value.toLowerCase() === section.toLowerCase() || value.toLowerCase().includes(section.toLowerCase()))) issues.push(issue('STRUCTURE_FIDELITY', 'MAJOR', `Approved section is missing from rendered output: ${section}`, `Render the approved ${section} section without changing design strategy.`, undefined, section));
  for (const viewport of input.evidence.viewports) { if (viewport.horizontalOverflow > 1) issues.push(issue('RESPONSIVE_LAYOUT', 'MAJOR', `Horizontal overflow detected at ${viewport.name} (${viewport.horizontalOverflow}px).`, 'Remove fixed-width overflow and preserve the approved mobile hierarchy.', viewport.name)); if (!viewport.heroVisible) issues.push(issue('MOBILE_HIERARCHY', 'MAJOR', 'Hero is not visible in the rendered viewport.', 'Restore visible hero hierarchy.', viewport.name)); if (!viewport.primaryCtaVisible) issues.push(issue('CTA_VISIBILITY', 'CRITICAL', 'Primary CTA is not visible in the rendered viewport.', 'Keep the approved primary CTA visible and usable.', viewport.name)); if (!viewport.controlsWithinViewport) issues.push(issue('NAVIGATION', 'MAJOR', 'Interactive controls are clipped by the viewport.', 'Keep navigation and CTA controls within the viewport.', viewport.name)); }
  for (const asset of input.evidence.brokenAssets ?? []) issues.push(issue('ASSET', 'MAJOR', `Broken local asset: ${asset}`, 'Fix the local asset path or use an intentional structural placeholder.'));
  for (const link of input.evidence.internalLinkErrors ?? []) issues.push(issue('NAVIGATION', 'MAJOR', `Broken internal link: ${link}`, 'Point the link to an existing local target.'));
  for (const marker of input.evidence.unresolvedMarkers ?? []) issues.push(issue('PLACEHOLDER', 'CRITICAL', `Unresolved or unsafe rendered marker: ${marker}`, 'Remove debug/template content without inventing facts.'));
  for (const error of input.evidence.consoleErrors ?? []) issues.push(issue('BUILD_RENDER', 'MAJOR', `Browser runtime error: ${error}`, 'Fix the rendered runtime error.'));
  if (input.evidence.headings && (!input.evidence.headings.some((x) => /^h1\b/i.test(x)) || input.evidence.headings.filter((x) => /^h1\b/i.test(x)).length > 1)) issues.push(issue('ACCESSIBILITY', 'MAJOR', 'Rendered heading hierarchy does not contain exactly one H1.', 'Provide one meaningful H1 and preserve semantic heading order.'));
  const decision = issues.length === 0 ? 'PASS' : attempt >= MAX_VISUAL_QA_ATTEMPTS ? 'VISUAL_QA_LIMIT_REACHED' : 'CORRECTION_REQUIRED';
  const report: VisualQaReportV1 = { id: `qa-${input.build.id}-r${buildRevision}-a${attempt}`, version: VISUAL_QA_REPORT_VERSION, buildArtifactId: input.build.id, designArtifactId: input.design.id, designArtifactRevision: input.design.revision, designRequestId: input.request.id, prospectId: input.request.prospectId, buildVersion: input.build.version, buildRevision, attempt, decision, issues, inspection: { viewports: input.evidence.viewports, expectedSections, observedSections: observed, primaryCta: input.design.strategy.primaryCta, brokenAssets: input.evidence.brokenAssets ?? [], internalLinkErrors: input.evidence.internalLinkErrors ?? [], consoleErrors: input.evidence.consoleErrors ?? [], unresolvedMarkers: input.evidence.unresolvedMarkers ?? [], headings: input.evidence.headings ?? [] }, createdAt: now };
  if (input.store) await input.store.save(report);
  return report;
}
export function createBuildCorrectionRequest(report: VisualQaReportV1, operation: BuildCorrectionRequestV1['operation'], context: { build: BuildArtifactV1; design: DesignArtifactV1; request: DesignRequestV1 }, issueValue = report.issues[0]): BuildCorrectionRequestV1 {
  if (!issueValue || !context) throw new Error('INVALID_CORRECTION_REQUEST: explicit correction context and issue are required');
  const correction: BuildCorrectionRequestV1 = { id: `correction-${report.id}`, version: 'BUILD_CORRECTION_REQUEST_V1', operation, buildArtifactId: report.buildArtifactId, designArtifactId: report.designArtifactId, designRequestId: report.designRequestId, prospectId: report.prospectId, qaReportId: report.id, targetBuildRevision: report.buildRevision, nextBuildRevision: report.buildRevision + 1, issue: issueValue, createdAt: report.createdAt };
  validateBuildCorrectionContext({ request: correction, targetBuild: context.build, qaReport: report, designRequest: context.request, approvedDesignArtifact: context.design });
  return correction;
}
