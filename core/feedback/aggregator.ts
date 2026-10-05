import {
  assertOperatorFeedbackEvent,
  type OperatorFeedbackEventV1,
  type OperatorFeedbackSignal,
} from './operator-feedback-contract';
import {
  AGGREGATED_INSIGHT_SCHEMA_VERSION,
  AGGREGATED_INSIGHT_VERSION,
  type AggregatedInsight,
  type AggregatedInsightDimension,
  type InsightDimensionName,
} from './aggregated-insight-contract';

/** Deliberately conservative: observations below this count cannot be considered for later promotion. */
export const AGGREGATION_MINIMUM_EVIDENCE_EVENTS = 3;

type Group = { dimensions: AggregatedInsightDimension[]; events: OperatorFeedbackEventV1[] };

function hash(value: string): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h1 ^= value.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return `insight-${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

function canonicalEvents(events: readonly OperatorFeedbackEventV1[]): OperatorFeedbackEventV1[] {
  const unique = new Map<string, OperatorFeedbackEventV1>();
  for (const event of events) {
    assertOperatorFeedbackEvent(event);
    const existing = unique.get(event.eventId);
    if (existing && JSON.stringify(existing) !== JSON.stringify(event)) throw new Error('CONFLICTING_DUPLICATE_FEEDBACK_EVENT');
    unique.set(event.eventId, event);
  }
  return [...unique.values()].sort((a, b) => a.eventId.localeCompare(b.eventId));
}

function add(groups: Map<string, Group>, name: InsightDimensionName, value: string, event: OperatorFeedbackEventV1, extra: Partial<AggregatedInsightDimension> = {}): void {
  const dimensions = [{ name, value, ...extra }];
  const key = JSON.stringify(dimensions);
  const group = groups.get(key) ?? { dimensions, events: [] };
  group.events.push(event);
  groups.set(key, group);
}

function insight(group: Group): AggregatedInsight {
  const events = canonicalEvents(group.events);
  const eventIds = events.map(event => event.eventId);
  const counts: Record<string, number> = {};
  for (const event of events) counts[event.signal] = (counts[event.signal] ?? 0) + 1;
  // No denominator is established for a single observation dimension; do not manufacture a rate.
  const ratio = null;
  const timestamps = events.map(event => event.actionAt).sort();
  const canonical = JSON.stringify({ version: AGGREGATED_INSIGHT_VERSION, dimensions: group.dimensions, eventIds });
  return {
    schemaVersion: AGGREGATED_INSIGHT_SCHEMA_VERSION,
    insightVersion: AGGREGATED_INSIGHT_VERSION,
    insightId: hash(canonical),
    pattern: `${group.dimensions.map(d => `${d.name}=${d.value}`).join(', ')} observed`,
    dimensions: group.dimensions,
    eventCount: events.length,
    counts,
    ratio,
    eventIds,
    prospectCount: new Set(events.map(event => event.linkage.prospectId)).size,
    observationWindow: timestamps.length ? { from: timestamps[0], to: timestamps[timestamps.length - 1] } : null,
    evidenceSufficient: events.length >= AGGREGATION_MINIMUM_EVIDENCE_EVENTS,
    recommendationEligible: events.length >= AGGREGATION_MINIMUM_EVIDENCE_EVENTS,
  };
}

export function aggregateOperatorFeedback(events: readonly OperatorFeedbackEventV1[]): AggregatedInsight[] {
  const canonical = canonicalEvents(events);
  const groups = new Map<string, Group>();
  for (const event of canonical) {
    add(groups, 'signal', event.signal, event);
    add(groups, 'channel', event.linkage.channel, event);
    add(groups, 'signal_channel', `${event.signal}:${event.linkage.channel}`, event, { signal: event.signal, channel: event.linkage.channel });
    if (event.payload.signal === 'REJECTED') add(groups, 'rejection_reason', event.payload.reason.code, event);
    if (event.payload.signal === 'EDITED') for (const field of [...event.payload.editedFields].sort()) add(groups, 'edited_field', field, event);
    if (event.payload.signal === 'SECTION_EDITED') {
      add(groups, 'edited_section', event.payload.section, event);
      for (const field of [...(event.payload.editedFields ?? [])].sort()) add(groups, 'edited_field', field, event);
    }
  }
  return [...groups.values()].map(insight).sort((a, b) => a.insightId.localeCompare(b.insightId));
}
