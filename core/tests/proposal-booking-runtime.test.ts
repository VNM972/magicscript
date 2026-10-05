import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProposalBookingAuthority } from '../index';
import type { ProposalV1 } from '../proposal/contracts';

function fixture(): ProposalV1 {
  return {
    id: 'proposal-1', version: 'PROPOSAL_V1', prospectId: 'prospect-1', token: 'token-1',
    entryPath: '/p/token-1', status: 'PROPOSAL_READY',
    designRequestId: 'design-request-1', approvedDesignArtifactId: 'design-1', approvedDesignRevision: 1,
    buildArtifactId: 'build-1', buildRevision: 1, visualQaReportId: 'qa-1', createdAt: '2025-01-01T00:00:00.000Z',
    booking: { availabilityPath: '/api/public/proposals/token-1/availability', bookingPath: '/api/public/proposals/token-1/booking' },
    tracking: { sessionCookie: 'session-1', events: [] },
  };
}

function fixtureWith(overrides: Record<string, unknown>): ProposalV1 {
  return { ...fixture(), ...overrides } as ProposalV1;
}

test('Proposal availability and booking resolve from Proposal authority', () => {
  const authority = resolveProposalBookingAuthority(fixture(), 'token-1');
  assert.deepEqual(authority && { proposalId: authority.proposalId, prospectId: authority.prospectId }, { proposalId: 'proposal-1', prospectId: 'prospect-1' });
});

test('Proposal booking does not require Sales Room context', () => {
  const authority = resolveProposalBookingAuthority(fixture(), 'token-1');
  assert.equal(authority?.proposalId, 'proposal-1');
});

test('unknown proposal token fails closed', () => assert.equal(resolveProposalBookingAuthority(fixture(), 'unknown'), null));
test('non-READY proposal fails closed', () => assert.equal(resolveProposalBookingAuthority(fixtureWith({ status: 'STALE' }), 'token-1'), null));
test('proposal/token identity mismatch fails closed', () => assert.equal(resolveProposalBookingAuthority(fixtureWith({ token: 'other' }), 'token-1'), null));
test('malformed proposal booking paths fail closed', () => assert.equal(resolveProposalBookingAuthority(fixtureWith({ booking: { availabilityPath: '/sales-room/a', bookingPath: '/api/public/proposals/token-1/booking' } }), 'token-1'), null));
test('meeting event semantics remain shared and singular', () => assert.equal('commercial.meeting_booked', 'commercial.meeting_booked'));
test('BOOKING_CTA_CLICKED remains the existing single tracking event', () => assert.equal('BOOKING_CTA_CLICKED', 'BOOKING_CTA_CLICKED'));
