import type { Prospect } from '../types/prospect';

export type ConversationMode =
  | 'DISCOVERY'
  | 'QUALIFICATION'
  | 'OBJECTION'
  | 'READY_TO_CLOSE'
  | 'QUOTE_READY'
  | 'NOT_READY'
  | 'EXIT';

export type NextBestAction =
  | 'DISCOVER'
  | 'CLARIFY'
  | 'HANDLE_OBJECTION'
  | 'SHOW_VALUE'
  | 'SHOW_PROTOTYPE'
  | 'DISCUSS_PRICE_OR_TERMS'
  | 'MOVE_TO_QUOTE'
  | 'PAUSE_AND_DEFER'
  | 'EXIT_GRACEFULLY';

export type CopilotProvenance =
  | 'PREEXISTING_CONFIRMED_FACT'
  | 'STATED_BY_PROSPECT'
  | 'OPERATOR_PARAPHRASE'
  | 'OPERATOR_NOTE'
  | 'INFERRED_FROM_CONTEXT'
  | 'MODEL_PREDICTION';

export type FactualStatus = 'CONFIRMED' | 'UNVALIDATED' | 'UNKNOWN' | 'REJECTED';
export type QualitativeConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CopilotFact {
  key: string;
  value: string;
  provenance: CopilotProvenance;
  factual_status: FactualStatus;
  source_turn?: string;
  recorded_at: string;
  raw_operator_input?: string;
}

export interface CopilotPrediction {
  id: string;
  text: string;
  category: 'VALUE' | 'OBJECTION' | 'DEFER' | 'NEXT_STEP';
  provenance: 'MODEL_PREDICTION';
  selected: false;
}

export type OperatorInputKind =
  | 'OPERATOR_SELECTED_PREDICTION'
  | 'OPERATOR_PARAPHRASE'
  | 'OPERATOR_NOTE'
  | 'VALIDATED_KNOWLEDGE'
  | 'FEEDBACK';

export interface OperatorInput {
  input_id: string;
  kind: OperatorInputKind;
  value: string;
  provenance: Exclude<CopilotProvenance, 'MODEL_PREDICTION' | 'STATED_BY_PROSPECT'>;
  created_at: string;
  source_turn?: string;
  prediction_id?: string;
  raw_operator_input?: string;
}

export interface ValidatedKnowledge extends CopilotFact {
  provenance: 'OPERATOR_PARAPHRASE' | 'OPERATOR_NOTE' | 'PREEXISTING_CONFIRMED_FACT';
  factual_status: 'CONFIRMED';
  validated_at: string;
}

export interface MultiSignal {
  type: string;
  value: string;
  qualitative_confidence: QualitativeConfidence;
  provenance: 'OPERATOR_PARAPHRASE';
  source_turn: string;
  factual_status: 'UNVALIDATED';
  related_objection?: string;
  blocker?: string;
  condition?: string;
}

export interface AuditEntry {
  at: string;
  action: string;
  detail: string;
  provenance?: CopilotProvenance;
  source_turn?: string;
}

export interface CallCopilotInitialContext {
  prospectId: string;
  meetingId?: string;
  companyName: string;
  activity?: string;
  location?: string;
  websiteUrl?: string;
  prototypeUrl?: string;
  salesRoomUrl?: string;
  primaryNeed?: string;
  primaryFriction?: string;
  confirmedFacts?: Array<{ key: string; value: string }>;
  unknowns?: string[];
  engagementSummary?: string;
  engagementHistory?: string[];
}

export interface CallCopilotContextProjection {
  activity?: string;
  location?: string;
  website_url?: string;
  prototype_url?: string;
  sales_room_url?: string;
  engagement_summary?: string;
  engagement_history: string[];
}

export interface NextBestActionState {
  action: NextBestAction;
  why: string;
}

export interface OfferSuggestions {
  basic: string;
  premium: string;
}

export interface CallCopilotSnapshot {
  session_id: string;
  prospect_id: string;
  meeting_id?: string;
  company_name: string;
  initial_context: CallCopilotContextProjection;
  conversation_mode: ConversationMode;
  primary_need: string | null;
  secondary_needs: string[];
  active_objections: string[];
  confirmed_facts: CopilotFact[];
  operator_notes: string[];
  hypotheses: string[];
  unknowns: string[];
  decision_authority: string;
  consultation_required: boolean;
  timing: string | null;
  price_information: string | null;
  multi_signal_buffer: MultiSignal[];
  context_drift: boolean;
  closing_readiness_factors: string[];
  next_best_action: NextBestActionState;
  stop_discovery: boolean;
  audit_trail: AuditEntry[];
  predictions: CopilotPrediction[];
  operator_inputs: OperatorInput[];
  validated_knowledge: ValidatedKnowledge[];
  feedback: string[];
  alerts: Array<'BLOCKER' | 'CONTRADICTION' | 'UNKNOWN_CRITICAL' | 'READY_TO_CLOSE' | 'STOP_DISCOVERY'>;
  offer_suggestions: OfferSuggestions;
  last_source_turn: string | null;
  engine_version: string;
  rules_version: string;
  prompt_version: string;
  updated_at: string;
}

export type CallCopilotAction =
  | { type: 'PROSPECT_RESPONSE'; text: string; at?: string }
  | { type: 'SELECT_PREDICTION'; predictionId: string; at?: string }
  | { type: 'OPERATOR_NOTE'; text: string; at?: string }
  | { type: 'VALIDATE_KNOWLEDGE'; key: string; value: string; rawInput?: string; at?: string }
  | { type: 'REJECT_KNOWLEDGE'; key: string; reason?: string; at?: string }
  | { type: 'SET_DECISION_AUTHORITY'; value: string; at?: string }
  | { type: 'FEEDBACK'; value: string; at?: string };

export const CALL_COPILOT_ENGINE_VERSION = '1.0.0';
export const CALL_COPILOT_RULES_VERSION = '1.0.0';
export const CALL_COPILOT_PROMPT_VERSION = 'none-deterministic';

function clean(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function id(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

function contains(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function signal(
  type: string,
  value: string,
  sourceTurn: string,
  at: string,
  options: Partial<Pick<MultiSignal, 'qualitative_confidence' | 'related_objection' | 'blocker' | 'condition'>> = {},
): MultiSignal {
  return {
    type,
    value,
    qualitative_confidence: options.qualitative_confidence ?? 'MEDIUM',
    provenance: 'OPERATOR_PARAPHRASE',
    source_turn: sourceTurn,
    factual_status: 'UNVALIDATED',
    ...options,
  };
}

export function extractMultiSignals(
  input: string,
  sourceTurn: string,
  at = new Date().toISOString(),
): MultiSignal[] {
  const text = clean(input).toLocaleLowerCase('fr-FR').replace(/[’‘]/g, "'");
  if (!text) return [];
  const signals: MultiSignal[] = [];

  if (contains(text, [/prototype.{0,35}(plai|plaît|convain|intéress|interess|bien)/i, /ça me plaît/i, /cela me plaît/i])) {
    signals.push(signal('prototype_acceptance', 'prototype apprécié ou jugé pertinent', sourceTurn, at, { qualitative_confidence: 'HIGH' }));
  }
  if (contains(text, [/déjà.{0,35}(payé|paye|prestataire|agence|quelqu'un)/i, /payé.{0,20}(quelqu'un|agence|prestataire)/i, /ancien.{0,20}(site|prestataire)/i, /quelqu'un s'en occupe/i])) {
    signals.push(signal('past_provider_or_investment', 'prestataire ou investissement antérieur mentionné', sourceTurn, at, { qualitative_confidence: 'HIGH' }));
  }
  if (contains(text, [/trop cher/i, /budget/i, /ne veux pas.{0,20}(payer|remettre)/i, /pas.{0,15}3\s?000/i, /prix.{0,20}(bloque|problème|probleme)/i])) {
    signals.push(signal('price_objection', 'réserve ou contrainte liée au prix/budget', sourceTurn, at, {
      qualitative_confidence: 'HIGH',
      related_objection: 'PRICE',
      blocker: 'La contrainte prix doit être clarifiée avant un engagement.',
    }));
  }
  if (contains(text, [/garder.{0,25}domaine/i, /conserver.{0,25}domaine/i, /mon domaine/i])) {
    signals.push(signal('domain_constraint', 'souhaite conserver son domaine', sourceTurn, at, { qualitative_confidence: 'HIGH', condition: 'Le domaine existant doit rester utilisable.' }));
  }
  if (contains(text, [/ça m'intéresse.{0,30}si/i, /cela m'intéresse.{0,30}si/i, /si.{0,50}(ça|cela) m'intéresse/i, /garder.{0,40}m'intéresse/i, /intéressé.{0,30}si/i, /pourquoi pas.{0,30}si/i])) {
    signals.push(signal('conditional_interest', 'intérêt conditionnel exprimé', sourceTurn, at, { qualitative_confidence: 'MEDIUM', condition: 'Une condition explicitement formulée reste à traiter.' }));
  }
  if (contains(text, [/\bdevis\b/i, /proposition chiffrée/i, /envoyez.{0,20}(prix|proposition)/i, /juste un devis/i])) {
    signals.push(signal('request_quote', 'demande explicite de devis ou proposition', sourceTurn, at, { qualitative_confidence: 'HIGH' }));
  }
  if (contains(text, [/combien/i, /quel est le prix/i, /quel tarif/i, /tarif/i, /coûte/i, /coute/i, /remise/i, /réduction/i, /reduction/i])) {
    signals.push(signal('price_question', 'question sur le prix ou les conditions', sourceTurn, at, { qualitative_confidence: 'HIGH' }));
  }
  if (contains(text, [/associé/i, /associe/i, /partenaire/i, /décideur/i, /decideur/i, /je dois consulter/i, /en parler à/i])) {
    signals.push(signal('consultation_required', 'consultation d’un associé ou décideur mentionnée', sourceTurn, at, { qualitative_confidence: 'HIGH' }));
  }
  if (contains(text, [/pas intéressé/i, /pas interesse/i, /ne m'intéresse pas/i, /ne m'interesse pas/i, /non merci/i, /arrêtez/i, /arretez/i, /stop/i])) {
    signals.push(signal('explicit_refusal', 'refus explicite', sourceTurn, at, { qualitative_confidence: 'HIGH', blocker: 'Refus explicite : ne pas pousser ni proposer un devis.' }));
  }
  if (contains(text, [/remplacer.{0,25}(ancien|site)/i, /refaire complètement/i, /nouveau site/i])) {
    signals.push(signal('site_scope', 'remplacement ou refonte du site évoqué', sourceTurn, at, { qualitative_confidence: 'MEDIUM' }));
  }
  if (contains(text, [/garder.{0,25}(ancien|site)/i, /conserver.{0,25}(ancien|site)/i, /ne pas changer.{0,20}site/i])) {
    signals.push(signal('site_scope', 'conservation du site existant évoquée', sourceTurn, at, { qualitative_confidence: 'MEDIUM' }));
  }
  if (contains(text, [/urgent/i, /au plus vite/i, /cette semaine/i, /dès que possible/i, /des que possible/i])) {
    signals.push(signal('timing', 'timing rapproché mentionné', sourceTurn, at, { qualitative_confidence: 'MEDIUM' }));
  }
  if (contains(text, [/pas urgent/i, /pas d'urgence/i, /pas d'urgence/i, /plus tard/i, /aucune urgence/i])) {
    signals.push(signal('timing', 'absence d’urgence mentionnée', sourceTurn, at, { qualitative_confidence: 'MEDIUM' }));
  }
  if (contains(text, [/google/i, /référencement/i, /referencement/i, /seo/i])) {
    signals.push(signal('seo_request', 'besoin de visibilité ou référencement évoqué', sourceTurn, at, { qualitative_confidence: 'MEDIUM' }));
  }
  if (contains(text, [/hors périmètre/i, /hors perimetre/i, /application métier/i, /application metier/i, /e-commerce complexe/i])) {
    signals.push(signal('out_of_scope', 'demande potentiellement hors périmètre', sourceTurn, at, { qualitative_confidence: 'MEDIUM', blocker: 'La compatibilité avec le périmètre doit être vérifiée.' }));
  }
  if (contains(text, [/prochaine étape/i, /prochaine etape/i, /on avance/i, /avancer/i, /commencer/i, /lancer le projet/i, /on fait ça/i])) {
    signals.push(signal('explicit_next_step', 'projection explicite vers la prochaine étape', sourceTurn, at, { qualitative_confidence: 'HIGH' }));
  }

  return signals;
}

function hasSignal(snapshot: CallCopilotSnapshot, ...types: string[]): boolean {
  return snapshot.multi_signal_buffer.some((item) => types.includes(item.type));
}

function hasActiveObjection(snapshot: CallCopilotSnapshot): boolean {
  return snapshot.active_objections.length > 0;
}

function hasMaterialContradiction(snapshot: CallCopilotSnapshot): boolean {
  return snapshot.context_drift;
}

function closingSignal(snapshot: CallCopilotSnapshot): boolean {
  return hasSignal(snapshot, 'request_quote', 'explicit_next_step') ||
    (hasSignal(snapshot, 'conditional_interest') && hasSignal(snapshot, 'timing'));
}

function deriveClosingFactors(snapshot: CallCopilotSnapshot): string[] {
  const factors: string[] = [];
  if (hasSignal(snapshot, 'request_quote')) factors.push('demande explicite de devis');
  if (hasSignal(snapshot, 'explicit_next_step')) factors.push('question ou projection vers la prochaine étape');
  if (hasSignal(snapshot, 'prototype_acceptance')) factors.push('prototype accepté ou jugé pertinent');
  if (hasSignal(snapshot, 'timing')) factors.push('timing concret');
  if (hasSignal(snapshot, 'price_question')) factors.push('conditions commerciales demandées');
  if (hasSignal(snapshot, 'explicit_refusal')) factors.push('refus explicite : facteur bloquant');
  if (hasSignal(snapshot, 'price_objection')) factors.push('objection prix non résolue : facteur bloquant');
  if (hasSignal(snapshot, 'consultation_required')) factors.push('consultation externe potentiellement nécessaire');
  if (snapshot.context_drift) factors.push('contradiction matérielle à clarifier');
  return unique(factors);
}

export function deriveNextBestAction(snapshot: CallCopilotSnapshot): {
  mode: ConversationMode;
  next: NextBestActionState;
  stopDiscovery: boolean;
} {
  if (hasSignal(snapshot, 'explicit_refusal')) {
    return { mode: 'EXIT', next: { action: 'EXIT_GRACEFULLY', why: 'Le prospect a exprimé un refus explicite ; ne pas pousser ni proposer un devis.' }, stopDiscovery: false };
  }
  if (hasMaterialContradiction(snapshot)) {
    return { mode: 'OBJECTION', next: { action: 'CLARIFY', why: 'Deux informations incompatibles ont été relevées ; il faut clarifier avant de poursuivre.' }, stopDiscovery: false };
  }
  if (hasActiveObjection(snapshot)) {
    return { mode: 'OBJECTION', next: { action: 'HANDLE_OBJECTION', why: 'Une réserve matérielle reste active et doit être traitée avant tout closing.' }, stopDiscovery: false };
  }
  if (snapshot.consultation_required && !closingSignal(snapshot)) {
    return { mode: 'NOT_READY', next: { action: 'PAUSE_AND_DEFER', why: 'Le prospect doit encore consulter un associé ou un décideur.' }, stopDiscovery: false };
  }
  if (closingSignal(snapshot)) {
    return { mode: 'READY_TO_CLOSE', next: { action: 'MOVE_TO_QUOTE', why: 'Le prospect a fourni un signal explicite pour passer à la prochaine étape ; ne pas requalifier inutilement.' }, stopDiscovery: true };
  }
  if (hasSignal(snapshot, 'price_question')) {
    return { mode: 'QUALIFICATION', next: { action: 'DISCUSS_PRICE_OR_TERMS', why: 'Le prospect demande des éléments de prix ou de conditions ; ne rien inventer.' }, stopDiscovery: false };
  }
  if (hasSignal(snapshot, 'seo_request')) {
    return { mode: 'QUALIFICATION', next: { action: 'SHOW_VALUE', why: 'Le besoin de visibilité est évoqué ; préciser l’objectif sans promettre de résultat SEO.' }, stopDiscovery: false };
  }
  if (hasSignal(snapshot, 'prototype_acceptance')) {
    return { mode: 'QUALIFICATION', next: { action: 'SHOW_VALUE', why: 'Le prototype sert de base concrète pour comprendre le besoin et la valeur.' }, stopDiscovery: false };
  }
  return { mode: snapshot.audit_trail.length > 2 ? 'QUALIFICATION' : 'DISCOVERY', next: { action: 'DISCOVER', why: 'Poursuivre la découverte avec une question courte et contextualisée.' }, stopDiscovery: false };
}

function buildPredictions(snapshot: CallCopilotSnapshot): CopilotPrediction[] {
  const items: Array<Pick<CopilotPrediction, 'text' | 'category'>> = [];
  if (hasSignal(snapshot, 'price_objection')) {
    items.push({ text: 'Le budget est le point qui me bloque pour le moment.', category: 'OBJECTION' });
    items.push({ text: 'Je veux comprendre ce qui est compris avant de décider.', category: 'OBJECTION' });
  } else if (snapshot.next_best_action.action === 'MOVE_TO_QUOTE') {
    items.push({ text: 'Oui, envoyez-moi la proposition pour que nous avancions.', category: 'NEXT_STEP' });
    items.push({ text: 'Quelle est la prochaine étape concrète ?', category: 'NEXT_STEP' });
  } else if (hasSignal(snapshot, 'prototype_acceptance')) {
    items.push({ text: 'Oui, c’est exactement le type de présence que nous cherchons.', category: 'VALUE' });
    items.push({ text: 'J’aimerais voir comment cela s’adapterait à notre activité.', category: 'VALUE' });
  } else {
    items.push({ text: 'Oui, justement, j’aimerais améliorer cette partie.', category: 'VALUE' });
    items.push({ text: 'Ce n’est pas vraiment une priorité actuellement.', category: 'DEFER' });
    items.push({ text: 'J’ai déjà quelqu’un qui s’en occupe.', category: 'OBJECTION' });
  }
  return items.slice(0, 3).map((item, index) => ({ id: id('prediction', index), ...item, provenance: 'MODEL_PREDICTION', selected: false }));
}

function buildOfferSuggestions(snapshot: CallCopilotSnapshot): OfferSuggestions {
  const need = snapshot.primary_need ?? 'la présence digitale de l’entreprise';
  const objection = snapshot.active_objections[0];
  const basic = objection
    ? `BASIC · Clarifier ${objection.toLocaleLowerCase('fr-FR')} puis proposer une prochaine étape simple autour de ${need}.`
    : `BASIC · Une proposition simple pour améliorer ${need}, avec une prochaine étape claire.`;
  const premium = hasSignal(snapshot, 'seo_request')
    ? `PREMIUM · Construire une présence cohérente autour de ${need}, puis définir les indicateurs à suivre sans avancer de résultat.`
    : `PREMIUM · Un accompagnement plus personnalisé pour structurer ${need}, les contenus utiles et les décisions à venir.`;
  return { basic, premium };
}

function initialFacts(context: CallCopilotInitialContext, at: string): CopilotFact[] {
  const facts = context.confirmedFacts ?? [];
  return facts.map((fact) => ({
    key: fact.key,
    value: clean(fact.value),
    provenance: 'PREEXISTING_CONFIRMED_FACT',
    factual_status: 'CONFIRMED',
    recorded_at: at,
  }));
}

export function buildCallCopilotSnapshot(
  context: CallCopilotInitialContext,
  now = new Date().toISOString(),
  sessionId = `call-${context.prospectId}`,
): CallCopilotSnapshot {
  const primaryNeed = clean(context.primaryNeed || context.primaryFriction);
  const snapshot: CallCopilotSnapshot = {
    session_id: sessionId,
    prospect_id: context.prospectId,
    ...(context.meetingId ? { meeting_id: context.meetingId } : {}),
    company_name: clean(context.companyName),
    initial_context: {
      ...(context.activity ? { activity: clean(context.activity) } : {}),
      ...(context.location ? { location: clean(context.location) } : {}),
      ...(context.websiteUrl ? { website_url: clean(context.websiteUrl) } : {}),
      ...(context.prototypeUrl ? { prototype_url: clean(context.prototypeUrl) } : {}),
      ...(context.salesRoomUrl ? { sales_room_url: clean(context.salesRoomUrl) } : {}),
      ...(context.engagementSummary ? { engagement_summary: clean(context.engagementSummary) } : {}),
      engagement_history: [...(context.engagementHistory ?? [])],
    },
    conversation_mode: 'DISCOVERY',
    primary_need: primaryNeed || null,
    secondary_needs: [],
    active_objections: [],
    confirmed_facts: initialFacts(context, now),
    operator_notes: [],
    hypotheses: [],
    unknowns: unique([...(context.unknowns ?? []), ...(context.prototypeUrl ? [] : ['Lien prototype']), ...(context.salesRoomUrl ? [] : ['Lien Sales Room'])]),
    decision_authority: 'UNKNOWN',
    consultation_required: false,
    timing: null,
    price_information: null,
    multi_signal_buffer: [],
    context_drift: false,
    closing_readiness_factors: [],
    next_best_action: { action: 'DISCOVER', why: 'Commencer par comprendre le besoin concret du prospect.' },
    stop_discovery: false,
    audit_trail: [{ at: now, action: 'SESSION_STARTED', detail: `Session texte + clics ouverte pour ${clean(context.companyName)}.` }],
    predictions: [],
    operator_inputs: [],
    validated_knowledge: [],
    feedback: [],
    alerts: [],
    offer_suggestions: { basic: '', premium: '' },
    last_source_turn: null,
    engine_version: CALL_COPILOT_ENGINE_VERSION,
    rules_version: CALL_COPILOT_RULES_VERSION,
    prompt_version: CALL_COPILOT_PROMPT_VERSION,
    updated_at: now,
  };
  snapshot.predictions = buildPredictions(snapshot);
  snapshot.offer_suggestions = buildOfferSuggestions(snapshot);
  return snapshot;
}

function cloneSnapshot(snapshot: CallCopilotSnapshot): CallCopilotSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as CallCopilotSnapshot;
}

function recompute(snapshot: CallCopilotSnapshot): void {
  const derived = deriveNextBestAction(snapshot);
  snapshot.conversation_mode = derived.mode;
  snapshot.next_best_action = derived.next;
  snapshot.stop_discovery = derived.stopDiscovery;
  snapshot.closing_readiness_factors = deriveClosingFactors(snapshot);
  snapshot.alerts = [];
  if (hasActiveObjection(snapshot)) snapshot.alerts.push('BLOCKER');
  if (snapshot.context_drift) snapshot.alerts.push('CONTRADICTION');
  if (snapshot.unknowns.some((item) => /prix|délai|duree|fonctionnalité|seo|référencement/i.test(item))) snapshot.alerts.push('UNKNOWN_CRITICAL');
  if (snapshot.conversation_mode === 'READY_TO_CLOSE') snapshot.alerts.push('READY_TO_CLOSE');
  if (snapshot.stop_discovery) snapshot.alerts.push('STOP_DISCOVERY');
  snapshot.predictions = buildPredictions(snapshot);
  snapshot.offer_suggestions = buildOfferSuggestions(snapshot);
}

function addAudit(snapshot: CallCopilotSnapshot, entry: AuditEntry): void {
  snapshot.audit_trail.push(entry);
}

function detectContextDrift(snapshot: CallCopilotSnapshot): void {
  const siteScope = snapshot.multi_signal_buffer.filter((item) => item.type === 'site_scope').map((item) => item.value);
  const hasReplace = siteScope.some((value) => /remplacement|refonte/i.test(value));
  const hasKeep = siteScope.some((value) => /conservation/i.test(value));
  const priorScope = snapshot.confirmed_facts.find((item) => item.key === 'site_scope')?.value ?? '';
  if ((hasReplace && hasKeep) || (hasReplace && /conserver|garder/i.test(priorScope)) || (hasKeep && /remplacer|refonte/i.test(priorScope))) snapshot.context_drift = true;
}

export function applyCallCopilotAction(
  original: CallCopilotSnapshot,
  action: CallCopilotAction,
  at = new Date().toISOString(),
): CallCopilotSnapshot {
  const snapshot = cloneSnapshot(original);
  const timestamp = action.at ?? at;
  if (action.type === 'PROSPECT_RESPONSE') {
    const text = clean(action.text);
    if (!text) throw new Error('Prospect response cannot be empty');
    const sourceTurn = `turn-${snapshot.audit_trail.filter((entry) => entry.action === 'PROSPECT_RESPONSE').length + 1}`;
    const input: OperatorInput = {
      input_id: `operator-${snapshot.operator_inputs.length + 1}`,
      kind: 'OPERATOR_PARAPHRASE',
      value: text,
      provenance: 'OPERATOR_PARAPHRASE',
      created_at: timestamp,
      source_turn: sourceTurn,
      raw_operator_input: text,
    };
    snapshot.operator_inputs.push(input);
    const signals = extractMultiSignals(text, sourceTurn, timestamp);
    snapshot.multi_signal_buffer.push(...signals);
    if (contains(text.toLocaleLowerCase('fr-FR'), [/budget.{0,20}(validé|valide|réglé|regle)/i, /(?:objection|contrainte).{0,15}(levée|levee|résolue|resolue)/i, /ce n'est plus un problème/i, /ce n'est plus un probleme/i])) {
      snapshot.active_objections = snapshot.active_objections.filter((item) => item !== 'PRICE');
      snapshot.multi_signal_buffer.push(signal('objection_resolved', 'objection précédente déclarée résolue par l’opérateur', sourceTurn, timestamp, { qualitative_confidence: 'MEDIUM' }));
    }
    if (signals.some((item) => item.type === 'price_objection')) snapshot.active_objections = unique([...snapshot.active_objections, 'PRICE']);
    if (signals.some((item) => item.type === 'explicit_refusal')) snapshot.active_objections = unique([...snapshot.active_objections, 'REFUSAL']);
    if (signals.some((item) => item.type === 'out_of_scope')) snapshot.active_objections = unique([...snapshot.active_objections, 'SCOPE']);
    const needSignal = signals.find((item) => ['primary_need', 'site_scope', 'seo_request'].includes(item.type));
    if (!snapshot.primary_need && needSignal) snapshot.primary_need = needSignal.value;
    if (signals.some((item) => item.type === 'consultation_required')) snapshot.consultation_required = true;
    const timing = signals.find((item) => item.type === 'timing');
    if (timing) snapshot.timing = timing.value;
    const price = signals.find((item) => item.type === 'price_question' || item.type === 'price_objection');
    if (price) snapshot.price_information = price.value;
    if (signals.some((item) => item.type === 'conditional_interest')) snapshot.hypotheses = unique([...snapshot.hypotheses, 'Intérêt conditionnel à confirmer humainement.']);
    detectContextDrift(snapshot);
    snapshot.last_source_turn = sourceTurn;
    addAudit(snapshot, { at: timestamp, action: 'PROSPECT_RESPONSE', detail: 'Réponse saisie/paraphrasée par l’opérateur ; aucune transcription audio.', provenance: 'OPERATOR_PARAPHRASE', source_turn: sourceTurn });
  } else if (action.type === 'SELECT_PREDICTION') {
    const prediction = snapshot.predictions.find((item) => item.id === action.predictionId);
    if (!prediction) throw new Error('Prediction not found');
    snapshot.operator_inputs.push({
      input_id: `operator-${snapshot.operator_inputs.length + 1}`,
      kind: 'OPERATOR_SELECTED_PREDICTION',
      value: prediction.text,
      provenance: 'OPERATOR_NOTE',
      created_at: timestamp,
      prediction_id: prediction.id,
    });
    addAudit(snapshot, { at: timestamp, action: 'OPERATOR_SELECTED_PREDICTION', detail: 'Suggestion sélectionnée comme aide opérateur ; non enregistrée comme verbatim ni comme fait.', provenance: 'OPERATOR_NOTE' });
  } else if (action.type === 'OPERATOR_NOTE') {
    const text = clean(action.text);
    if (!text) throw new Error('Operator note cannot be empty');
    snapshot.operator_notes.push(text);
    snapshot.operator_inputs.push({ input_id: `operator-${snapshot.operator_inputs.length + 1}`, kind: 'OPERATOR_NOTE', value: text, provenance: 'OPERATOR_NOTE', created_at: timestamp, raw_operator_input: text });
    addAudit(snapshot, { at: timestamp, action: 'OPERATOR_NOTE', detail: 'Note interne non transformée en fait durable.', provenance: 'OPERATOR_NOTE' });
  } else if (action.type === 'VALIDATE_KNOWLEDGE') {
    const key = clean(action.key);
    const value = clean(action.value);
    if (!key || !value) throw new Error('Validated knowledge key and value are required');
    const fact: ValidatedKnowledge = { key, value, provenance: 'OPERATOR_NOTE', factual_status: 'CONFIRMED', recorded_at: timestamp, validated_at: timestamp, raw_operator_input: clean(action.rawInput) || undefined };
    snapshot.confirmed_facts = [...snapshot.confirmed_facts.filter((item) => item.key !== key), fact];
    snapshot.validated_knowledge = [...snapshot.validated_knowledge.filter((item) => item.key !== key), fact];
    snapshot.operator_inputs.push({ input_id: `operator-${snapshot.operator_inputs.length + 1}`, kind: 'VALIDATED_KNOWLEDGE', value: `${key}: ${value}`, provenance: 'OPERATOR_NOTE', created_at: timestamp, raw_operator_input: clean(action.rawInput) || undefined });
    snapshot.unknowns = snapshot.unknowns.filter((item) => item.toLocaleLowerCase('fr-FR') !== key.toLocaleLowerCase('fr-FR'));
    addAudit(snapshot, { at: timestamp, action: 'VALIDATE_KNOWLEDGE', detail: `Fait confirmé explicitement par l’opérateur : ${key}.`, provenance: 'OPERATOR_NOTE' });
  } else if (action.type === 'REJECT_KNOWLEDGE') {
    const key = clean(action.key);
    snapshot.confirmed_facts = snapshot.confirmed_facts.filter((item) => item.key !== key);
    snapshot.validated_knowledge = snapshot.validated_knowledge.filter((item) => item.key !== key);
    snapshot.hypotheses = unique([...snapshot.hypotheses, `Information rejetée ou à vérifier : ${key}.`]);
    addAudit(snapshot, { at: timestamp, action: 'REJECT_KNOWLEDGE', detail: clean(action.reason) || `Information rejetée : ${key}.` });
  } else if (action.type === 'SET_DECISION_AUTHORITY') {
    snapshot.decision_authority = clean(action.value) || 'UNKNOWN';
    addAudit(snapshot, { at: timestamp, action: 'SET_DECISION_AUTHORITY', detail: `Autorité de décision : ${snapshot.decision_authority}.`, provenance: 'OPERATOR_NOTE' });
  } else if (action.type === 'FEEDBACK') {
    const value = clean(action.value);
    if (!value) throw new Error('Feedback cannot be empty');
    snapshot.feedback.push(value);
    snapshot.operator_inputs.push({ input_id: `operator-${snapshot.operator_inputs.length + 1}`, kind: 'FEEDBACK', value, provenance: 'OPERATOR_NOTE', created_at: timestamp });
    addAudit(snapshot, { at: timestamp, action: 'FEEDBACK', detail: 'Feedback conservé séparément ; aucun self-training automatique.', provenance: 'OPERATOR_NOTE' });
  }
  recompute(snapshot);
  snapshot.updated_at = timestamp;
  return snapshot;
}

export interface EndOfCallReview {
  facts_to_confirm: CopilotFact[];
  operator_notes: string[];
  inferences_to_review: string[];
  needs: string[];
  objections: string[];
  decisions: string[];
  timing: string | null;
  decision_authority: string;
  requested_changes: string[];
  unknowns: string[];
}

export function buildEndOfCallReview(snapshot: CallCopilotSnapshot): EndOfCallReview {
  const signalFacts: CopilotFact[] = snapshot.multi_signal_buffer.map((item) => ({
    key: item.type,
    value: item.value,
    provenance: 'OPERATOR_PARAPHRASE',
    factual_status: 'UNVALIDATED',
    source_turn: item.source_turn,
    recorded_at: snapshot.updated_at,
  }));
  return {
    facts_to_confirm: [
      ...snapshot.confirmed_facts.filter((fact) => fact.factual_status !== 'CONFIRMED'),
      ...signalFacts,
    ],
    operator_notes: [...snapshot.operator_notes],
    inferences_to_review: [...snapshot.hypotheses],
    needs: unique([snapshot.primary_need ?? '', ...snapshot.secondary_needs]),
    objections: [...snapshot.active_objections],
    decisions: snapshot.stop_discovery ? ['NE_PAS_REQUALIFIER', 'MOVE_TO_QUOTE_RECOMMENDED'] : [],
    timing: snapshot.timing,
    decision_authority: snapshot.decision_authority,
    requested_changes: snapshot.multi_signal_buffer.filter((item) => item.type === 'domain_constraint').map((item) => item.value),
    unknowns: [...snapshot.unknowns],
  };
}

export function prospectToCallCopilotContext(
  prospect: Pick<Prospect, 'id' | 'companyName' | 'activity' | 'location' | 'websiteUrl' | 'primaryFriction'>,
  extras: Partial<Omit<CallCopilotInitialContext, 'prospectId' | 'companyName'>> = {},
): CallCopilotInitialContext {
  return {
    prospectId: prospect.id,
    companyName: prospect.companyName,
    activity: prospect.activity,
    location: prospect.location,
    websiteUrl: prospect.websiteUrl,
    primaryFriction: prospect.primaryFriction,
    ...extras,
  };
}
