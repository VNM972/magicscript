import type { ProspectState } from '../types/prospect';

const humanStates = new Set<ProspectState>([
  'INTERESTED',
  'MEETING_BOOKED',
  'QUOTE_PENDING',
  'COMMITTED',
  'HOT_LEAD',
  'MEETING_REQUESTED',
  'PRICING_REQUESTED',
  'CUSTOM_REQUEST',
  'HUMAN_ACTION_REQUIRED',
]);

export function requiresHuman(state: ProspectState): boolean {
  return humanStates.has(state);
}

export function humanReason(state: ProspectState): string | null {
  switch (state) {
    case 'INTERESTED':
      return 'Intérêt explicite à traiter par Stéphane';
    case 'MEETING_BOOKED':
      return 'Rendez-vous réservé : briefing prêt pour Stéphane';
    case 'QUOTE_PENDING':
      return 'Devis à préparer ou valider humainement';
    case 'COMMITTED':
      return 'Devis accepté : acompte à confirmer';
    case 'HOT_LEAD':
      return 'Lead commercial qualifié';
    case 'MEETING_REQUESTED':
      return 'Le prospect demande un rendez-vous';
    case 'PRICING_REQUESTED':
      return 'Le prospect demande un prix';
    case 'CUSTOM_REQUEST':
      return 'Le prospect demande une personnalisation';
    case 'HUMAN_ACTION_REQUIRED':
      return 'Décision humaine requise par le workflow';
    default:
      return null;
  }
}
