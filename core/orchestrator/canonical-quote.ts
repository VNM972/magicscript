import type { PricingResolution } from './pricing-policy';

export interface CanonicalQuoteLegalConfig {
  vatNote: string;
  cgvReference: string;
}

export interface CanonicalQuoteInput {
  quoteId: string;
  quoteNumber: string;
  issueDate: string;
  validUntil: string;
  deliveryDeadline: string;
  companyName: string;
  legalName?: string;
  pricing: PricingResolution;
  legal: CanonicalQuoteLegalConfig;
}

export interface CanonicalQuote {
  quoteId: string;
  quoteNumber: string;
  issueDate: string;
  validUntil: string;
  deliveryDeadline: string;
  client: {
    companyName: string;
    legalName?: string;
  };
  line: {
    description: string;
    quantity: 1;
    unitPriceCents: number;
  };
  vatNote: string;
  cgvReference: string;
  currency: 'EUR';
  depositPercent: 50;
  balancePercent: 50;
  subtotalCents: number;
  totalCents: number;
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

export function buildCanonicalQuote(input: CanonicalQuoteInput): CanonicalQuote {
  const companyName = requiredText(input.companyName, 'company identity');
  const vatNote = requiredText(input.legal.vatNote, 'canonical VAT note');
  const cgvReference = requiredText(input.legal.cgvReference, 'canonical CGV reference');

  if (
    input.pricing.status !== 'FIXED' ||
    input.pricing.priceCents === null ||
    !input.pricing.commercialName
  ) {
    throw new Error('Only fixed canonical pricing can be published');
  }

  if (!Number.isInteger(input.pricing.priceCents) || input.pricing.priceCents <= 0) {
    throw new Error('Canonical quote amount is invalid');
  }

  const line = {
    description: input.pricing.commercialName.trim(),
    quantity: 1 as const,
    unitPriceCents: input.pricing.priceCents,
  };

  return {
    quoteId: requiredText(input.quoteId, 'quote id'),
    quoteNumber: requiredText(input.quoteNumber, 'quote number'),
    issueDate: requiredText(input.issueDate, 'issue date'),
    validUntil: requiredText(input.validUntil, 'validity date'),
    deliveryDeadline: requiredText(input.deliveryDeadline, 'delivery deadline'),
    client: {
      companyName,
      ...(input.legalName?.trim() ? { legalName: input.legalName.trim() } : {}),
    },
    line,
    vatNote,
    cgvReference,
    currency: 'EUR',
    depositPercent: 50,
    balancePercent: 50,
    subtotalCents: line.unitPriceCents,
    totalCents: line.unitPriceCents,
  };
}
