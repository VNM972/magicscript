import { COMMERCIAL_ELIGIBILITY_GATE_VERSION } from '../scoring/commercial-eligibility';
import type { MagicScriptEvent } from '../types/events';
import type { Prospect } from '../types/prospect';
import { classifyDoNotProspectIdentity } from './prospect-intake-identity';

export type ProspectCommercialViewCategory =
  | 'CURRENT'
  | 'LEGACY'
  | 'INTERNAL'
  | 'REJECTED';

export interface ProspectCommercialView {
  category: ProspectCommercialViewCategory;
  gateVersion: typeof COMMERCIAL_ELIGIBILITY_GATE_VERSION | null;
  reason:
    | 'CURRENT_GATE_ELIGIBLE'
    | 'PRE_GATE_OR_UNVERSIONED'
    | 'SYNTHETIC_METADATA'
    | 'DETERMINISTIC_FIXTURE_ID'
    | 'EXPLICIT_FIXTURE_ACTIVITY'
    | 'KNOWN_PROJECT_IDENTITY'
    | 'INTERNAL_BUSINESS_IDENTITY'
    | 'CURRENT_GATE_REJECTED'
    | 'CURRENT_GATE_INVALID_IDENTITY'
    | 'CURRENT_GATE_OPPOSED'
    | 'CURRENT_GATE_PRE_ACTIVE';
}

export interface ProspectInternalEvidence {
  syntheticMetadata?: boolean;
  contactabilityOpposed?: boolean;
}

const DETERMINISTIC_FIXTURE_IDS = new Set([
  '00000000-0000-4000-8000-000000000001',
  '2609319c-5578-4a37-99bb-1b0923a2f81f',
  'af8c9cc6-4c49-4aa5-9365-40fc79fa480d',
]);

function hasCurrentGateEvidence(events: readonly MagicScriptEvent[]): boolean {
  return events.some(
    (event) =>
      event.type === 'discovery.prospect_created' &&
      event.payload.gateVersion === COMMERCIAL_ELIGIBILITY_GATE_VERSION,
  );
}

function hasValidIdentity(prospect: Pick<Prospect, 'siren' | 'siret'>): boolean {
  return /^\d{9}$/.test(prospect.siren ?? '') && /^\d{14}$/.test(prospect.siret ?? '');
}

export function deriveProspectCommercialView(
  prospect: Pick<
    Prospect,
    | 'id'
    | 'companyName'
    | 'legalName'
    | 'activity'
    | 'commercialEligibility'
    | 'siren'
    | 'siret'
    | 'websiteUrl'
    | 'state'
  >,
  events: readonly MagicScriptEvent[],
  evidence: ProspectInternalEvidence = {},
): ProspectCommercialView {
  if (evidence.syntheticMetadata) {
    return { category: 'INTERNAL', gateVersion: null, reason: 'SYNTHETIC_METADATA' };
  }
  if (DETERMINISTIC_FIXTURE_IDS.has(prospect.id)) {
    return {
      category: 'INTERNAL',
      gateVersion: null,
      reason: 'DETERMINISTIC_FIXTURE_ID',
    };
  }
  if (prospect.activity?.trim() === 'Synthetic internal E2E fixture') {
    return {
      category: 'INTERNAL',
      gateVersion: null,
      reason: 'EXPLICIT_FIXTURE_ACTIVITY',
    };
  }

  const excludedIdentity = classifyDoNotProspectIdentity(prospect);
  if (excludedIdentity) {
    return {
      category: 'INTERNAL',
      gateVersion: null,
      reason:
        excludedIdentity.decision === 'KNOWN_PROJECT'
          ? 'KNOWN_PROJECT_IDENTITY'
          : 'INTERNAL_BUSINESS_IDENTITY',
    };
  }

  if (!hasCurrentGateEvidence(events)) {
    return {
      category: 'LEGACY',
      gateVersion: null,
      reason: 'PRE_GATE_OR_UNVERSIONED',
    };
  }

  if (!hasValidIdentity(prospect)) {
    return {
      category: 'REJECTED',
      gateVersion: COMMERCIAL_ELIGIBILITY_GATE_VERSION,
      reason: 'CURRENT_GATE_INVALID_IDENTITY',
    };
  }
  if (prospect.state === 'DO_NOT_CONTACT' || evidence.contactabilityOpposed) {
    return {
      category: 'REJECTED',
      gateVersion: COMMERCIAL_ELIGIBILITY_GATE_VERSION,
      reason: 'CURRENT_GATE_OPPOSED',
    };
  }
  if (
    prospect.commercialEligibility !== 'HIGH_PRIORITY' &&
    prospect.commercialEligibility !== 'RESEARCH'
  ) {
    return {
      category: 'REJECTED',
      gateVersion: COMMERCIAL_ELIGIBILITY_GATE_VERSION,
      reason: 'CURRENT_GATE_REJECTED',
    };
  }

  if (prospect.state === 'DISCOVERED') {
    return {
      category: 'LEGACY',
      gateVersion: COMMERCIAL_ELIGIBILITY_GATE_VERSION,
      reason: 'CURRENT_GATE_PRE_ACTIVE',
    };
  }

  return {
    category: 'CURRENT',
    gateVersion: COMMERCIAL_ELIGIBILITY_GATE_VERSION,
    reason: 'CURRENT_GATE_ELIGIBLE',
  };
}

export interface CommercialViewProspect {
  id: string;
  companyName: string;
  commercialEligibility?: Prospect['commercialEligibility'];
  score?: number;
  updatedAt: string;
  commercialView: ProspectCommercialView;
  contactability?: { preparation?: unknown | null };
}

export function partitionProspectsByCommercialView<
  T extends Pick<CommercialViewProspect, 'commercialView'>,
>(prospects: readonly T[]): {
  current: T[];
  legacy: T[];
  internal: T[];
  rejected: T[];
} {
  return {
    current: prospects.filter((item) => item.commercialView.category === 'CURRENT'),
    legacy: prospects.filter((item) => item.commercialView.category === 'LEGACY'),
    internal: prospects.filter((item) => item.commercialView.category === 'INTERNAL'),
    rejected: prospects.filter((item) => item.commercialView.category === 'REJECTED'),
  };
}

function eligibilityRank(value: Prospect['commercialEligibility']): number {
  if (value === 'HIGH_PRIORITY') return 0;
  if (value === 'RESEARCH') return 1;
  return 2;
}

export function sortCurrentCommercialProspects<T extends CommercialViewProspect>(
  prospects: readonly T[],
): T[] {
  return [...prospects].sort((left, right) => {
    const eligibilityDelta =
      eligibilityRank(left.commercialEligibility) -
      eligibilityRank(right.commercialEligibility);
    if (eligibilityDelta !== 0) return eligibilityDelta;

    const contactDelta =
      Number(Boolean(right.contactability?.preparation)) -
      Number(Boolean(left.contactability?.preparation));
    if (contactDelta !== 0) return contactDelta;

    const scoreDelta = (right.score ?? -1) - (left.score ?? -1);
    if (scoreDelta !== 0) return scoreDelta;

    return (
      new Date(right.updatedAt).getTime() -
      new Date(left.updatedAt).getTime()
    );
  });
}
