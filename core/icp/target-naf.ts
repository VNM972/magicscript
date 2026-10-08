/**
 * Source unique de verite pour la cible NAF MagicScript.
 *
 * TARGET_NAF_DIVISIONS decrit la cible reelle produit (commerces locaux
 * avec budget : restauration, beaute/coiffure, commerce de proximite,
 * hebergement, reparation, services personnels).
 *
 * BROAD_DISCOVERY_NAF_DIVISIONS conserve la politique large historique
 * utilisee par isMagicScriptTargetActivity ? a resserrer vers la cible
 * reelle en Phase C-2.
 */

export const TARGET_NAF_DIVISIONS = ['45', '47', '55', '56', '95', '96'] as const;
export type TargetNafDivision = typeof TARGET_NAF_DIVISIONS[number];

/** Codes 5-char exacts autorises hors divisions cibles (cas metier specifiques).
 *  90.03B = tatouage et piercing (NAF rev.2 2020, section R). */
export const TARGET_NAF_EXACT_CODES = ['90.03B'] as const;

export const BROAD_DISCOVERY_NAF_DIVISIONS = [
  '41', '42', '43',
  '45', '47',
  '55', '56',
  '68',
  '71', '73', '74', '77', '79',
  '81',
  '90', '91', '93',
  '95', '96',
] as const;

export const STRONG_ICP_NAF_DIVISION_SCORES: ReadonlyMap<string, number> = new Map<string, number>([
  ['45', 10],
  ['47', 10],
  ['55', 14],
  ['56', 14],
  ['95', 10],
  ['96', 10],
]);

export const FIRST_WAVE_ACTIVITY_CODES = {
  FOOD_SERVICE: [
    '56.10A', '56.10B', '56.10C', '56.21Z', '56.29A', '56.29B', '56.30Z',
  ],
  HAIR_BEAUTY: ['96.02A', '96.02B'],
  LOCAL_RETAIL: [
    '47.11A', '47.11B', '47.11C', '47.11D', '47.11E', '47.11F', '47.19A', '47.19B',
    '47.21Z', '47.22Z', '47.23Z', '47.24Z', '47.25Z', '47.26Z', '47.29Z', '47.30Z',
    '47.41Z', '47.42Z', '47.43Z', '47.51Z', '47.52A', '47.52B', '47.53Z', '47.54Z',
    '47.59A', '47.59B', '47.61Z', '47.62Z', '47.63Z', '47.64Z', '47.65Z', '47.71Z',
    '47.72A', '47.72B', '47.73Z', '47.74Z', '47.75Z', '47.76Z', '47.77Z', '47.78A',
    '47.78B', '47.78C', '47.79Z', '47.81Z', '47.82Z', '47.89Z', '47.91A', '47.91B',
    '47.99A', '47.99B',
  ],
} as const;

export function normalizeNafCode(code?: string | null): string {
  return (code ?? '').trim().toUpperCase().replace(/[\s]+/g, '');
}

export function nafDivision(code?: string | null): string | undefined {
  const normalized = normalizeNafCode(code);
  const match = /^(\d{2})/.exec(normalized);
  return match ? match[1] : undefined;
}

export function isBroadDiscoveryNafActivity(code?: string | null): boolean {
  const division = nafDivision(code);
  if (!division) return false;
  return (BROAD_DISCOVERY_NAF_DIVISIONS as readonly string[]).includes(division);
}

export function isTargetNafDivision(code?: string | null): boolean {
  const division = nafDivision(code);
  if (!division) return false;
  return (TARGET_NAF_DIVISIONS as readonly string[]).includes(division);
}

/**
 * Politique cible reelle MagicScript :
 * - division dans TARGET_NAF_DIVISIONS, OU
 * - code exact dans TARGET_NAF_EXACT_CODES (ex: 90.03B tatouage/piercing).
 */
export function isTargetNafActivity(code?: string | null): boolean {
  const normalized = normalizeNafCode(code);
  if (!normalized) return false;
  if ((TARGET_NAF_EXACT_CODES as readonly string[]).includes(normalized)) return true;
  return isTargetNafDivision(normalized);
}

export function strongIcpScoreForNaf(code?: string | null): number | undefined {
  const division = nafDivision(code);
  if (!division) return undefined;
  return STRONG_ICP_NAF_DIVISION_SCORES.get(division);
}
