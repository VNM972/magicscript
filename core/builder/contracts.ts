import type { DesignRequestV1, DesignVertical } from '../design/design-request';
export const BUILD_ARTIFACT_VERSION = 'BUILD_ARTIFACT_V1' as const;
export const BUILDER_VERSION = 'builder-v1' as const;
export const V2_BUILD_JOB_KIND = 'V2_BUILD_SITE' as const;
export type BuildStatus = 'SUCCEEDED' | 'FAILED';
export type BuildFailureCode = 'INVALID_APPROVAL_STATE' | 'MISSING_DESIGN_ARTIFACT' | 'INVALID_DESIGN_ARTIFACT' | 'SOURCE_GENERATION_FAILED' | 'BUILD_FAILED' | 'OUTPUT_MISSING';
export interface BuildRequestV1 { id: string; version: typeof BUILD_ARTIFACT_VERSION; approvedDesignArtifactId: string; designRequestId: string; prospectId: string; approvedRevision: number; buildRevision?: number; vertical: DesignVertical; builderVersion: typeof BUILDER_VERSION; sourcePath: string; outputPath: string; }
export interface BuildArtifactV1 { id: string; version: typeof BUILD_ARTIFACT_VERSION; approvedDesignArtifactId: string; designRequestId: string; prospectId: string; approvedRevision: number; builderVersion: typeof BUILDER_VERSION; sourcePath: string; outputPath: string; status: BuildStatus; framework: 'STATIC_HTML_CSS'; sourceHash?: string; createdAt: string; completedAt: string; metadata: { entryFile: string; buildCommand: string; missingAssetRequirements: string[]; failureCode?: BuildFailureCode; error?: string; }; }
export interface BuildArtifactStore { get(id: string): Promise<BuildArtifactV1 | null>; save(artifact: BuildArtifactV1): Promise<void>; list?(): Promise<BuildArtifactV1[]> }
export type { DesignRequestV1 };
