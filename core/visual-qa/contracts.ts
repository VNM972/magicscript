import type { BuildArtifactV1 } from '../builder/contracts';
import type { DesignArtifactV1 } from '../design/design-artifact';
import type { DesignRequestV1 } from '../design/design-request';

export const VISUAL_QA_REPORT_VERSION = 'VISUAL_QA_REPORT_V1' as const;
export const V2_VISUAL_QA_JOB_KIND = 'V2_VISUAL_QA' as const;
export const V2_BUILD_CORRECTION_JOB_KIND = 'V2_BUILD_CORRECTION' as const;
export const MAX_VISUAL_QA_ATTEMPTS = 3;
export type VisualQaDecision = 'PASS' | 'CORRECTION_REQUIRED' | 'VISUAL_QA_LIMIT_REACHED';
export type VisualQaSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';
export type VisualQaCategory = 'STRUCTURE_FIDELITY' | 'RESPONSIVE_LAYOUT' | 'MOBILE_HIERARCHY' | 'CTA_VISIBILITY' | 'TEXT_OVERFLOW' | 'SPACING' | 'NAVIGATION' | 'ACCESSIBILITY' | 'CONTRAST' | 'PLACEHOLDER' | 'ASSET' | 'BUILD_RENDER';
export interface VisualQaViewport { name: 'DESKTOP' | 'MOBILE' | 'TABLET'; width: number; height: number; horizontalOverflow: number; heroVisible: boolean; primaryCtaVisible: boolean; contentVisible: boolean; controlsWithinViewport: boolean; }
export interface VisualQaIssue { category: VisualQaCategory; severity: VisualQaSeverity; section?: string; message: string; expectedCorrection: string; viewport?: string; }
export interface VisualQaInspection { viewports: VisualQaViewport[]; expectedSections: string[]; observedSections: string[]; primaryCta: string; brokenAssets: string[]; internalLinkErrors: string[]; consoleErrors: string[]; unresolvedMarkers: string[]; headings: string[]; }
export interface VisualQaReportV1 { id: string; version: typeof VISUAL_QA_REPORT_VERSION; buildArtifactId: string; designArtifactId: string; designArtifactRevision: number; designRequestId: string; prospectId: string; buildVersion: string; buildRevision: number; attempt: number; decision: VisualQaDecision; issues: VisualQaIssue[]; inspection: VisualQaInspection; createdAt: string; }
export interface BuildCorrectionRequestV1 { id: string; version: 'BUILD_CORRECTION_REQUEST_V1'; buildArtifactId: string; designArtifactId: string; prospectId: string; qaReportId: string; targetBuildRevision: number; nextBuildRevision: number; issue: VisualQaIssue; createdAt: string; }
export interface VisualQaReportStore { get(id: string): Promise<VisualQaReportV1 | null>; save(report: VisualQaReportV1): Promise<void>; list?(buildArtifactId?: string): Promise<VisualQaReportV1[]> }
export interface BuildCorrectionStore { get(id: string): Promise<BuildCorrectionRequestV1 | null>; save(request: BuildCorrectionRequestV1): Promise<void>; list?(): Promise<BuildCorrectionRequestV1[]> }
export class InMemoryVisualQaReportStore implements VisualQaReportStore { private values = new Map<string, VisualQaReportV1>(); async get(id: string) { return this.values.get(id) ?? null; } async save(value: VisualQaReportV1) { this.values.set(value.id, value); } async list(buildArtifactId?: string) { return [...this.values.values()].filter((x) => !buildArtifactId || x.buildArtifactId === buildArtifactId); } }
export class InMemoryBuildCorrectionStore implements BuildCorrectionStore { private values = new Map<string, BuildCorrectionRequestV1>(); async get(id: string) { return this.values.get(id) ?? null; } async save(value: BuildCorrectionRequestV1) { this.values.set(value.id, value); } async list() { return [...this.values.values()]; } }
export interface BrowserQaEvidence { viewports: VisualQaViewport[]; observedSections: string[]; brokenAssets?: string[]; internalLinkErrors?: string[]; consoleErrors?: string[]; unresolvedMarkers?: string[]; headings?: string[]; }
export function visualQaJobFor(build: BuildArtifactV1, now = new Date().toISOString()) { return { id: `job-${build.prospectId}-visual-qa-${build.id}-r${build.approvedRevision}`, kind: V2_VISUAL_QA_JOB_KIND, prospectId: build.prospectId, payload: { buildArtifactId: build.id, designArtifactId: build.approvedDesignArtifactId, designRequestId: build.designRequestId, buildRevision: build.approvedRevision }, maxAttempts: 2, runAfter: now }; }
export function correctionJobFor(request: BuildCorrectionRequestV1, now = new Date().toISOString()) { return { id: `job-${request.prospectId}-build-correction-${request.buildArtifactId}-r${request.nextBuildRevision}`, kind: V2_BUILD_CORRECTION_JOB_KIND, prospectId: request.prospectId, payload: { correctionRequestId: request.id, buildArtifactId: request.buildArtifactId, nextBuildRevision: request.nextBuildRevision }, maxAttempts: 2, runAfter: now }; }
export type { BuildArtifactV1, DesignArtifactV1, DesignRequestV1 };
