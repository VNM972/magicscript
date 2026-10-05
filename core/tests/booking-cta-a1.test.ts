import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveBookingCtaAuthority } from '../proposal/booking-cta';
import { proposalBookingCtaEvent } from '../proposal/tracking';
import type { ProposalV1 } from '../proposal/contracts';

const base: ProposalV1 = {
  id: 'proposal-build-PROPOSAL_V1', version: 'PROPOSAL_V1', prospectId: 'prospect-1',
  designRequestId: 'design-1', approvedDesignArtifactId: 'design-artifact-1', approvedDesignRevision: 1,
  buildArtifactId: 'build-1', buildRevision: 1, visualQaReportId: 'qa-1', token: 'canonical-token',
  entryPath: '/p/canonical-token', status: 'PROPOSAL_READY', createdAt: '2026-01-01T00:00:00.000Z',
  booking: {
    availabilityPath: '/api/public/proposals/canonical-token/availability',
    bookingPath: '/api/public/proposals/canonical-token/booking',
  },
  tracking: { sessionCookie: 'ms_proposal_canonical-token', events: ['PROPOSAL_VIEWED', 'RETURN_VISIT', 'SHARE_CLICKED'] },
};

const ready = (overrides: Partial<ProposalV1> = {}) => ({ ...base, ...overrides });

test('eligible READY proposal exposes canonical booking CTA authority', () => {
  assert.deepEqual(deriveBookingCtaAuthority({ proposal: base, prospectId: 'prospect-1', proposalId: base.id }), {
    proposalId: base.id, prospectId: 'prospect-1', ...base.booking,
  });
});

test('caller booking URL cannot override canonical authority', () => {
  const authority = deriveBookingCtaAuthority({ proposal: base, prospectId: 'prospect-1', proposalId: base.id, callerBookingUrl: 'https://evil.example/book' });
  assert.equal(authority?.bookingPath, base.booking.bookingPath);
  assert.notEqual(authority?.bookingPath, 'https://evil.example/book');
});

test('missing or malformed authority fails closed', () => {
  assert.equal(deriveBookingCtaAuthority({ proposal: ready({ booking: undefined as never }), prospectId: 'prospect-1', proposalId: base.id }), null);
  assert.equal(deriveBookingCtaAuthority({ proposal: ready({ booking: { ...base.booking, bookingPath: 'javascript:alert(1)' } }), prospectId: 'prospect-1', proposalId: base.id }), null);
});

test('proposal and prospect mismatch fails closed', () => {
  assert.equal(deriveBookingCtaAuthority({ proposal: base, prospectId: 'other', proposalId: base.id }), null);
  assert.equal(deriveBookingCtaAuthority({ proposal: base, prospectId: 'prospect-1', proposalId: 'other' }), null);
  assert.equal(deriveBookingCtaAuthority({ proposal: ready({ prospectId: 'other' }), prospectId: 'prospect-1', proposalId: base.id }), null);
});

test('tracking taxonomy remains canonical', () => {
  assert.equal(proposalBookingCtaEvent(), 'BOOKING_CTA_CLICKED');
});
