import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createQuoteDraft,
  nextDocumentWorkflowAction,
  validateQuoteAcceptanceProof,
  validateQuoteDraft,
  type QuoteDraftInput,
} from '../orchestrator/business-documents';

const validQuote: QuoteDraftInput = {
  quoteId: 'quote-synthetic-001',
  quoteNumber: 'DEV-2026-001',
  issueDate: '2026-09-02',
  validUntil: '2026-09-30',
  deliveryDeadline: 'À définir au devis accepté',
  clientType: 'PROFESSIONAL',
  client: { companyName: 'Entreprise synthétique', email: 'contact@example.test' },
  lines: [{ description: 'Formule Essentiel', quantity: 1, unitPriceCents: 59000 }],
  vatNote: 'Mention TVA fournie et validée par Magic Script',
  cgvReference: 'sites/magicscript-v2/public/cgv.html',
};

test('creates a professional quote draft with the fixed 50/50 payment split', () => {
  const draft = createQuoteDraft(validQuote);

  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.totalCents, 59000);
  assert.equal(draft.depositPercent, 50);
  assert.equal(draft.balancePercent, 50);
  assert.equal(draft.humanValidationRequired, true);
});

test('rejects individuals and incomplete legal/payment inputs', () => {
  const result = validateQuoteDraft({
    ...validQuote,
    clientType: 'INDIVIDUAL' as never,
    lines: [],
    vatNote: '',
    cgvReference: '',
  });

  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('only professional clients are supported'));
  assert.ok(result.reasons.includes('at least one quote line is required'));
  assert.ok(result.reasons.includes('VAT note must be supplied and validated by a human'));
  assert.ok(result.reasons.includes('CGV reference is required'));
});

test('requires durable Sales Room evidence for quote acceptance', () => {
  const accepted = validateQuoteAcceptanceProof({
    quoteId: 'quote-synthetic-001',
    quoteNumber: 'DEV-2026-001',
    quoteVersionHash: 'sha256:fixture-version-001',
    signerName: 'Marie Exemple',
    signerEmail: 'marie@example.test',
    signerCompanyName: 'Entreprise synth�tique',
    acceptedAt: '2026-09-04T18:00:00.000Z',
    consentGiven: true,
    consentLabel: 'BON_POUR_ACCORD',
    cgvReference: 'sites/magicscript-v2/public/cgv.html',
    totalCents: 59000,
    currency: 'EUR',
    source: 'SALES_ROOM',
  });

  assert.equal(accepted.accepted, true);

  const checkboxOnly = validateQuoteAcceptanceProof({
    consentGiven: true,
    consentLabel: 'BON_POUR_ACCORD',
  });

  assert.equal(checkboxOnly.accepted, false);
  assert.ok(checkboxOnly.reasons.includes('quote id is required'));
  assert.ok(checkboxOnly.reasons.includes('quote version hash is required'));
  assert.ok(checkboxOnly.reasons.includes('signer name is required'));
  assert.ok(checkboxOnly.reasons.includes('valid acceptance timestamp is required'));
});

test('keeps the signature proof and deposit sequence fail-closed', () => {
  const base = {
    interested: true,
    quoteDraftCreated: true,
    humanValidated: true,
    signatureRequestPrepared: true,
    depositDraftPrepared: false,
  };

  assert.equal(nextDocumentWorkflowAction({ ...base }), 'WAIT_FOR_SIGNED_PDF_AND_PROOF');
  assert.equal(nextDocumentWorkflowAction({ ...base, signedPdfReference: 'pdf:001' }), 'WAIT_FOR_SIGNED_PDF_AND_PROOF');
  assert.equal(nextDocumentWorkflowAction({ ...base, signedPdfReference: 'pdf:001', proofCertificateReference: 'proof:001' }), 'PREPARE_DEPOSIT_REQUEST_DRAFT');
  assert.equal(nextDocumentWorkflowAction({ ...base, signedPdfReference: 'pdf:001', proofCertificateReference: 'proof:001', depositDraftPrepared: true }), 'WAIT_FOR_PAYMENT_CONFIRMATION');
  assert.equal(nextDocumentWorkflowAction({ ...base, signedPdfReference: 'pdf:001', proofCertificateReference: 'proof:001', depositDraftPrepared: true, paymentConfirmationReference: 'payment:001' }), 'PREPARE_DELIVERY');
});
