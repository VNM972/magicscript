import type { DeckCommercialStage } from './deck';

export const deckStageLabels: Record<DeckCommercialStage, string> = {
  A_CONTACTER: 'À contacter',
  ENVOYES: 'Envoyés',
  EN_ATTENTE: 'En attente',
  RDV: 'RDV',
  DEVIS: 'Devis',
  RELANCES: 'Relances',
  GAGNES: 'Gagnés',
  PERDUS: 'Perdus',
  ARCHIVES: 'Archivés',
};

export function displayValue(value: string | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Non disponible';
  return typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : value;
}

export function displayStage(stage: DeckCommercialStage | null): string {
  return stage ? deckStageLabels[stage] ?? stage : 'Non disponible';
}

export function whatsappUrl(mobile: string | null): string | null {
  if (!mobile) return null;
  const compact = mobile.replace(/[\s().-]/g, '');
  const international = compact.startsWith('00') ? compact.slice(2) : compact.replace(/^\+/, '');
  // Never infer a country code for a local or ambiguous number.
  return /^[1-9]\d{6,14}$/.test(international) ? `https://wa.me/${international}` : null;
}
