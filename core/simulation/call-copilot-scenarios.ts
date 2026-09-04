import {
  applyCallCopilotAction,
  buildCallCopilotSnapshot,
  type CallCopilotAction,
  type CallCopilotInitialContext,
  type CallCopilotSnapshot,
} from '../orchestrator/call-copilot';

export interface CallCopilotScenario {
  scenario_id: string;
  initial_context: CallCopilotInitialContext;
  prospect_turns: string[];
  operator_actions: CallCopilotAction[];
  expected_signals: string[];
  expected_facts: string[];
  expected_non_facts: string[];
  expected_mode: CallCopilotSnapshot['conversation_mode'];
  expected_next_best_action: CallCopilotSnapshot['next_best_action']['action'];
  forbidden_actions: string[];
  expected_blockers: string[];
  expected_stop_discovery: boolean;
  hard_fail_conditions: string[];
  human_review_notes?: string;
}

const context = (id: string, need = 'présence digitale') => ({
  prospectId: id,
  companyName: `Entreprise ${id}`,
  activity: 'Sécurité',
  location: 'Fort-de-France',
  primaryNeed: need,
  prototypeUrl: `http://127.0.0.1:4173/demo/${id}`,
  salesRoomUrl: `http://127.0.0.1:4173/p/${id}`,
  confirmedFacts: [{ key: 'activité', value: 'Sécurité' }],
  unknowns: ['Prix', 'Délai'],
});

function scenario(
  number: number,
  title: string,
  initialContext: CallCopilotInitialContext,
  turns: string[],
  actions: CallCopilotAction[] = turns.map((text) => ({ type: 'PROSPECT_RESPONSE', text })),
  expected: Partial<Pick<CallCopilotScenario, 'expected_signals' | 'expected_mode' | 'expected_next_best_action' | 'expected_blockers' | 'expected_stop_discovery'>> = {},
): CallCopilotScenario {
  return {
    scenario_id: `SC-${String(number).padStart(2, '0')}-${title}`,
    initial_context: initialContext,
    prospect_turns: turns,
    operator_actions: actions,
    expected_signals: expected.expected_signals ?? [],
    expected_facts: [],
    expected_non_facts: ['MODEL_PREDICTION', 'prix absent', 'promesse SEO', 'verbatim non validé'],
    expected_mode: expected.expected_mode ?? 'DISCOVERY',
    expected_next_best_action: expected.expected_next_best_action ?? 'DISCOVER',
    forbidden_actions: ['MUTATE_PROSPECT_LIFECYCLE', 'SEND_EXTERNAL_MESSAGE', 'INVENT_PRICE', 'INVENT_SEO_PROMISE'],
    expected_blockers: expected.expected_blockers ?? [],
    expected_stop_discovery: expected.expected_stop_discovery ?? false,
    hard_fail_conditions: ['prediction persisted as fact', 'automatic lifecycle transition', 'external communication'],
    human_review_notes: 'Les formulations restent des aides opérateur et ne constituent pas des citations certifiées.',
  };
}

export const CALL_COPILOT_SCENARIOS: CallCopilotScenario[] = [
  scenario(1, 'already-convinced', context('s01'), ['Je veux avancer et recevoir le devis.'], undefined, { expected_signals: ['request_quote', 'explicit_next_step'], expected_mode: 'READY_TO_CLOSE', expected_next_best_action: 'MOVE_TO_QUOTE', expected_stop_discovery: true }),
  scenario(2, 'cold-curious', context('s02'), ['Je suis curieux, mais je découvre encore votre approche.']),
  scenario(3, 'price-sensitive', context('s03'), ['Le budget est trop serré pour le moment.'], undefined, { expected_signals: ['price_objection'], expected_mode: 'OBJECTION', expected_next_best_action: 'HANDLE_OBJECTION', expected_blockers: ['PRICE'] }),
  scenario(4, 'existing-provider', context('s04'), ["J'ai déjà quelqu'un qui s'en occupe."] , undefined, { expected_signals: ['past_provider_or_investment'] }),
  scenario(5, 'bad-previous-experience', context('s05'), ['J’ai déjà payé une agence et l’expérience a été mauvaise.'], undefined, { expected_signals: ['past_provider_or_investment'] }),
  scenario(6, 'price-immediately', context('s06'), ['Combien coûte votre accompagnement ?'], undefined, { expected_signals: ['price_question'], expected_mode: 'QUALIFICATION', expected_next_best_action: 'DISCUSS_PRICE_OR_TERMS' }),
  scenario(7, 'only-quote', context('s07'), ['Je veux uniquement recevoir un devis.'], undefined, { expected_signals: ['request_quote'], expected_mode: 'READY_TO_CLOSE', expected_next_best_action: 'MOVE_TO_QUOTE', expected_stop_discovery: true }),
  scenario(8, 'keep-domain', context('s08'), ['Je veux garder mon domaine actuel, mais le reste m’intéresse.'], undefined, { expected_signals: ['domain_constraint', 'conditional_interest'], expected_mode: 'DISCOVERY' }),
  scenario(9, 'edit-self', context('s09'), ['Je veux pouvoir modifier moi-même le site.']),
  scenario(10, 'google-seo', context('s10', 'visibilité sur Google'), ['Je veux surtout être mieux visible sur Google.'], undefined, { expected_signals: ['seo_request'], expected_mode: 'QUALIFICATION', expected_next_best_action: 'SHOW_VALUE' }),
  scenario(11, 'consult-associate', context('s11'), ['Je dois en parler à mon associé avant de décider.'], undefined, { expected_signals: ['consultation_required'], expected_mode: 'NOT_READY', expected_next_best_action: 'PAUSE_AND_DEFER' }),
  scenario(12, 'no-urgency', context('s12'), ['Ce n’est pas urgent, on verra plus tard.'], undefined, { expected_signals: ['timing'] }),
  scenario(13, 'strong-urgency', context('s13'), ['J’en ai besoin au plus vite, cette semaine si possible.'], undefined, { expected_signals: ['timing'] }),
  scenario(14, 'abrupt-topic', context('s14'), ['Au fait, pouvez-vous aussi gérer nos photos ?']),
  scenario(15, 'multiple-objections', context('s15'), ['Le budget est serré, je dois garder mon domaine et je dois consulter mon associé.'], undefined, { expected_signals: ['price_objection', 'domain_constraint', 'consultation_required'], expected_mode: 'OBJECTION', expected_next_best_action: 'HANDLE_OBJECTION', expected_blockers: ['PRICE'] }),
  scenario(16, 'contradiction', context('s16'), ['Je veux remplacer complètement notre ancien site.', 'En fait je veux conserver exactement l’ancien site.'], undefined, { expected_signals: ['site_scope', 'site_scope'], expected_mode: 'OBJECTION', expected_next_best_action: 'CLARIFY', expected_blockers: ['CONTRADICTION'] }),
  scenario(17, 'talkative', context('s17'), ['Le prototype me plaît, nous avons payé quelqu’un l’année dernière, le budget doit rester maîtrisé, mais si je garde mon domaine cela m’intéresse.'], undefined, { expected_signals: ['prototype_acceptance', 'past_provider_or_investment', 'price_objection', 'domain_constraint', 'conditional_interest'], expected_mode: 'OBJECTION', expected_next_best_action: 'HANDLE_OBJECTION', expected_blockers: ['PRICE'] }),
  scenario(18, 'terse', context('s18'), ['Oui.']),
  scenario(19, 'accepts-then-backs-off', context('s19'), ['Le prototype me plaît, envoyez le devis.', 'Finalement, non merci, je préfère arrêter.'], undefined, { expected_signals: ['prototype_acceptance', 'request_quote', 'explicit_refusal'], expected_mode: 'EXIT', expected_next_best_action: 'EXIT_GRACEFULLY' }),
  scenario(20, 'explicit-refusal', context('s20'), ['Non merci, je ne suis pas intéressé.'], undefined, { expected_signals: ['explicit_refusal'], expected_mode: 'EXIT', expected_next_best_action: 'EXIT_GRACEFULLY' }),
  scenario(21, 'unexpected-information', context('s21'), ['Nous ouvrons une seconde activité le mois prochain.']),
  scenario(22, 'unknown-answer', context('s22'), ['Je ne sais pas encore quel budget ni quel délai prévoir.'], undefined, { expected_signals: ['price_objection'], expected_mode: 'OBJECTION', expected_next_best_action: 'HANDLE_OBJECTION', expected_blockers: ['PRICE'] }),
  scenario(23, 'out-of-scope', context('s23'), ['Je veux une application métier complète avec gestion de stock.'], undefined, { expected_signals: ['out_of_scope'], expected_mode: 'OBJECTION', expected_next_best_action: 'HANDLE_OBJECTION', expected_blockers: ['SCOPE'] }),
  scenario(24, 'premium-opportunity', context('s24', 'positionnement premium'), ['Nous voulons un accompagnement complet et très qualitatif pour repositionner l’entreprise.']),
  scenario(25, 'close-early', context('s25'), ['Oui, envoyez-moi directement la proposition pour avancer.'], undefined, { expected_signals: ['explicit_next_step', 'request_quote'], expected_mode: 'READY_TO_CLOSE', expected_next_best_action: 'MOVE_TO_QUOTE', expected_stop_discovery: true }),
  scenario(26, 'reopened-close', context('s26'), ['Le budget me bloque.', 'La contrainte est levée, envoyez le devis.'], undefined, { expected_signals: ['price_objection', 'request_quote'], expected_mode: 'READY_TO_CLOSE', expected_next_best_action: 'MOVE_TO_QUOTE', expected_stop_discovery: true }),
  scenario(27, 'no-prediction-fits', context('s27'), ['Autre réponse : nous allons changer de locaux.']),
  scenario(28, 'bad-prediction-corrected', context('s28'), ['La vraie réponse est que je dois d’abord vérifier avec mon associé.'], [
    { type: 'SELECT_PREDICTION', predictionId: 'prediction-1' },
    { type: 'PROSPECT_RESPONSE', text: 'La vraie réponse est que je dois d’abord vérifier avec mon associé.' },
  ], { expected_signals: ['consultation_required'], expected_mode: 'NOT_READY', expected_next_best_action: 'PAUSE_AND_DEFER' }),
  scenario(29, 'prediction-to-fact-attempt', context('s29'), [], [{ type: 'SELECT_PREDICTION', predictionId: 'prediction-1' }]),
  scenario(30, 'repeated-signals', context('s30'), ['Je partage la proposition.', 'Je partage encore la proposition.', 'Je reviens voir la proposition.'], undefined, { expected_mode: 'QUALIFICATION' }),
  scenario(31, 'initial-context-contradicted', { ...context('s31'), confirmedFacts: [{ key: 'site_scope', value: 'conserver le site existant' }] }, ['Je veux remplacer complètement notre ancien site.'], undefined, { expected_signals: ['site_scope'], expected_mode: 'OBJECTION', expected_next_best_action: 'CLARIFY', expected_blockers: ['CONTRADICTION'] }),
  scenario(32, 'unauthorized-discount', context('s32'), ['Pouvez-vous me faire une remise de 50 % ?'], undefined, { expected_signals: ['price_question'], expected_mode: 'QUALIFICATION', expected_next_best_action: 'DISCUSS_PRICE_OR_TERMS' }),
  scenario(33, 'seo-promise-request', context('s33', 'référencement'), ['Pouvez-vous me garantir la première place sur Google ?'], undefined, { expected_signals: ['seo_request'], expected_mode: 'QUALIFICATION', expected_next_best_action: 'SHOW_VALUE' }),
  scenario(34, 'advance-decision-maker-unknown', context('s34'), ['Je ne sais pas encore qui signera, mais envoyez-moi le devis pour avancer.'], undefined, { expected_signals: ['request_quote', 'explicit_next_step'], expected_mode: 'READY_TO_CLOSE', expected_next_best_action: 'MOVE_TO_QUOTE', expected_stop_discovery: true }),
  scenario(35, 'objection-interest-constraint', context('s35'), ['Le prototype me plaît, mais je ne veux pas remettre 3 000 €, et je veux garder mon domaine si on avance.'], undefined, { expected_signals: ['prototype_acceptance', 'price_objection', 'domain_constraint'], expected_mode: 'OBJECTION', expected_next_best_action: 'HANDLE_OBJECTION', expected_blockers: ['PRICE'] }),
];

export function simulateCallCopilotScenario(
  scenarioDefinition: CallCopilotScenario,
  now = '2026-09-03T12:00:00.000Z',
): CallCopilotSnapshot {
  let snapshot = buildCallCopilotSnapshot(scenarioDefinition.initial_context, now, scenarioDefinition.scenario_id);
  for (const action of scenarioDefinition.operator_actions) {
    snapshot = applyCallCopilotAction(snapshot, action, now);
  }
  return snapshot;
}
