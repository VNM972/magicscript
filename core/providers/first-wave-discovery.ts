import type { CommercialEligibilityResult } from '../scoring/commercial-eligibility';
import { resolveCommercialFamilyFromNaf } from '../icp/icp-decision';
import { isMagicScriptTargetActivity } from './insee-sirene';

export type FirstWaveDiscoveryTier = 1 | 2 | 3;

/** A discovery signal only. Canonical family and ICP still require later evidence. */
export function firstWaveDiscoveryTier(
  eligibility: CommercialEligibilityResult | undefined,
): FirstWaveDiscoveryTier {
  const activity = eligibility?.activity?.trim().toUpperCase().replace(/\s+/g, '') ?? '';
  const local = eligibility?.sectorSource === 'LOCAL_ESTABLISHMENT_ACTIVITY';
  if (local && (resolveCommercialFamilyFromNaf(activity) === 'LOCAL_RETAIL'
    || /^56\.\d{2}[A-Z]$/.test(activity)
    || /^96\.02[AB]$/.test(activity))) {
    return 1;
  }
  return isMagicScriptTargetActivity(activity) ? 2 : 3;
}

export function rankFirstWaveDiscoveryCandidates<T extends {
  siren?: string;
  siret?: string;
  eligibility?: CommercialEligibilityResult;
}>(candidates: readonly T[]): T[] {
  const classificationRank = (value: CommercialEligibilityResult | undefined): number =>
    value?.classification === 'HIGH_PRIORITY' ? 0
      : value?.classification === 'RESEARCH' ? 1
        : 2;
  return [...candidates].sort((a, b) =>
    firstWaveDiscoveryTier(a.eligibility) - firstWaveDiscoveryTier(b.eligibility)
    || classificationRank(a.eligibility) - classificationRank(b.eligibility)
    || (b.eligibility?.score ?? 0) - (a.eligibility?.score ?? 0)
    || `${a.siren ?? ''}|${a.siret ?? ''}`.localeCompare(`${b.siren ?? ''}|${b.siret ?? ''}`)
  );
}
