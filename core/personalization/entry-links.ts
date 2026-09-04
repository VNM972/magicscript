import {
  buildSalesRoomSlug,
  type SalesRoomStatus,
} from './sales-room';

const OPAQUE_PROSPECT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_INTERNAL_PROSPECT_ID = /^[a-z0-9][a-z0-9-]{2,63}$/i;

export interface PersonalizedEntryInput {
  prospectId: string;
  companyName?: string | null;
  salesRoomSlug?: string | null;
  salesRoomStatus?: SalesRoomStatus;
  allCompanyNames?: readonly string[];
  prototypeUrl?: string | null;
  prototypeStatus?: string | null;
  qaStatus?: string | null;
  personalizedBaseUrl?: string | null;
}

export interface CommercialLink {
  label: 'Voir votre proposition' | 'Accéder à la Sales Room';
  url: string;
}

export interface PersonalizedEntryLinks {
  prototypeUrl: string | null;
  prototypeEntryUrl: string | null;
  salesRoomUrl: string | null;
  salesRoomSlug: string | null;
  salesRoomStatus: SalesRoomStatus;
  personalizedUrl: string | null;
  personalizedEntryEnabled: boolean;
  links: CommercialLink[];
}

function normalizeApprovedPrototypeUrl(value?: string | null): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.pages.dev') ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function normalizeEntryBaseUrl(value?: string | null): URL | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    const loopback =
      url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null;
    if (url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

export function buildPersonalizedEntryLinks(
  input: PersonalizedEntryInput,
): PersonalizedEntryLinks {
  const prototypeUrl =
    input.prototypeStatus === 'DEPLOYED' && input.qaStatus === 'PASS'
      ? normalizeApprovedPrototypeUrl(input.prototypeUrl)
      : null;
  const canUseCompanyRoute = Boolean(
    input.salesRoomSlug?.trim() ||
      (input.companyName?.trim() &&
        (OPAQUE_PROSPECT_ID.test(input.prospectId.trim()) ||
          SAFE_INTERNAL_PROSPECT_ID.test(input.prospectId.trim()))),
  );
  const baseUrl = canUseCompanyRoute
    ? normalizeEntryBaseUrl(input.personalizedBaseUrl)
    : null;
  const salesRoomSlug =
    input.salesRoomSlug?.trim() ||
    (input.companyName?.trim()
      ? buildSalesRoomSlug(
          input.companyName.trim(),
          input.prospectId.trim(),
          input.allCompanyNames,
        )
      : null);
  const salesRoomStatus = input.salesRoomStatus ?? 'ACTIVE';
  const prototypeEntryUrl =
    baseUrl && salesRoomSlug
      ? new URL(`/demo/${encodeURIComponent(salesRoomSlug)}`, baseUrl).toString()
      : null;
  const salesRoomUrl =
    baseUrl && salesRoomSlug
      ? new URL(`/p/${encodeURIComponent(salesRoomSlug)}`, baseUrl).toString()
      : null;

  if (
    !prototypeUrl ||
    !baseUrl ||
    !salesRoomSlug ||
    !prototypeEntryUrl ||
    !salesRoomUrl ||
    salesRoomStatus === 'DISABLED'
  ) {
    return {
      prototypeUrl,
      prototypeEntryUrl,
      salesRoomUrl,
      salesRoomSlug,
      salesRoomStatus,
      personalizedUrl: null,
      personalizedEntryEnabled: false,
      links: prototypeUrl ? [{ label: 'Voir votre proposition', url: prototypeUrl }] : [],
    };
  }

  return {
    prototypeUrl,
    prototypeEntryUrl,
    salesRoomUrl,
    salesRoomSlug,
    salesRoomStatus,
    personalizedUrl: salesRoomUrl,
    personalizedEntryEnabled: true,
    links: [
      { label: 'Voir votre proposition', url: prototypeUrl },
      { label: 'Accéder à la Sales Room', url: salesRoomUrl },
    ],
  };
}
