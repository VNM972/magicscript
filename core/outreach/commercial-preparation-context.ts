import type { OutreachChannel } from './contracts';
import type { CommercialClaim, EvidenceSource } from './commercial-contract';
import { catalogEntryIsCanonical, catalogVersion, type CommercialCatalogEntry } from './commercial-catalog';
import { COMMERCIAL_PLAYBOOK_VERSION } from './commercial-policy';
import { resolveVerticalProfile, type CommercialState } from './commercial-profiles';
import type { ProposalV1 } from '../proposal/contracts';

export const COMMERCIAL_PREPARATION_CONTEXT_VERSION = 'COMMERCIAL_PREPARATION_CONTEXT_V1' as const;
export const COMMERCIAL_PREPARATION_CONTEXT_SCHEMA_VERSION = 1 as const;
export type CommercialVerticalProfileId = 'RESTAURANTS_BARS_CAFES' | 'BEAUTY_HAIR_BARBER' | 'LOCAL_RETAIL' | 'LOCAL_SERVICES' | 'NEUTRAL_EVIDENCE_ONLY';

export interface CommercialPreparationContextV1 {
  schemaVersion: typeof COMMERCIAL_PREPARATION_CONTEXT_SCHEMA_VERSION;
  contextVersion: typeof COMMERCIAL_PREPARATION_CONTEXT_VERSION;
  contextId: string;
  prospectId: string;
  proposalId: string;
  createdAt: string;
  evaluatedAt: string;
  agent1: { sourceRef: string; version: string; decision: 'ADMITTED'; opportunity: { text: string; supportingClaimIds: string[] } };
  vertical: { profile: CommercialVerticalProfileId; version: 'CP03_VERTICAL_PROFILE_V1'; mappingVersion: 'CP04_VERTICAL_MAPPING_V1' };
  commercialState: CommercialState;
  sources: EvidenceSource[];
  claims: CommercialClaim[];
  requiredClaimIds: string[];
  derivationRules: { id: string; version: string; description: string }[];
  artifact: { proposalId: string; prospectId: string; status: 'PROPOSAL_READY'; version: string; buildArtifactId: string; buildRevision: number; visualQaReportId: string; entryPath: string; capabilities: { id: string; status: 'DEMONSTRATIVE' | 'LIVE'; sourceRef: string }[] };
  channel: { type: OutreachChannel; contactRef: string; sourceRef: string; verifiedAt: string };
  contactState: { suppressionAuthorityRef: string; firstContactAuthorityRef: string; sourceRef: string; verifiedAt: string };
  catalog: { version: string; entryIds: string[]; entries: CommercialCatalogEntry[]; scopeConfirmed: boolean; priceAuthorizationRef: string | null };
  trace: { playbookVersion: typeof COMMERCIAL_PLAYBOOK_VERSION; preparationVersion: string; cp03Version: string; cp02Version: string; sourceVersion: string };
}

export interface CommercialPreparationContextInput {
  prospectId: string; proposal: ProposalV1; createdAt: string; evaluatedAt: string;
  agent1: CommercialPreparationContextV1['agent1']; verticalEvidence: string;
  commercialState: CommercialState; sources: EvidenceSource[]; claims: CommercialClaim[]; requiredClaimIds: string[];
  derivationRules: CommercialPreparationContextV1['derivationRules']; channel: CommercialPreparationContextV1['channel'];
  contactState: CommercialPreparationContextV1['contactState']; catalogEntries: CommercialCatalogEntry[]; scopeConfirmed: boolean;
  priceAuthorizationRef?: string | null; preparationVersion?: string; cp03Version?: string; cp02Version?: string; sourceVersion?: string;
}

const iso = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v) && Number.isFinite(Date.parse(v));
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function mapTrustedVertical(verticalEvidence: string): CommercialVerticalProfileId {
  const normalized = verticalEvidence.trim().toUpperCase();
  if (normalized.includes('RESTAURANT') || normalized.includes('BAR') || normalized.includes('CAFE') || normalized.includes('CAFÉ')) return 'RESTAURANTS_BARS_CAFES';
  if (normalized.includes('BEAUTY') || normalized.includes('HAIR') || normalized.includes('BARBER') || normalized.includes('COIFF')) return 'BEAUTY_HAIR_BARBER';
  if (normalized.includes('RETAIL') || normalized.includes('COMMERCE') || normalized.includes('SHOP')) return 'LOCAL_RETAIL';
  if (normalized.includes('SERVICE') || normalized.includes('SERVICES')) return 'LOCAL_SERVICES';
  return 'NEUTRAL_EVIDENCE_ONLY';
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value as object).sort().map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function identity(value: unknown): string { let h = 2166136261; for (const c of stable(value)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return `cpc-${(h >>> 0).toString(16).padStart(8, '0')}`; }

export function commercialPreparationContextId(input: Omit<CommercialPreparationContextV1, 'contextId'>): string {
  return identity({ prospectId: input.prospectId, proposalId: input.proposalId, agent1: input.agent1, vertical: input.vertical, commercialState: input.commercialState, claims: input.claims, sources: input.sources, artifact: input.artifact, channel: input.channel, catalog: input.catalog });
}

export function commercialPreparationContextIssues(context: CommercialPreparationContextV1): string[] {
  const errors: string[] = [];
  if (context.schemaVersion !== 1 || context.contextVersion !== COMMERCIAL_PREPARATION_CONTEXT_VERSION) errors.push('UNKNOWN_SCHEMA_VERSION');
  if (!nonEmpty(context.contextId) || !nonEmpty(context.prospectId) || !nonEmpty(context.proposalId)) errors.push('IDENTITY_REQUIRED');
  if (!iso(context.createdAt) || !iso(context.evaluatedAt)) errors.push('INVALID_TIMESTAMP');
  if (context.agent1.decision !== 'ADMITTED' || !nonEmpty(context.agent1.sourceRef) || !nonEmpty(context.agent1.version)) errors.push('AGENT1_AUTHORITY_REQUIRED');
  if (!nonEmpty(context.agent1.opportunity.text) || context.agent1.opportunity.supportingClaimIds.length === 0) errors.push('OPPORTUNITY_REQUIRED');
  const sourceIds = new Set(context.sources.map(s => s.id)); const claimIds = new Set(context.claims.map(c => c.id));
  if (sourceIds.size !== context.sources.length || claimIds.size !== context.claims.length) errors.push('DUPLICATE_REFERENCE');
  for (const source of context.sources) if (!nonEmpty(source.id) || source.prospectId !== context.prospectId || !nonEmpty(source.version) || !nonEmpty(source.fact) || source.trust !== 'DATA_ONLY') errors.push('INVALID_EVIDENCE_SOURCE');
  for (const claim of context.claims) {
    if (claim.scope.prospectId !== context.prospectId || !nonEmpty(claim.id) || !nonEmpty(claim.text) || claim.status === 'UNSUPPORTED' || claim.status === 'CONFLICTED' || claim.sourceRefs.length === 0 || claim.sourceRefs.some(id => !sourceIds.has(id))) errors.push('INVALID_COMMERCIAL_CLAIM');
  }
  if (context.agent1.opportunity.supportingClaimIds.some(id => !claimIds.has(id)) || context.requiredClaimIds.some(id => !claimIds.has(id))) errors.push('INCOMPLETE_CLAIM_GRAPH');
  if (!['RESTAURANTS_BARS_CAFES', 'BEAUTY_HAIR_BARBER', 'LOCAL_RETAIL', 'LOCAL_SERVICES', 'NEUTRAL_EVIDENCE_ONLY'].includes(context.vertical.profile) || context.vertical.version !== 'CP03_VERTICAL_PROFILE_V1') errors.push('INVALID_VERTICAL');
  if (context.commercialState === 'SITE_UNDER_CONSTRUCTION' && !context.claims.some(c => c.status === 'SUPPORTED' && /under construction|rebuilding|en construction|coming soon|en attente de construction/iu.test(`${c.text} ${c.evidenceExcerptOrFact}`))) errors.push('SITE_STATE_UNSUPPORTED');
  const a = context.artifact; if (a.prospectId !== context.prospectId || a.proposalId !== context.proposalId || a.status !== 'PROPOSAL_READY' || !nonEmpty(a.version) || !nonEmpty(a.entryPath) || !nonEmpty(a.buildArtifactId) || !nonEmpty(a.visualQaReportId)) errors.push('INVALID_ARTIFACT');
  if (!['EMAIL', 'MOBILE'].includes(context.channel.type) || !nonEmpty(context.channel.contactRef) || !nonEmpty(context.channel.sourceRef) || !iso(context.channel.verifiedAt)) errors.push('INVALID_CHANNEL_AUTHORITY');
  if (!nonEmpty(context.contactState.sourceRef) || !nonEmpty(context.contactState.suppressionAuthorityRef) || !nonEmpty(context.contactState.firstContactAuthorityRef) || !iso(context.contactState.verifiedAt)) errors.push('INVALID_CONTACT_AUTHORITY');
  if (!context.catalog.scopeConfirmed || context.catalog.version !== catalogVersion() || context.catalog.entryIds.some(id => !context.catalog.entries.some(e => e.offerId === id)) || context.catalog.entries.some(e => !catalogEntryIsCanonical(e))) errors.push('INVALID_CATALOG_AUTHORITY');
  if (context.trace.playbookVersion !== COMMERCIAL_PLAYBOOK_VERSION) errors.push('INVALID_TRACE');
  const { contextId: _contextId, ...withoutId } = context;
  if (commercialPreparationContextId(withoutId) !== context.contextId) errors.push('CONTEXT_ID_MISMATCH');
  return [...new Set(errors)];
}

export function assertCommercialPreparationContext(context: CommercialPreparationContextV1): void { const issues = commercialPreparationContextIssues(context); if (issues.length) throw new Error(`INVALID_COMMERCIAL_PREPARATION_CONTEXT:${issues.join(',')}`); }

export function createCommercialPreparationContext(input: CommercialPreparationContextInput): CommercialPreparationContextV1 {
  if (input.proposal.prospectId !== input.prospectId || input.proposal.status !== 'PROPOSAL_READY') throw new Error('INVALID_PROPOSAL_AUTHORITY');
  const profile = mapTrustedVertical(input.verticalEvidence); const resolved = resolveVerticalProfile(profile);
  const contextWithoutId: Omit<CommercialPreparationContextV1, 'contextId'> = {
    schemaVersion: 1, contextVersion: COMMERCIAL_PREPARATION_CONTEXT_VERSION, prospectId: input.prospectId, proposalId: input.proposal.id,
    createdAt: input.createdAt, evaluatedAt: input.evaluatedAt, agent1: input.agent1, vertical: { profile, version: resolved.version, mappingVersion: 'CP04_VERTICAL_MAPPING_V1' }, commercialState: input.commercialState,
    sources: input.sources, claims: input.claims, requiredClaimIds: input.requiredClaimIds, derivationRules: input.derivationRules,
    artifact: { proposalId: input.proposal.id, prospectId: input.prospectId, status: 'PROPOSAL_READY', version: input.proposal.version, buildArtifactId: input.proposal.buildArtifactId, buildRevision: input.proposal.buildRevision, visualQaReportId: input.proposal.visualQaReportId, entryPath: input.proposal.entryPath, capabilities: [] },
    channel: input.channel, contactState: input.contactState, catalog: { version: catalogVersion(), entryIds: input.catalogEntries.map(e => e.offerId), entries: input.catalogEntries, scopeConfirmed: input.scopeConfirmed, priceAuthorizationRef: input.priceAuthorizationRef ?? null },
    trace: { playbookVersion: COMMERCIAL_PLAYBOOK_VERSION, preparationVersion: input.preparationVersion ?? 'CP04_PREPARATION_V1', cp03Version: input.cp03Version ?? 'CP03_PREPARATION_VERSION', cp02Version: input.cp02Version ?? 'CP02_QUALITY_GATE_V1', sourceVersion: input.sourceVersion ?? 'AGENT1_CONTEXT_V1' },
  };
  const context = { ...contextWithoutId, contextId: commercialPreparationContextId(contextWithoutId) };
  assertCommercialPreparationContext(context); return context;
}

export function serializeCommercialPreparationContext(context: CommercialPreparationContextV1): string { assertCommercialPreparationContext(context); return JSON.stringify(context); }
export function deserializeCommercialPreparationContext(value: string): CommercialPreparationContextV1 { let parsed: unknown; try { parsed = JSON.parse(value); } catch { throw new Error('MALFORMED_COMMERCIAL_CONTEXT_JSON'); } assertCommercialPreparationContext(parsed as CommercialPreparationContextV1); return parsed as CommercialPreparationContextV1; }
