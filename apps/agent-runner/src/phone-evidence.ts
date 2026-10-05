import { extractPhoneEvidence, type IndependentPhoneEvidence } from '../../../core/research/phone-extractor';
import { publicHttpUrl } from '../../../core/research/evidence-integrity';
import { fetchSourcePage, type FetchResult } from '../../../core/research/source-fetcher';

type FetchPage = (url: string) => Promise<FetchResult>;

function normalizedCandidate(value: unknown): string | null {
  return publicHttpUrl(value)?.toString() ?? null;
}

type PhoneSourceOwnership =
  | 'OWNED_BUSINESS_SOURCE'
  | 'DIRECT_STRUCTURED_BUSINESS_SOURCE'
  | 'THIRD_PARTY_LISTING_BUSINESS_FIELD'
  | 'THIRD_PARTY_SITE_GLOBAL_CONTACT'
  | 'AMBIGUOUS_SOURCE_OWNERSHIP'
  | 'UNKNOWN';

function sourceRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object' && !Array.isArray(item))
    : [];
}

export function selectPhoneEvidenceCandidateUrls(result: Record<string, unknown>): string[] {
  const candidates: string[] = [];
  const add = (value: unknown): void => {
    const url = normalizedCandidate(value);
    if (url && !candidates.includes(url) && candidates.length < 3) candidates.push(url);
  };

  add(result.phoneSourceUrl);

  for (const source of sourceRecords(result.sources)) {
    const supports = Array.isArray(source.supports) ? source.supports : [];
    const url = typeof source.url === 'string' ? source.url : '';
    const note = typeof source.note === 'string' ? source.note : '';
    const normalizedUrl = normalizedCandidate(url);
    const pathname = normalizedUrl ? new URL(normalizedUrl).pathname : '';
    const looksLikeContactPage =
      supports.includes('phone') ||
      supports.includes('contactability') ||
      /(?:^|[\/_-])(contact|nous-contacter|coordonnees)(?:[\/_-]|$)/i.test(pathname) ||
      /\b(contact|coordonn(?:e|é)es|téléphone|telephone)\b/i.test(note);
    if (looksLikeContactPage) add(url);
  }

  add(result.websiteUrl);
  return candidates;
}

/**
 * Remove any model-authored derived evidence, then independently fetch at most
 * three public candidate pages and attach the first deterministic extraction.
 */
export async function enrichResearchResultWithPhoneEvidence(
  input: Record<string, unknown>,
  fetchPage: FetchPage = fetchSourcePage,
): Promise<Record<string, unknown>> {
  const result = { ...input };
  delete result.derivedPhoneEvidence;

  for (const candidateUrl of selectPhoneEvidenceCandidateUrls(result)) {
    const fetched = await fetchPage(candidateUrl);
    if (!fetched.ok) continue;
    const evidence: IndependentPhoneEvidence | null = extractPhoneEvidence(
      fetched.text,
      fetched.finalUrl,
    );
    if (!evidence) continue;

    const sourceOwnership: PhoneSourceOwnership = new URL(fetched.finalUrl).hostname.replace(/^www\./i, '').toLowerCase() ===
      (typeof result.websiteUrl === 'string' ? new URL(result.websiteUrl).hostname.replace(/^www\./i, '').toLowerCase() : '')
      ? 'OWNED_BUSINESS_SOURCE'
      : 'THIRD_PARTY_LISTING_BUSINESS_FIELD';
    const sources = sourceRecords(result.sources);
    const deterministicSource = {
      url: evidence.sourceUrl,
      note: `Deterministically observed public phone (${evidence.evidenceType}).`,
      supports: ['phone'],
    };
    return {
      ...result,
      sources: [...sources, deterministicSource],
      derivedPhoneEvidence: { ...evidence, sourceOwnership, entityBound: true },
    };
  }

  return result;
}
