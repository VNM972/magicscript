export type PricingPackageId =
  | 'STARTER'
  | 'ESSENTIEL'
  | 'BUSINESS'
  | 'PREMIUM'
  | 'CUSTOM';

export type PricingResolutionStatus =
  | 'FIXED'
  | 'FROM'
  | 'CUSTOM'
  | 'UNKNOWN';

export interface PricingPackageDefinition {
  id: Exclude<PricingPackageId, 'CUSTOM'>;
  commercialName: string;
  priceCents: number;
  pricingMode: 'FIXED' | 'FROM';
  includedRevisionRounds: number | null;
}

export interface PricingResolution {
  packageId: PricingPackageId | null;
  status: PricingResolutionStatus;
  priceCents: number | null;
  currency: 'EUR';
  commercialName: string | null;
  includedRevisionRounds: number | null;
}

export const MAGIC_SCRIPT_PRICING_POLICY = {
  currency: 'EUR',
  depositPercent: 50,
  balancePercent: 50,
  annualCareCents: 19900,
  packages: {
    STARTER: {
      id: 'STARTER',
      commercialName: 'Starter / Lancement',
      priceCents: 79000,
      pricingMode: 'FIXED',
      includedRevisionRounds: 1,
    },
    ESSENTIEL: {
      id: 'ESSENTIEL',
      commercialName: 'Essentiel / Croissance',
      priceCents: 119000,
      pricingMode: 'FIXED',
      includedRevisionRounds: 2,
    },
    BUSINESS: {
      id: 'BUSINESS',
      commercialName: 'Business / Performance',
      priceCents: 169000,
      pricingMode: 'FIXED',
      includedRevisionRounds: 3,
    },
    PREMIUM: {
      id: 'PREMIUM',
      commercialName: 'Premium',
      priceCents: 229000,
      pricingMode: 'FROM',
      includedRevisionRounds: null,
    },
  },
} as const;

export function resolvePricingPackage(
  packageId: string | null | undefined,
): PricingResolution {
  const normalized = packageId?.trim().toUpperCase() ?? '';

  if (!normalized) {
    return {
      packageId: null,
      status: 'UNKNOWN',
      priceCents: null,
      currency: 'EUR',
      commercialName: null,
      includedRevisionRounds: null,
    };
  }

  if (normalized === 'CUSTOM') {
    return {
      packageId: 'CUSTOM',
      status: 'CUSTOM',
      priceCents: null,
      currency: 'EUR',
      commercialName: null,
      includedRevisionRounds: null,
    };
  }

  if (
    normalized !== 'STARTER' &&
    normalized !== 'ESSENTIEL' &&
    normalized !== 'BUSINESS' &&
    normalized !== 'PREMIUM'
  ) {
    return {
      packageId: null,
      status: 'UNKNOWN',
      priceCents: null,
      currency: 'EUR',
      commercialName: null,
      includedRevisionRounds: null,
    };
  }

  const definition = MAGIC_SCRIPT_PRICING_POLICY.packages[normalized];

  return {
    packageId: definition.id,
    status: definition.pricingMode,
    priceCents: definition.priceCents,
    currency: 'EUR',
    commercialName: definition.commercialName,
    includedRevisionRounds: definition.includedRevisionRounds,
  };
}
