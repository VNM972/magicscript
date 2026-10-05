import { validateProviderDomain } from '../research/website-seed';
import type { ProviderWebsiteSeedResult } from '../research/website-seed';

export type HunterDomainFinderResult = ProviderWebsiteSeedResult;

/** Only data[].domain is considered; provider identity fields have no authority. */
export function normalizeHunterDomainFinderResponse(body: unknown, requestCount: 0 | 1 = 0): HunterDomainFinderResult {
  const base = { provider: 'HUNTER_DOMAIN_FINDER' as const, authority: 'NON_AUTHORITATIVE' as const, requestCount };
  const failure = (): HunterDomainFinderResult => ({ ...base, state: 'PROVIDER_FAILURE' });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return failure();
  const envelope = body as { data?: unknown; errors?: unknown };
  if (envelope.errors !== undefined && (!Array.isArray(envelope.errors) || envelope.errors.length)) return failure();
  if (!Array.isArray(envelope.data)) return failure();
  if (!envelope.data.length) return { ...base, state: 'PROVIDER_NO_RESULT' };
  const domains: string[] = [];
  for (const item of envelope.data) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.domain !== 'string') return failure();
    const domain = validateProviderDomain(item.domain);
    if (!domain) return { ...base, state: 'INVALID_PROVIDER_DOMAIN' };
    domains.push(domain);
  }
  if (new Set(domains).size !== 1) return { ...base, state: 'AMBIGUOUS_PROVIDER_RESULT' };
  const domain = domains[0];
  return { ...base, state: 'CANDIDATE_DOMAIN', domain, candidateUrl: `https://${domain}/` };
}

export interface HunterDomainSearchSource {
  uri?: string;
  domain?: string;
  last_seen_on?: string;
  extracted_on?: string;
}

export interface HunterDomainSearchEmail {
  value: string;
  type?: 'personal' | 'generic';
  confidence?: number;
  position?: string | null;
  sources?: HunterDomainSearchSource[];
}

export interface HunterDomainSearchResult {
  domain?: string;
  organization?: string;
  emails: HunterDomainSearchEmail[];
}

export interface HunterEmailCountResult {
  total: number;
  personalEmails: number;
  genericEmails: number;
}

interface HunterApiEnvelope<T> {
  data?: T;
  errors?: Array<{ id?: string; code?: number; details?: string }>;
}

export class HunterApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'HunterApiError';
  }
}

export class HunterClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.hunter.io/v2',
    private readonly domainFinderTransport: typeof fetch = (...args) => fetch(...args),
  ) {}

  /** R48: one isolated request, no retries, variants, pagination or email endpoints. */
  async domainFinder(input: { company: string }): Promise<HunterDomainFinderResult> {
    const failure = (requestCount: 0 | 1): HunterDomainFinderResult => ({
      provider: 'HUNTER_DOMAIN_FINDER', authority: 'NON_AUTHORITATIVE', state: 'PROVIDER_FAILURE', requestCount,
    });
    if (typeof input?.company !== 'string' || !input.company.trim()) return failure(0);
    let requestCount: 0 | 1 = 0;
    try {
      const url = new URL(`${this.baseUrl}/domain-finder`);
      url.searchParams.set('api_key', this.apiKey);
      url.searchParams.set('company', input.company);
      url.searchParams.set('limit', '1');
      requestCount = 1;
      const response = await this.domainFinderTransport(url, {
        method: 'GET', headers: { accept: 'application/json' }, redirect: 'error',
      });
      if (!response.ok) return failure(requestCount);
      return normalizeHunterDomainFinderResponse(await response.json(), requestCount);
    } catch {
      // Never return transport errors: they can contain the authentication URL.
      return failure(requestCount);
    }
  }

  async emailCount(input: {
    domain?: string;
    company?: string;
  }): Promise<HunterEmailCountResult> {
    const data = await this.get<{
      total?: number;
      personal_emails?: number;
      generic_emails?: number;
    }>('/email-count', input);

    return {
      total: Number(data.total ?? 0),
      personalEmails: Number(data.personal_emails ?? 0),
      genericEmails: Number(data.generic_emails ?? 0),
    };
  }

  async domainSearch(input: {
    domain?: string;
    company?: string;
    limit?: number;
  }): Promise<HunterDomainSearchResult> {
    const data = await this.get<{
      domain?: string;
      organization?: string;
      emails?: HunterDomainSearchEmail[];
    }>('/domain-search', {
      ...input,
      limit: input.limit ?? 10,
    });

    return {
      domain: data.domain,
      organization: data.organization,
      emails: Array.isArray(data.emails) ? data.emails : [],
    };
  }

  private async get<T>(
    path: string,
    params: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('api_key', this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
      },
    });

    const body = (await response.json().catch(() => ({}))) as HunterApiEnvelope<T>;

    if (!response.ok || !body.data) {
      const details =
        body.errors?.map((error) => error.details || error.id).filter(Boolean).join('; ') ||
        response.statusText ||
        'Unknown Hunter API error';

      throw new HunterApiError(details, response.status);
    }

    return body.data;
  }
}

export function domainFromWebsite(url?: string): string | undefined {
  if (!url) return undefined;

  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    try {
      return new URL(`https://${url}`).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
      return undefined;
    }
  }
}
