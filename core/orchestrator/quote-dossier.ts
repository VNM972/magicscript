import { classifyCommercialScope, type CommercialScopeProfile } from './commercial-scope';
import { resolvePricingPackage } from './pricing-policy';

export type DossierStatus = 'DRAFT' | 'HUMAN_VALIDATED';
export type DossierEvidenceStatus = 'CONFIRMED' | 'OPERATOR_NOTE' | 'UNKNOWN' | 'SYSTEM_SUGGESTION' | 'CONFLICT';
export type QuoteDossierConflictField = 'commercialNeed' | 'requestedScope' | 'timing' | 'decisionContext';

export interface DossierField {
  value: string | null;
  evidenceStatus: DossierEvidenceStatus;
  provenance: string;
  sourceRef: string | null;
}

export interface QuoteDossier {
  id: string;
  prospectId: string;
  meetingId: string | null;
  sourceCopilotSessionId: string | null;
  status: DossierStatus;
  prospectIdentity: DossierField;
  companyIdentity: DossierField;
  commercialNeed: DossierField;
  requestedScope: DossierField;
  constraints: DossierField[];
  timing: DossierField;
  decisionContext: DossierField;
  blockers: DossierField[];
  validatedRequirements: DossierField[];
  openQuestions: string[];
  recommendedNextAction: DossierField;
  commercialScope: CommercialScopeProfile;
  pricing: DossierField;
  conflicts: string[];
  humanValidatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DossierPrefillInput {
  id: string;
  prospectId: string;
  companyName: string;
  meetingId?: string | null;
  sourceCopilotSessionId?: string | null;
  activity?: string | null;
  primaryFriction?: string | null;
  snapshot?: {
    session_id: string;
    confirmed_facts: Array<{ key: string; value: string; factual_status: string; provenance: string }>;
    validated_knowledge: Array<{ key: string; value: string; source_turn?: string; provenance: string }>;
    operator_notes: string[];
    unknowns: string[];
    inferences_to_review?: string[];
    timing: string | null;
    decision_authority: string;
    active_objections: string[];
    multi_signal_buffer: Array<{ type: string; value: string; factual_status: string; source_turn: string }>;
    next_best_action: { action: string; why: string };
  };
  now: string;
}

function field(value: string | null, evidenceStatus: DossierEvidenceStatus, provenance: string, sourceRef: string | null = null): DossierField {
  return { value: value?.trim() || null, evidenceStatus, provenance, sourceRef };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function buildQuoteDossier(input: DossierPrefillInput): QuoteDossier {
  const snapshot = input.snapshot;
  const confirmed = new Map(
    (snapshot?.confirmed_facts ?? [])
      .filter((item) => item.factual_status === 'CONFIRMED')
      .map((item) => [item.key, item]),
  );
  const validated = new Map((snapshot?.validated_knowledge ?? []).map((item) => [item.key, item]));
  const valueFor = (key: string, fallback: string | null): DossierField => {
    const item = validated.get(key) ?? confirmed.get(key);
    return item
      ? field(item.value, 'CONFIRMED', item.provenance, snapshot?.session_id ?? null)
      : field(fallback, fallback ? 'CONFIRMED' : 'UNKNOWN', fallback ? 'prospect_record' : 'none');
  };
  const signals = snapshot?.multi_signal_buffer ?? [];
  const constraints = signals.filter((item) => ['domain_constraint', 'out_of_scope'].includes(item.type))
    .map((item) => field(item.value, 'OPERATOR_NOTE', 'human_reviewed_call_copilot', `${snapshot?.session_id}:${item.source_turn}`));
  const blockers = [...(snapshot?.active_objections ?? []), ...signals.filter((item) => item.type === 'price_objection').map((item) => item.value)]
    .map((value) => field(value, 'OPERATOR_NOTE', 'human_reviewed_call_copilot', snapshot?.session_id ?? null));
  const requirements = signals.filter((item) => item.type !== 'price_objection' && item.type !== 'explicit_refusal')
    .map((item) => field(item.value, 'OPERATOR_NOTE', 'human_reviewed_call_copilot', `${snapshot?.session_id}:${item.source_turn}`));
  const openQuestions = unique([
    ...(snapshot?.unknowns ?? []),
    ...(snapshot?.inferences_to_review ?? []),
    ...(snapshot?.decision_authority === 'UNKNOWN' ? ['AutoritÃ© de dÃ©cision'] : []),
  ]);
  return {
    id: input.id,
    prospectId: input.prospectId,
    meetingId: input.meetingId ?? null,
    sourceCopilotSessionId: input.sourceCopilotSessionId ?? snapshot?.session_id ?? null,
    status: 'DRAFT',
    prospectIdentity: field(input.prospectId, 'CONFIRMED', 'prospect_record', input.prospectId),
    companyIdentity: valueFor('company_name', input.companyName),
    commercialNeed: valueFor('besoin_confirmÃ©', input.primaryFriction ?? null),
    requestedScope: valueFor('site_scope', null),
    constraints,
    timing: field(snapshot?.timing ?? null, snapshot?.timing ? 'CONFIRMED' : 'UNKNOWN', snapshot?.timing ? 'human_reviewed_call_copilot' : 'none', snapshot?.timing ? snapshot.session_id : null),
    decisionContext: field(snapshot?.decision_authority && snapshot.decision_authority !== 'UNKNOWN' ? snapshot.decision_authority : null, snapshot?.decision_authority && snapshot.decision_authority !== 'UNKNOWN' ? 'OPERATOR_NOTE' : 'UNKNOWN', 'human_reviewed_call_copilot', snapshot?.session_id ?? null),
    blockers,
    validatedRequirements: requirements,
    openQuestions,
    recommendedNextAction: field(snapshot?.next_best_action.action ?? 'TO_DEFINE', 'SYSTEM_SUGGESTION', 'human_reviewed_call_copilot', snapshot?.session_id ?? null),
    commercialScope: { siteKind: null, pageCount: null, lightweightFeatures: [], complexRequirements: [] },
    pricing: field(null, 'UNKNOWN', 'none'),
    conflicts: [],
    humanValidatedAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function mergeQuoteDossier(existing: QuoteDossier, incoming: QuoteDossier): QuoteDossier {
  const resolvable = (conflict: string): boolean =>
    ['commercialNeed', 'requestedScope', 'timing', 'decisionContext'].some((key) => conflict.startsWith(`${key}:`));
  const conflicts = [...existing.conflicts.filter(resolvable)];
  const informationalConflicts = existing.conflicts.filter((conflict) => !resolvable(conflict));
  const mergeField = (key: QuoteDossierConflictField, current: DossierField, next: DossierField): DossierField => {
    if (current.provenance === 'human_conflict_resolution') return current;
    if (current.evidenceStatus === 'CONFIRMED' && next.value && current.value && current.value !== next.value) {
      conflicts.push(`${key}: ${current.provenance}: ${current.value} / ${next.provenance}: ${next.value}`);
      return { ...current, evidenceStatus: 'CONFLICT' };
    }
    if (current.evidenceStatus === 'CONFIRMED' || current.evidenceStatus === 'CONFLICT') return current;
    return next;
  };
  return {
    ...existing,
    ...incoming,
    status: existing.status,
    humanValidatedAt: existing.humanValidatedAt,
    prospectIdentity: existing.prospectIdentity,
    companyIdentity: existing.companyIdentity,
    commercialNeed: mergeField('commercialNeed', existing.commercialNeed, incoming.commercialNeed),
    requestedScope: mergeField('requestedScope', existing.requestedScope, incoming.requestedScope),
    timing: mergeField('timing', existing.timing, incoming.timing),
    decisionContext: mergeField('decisionContext', existing.decisionContext, incoming.decisionContext),
    commercialScope: existing.commercialScope,
    pricing: existing.pricing,
    openQuestions: unique([...existing.openQuestions, ...informationalConflicts, ...incoming.openQuestions]),
    conflicts: unique([...conflicts, ...incoming.conflicts.filter(resolvable)]),
    updatedAt: incoming.updatedAt,
  };
}

export function resolveQuoteDossierConflict(
  dossier: QuoteDossier,
  fieldName: QuoteDossierConflictField,
  value: string,
  now: string,
): QuoteDossier {
  const retainedValue = value.trim();
  if (!retainedValue) throw new Error('Conflict resolution value is required');
  const current = dossier[fieldName];
  if (
    current.evidenceStatus !== 'CONFLICT' ||
    !dossier.conflicts.some((conflict) => conflict.startsWith(`${fieldName}:`))
  ) {
    throw new Error('Requested dossier conflict was not found');
  }
  return {
    ...dossier,
    [fieldName]: {
      value: retainedValue,
      evidenceStatus: 'CONFIRMED',
      provenance: 'human_conflict_resolution',
      sourceRef: dossier.id,
    },
    conflicts: dossier.conflicts.filter((conflict) => !conflict.startsWith(`${fieldName}:`)),
    updatedAt: now,
  };
}

export function applyCommercialScopeProfile(
  dossier: QuoteDossier,
  commercialScope: CommercialScopeProfile,
  now: string,
): QuoteDossier {
  const classification = classifyCommercialScope(commercialScope);

  if (
    classification.status === 'FIXED' &&
    classification.packageId &&
    classification.packageId !== 'CUSTOM'
  ) {
    const pricing = resolvePricingPackage(classification.packageId);

    if (
      pricing.status !== 'FIXED' ||
      pricing.priceCents === null ||
      !pricing.commercialName
    ) {
      throw new Error('Fixed commercial scope did not resolve to fixed canonical pricing');
    }

    return {
      ...dossier,
      commercialScope,
      pricing: {
        value: `${pricing.commercialName} — ${(pricing.priceCents / 100).toFixed(2)} EUR`,
        evidenceStatus: 'CONFIRMED',
        provenance: 'canonical_pricing_policy',
        sourceRef: classification.packageId,
      },
      updatedAt: now,
    };
  }

  return {
    ...dossier,
    commercialScope,
    pricing: {
      value: null,
      evidenceStatus: 'UNKNOWN',
      provenance:
        classification.status === 'FROM'
          ? 'premium_floor_requires_exact_quote'
          : classification.status === 'CUSTOM'
            ? 'custom_quote_required'
            : 'commercial_scope_incomplete',
      sourceRef: classification.packageId,
    },
    updatedAt: now,
  };
}
export function validateQuoteDossier(dossier: QuoteDossier, now: string): QuoteDossier {
  if (dossier.conflicts.length > 0) throw new Error('Dossier conflicts must be resolved before validation');
  return { ...dossier, status: 'HUMAN_VALIDATED', humanValidatedAt: now, updatedAt: now };
}


