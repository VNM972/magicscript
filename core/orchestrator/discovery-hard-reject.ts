export type HardRejectReason =
  | 'ASSOCIATION_LOI_1901'
  | 'ASSOCIATION_LEGAL_NATURE'
  | 'INSTITUTION_LEGAL_NATURE'
  | 'GRAND_GROUPE'
  | 'ETI'
  | 'EFFECTIF_SUP_50'
  | 'SECTEUR_PUBLIC'
  | 'RESEAU_NON_AUTONOME';

const EXCLUDED_EMPLOYEE_BANDS = new Set(['21', '22', '31', '32', '41', '42', '51', '52', '53']);
const ASSOCIATION_LEGAL_NATURES = new Set(['5195', '9210', '9220', '9221', '9222', '9223', '9224', '9230', '9240', '9260']);
const INSTITUTION_LEGAL_NATURES = new Set(['7381', '7389']);
const normalize = (value: string | null | undefined): string =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';

export function hardRejectReason(input: {
  siret?: string | null;
  companyCategory?: string | null;
  companyEmployeeBand?: string | null;
  legalNature?: string | null;
  publicOrParapublic?: boolean | null;
  requiresNetworkAutonomyCheck?: boolean | null;
  autonomyEvidence?: string | null;
}): HardRejectReason | null {
  const siret = normalize(input.siret);
  const companyCategory = normalize(input.companyCategory);
  const companyEmployeeBand = normalize(input.companyEmployeeBand);
  const legalNature = normalize(input.legalNature);
  const autonomyEvidence = normalize(input.autonomyEvidence);

  if (siret.startsWith('W')) return 'ASSOCIATION_LOI_1901';
  if (companyCategory === 'GE') return 'GRAND_GROUPE';
  if (companyCategory === 'ETI') return 'ETI';
  if (EXCLUDED_EMPLOYEE_BANDS.has(companyEmployeeBand)) return 'EFFECTIF_SUP_50';
  if (ASSOCIATION_LEGAL_NATURES.has(legalNature)) return 'ASSOCIATION_LEGAL_NATURE';
  if (INSTITUTION_LEGAL_NATURES.has(legalNature)) return 'INSTITUTION_LEGAL_NATURE';
  if (input.publicOrParapublic === true) return 'SECTEUR_PUBLIC';
  if (input.requiresNetworkAutonomyCheck === true && autonomyEvidence !== 'CONFIRMED') {
    return 'RESEAU_NON_AUTONOME';
  }
  return null;
}
