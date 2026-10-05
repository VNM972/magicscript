import { createHash } from 'node:crypto';
import { classifySourceType } from '../../../core/contact-acquisition/agent';
import { evaluateResearchEvidenceIntegrity, publicHttpUrl } from '../../../core/research/evidence-integrity';
import { extractOperatingEvidence } from '../../../core/research/operating-evidence';
import { extractDigitalPainEvidence, inspectBrokenPrimaryAction, type DigitalPainEvidence } from '../../../core/research/digital-pain-evidence';
import { fetchSourcePage, type FetchResult } from '../../../core/research/source-fetcher';

type FetchPage = (url: string) => Promise<FetchResult>;

/** Fetch only accepted owned pages or candidate first-party profiles. */
export async function enrichResearchResultWithOperatingEvidence(
  input: Record<string, unknown>,
  fetchPage?: FetchPage,
  identity?: { companyName: string; city: string },
  pause?: () => Promise<void>,
): Promise<Record<string, unknown>> {
  const accepted = evaluateResearchEvidenceIntegrity(input).acceptedSources;
  const urls = [...new Set(accepted.filter((source) =>
    ((source.supports.includes('activity') || source.supports.includes('website')) && classifySourceType(source.url, true) === 'OWNED_WEBSITE') ||
    (source.supports.includes('websiteAbsent') && ['FACEBOOK', 'INSTAGRAM'].includes(classifySourceType(source.url))),
  ).map((source) => source.url))].slice(0, 8);
  const allowed = new Set(urls);
  const fetchAccepted: FetchPage = fetchPage ?? ((url) => fetchSourcePage(url, {
    urlValidator: (value) => {
      const parsed = publicHttpUrl(value);
      return parsed && allowed.has(parsed.toString()) ? parsed : null;
    },
  }));
  const pages: { url: string; html: string; observedAt: string; snapshotDigest: string }[] = [];
  for (const url of urls) {
    const result = await fetchAccepted(url);
    if (result.ok && allowed.has(result.finalUrl)) pages.push({
      url: result.finalUrl, html: result.text, observedAt: new Date().toISOString(),
      snapshotDigest: `sha256:${createHash('sha256').update(result.text).digest('hex')}`,
    });
  }
  const presence = input.contactPresence as { website?: { status?: string; values?: unknown[] } } | undefined;
  const verifiedOwnedWebsite = presence?.website?.status === 'VERIFIED' && Boolean(presence.website.values?.length);
  let digitalPainEvidence: DigitalPainEvidence = extractDigitalPainEvidence(accepted, pages, identity, verifiedOwnedWebsite);
  if (digitalPainEvidence.status === 'UNKNOWN') {
    for (const page of pages) {
      const source = accepted.find((item) => item.url === page.url);
      if (!source || classifySourceType(source.url, true) !== 'OWNED_WEBSITE') continue;
      const action = await inspectBrokenPrimaryAction(source, page, fetchPage ?? fetchSourcePage, pause);
      if (action.status === 'VERIFIED') {
        if (digitalPainEvidence.observations.length) { digitalPainEvidence = { status: 'UNKNOWN', observations: [] }; break; }
        digitalPainEvidence = action;
      }
    }
  }
  const observedUrls = new Set(digitalPainEvidence.observations.map((observation) => observation.sourceUrl));
  const sources = Array.isArray(input.sources) ? input.sources.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    const source = raw as Record<string, unknown>;
    if (!observedUrls.has(source.url as string) || !Array.isArray(source.supports)) return raw;
    return { ...source, supports: [...new Set([...source.supports, 'digitalGap'])] };
  }) : input.sources;
  return { ...input, sources, operatingEvidence: extractOperatingEvidence(accepted, pages), digitalPainEvidence };
}
