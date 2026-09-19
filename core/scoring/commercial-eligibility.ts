export const COMMERCIAL_ELIGIBILITY_GATE_VERSION =
  'COMMERCIAL_ELIGIBILITY_V2.6.0' as const;

export type CommercialEligibilityClassification =
  | 'HIGH_PRIORITY'
  | 'RESEARCH'
  | 'LOW_PRIORITY'
  | 'REJECT';

export type ActivityTaxonomy = 'NAF_2008';

export interface CommercialResearchIdentity {
  siren: string;
  siret: string;
  companyName: string;
  city: string;
  sourceUrl: string;
}

export interface CommercialEligibilityInput {
  siren: string;
  siret: string;
  companyName: string;
  legalName?: string;
  city: string;
  sourceUrl: string;
  companyActivity?: string;
  localActivity?: string;
  companyCategory?: string;
  companyEmployeeBand?: string;
  localEmployeeBand?: string;
  isHeadOffice?: boolean;
  numberOpenEstablishments?: number;
  legalNature?: string;
  companyCreationDate?: string;
  asOfDate: string;
  publicOrParapublic?: boolean;
  requiresNetworkAutonomyCheck?: boolean;
  autonomyEvidence?: 'CONFIRMED' | 'MISSING' | 'UNVERIFIED';
}

export interface CommercialEligibilityResult {
  gateVersion: typeof COMMERCIAL_ELIGIBILITY_GATE_VERSION;
  identityKey: string;
  researchIdentity: CommercialResearchIdentity;
  activity: string | undefined;
  activityTaxonomy: ActivityTaxonomy;
  companyActivitySection: string | undefined;
  localActivitySection: string | undefined;
  sectorSource:
    | 'LOCAL_ESTABLISHMENT_ACTIVITY'
    | 'COMPANY_ACTIVITY_FALLBACK'
    | 'UNKNOWN';
  localityScore: number;
  sizeScore: number;
  autonomyScore: number;
  sectorScore: number;
  recencyScore: number;
  score: number;
  classification: CommercialEligibilityClassification;
  association: boolean;
  institutional: boolean;
  networkAutonomyCheck: boolean;
  brandKey: string;
  brandKeyTrust: 'EXACT_COMMERCIAL_NAME' | 'LEGAL_IDENTITY_FALLBACK';
  genericBrandPlaceholder: boolean;
  brandCollisionGroup: string | null;
  initialResearchRepresentative: boolean;
  constraints: string[];
}

const ASSOCIATION_LEGAL_NATURES = new Set([
  '5195',
  '9210',
  '9220',
  '9221',
  '9222',
  '9223',
  '9224',
  '9230',
  '9240',
  '9260',
]);

const INSTITUTIONAL_LEGAL_NATURES = new Set(['7381', '7389']);

// NAF division-level policy keeps customer-facing local activity explicit while
// preventing broad M/N section weights from promoting weak first-wave targets.
const STRONG_ICP_NAF_DIVISION_SCORES = new Map([
  ['45', 10], // motor-vehicle trade and repair
  ['47', 10], // retail
  ['55', 14], // accommodation
  ['56', 14], // restaurants, food service and bars
  ['95', 10], // selected consumer repair
  ['96', 10], // personal services, including hair and beauty
]);

const NON_TARGET_NAF_ACTIVITIES = new Set(['70.10Z', '82.11Z']);

function isNonTargetNafActivity(activity?: string): boolean {
  const normalized = clean(activity).toUpperCase();
  return normalized.startsWith('69.') || NON_TARGET_NAF_ACTIVITIES.has(normalized);
}

const GENERIC_BRAND_PLACEHOLDERS = new Set([
  '',
  'NON DIFFUSIBLE',
  'UNKNOWN',
  'INCONNU',
  'SANS NOM',
]);

function isKnownInstitutionalName(value: string): boolean {
  const normalized = normalizeCommercialName(value);
  return (
    normalized === 'CNRS' ||
    normalized.startsWith('CNRS ') ||
    normalized === 'INRAE' ||
    normalized.startsWith('INRAE ') ||
    normalized === 'CCIM' ||
    normalized.includes('CHAMBRE COMMERCE ET INDUSTRIE MARTINIQUE CCIM') ||
    normalized.includes('SPL SOGES') ||
    normalized.includes('SEMAAG') ||
    normalized === 'MINISTERE APOSTOLIQUE ET PROPHETIQUE SION'
  );
}

function clean(value?: string): string {
  return value?.trim() ?? '';
}

export function commercialIdentityKey(siren: string, siret: string): string {
  return `${clean(siren)}|${clean(siret)}`;
}

export function normalizeCommercialName(value?: string): string {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isGenericCommercialName(value?: string): boolean {
  return GENERIC_BRAND_PLACEHOLDERS.has(normalizeCommercialName(value));
}

export function activitySectionFromNaf(activity?: string): string | undefined {
  const match = clean(activity).match(/^(\d{2})/);
  if (!match) return undefined;

  const division = Number.parseInt(match[1], 10);
  if (division >= 1 && division <= 3) return 'A';
  if (division >= 5 && division <= 9) return 'B';
  if (division >= 10 && division <= 33) return 'C';
  if (division === 35) return 'D';
  if (division >= 36 && division <= 39) return 'E';
  if (division >= 41 && division <= 43) return 'F';
  if (division >= 45 && division <= 47) return 'G';
  if (division >= 49 && division <= 53) return 'H';
  if (division >= 55 && division <= 56) return 'I';
  if (division >= 58 && division <= 63) return 'J';
  if (division >= 64 && division <= 66) return 'K';
  if (division === 68) return 'L';
  if (division >= 69 && division <= 75) return 'M';
  if (division >= 77 && division <= 82) return 'N';
  if (division === 84) return 'O';
  if (division === 85) return 'P';
  if (division >= 86 && division <= 88) return 'Q';
  if (division >= 90 && division <= 93) return 'R';
  if (division >= 94 && division <= 96) return 'S';
  if (division >= 97 && division <= 98) return 'T';
  if (division === 99) return 'U';
  return undefined;
}

function localityScore(input: CommercialEligibilityInput): number {
  if (input.isHeadOffice === true) return 30;
  return (input.numberOpenEstablishments ?? Number.POSITIVE_INFINITY) <= 5
    ? 12
    : 5;
}

function sizeScore(input: CommercialEligibilityInput): number {
  const category = clean(input.companyCategory).toUpperCase();
  const band = clean(input.companyEmployeeBand).toUpperCase();
  const verySmall = new Set(['00', '01', '02', '03']);
  const small = new Set(['11', '12']);
  const medium = new Set(['21', '22', '31']);

  if (category === 'PME') {
    if (verySmall.has(band)) return 20;
    if (small.has(band)) return 19;
    if (medium.has(band)) return 16;
    return 12;
  }

  if (category === 'ETI') {
    if (verySmall.has(band)) return 12;
    if (small.has(band)) return 11;
    if (medium.has(band)) return 8;
    return 4;
  }

  if (category === 'GE') {
    if (verySmall.has(band)) return 8;
    if (small.has(band)) return 7;
    if (medium.has(band)) return 4;
    return 0;
  }

  return 8;
}

function autonomyScore(input: CommercialEligibilityInput): number {
  const establishments =
    input.numberOpenEstablishments ?? Number.POSITIVE_INFINITY;
  if (input.isHeadOffice === true) return establishments <= 5 ? 20 : 14;
  if (establishments <= 5) return 8;
  if (establishments <= 20) return 4;
  return 0;
}

function sectorScore(activity: string | undefined, section: string | undefined): number {
  const normalizedActivity = clean(activity).toUpperCase();
  const division = normalizedActivity.slice(0, 2);
  const explicitScore = STRONG_ICP_NAF_DIVISION_SCORES.get(division);
  if (explicitScore !== undefined) return explicitScore;
  if (isNonTargetNafActivity(normalizedActivity)) return 5;

  switch (section) {
    case 'F':
      return 15;
    case 'I':
      return 8;
    case 'G':
    case 'S':
      return 6;
    case 'R':
      return 6;
    default:
      return 5;
  }
}

function monthsBetween(older: Date, newer: Date): number {
  let months =
    (newer.getUTCFullYear() - older.getUTCFullYear()) * 12 +
    newer.getUTCMonth() -
    older.getUTCMonth();
  if (newer.getUTCDate() < older.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function boundedRecencyBonus(
  companyCreationDate?: string,
  asOfDate?: string,
): number {
  if (!companyCreationDate || !asOfDate) return 0;
  const created = new Date(`${companyCreationDate.slice(0, 10)}T00:00:00.000Z`);
  const asOf = new Date(`${asOfDate.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(created.getTime()) || !Number.isFinite(asOf.getTime())) {
    return 0;
  }
  if (created.getTime() > asOf.getTime()) return 0;

  const ageMonths = monthsBetween(created, asOf);
  if (ageMonths < 6) return 10;
  if (ageMonths < 12) return 6;
  if (ageMonths < 24) return 4;
  if (ageMonths < 60) return 2;
  return 0;
}

function baseClassification(score: number): CommercialEligibilityClassification {
  if (score >= 75) return 'HIGH_PRIORITY';
  if (score >= 60) return 'RESEARCH';
  if (score >= 40) return 'LOW_PRIORITY';
  return 'REJECT';
}

export function scoreCommercialEligibility(
  input: CommercialEligibilityInput,
): CommercialEligibilityResult {
  const siren = clean(input.siren);
  const siret = clean(input.siret);
  const companyName = clean(input.companyName);
  const city = clean(input.city);
  const sourceUrl = clean(input.sourceUrl);
  const localActivity = clean(input.localActivity) || undefined;
  const companyActivity = clean(input.companyActivity) || undefined;
  const activity = localActivity ?? companyActivity;
  const localActivitySection = activitySectionFromNaf(localActivity);
  const companyActivitySection = activitySectionFromNaf(companyActivity);
  const selectedSection = localActivitySection ?? companyActivitySection;
  const sectorSource = localActivity
    ? 'LOCAL_ESTABLISHMENT_ACTIVITY'
    : companyActivity
      ? 'COMPANY_ACTIVITY_FALLBACK'
      : 'UNKNOWN';
  const legalNature = clean(input.legalNature);
  const association = ASSOCIATION_LEGAL_NATURES.has(legalNature);
  const institutional =
    input.publicOrParapublic === true ||
    INSTITUTIONAL_LEGAL_NATURES.has(legalNature) ||
    isKnownInstitutionalName(companyName) ||
    isKnownInstitutionalName(input.legalName ?? '');
  const institutionalScoreCap =
    input.publicOrParapublic === true ||
    legalNature === '7381' ||
    isKnownInstitutionalName(companyName) ||
    isKnownInstitutionalName(input.legalName ?? '');
  const networkAutonomyCheck =
    input.requiresNetworkAutonomyCheck === true &&
    input.autonomyEvidence !== 'CONFIRMED';
  const genericBrandPlaceholder = isGenericCommercialName(companyName);
  const normalizedBrand = normalizeCommercialName(companyName);
  const brandKey = genericBrandPlaceholder
    ? `SIREN:${siren}`
    : normalizedBrand;
  const constraints: string[] = [];

  if (clean(activity).toUpperCase() === '70.10Z') {
    constraints.push('NAF_70_10Z_NEUTRAL_SECTOR');
  }
  if (isNonTargetNafActivity(activity)) {
    constraints.push('ICP_FIRST_WAVE_RESEARCH_CAP');
  }
  if (association) constraints.push('ASSOCIATION_RESEARCH_CAP');
  if (networkAutonomyCheck) constraints.push('NETWORK_AUTONOMY_CHECK_REQUIRED');
  if (institutional) constraints.push('INSTITUTIONAL_ENTITY');
  if (genericBrandPlaceholder) constraints.push('GENERIC_BRAND_IDENTITY_FALLBACK');

  const locality = localityScore(input);
  const size = sizeScore(input);
  const autonomy = autonomyScore(input);
  const sector = sectorScore(activity, selectedSection);
  const recency = boundedRecencyBonus(input.companyCreationDate, input.asOfDate);
  const rawScore = Math.min(100, locality + size + autonomy + sector + recency);
  const score = institutionalScoreCap ? Math.min(rawScore, 25) : rawScore;
  let classification = institutional ? 'REJECT' : baseClassification(score);

  if (
    classification === 'HIGH_PRIORITY' &&
    (association || networkAutonomyCheck || isNonTargetNafActivity(activity))
  ) {
    classification = 'RESEARCH';
  }

  return {
    gateVersion: COMMERCIAL_ELIGIBILITY_GATE_VERSION,
    identityKey: commercialIdentityKey(siren, siret),
    researchIdentity: { siren, siret, companyName, city, sourceUrl },
    activity,
    activityTaxonomy: 'NAF_2008',
    companyActivitySection,
    localActivitySection,
    sectorSource,
    localityScore: locality,
    sizeScore: size,
    autonomyScore: autonomy,
    sectorScore: sector,
    recencyScore: recency,
    score,
    classification,
    association,
    institutional,
    networkAutonomyCheck,
    brandKey,
    brandKeyTrust: genericBrandPlaceholder
      ? 'LEGAL_IDENTITY_FALLBACK'
      : 'EXACT_COMMERCIAL_NAME',
    genericBrandPlaceholder,
    brandCollisionGroup: null,
    initialResearchRepresentative: true,
    constraints,
  };
}

function classificationRank(value: CommercialEligibilityClassification): number {
  return value === 'HIGH_PRIORITY'
    ? 3
    : value === 'RESEARCH'
      ? 2
      : value === 'LOW_PRIORITY'
        ? 1
        : 0;
}

export function applyCommercialBrandCollisions(
  results: readonly CommercialEligibilityResult[],
): CommercialEligibilityResult[] {
  const groups = new Map<string, CommercialEligibilityResult[]>();
  for (const result of results) {
    if (result.genericBrandPlaceholder || !result.brandKey) continue;
    const group = groups.get(result.brandKey) ?? [];
    group.push(result);
    groups.set(result.brandKey, group);
  }

  const representatives = new Map<string, string>();
  for (const [brandKey, group] of groups) {
    if (group.length < 2) continue;
    const representative = [...group].sort(
      (left, right) =>
        classificationRank(right.classification) -
          classificationRank(left.classification) ||
        right.score - left.score ||
        left.identityKey.localeCompare(right.identityKey),
    )[0];
    representatives.set(brandKey, representative.identityKey);
  }

  return results.map((result) => {
    const representative = representatives.get(result.brandKey);
    if (!representative) return { ...result };
    const isRepresentative = representative === result.identityKey;
    return {
      ...result,
      brandCollisionGroup: result.brandKey,
      initialResearchRepresentative: isRepresentative,
      classification:
        !isRepresentative && result.classification === 'HIGH_PRIORITY'
          ? 'RESEARCH'
          : result.classification,
      constraints: isRepresentative
        ? [...result.constraints, 'BRAND_COLLISION_REPRESENTATIVE']
        : [...result.constraints, 'BRAND_COLLISION_DEFERRED'],
    };
  });
}
