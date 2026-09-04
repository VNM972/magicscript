export type ClientType = 'PROFESSIONAL';

export type DocumentWorkflowAction =
  | 'WAIT_FOR_INTEREST'
  | 'CREATE_QUOTE_DRAFT'
  | 'REQUEST_HUMAN_VALIDATION'
  | 'PREPARE_SIGNATURE_REQUEST_DRAFT'
  | 'WAIT_FOR_SIGNED_PDF_AND_PROOF'
  | 'PREPARE_DEPOSIT_REQUEST_DRAFT'
  | 'WAIT_FOR_PAYMENT_CONFIRMATION'
  | 'PREPARE_DELIVERY';

export interface QuoteLineInput {
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface QuoteDraftInput {
  quoteId: string;
  quoteNumber: string;
  issueDate: string;
  validUntil: string;
  deliveryDeadline: string;
  clientType: ClientType;
  client: {
    companyName: string;
    contactName?: string;
    email?: string;
    address?: string;
  };
  lines: readonly QuoteLineInput[];
  vatNote: string;
  cgvReference: string;
  paymentLink?: string;
}

export interface QuoteDraft extends QuoteDraftInput {
  currency: 'EUR';
  depositPercent: 50;
  balancePercent: 50;
  subtotalCents: number;
  totalCents: number;
  status: 'DRAFT';
  humanValidationRequired: true;
}

export interface QuoteValidation {
  accepted: boolean;
  reasons: readonly string[];
}

export interface QuoteAcceptanceProofInput {
  quoteId: string;
  quoteNumber: string;
  quoteVersionHash: string;
  signerName: string;
  signerEmail: string;
  signerCompanyName: string;
  acceptedAt: string;
  consentGiven: boolean;
  consentLabel: 'BON_POUR_ACCORD';
  cgvReference: string;
  totalCents: number;
  currency: 'EUR';
  source: 'SALES_ROOM';
}

export interface QuoteAcceptanceProofValidation {
  accepted: boolean;
  reasons: readonly string[];
}

export interface DocumentWorkflowInput {
  interested: boolean;
  quoteDraftCreated: boolean;
  humanValidated: boolean;
  signatureRequestPrepared: boolean;
  signedPdfReference?: string;
  proofCertificateReference?: string;
  depositDraftPrepared: boolean;
  paymentConfirmationReference?: string;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateQuoteAcceptanceProof(
  input: Partial<QuoteAcceptanceProofInput>,
): QuoteAcceptanceProofValidation {
  const reasons: string[] = [];

  if (!hasText(input.quoteId)) reasons.push('quote id is required');
  if (!hasText(input.quoteNumber)) reasons.push('quote number is required');
  if (!hasText(input.quoteVersionHash)) reasons.push('quote version hash is required');
  if (!hasText(input.signerName)) reasons.push('signer name is required');
  if (!hasText(input.signerEmail)) reasons.push('signer email is required');
  if (!hasText(input.signerCompanyName)) reasons.push('signer company name is required');
  if (!hasText(input.acceptedAt) || !Number.isFinite(Date.parse(input.acceptedAt))) {
    reasons.push('valid acceptance timestamp is required');
  }
  if (input.consentGiven !== true) reasons.push('explicit consent is required');
  if (input.consentLabel !== 'BON_POUR_ACCORD') reasons.push('bon pour accord consent is required');
  if (!hasText(input.cgvReference)) reasons.push('CGV reference is required');
  if (!Number.isInteger(input.totalCents) || (input.totalCents ?? 0) <= 0) {
    reasons.push('accepted total must be a positive integer amount');
  }
  if (input.currency !== 'EUR') reasons.push('accepted currency must be EUR');
  if (input.source !== 'SALES_ROOM') reasons.push('acceptance source must be SALES_ROOM');

  return { accepted: reasons.length === 0, reasons };
}

export function validateQuoteDraft(input: Partial<QuoteDraftInput>): QuoteValidation {
  const reasons: string[] = [];

  if (!hasText(input.quoteId)) reasons.push('quote id is required');
  if (!hasText(input.quoteNumber)) reasons.push('quote number is required');
  if (!hasText(input.issueDate)) reasons.push('issue date is required');
  if (!hasText(input.validUntil)) reasons.push('validity date is required');
  if (!hasText(input.deliveryDeadline)) reasons.push('delivery deadline is required');
  if (input.clientType !== 'PROFESSIONAL') reasons.push('only professional clients are supported');
  if (!input.client || !hasText(input.client.companyName)) reasons.push('professional company name is required');
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    reasons.push('at least one quote line is required');
  } else {
    input.lines.forEach((line, index) => {
      if (!hasText(line?.description)) reasons.push(`line ${index + 1} description is required`);
      if (!Number.isInteger(line?.quantity) || (line?.quantity ?? 0) <= 0) reasons.push(`line ${index + 1} quantity must be positive`);
      if (!Number.isInteger(line?.unitPriceCents) || (line?.unitPriceCents ?? 0) <= 0) reasons.push(`line ${index + 1} unit price must be positive`);
    });
  }
  if (!hasText(input.vatNote)) reasons.push('VAT note must be supplied and validated by a human');
  if (!hasText(input.cgvReference)) reasons.push('CGV reference is required');

  return { accepted: reasons.length === 0, reasons };
}

export function createQuoteDraft(input: QuoteDraftInput): QuoteDraft {
  const validation = validateQuoteDraft(input);
  if (!validation.accepted) {
    throw new Error(`Invalid quote draft: ${validation.reasons.join('; ')}`);
  }

  const lines = input.lines.map((line) => ({
    ...line,
    description: line.description.trim(),
    lineTotalCents: line.quantity * line.unitPriceCents,
  }));
  const subtotalCents = lines.reduce((total, line) => total + line.lineTotalCents, 0);

  return {
    ...input,
    quoteId: input.quoteId.trim(),
    quoteNumber: input.quoteNumber.trim(),
    issueDate: input.issueDate.trim(),
    validUntil: input.validUntil.trim(),
    deliveryDeadline: input.deliveryDeadline.trim(),
    client: {
      ...input.client,
      companyName: input.client.companyName.trim(),
      ...(input.client.contactName ? { contactName: input.client.contactName.trim() } : {}),
      ...(input.client.email ? { email: input.client.email.trim() } : {}),
      ...(input.client.address ? { address: input.client.address.trim() } : {}),
    },
    lines,
    vatNote: input.vatNote.trim(),
    cgvReference: input.cgvReference.trim(),
    ...(input.paymentLink ? { paymentLink: input.paymentLink.trim() } : {}),
    currency: 'EUR',
    depositPercent: 50,
    balancePercent: 50,
    subtotalCents,
    totalCents: subtotalCents,
    status: 'DRAFT',
    humanValidationRequired: true,
  };
}

export function nextDocumentWorkflowAction(input: DocumentWorkflowInput): DocumentWorkflowAction {
  if (!input.interested) return 'WAIT_FOR_INTEREST';
  if (!input.quoteDraftCreated) return 'CREATE_QUOTE_DRAFT';
  if (!input.humanValidated) return 'REQUEST_HUMAN_VALIDATION';
  if (!input.signatureRequestPrepared) return 'PREPARE_SIGNATURE_REQUEST_DRAFT';
  if (!hasText(input.signedPdfReference) || !hasText(input.proofCertificateReference)) {
    return 'WAIT_FOR_SIGNED_PDF_AND_PROOF';
  }
  if (!input.depositDraftPrepared) return 'PREPARE_DEPOSIT_REQUEST_DRAFT';
  if (!hasText(input.paymentConfirmationReference)) return 'WAIT_FOR_PAYMENT_CONFIRMATION';
  return 'PREPARE_DELIVERY';
}
