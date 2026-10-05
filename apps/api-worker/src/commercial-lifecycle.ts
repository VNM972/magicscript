import {
  COMMERCIAL_PLAYBOOK_VERSION,
  commercialContentRef,
  commercialPreparationContextIssues,
  evaluateCommercialQualityGate,
  prepareCommercialOutreach,
  type CommercialMessageCandidate,
  type CommercialPreparationContextV1,
  type CommercialQualityGateResult,
  type CommercialContext,
  type OutreachChannel,
  type ProposalV1,
} from '@magicscript/core';
import { D1CommercialPreparationContextStore } from '@magicscript/core';
import type { D1DatabaseLike } from '@magicscript/core';

export interface ServerCommercialEnvironment { MAGICSCRIPT_PUBLIC_BASE_URL?: string }
export interface ServerCommercialDraftInput { proposalId: string; channel: OutreachChannel; recipientRef: string }
export interface ServerCommercialContext { proposal: ProposalV1; context: CommercialPreparationContextV1; commercial: CommercialContext; canonicalLink: string }
export type ReloadQualityState = 'READY' | 'NOT_READY' | 'UNPROVEN';
export interface ReloadQualityResult { state: ReloadQualityState; reason: string | null; linkage: Record<string, unknown> | null }
function sha256Hex(value: string): Promise<string> { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then((v) => Array.from(new Uint8Array(v)).map((b) => b.toString(16).padStart(2, '0')).join('')); }
export async function validateReloadQualityLinkage(server: ServerCommercialContext, draft: Record<string, unknown>): Promise<ReloadQualityResult> {
  const raw = draft.quality_gate_json;
  if (typeof raw !== 'string' || !raw.trim()) return { state: 'UNPROVEN', reason: 'QUALITY_METADATA_MISSING', linkage: null };
  let q: Record<string, unknown>;
  try { const parsed: unknown = JSON.parse(raw); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(); q = parsed as Record<string, unknown>; } catch { return { state: 'NOT_READY', reason: 'QUALITY_METADATA_MALFORMED', linkage: null }; }
  const revision = Number(draft.revision), channel = String(draft.channel);
  let assertions: unknown[]; try { const x=JSON.parse(String(draft.grounding_json ?? '[]')); if (!Array.isArray(x)) throw new Error(); assertions=x; } catch { return { state: 'NOT_READY', reason: 'DRAFT_CONTENT_MALFORMED', linkage: q }; }
  if (!Number.isInteger(revision) || (channel !== 'EMAIL' && channel !== 'MOBILE')) return { state: 'NOT_READY', reason: 'DRAFT_CONTENT_MALFORMED', linkage: q };
  const candidate: any = { channel, subject: channel === 'EMAIL' ? (draft.subject == null ? null : String(draft.subject)) : null, body: String(draft.body ?? ''), transportSignature: null, composition: channel === 'EMAIL' ? 'EMAIL_ORIGINAL' : 'MOBILE_ORIGINAL', assertions, catalogMentions: [], revision, contentRef: '', approval: null };
  candidate.contentRef = commercialContentRef(candidate);
  const expectedHash = await sha256Hex(channel + ':' + String(draft.recipient_ref) + ':' + candidate.body + ':' + server.canonicalLink + ':' + (candidate.subject ?? ''));
  const checks: [boolean,string][] = [
    [q.schemaVersion === 'CP04_QUALITY_LINKAGE_V1', 'QUALITY_SCHEMA_UNSUPPORTED'], [q.gateVersion === 'AGENT3_COMMERCIAL_QUALITY_GATE_V1', 'QUALITY_GATE_UNSUPPORTED'],
    [q.contextId === server.context.contextId && q.contextVersion === server.context.contextVersion, 'CONTEXT_MISMATCH'], [q.prospectId === server.proposal.prospectId && q.proposalId === server.proposal.id, 'PROPOSAL_CONTEXT_MISMATCH'],
    [q.revision === revision, 'REVISION_MISMATCH'], [q.cp04ContentRef === candidate.contentRef, 'CONTENT_REF_MISMATCH'], [String(draft.content_hash) === expectedHash, 'CONTENT_HASH_MISMATCH'], [q.channel === channel, 'CHANNEL_MISMATCH'],
    [q.artifactId === server.context.artifact.buildArtifactId && q.artifactVersion === server.context.artifact.version, 'ARTIFACT_MISMATCH'], [q.canonicalLink === server.canonicalLink && draft.proposal_link === server.canonicalLink, 'CANONICAL_LINK_MISMATCH'], [q.status === 'READY' && q.decision === 'READY_FOR_OPERATOR', 'QUALITY_NOT_READY'] ];
  const failed=checks.find(([ok])=>!ok); return failed ? { state:'NOT_READY', reason:failed[1], linkage:q } : { state:'READY', reason:null, linkage:q };
}

export async function requireCurrentQuality(server: ServerCommercialContext, draft: Record<string, unknown>): Promise<void> { const result = await validateReloadQualityLinkage(server, draft); if (result.state !== 'READY') throw new Error('CP04_QUALITY_' + (result.reason ?? 'NOT_READY')); }

function required(value: unknown, name: string): string { if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`); return value.trim(); }
function canonicalLink(env: ServerCommercialEnvironment, proposal: ProposalV1): string {
  const base = required(env.MAGICSCRIPT_PUBLIC_BASE_URL, 'MAGICSCRIPT_PUBLIC_BASE_URL');
  let url: URL;
  try { url = new URL(base); } catch { throw new Error('INVALID_PUBLIC_BASE_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('INVALID_PUBLIC_BASE_URL');
  const path = proposal.entryPath.startsWith('/') ? proposal.entryPath : `/${proposal.entryPath}`;
  return new URL(path, url).toString();
}
function proposalFromRow(row: { proposal_json?: string; id?: string; prospect_id?: string; status?: string }): ProposalV1 {
  if (!row.proposal_json) throw new Error('PROPOSAL_AUTHORITY_MISSING');
  let parsed: unknown; try { parsed = JSON.parse(row.proposal_json); } catch { throw new Error('MALFORMED_PROPOSAL_AUTHORITY'); }
  const proposal = parsed as ProposalV1;
  if (proposal.id !== row.id || proposal.prospectId !== row.prospect_id || proposal.status !== 'PROPOSAL_READY') throw new Error('INVALID_PROPOSAL_AUTHORITY');
  return proposal;
}
function toCommercial(context: CommercialPreparationContextV1, link: string, channel: OutreachChannel, contactRef: string, suppression: 'CLEAR' | 'SUPPRESSED' | 'OPPOSED' | 'UNKNOWN', firstContact: 'NOT_CONTACTED' | 'CONTACTED' | 'DUPLICATE' | 'UNKNOWN'): CommercialContext {
  if (commercialPreparationContextIssues(context).length) throw new Error('INVALID_COMMERCIAL_PREPARATION_CONTEXT');
  const selected = context.channel.type === channel && context.channel.contactRef === contactRef;
  return {
    playbookVersion: COMMERCIAL_PLAYBOOK_VERSION,
    prospect: { id: context.prospectId, name: context.prospectId, contactName: null, vertical: context.vertical.profile },
    agent1: context.agent1,
    commercialState: context.commercialState,
    channel,
    authorizedChannels: selected ? [{ channel, contactRef, sourceRef: context.channel.sourceRef, verifiedAt: context.channel.verifiedAt }] : [],
    whatsAppAvailability: 'UNKNOWN',
    contactState: { suppression, firstContact, sourceRef: context.contactState.sourceRef, verifiedAt: context.contactState.verifiedAt },
    artifact: { id: context.artifact.buildArtifactId, version: context.artifact.version, prospectId: context.prospectId, type: 'PROPOSAL', status: 'READY', canonicalLink: link, capabilities: context.artifact.capabilities },
    sources: context.sources, claims: context.claims, requiredClaimIds: context.requiredClaimIds, derivationRules: context.derivationRules,
    catalog: context.catalog.entries, priceAuthorization: context.catalog.priceAuthorizationRef ? { actor: context.catalog.priceAuthorizationRef, at: context.evaluatedAt, offerIds: context.catalog.entryIds } : null,
    scopeConfirmed: context.catalog.scopeConfirmed, evaluatedAt: context.evaluatedAt,
  };
}
export async function loadServerCommercialContext(db: D1DatabaseLike, env: ServerCommercialEnvironment, input: ServerCommercialDraftInput): Promise<ServerCommercialContext> {
  const row = await db.prepare('SELECT id, prospect_id, status, proposal_json FROM v2_proposals WHERE id = ? LIMIT 1').bind(input.proposalId).first<{ id: string; prospect_id: string; status: string; proposal_json: string }>();
  if (!row || row.status !== 'PROPOSAL_READY') throw new Error('PROPOSAL_NOT_READY');
  const proposal = proposalFromRow(row);
  const context = await new D1CommercialPreparationContextStore(db).getLatestCommercialPreparationContextForProposal(input.proposalId);
  if (!context || context.proposalId !== proposal.id || context.prospectId !== proposal.prospectId) throw new Error('COMMERCIAL_CONTEXT_NOT_FOUND');
  const link = canonicalLink(env, proposal);
  if (context.artifact.entryPath !== proposal.entryPath) throw new Error('ARTIFACT_LINK_MISMATCH');
  const channel = input.channel;
  const contact = await db.prepare('SELECT id, email, is_suppressed FROM contacts WHERE id = ? AND prospect_id = ? AND is_validated = 1 LIMIT 1').bind(input.recipientRef, proposal.prospectId).first<{ id: string; email: string; is_suppressed: number }>();
  const listed = contact ? await db.prepare('SELECT email FROM suppression_list WHERE lower(email) = lower(?) LIMIT 1').bind(contact.email).first<{ email: string }>() : null;
  const suppression = contact ? (contact.is_suppressed || listed ? 'SUPPRESSED' : 'CLEAR') : 'UNKNOWN';
  const contacted = await db.prepare('SELECT 1 FROM v2_contacted WHERE proposal_id = ? AND prospect_id = ? AND channel = ? LIMIT 1').bind(proposal.id, proposal.prospectId, channel).first();
  const commercial = toCommercial(context, link, channel, input.recipientRef, suppression, contacted ? 'CONTACTED' : 'NOT_CONTACTED');
  if (!commercial.authorizedChannels.length) throw new Error('CHANNEL_NOT_AUTHORIZED');
  if (context.artifact.prospectId !== proposal.prospectId) throw new Error('ARTIFACT_PROSPECT_MISMATCH');
  return { proposal, context, commercial, canonicalLink: link };
}
export function prepareServerCommercialDraft(server: ServerCommercialContext): { candidate: CommercialMessageCandidate; gate: CommercialQualityGateResult; preparationAttempt: number } {
  const prepared = prepareCommercialOutreach(server.commercial);
  if (prepared.decision !== 'READY_FOR_OPERATOR' || !prepared.candidate || !prepared.qualityGate) throw new Error(`COMMERCIAL_PREPARATION_${prepared.decision}:${prepared.qualityGate?.abstentionReason ?? prepared.qualityGate?.blockers.join(',') ?? 'NO_RESULT'}`);
  return { candidate: prepared.candidate, gate: prepared.qualityGate, preparationAttempt: prepared.trace.attempts };
}
export function evaluateServerCommercialEdit(server: ServerCommercialContext, draft: { subject: string | null; body: string; revision: number }, nextRevision: number): { candidate: CommercialMessageCandidate; gate: CommercialQualityGateResult } {
  const candidate: CommercialMessageCandidate = { channel: server.commercial.channel, subject: server.commercial.channel === 'EMAIL' ? draft.subject : null, body: draft.body, transportSignature: null, composition: server.commercial.channel === 'EMAIL' ? 'EMAIL_ORIGINAL' : 'MOBILE_ORIGINAL', assertions: server.commercial.claims.filter(c => draft.body.includes(c.text)).map(c => ({ claimId: c.id, text: c.text })), catalogMentions: [], revision: nextRevision, contentRef: '', approval: null };
  candidate.contentRef = commercialContentRef(candidate);
  const gate = evaluateCommercialQualityGate({ context: server.commercial, candidate, expectedOutcome: { decision: 'GENERATE', reason: null }, semanticAssessment: { specificity: 4, commercialRelevance: 4, humanness: 4, channelFit: 4, ctaQuality: 4, concision: 4, antiGenericQuality: 4, assessor: 'CP04_OPERATOR_EDIT_V1' } });
  return { candidate, gate };
}
export function qualityLinkage(server: ServerCommercialContext, gate: CommercialQualityGateResult, candidate: CommercialMessageCandidate, revision: number, attempt: number): Record<string, unknown> {
  return { schemaVersion: 'CP04_QUALITY_LINKAGE_V1', contextId: server.context.contextId, contextVersion: server.context.contextVersion, preparationVersion: server.context.trace.preparationVersion, cp02Version: server.context.trace.cp02Version, decision: gate.decision, gateVersion: gate.qualityGateVersion, status: gate.decision === 'READY_FOR_OPERATOR' ? 'READY' : gate.decision, score: gate.totalScore, blockers: gate.blockers, warnings: gate.warnings, qualityDimensions: gate.qualityDimensions, cp04ContentRef: candidate.contentRef, revision, prospectId: server.context.prospectId, proposalId: server.context.proposalId, artifactId: server.context.artifact.buildArtifactId, artifactVersion: server.context.artifact.version, canonicalLink: server.canonicalLink, channel: server.commercial.channel, claimsUsed: candidate.assertions.map(a => a.claimId), catalogVersion: server.context.catalog.version, commercialState: server.context.commercialState, verticalProfile: server.context.vertical.profile, preparationAttempt: attempt, evaluatedAt: new Date().toISOString() };
}
