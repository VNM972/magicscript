import type { PricingPackageId } from './pricing-policy';

export type CommercialSiteKind =
  | 'SHOWCASE'
  | 'ECOMMERCE'
  | 'CUSTOM_APPLICATION';

export type LightweightCommercialFeature =
  | 'THIRD_PARTY_BOOKING'
  | 'SIMPLE_BLOG'
  | 'ADVANCED_FORM'
  | 'LIGHT_INTEGRATION';

export type ComplexCommercialRequirement =
  | 'CUSTOM_DEVELOPMENT'
  | 'COMPLEX_INTEGRATION'
  | 'CLIENT_PORTAL'
  | 'BUSINESS_PAYMENT'
  | 'LARGE_CATALOG'
  | 'ATYPICAL_REQUIREMENT';

export interface CommercialScopeProfile {
  siteKind: CommercialSiteKind | null;
  pageCount: number | null;
  lightweightFeatures: readonly LightweightCommercialFeature[];
  complexRequirements: readonly ComplexCommercialRequirement[];
}

export type CommercialScopeClassificationStatus =
  | 'FIXED'
  | 'FROM'
  | 'CUSTOM'
  | 'UNKNOWN';

export interface CommercialScopeClassification {
  packageId: PricingPackageId | null;
  status: CommercialScopeClassificationStatus;
  reason: string;
}

export function classifyCommercialScope(
  profile: CommercialScopeProfile,
): CommercialScopeClassification {
  if (
    profile.siteKind === 'ECOMMERCE' ||
    profile.siteKind === 'CUSTOM_APPLICATION' ||
    profile.complexRequirements.length > 0
  ) {
    return {
      packageId: 'CUSTOM',
      status: 'CUSTOM',
      reason: 'Complex or unsupported commercial scope requires a custom quote.',
    };
  }

  if (profile.siteKind !== 'SHOWCASE') {
    return {
      packageId: null,
      status: 'UNKNOWN',
      reason: 'A supported site kind is required before automatic pricing.',
    };
  }

  if (
    !Number.isInteger(profile.pageCount) ||
    (profile.pageCount ?? 0) <= 0
  ) {
    return {
      packageId: null,
      status: 'UNKNOWN',
      reason: 'A positive page count is required before automatic pricing.',
    };
  }

  const pageCount = profile.pageCount as number;
  const lightweightFeatureCount = new Set(profile.lightweightFeatures).size;

  if (pageCount === 1 && lightweightFeatureCount === 0) {
    return {
      packageId: 'STARTER',
      status: 'FIXED',
      reason: 'Single-page showcase site without advanced functionality.',
    };
  }

  if (
    pageCount >= 2 &&
    pageCount <= 5 &&
    lightweightFeatureCount === 0
  ) {
    return {
      packageId: 'ESSENTIEL',
      status: 'FIXED',
      reason: 'Two-to-five-page standard showcase site.',
    };
  }

  if (
    pageCount <= 8 &&
    lightweightFeatureCount <= 1
  ) {
    return {
      packageId: 'BUSINESS',
      status: 'FIXED',
      reason: 'Showcase site up to eight pages and at most one supported lightweight feature.',
    };
  }

  return {
    packageId: 'PREMIUM',
    status: 'FROM',
    reason: 'Richer showcase scope requires Premium pricing from the canonical floor.',
  };
}
