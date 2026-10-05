export const AGGREGATED_INSIGHT_SCHEMA_VERSION = 1 as const;
export const AGGREGATED_INSIGHT_VERSION = 'AGGREGATED_COMMERCIAL_INSIGHT_V1' as const;

export type InsightDimensionName =
  | 'signal'
  | 'channel'
  | 'signal_channel'
  | 'rejection_reason'
  | 'edited_field'
  | 'edited_section';

export interface AggregatedInsightDimension {
  readonly name: InsightDimensionName;
  readonly value: string;
  readonly channel?: 'EMAIL' | 'MOBILE';
  readonly signal?: string;
}

export interface AggregatedInsight {
  readonly schemaVersion: typeof AGGREGATED_INSIGHT_SCHEMA_VERSION;
  readonly insightVersion: typeof AGGREGATED_INSIGHT_VERSION;
  readonly insightId: string;
  readonly pattern: string;
  readonly dimensions: readonly AggregatedInsightDimension[];
  readonly eventCount: number;
  readonly counts: Readonly<Record<string, number>>;
  /** Null means this insight has no mathematically meaningful denominator. */
  readonly ratio: number | null;
  readonly eventIds: readonly string[];
  readonly prospectCount: number;
  readonly observationWindow: { readonly from: string; readonly to: string } | null;
  readonly evidenceSufficient: boolean;
  readonly recommendationEligible: boolean;
}
