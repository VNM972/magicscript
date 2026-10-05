import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPersonalizedEntryLinks } from '../personalization/entry-links';
import { buildBookingCta } from '../proposal/booking-cta';
import { resolveProposalBookingAuthority } from '../proposal/booking-runtime';
import { proposalBookingCtaEvent } from '../proposal/tracking';
import type { ProposalV1 } from '../proposal/contracts';

function proposal(): ProposalV1 {
  return {
    id: 'proposal-1', version: 'PROPOSAL_V1', prospectId: 'prospect-1', token: 'token-1',
    entryPath: '/p/token-1', status: 'PROPOSAL_READY', designRequestId: 'design-1',
    approvedDesignArtifactId: 'artifact-1', approvedDesignRevision: 1, buildArtifactId: 'build-1',
    buildRevision: 1, visualQaReportId: 'qa-1', createdAt: '2025-01-01T00:00:00.000Z',
    booking: {
      availabilityPath: '/api/public/proposals/token-1/availability',
      bookingPath: '/api/public/proposals/token-1/booking',
    },
    tracking: { sessionCookie: 'session-1', events: [] },
  };
}

test('prospect entry links expose Proposal only', () => {
  const links = buildPersonalizedEntryLinks({
    prospectId: 'prospect-1', companyName: 'Example', salesRoomSlug: 'example',
    prototypeUrl: 'https://example.pages.dev/', prototypeStatus: 'DEPLOYED', qaStatus: 'PASS',
    personalizedBaseUrl: 'https://app.example.test',
  });
  assert.equal(links.personalizedUrl, 'https://app.example.test/demo/example');
  assert.deepEqual(links.links, [{ label: 'Voir votre proposition', url: 'https://example.pages.dev/' }]);
  assert.equal(links.links.some((link) => link.url.includes('/p/')), false);
});

test('Proposal booking remains authoritative without Sales Room context', () => {
  const value = proposal();
  assert.deepEqual(resolveProposalBookingAuthority(value, 'token-1')?.proposalId, 'proposal-1');
  assert.deepEqual(buildBookingCta({ proposal: value, prospectId: 'prospect-1', proposalId: 'proposal-1' }), {
    proposalId: 'proposal-1', prospectId: 'prospect-1',
    availabilityPath: '/api/public/proposals/token-1/availability',
    bookingPath: '/api/public/proposals/token-1/booking',
    label: 'Prendre rendez-vous', event: 'BOOKING_CTA_CLICKED',
  });
});

test('Proposal tracking taxonomy remains unchanged', () => {
  assert.equal(proposalBookingCtaEvent(), 'BOOKING_CTA_CLICKED');
});

test('legacy Sales Room implementation remains internal and is not emitted as a CTA', () => {
  const links = buildPersonalizedEntryLinks({ prospectId: 'prospect-1', salesRoomSlug: 'legacy' });
  assert.equal(links.salesRoomUrl, null);
  assert.deepEqual(links.links, []);
});
