import type { ProposalV1 } from './contracts';

export interface BookingCtaAuthority {
  proposalId: string;
  prospectId: string;
  availabilityPath: string;
  bookingPath: string;
}

export interface BookingCtaInput {
  proposal: ProposalV1 | null | undefined;
  prospectId: string;
  proposalId: string;
  callerBookingUrl?: unknown;
}

export interface BookingCtaModel extends BookingCtaAuthority {
  label: 'Prendre rendez-vous';
  event: 'BOOKING_CTA_CLICKED';
}

const CANONICAL_PATH = /^\/api\/public\/proposals\/[^/?#]+\/(availability|booking)$/;

function validCanonicalPath(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL_PATH.test(value);
}

export function deriveBookingCtaAuthority(input: BookingCtaInput): BookingCtaAuthority | null {
  const proposal = input.proposal;
  if (!proposal || proposal.status !== 'PROPOSAL_READY') return null;
  if (proposal.id !== input.proposalId || proposal.prospectId !== input.prospectId) return null;
  if (!validCanonicalPath(proposal.booking?.availabilityPath) || !validCanonicalPath(proposal.booking?.bookingPath)) return null;

  const token = proposal.entryPath.match(/^\/p\/([^/?#]+)$/)?.[1];
  const availabilityToken = proposal.booking.availabilityPath.match(/^\/api\/public\/proposals\/([^/?#]+)\/availability$/)?.[1];
  const bookingToken = proposal.booking.bookingPath.match(/^\/api\/public\/proposals\/([^/?#]+)\/booking$/)?.[1];
  if (!token || token !== availabilityToken || token !== bookingToken) return null;

  return {
    proposalId: proposal.id,
    prospectId: proposal.prospectId,
    availabilityPath: proposal.booking.availabilityPath,
    bookingPath: proposal.booking.bookingPath,
  };
}

export function buildBookingCta(input: BookingCtaInput): BookingCtaModel | null {
  const authority = deriveBookingCtaAuthority(input);
  return authority ? { ...authority, label: 'Prendre rendez-vous', event: 'BOOKING_CTA_CLICKED' } : null;
}

export function requiresStandaloneBookingFallback(input: BookingCtaInput): boolean {
  return buildBookingCta(input) === null;
}
