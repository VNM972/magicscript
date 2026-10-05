import { MAGIC_SCRIPT_PRICING_POLICY, resolvePricingPackage, type PricingPackageId } from '../orchestrator/pricing-policy';
import { classifyCommercialScope, type CommercialScopeProfile } from '../orchestrator/commercial-scope';

export interface CommercialCatalogEntry {
  offerId: PricingPackageId;
  name: string;
  priceMode: 'FIXED' | 'FROM' | 'QUOTE';
  amountCents: number | null;
  currency: 'EUR';
  authorizedCapabilities: string[];
  limits: string[];
  source: string;
  version: string;
}

/** Content version changes when authority changes; no independent price table. */
export function catalogVersion(): string {
  return `pricing-policy:${JSON.stringify(MAGIC_SCRIPT_PRICING_POLICY.packages)}`;
}

/** IDs and optional scope are confirmed upstream. This function never chooses an offer. */
export function projectCommercialCatalog(
  authorizedIds: readonly PricingPackageId[],
  confirmedScopes: Partial<Record<PricingPackageId, CommercialScopeProfile>> = {},
): CommercialCatalogEntry[] {
  return [...new Set(authorizedIds)].map(offerId => {
    const price = resolvePricingPackage(offerId);
    if (price.status === 'UNKNOWN' || !price.packageId) throw new Error('UNKNOWN_CATALOG_REFERENCE');
    const scope = confirmedScopes[offerId];
    const classification = scope ? classifyCommercialScope(scope) : null;
    if (classification && classification.packageId !== offerId) throw new Error('UNCONFIRMED_OFFER_SCOPE');
    return {
      offerId, name: price.commercialName ?? price.packageId,
      priceMode: price.status === 'CUSTOM' ? 'QUOTE' : price.status,
      amountCents: price.priceCents, currency: price.currency,
      // A scope classification describes scope, never operational capability or inclusion.
      authorizedCapabilities: classification && offerId !== 'CUSTOM' ? [classification.reason] : [],
      limits: [
        ...(classification ? [classification.reason] : ['No confirmed scope: no capability mention authorized.']),
        'No inferred discount, tax status, deadline, annual care, maintenance, domain or contract terms.',
        'Scope does not prove a demonstrated feature is live.',
        ...(offerId === 'CUSTOM' ? ['Custom quote requires human scoping; no delivery capability is confirmed.'] : []),
      ],
      source: 'core/orchestrator/pricing-policy.ts + core/orchestrator/commercial-scope.ts',
      version: `${catalogVersion()}|scope:${JSON.stringify(scope ?? null)}`,
    };
  });
}

export function catalogEntryIsCanonical(entry: CommercialCatalogEntry): boolean {
  try {
    const prefix = `${catalogVersion()}|scope:`;
    if (!entry.version.startsWith(prefix)) return false;
    const scope = JSON.parse(entry.version.slice(prefix.length)) as CommercialScopeProfile | null;
    const expected = projectCommercialCatalog([entry.offerId], scope ? { [entry.offerId]: scope } : {})[0];
    return (Object.keys(expected) as (keyof CommercialCatalogEntry)[])
      .every(key => JSON.stringify(entry[key]) === JSON.stringify(expected[key]));
  } catch { return false; }
}
