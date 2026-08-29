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
  ) {}

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
