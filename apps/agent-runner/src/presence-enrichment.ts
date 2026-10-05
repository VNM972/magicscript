import {
  enrichContactPresence,
  type ContactPresenceResult,
  type EnrichmentSource,
  type IdentityInput,
} from '../../../core/contact-presence/enrichment';
import { publicHttpUrl } from '../../../core/research/evidence-integrity';
import { fetchSourcePage, type FetchResult } from '../../../core/research/source-fetcher';

type FetchPage = (url: string) => Promise<FetchResult>;

function records(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object' && !Array.isArray(item))
    : [];
}

export function selectContactPresenceCandidateUrls(result: Record<string, unknown>): string[] {
  const urls: string[] = [];
  const add = (value: unknown) => {
    const normalized = publicHttpUrl(value)?.toString();
    if (normalized && !urls.includes(normalized) && urls.length < 3) urls.push(normalized);
  };
  add(result.websiteUrl);
  for (const source of records(result.sources)) add(source.url);
  return urls;
}

function identityFrom(result: Record<string, unknown>): IdentityInput {
  const website = publicHttpUrl(result.websiteUrl);
  return {
    companyName: typeof result.companyName === 'string' ? result.companyName : undefined,
    domain: website?.hostname,
    city: typeof result.city === 'string' ? result.city :
      typeof result.location === 'string' ? result.location : undefined,
  };
}

/** Fetches bounded public pages and parses deterministic contact/presence evidence. */
export async function enrichResearchResultWithContactPresence(
  input: Record<string, unknown>,
  fetchPage: FetchPage = fetchSourcePage,
): Promise<Record<string, unknown>> {
  const sources: EnrichmentSource[] = [];
  for (const url of selectContactPresenceCandidateUrls(input)) {
    const fetched = await fetchPage(url);
    if (!fetched.ok) continue;
    sources.push({ url: fetched.finalUrl, html: fetched.text });
  }
  const contactPresence: ContactPresenceResult = enrichContactPresence(
    sources,
    identityFrom(input),
    { maxSources: 3, maxBytesPerSource: 500_000 },
  );
  return { ...input, contactPresence };
}
