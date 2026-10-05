import type { RunnerProspect } from './api';
import { evaluateResearchEvidenceIntegrity } from '../../../core/research/evidence-integrity';

const ALLOWED_RESEARCH_CLAIMS = new Set([
  'digitalGap', 'commercialStrength', 'contactability', 'localFit',
  'prototypeLeverage', 'confidence', 'activity', 'location', 'website', 'websiteAbsent',
  'publicListing', 'bookingPlatform', 'menuProvider', 'eventPlatform', 'phone',
  'opportunity', 'primaryAsset', 'primaryFriction',
  'brandAsset',
]);

const SCORE_KEYS = [
  'digitalGap',
  'commercialStrength',
  'contactability',
  'localFit',
  'prototypeLeverage',
  'confidence',
] as const;

type ScoreKey = (typeof SCORE_KEYS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function boundedScore(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;

  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizedBrandAsset(value: unknown): {
  status: 'OFFICIAL_LOGO_FOUND' | 'PUBLIC_LOGO_CANDIDATE' | 'NOT_FOUND' | 'UNKNOWN';
  reuseDecision:
    | 'REUSE_IF_RIGHTS_CLEAR'
    | 'DO_NOT_REUSE'
    | 'CREATE_ONLY_IF_NO_USABLE_IDENTITY'
    | 'UNKNOWN';
  sourceUrl?: string;
  assetUrl?: string;
  note: string;
} {
  const source = isRecord(value) ? value : {};
  const requestedStatus = source.status;
  const requestedReuse = source.reuseDecision;
  const sourceUrl = safeHttpUrl(source.sourceUrl);
  const assetUrl = safeHttpUrl(source.assetUrl);
  const status =
    requestedStatus === 'OFFICIAL_LOGO_FOUND' ||
    requestedStatus === 'PUBLIC_LOGO_CANDIDATE' ||
    requestedStatus === 'NOT_FOUND' ||
    requestedStatus === 'UNKNOWN'
      ? requestedStatus
      : 'UNKNOWN';
  const safeStatus = status === 'OFFICIAL_LOGO_FOUND' && !sourceUrl ? 'UNKNOWN' : status;
  const reuseDecision =
    requestedReuse === 'REUSE_IF_RIGHTS_CLEAR' ||
    requestedReuse === 'DO_NOT_REUSE' ||
    requestedReuse === 'CREATE_ONLY_IF_NO_USABLE_IDENTITY' ||
    requestedReuse === 'UNKNOWN'
      ? requestedReuse
      : 'CREATE_ONLY_IF_NO_USABLE_IDENTITY';

  const normalized: {
    status: 'OFFICIAL_LOGO_FOUND' | 'PUBLIC_LOGO_CANDIDATE' | 'NOT_FOUND' | 'UNKNOWN';
    reuseDecision:
      | 'REUSE_IF_RIGHTS_CLEAR'
      | 'DO_NOT_REUSE'
      | 'CREATE_ONLY_IF_NO_USABLE_IDENTITY'
      | 'UNKNOWN';
    sourceUrl?: string;
    assetUrl?: string;
    note: string;
  } = {
    status: safeStatus,
    reuseDecision,
    note:
      typeof source.note === 'string' && source.note.trim()
        ? source.note.trim()
        : 'Aucun logo officiel suffisamment vérifié dans cette sortie ; conserver une identité neutre tant qu’un actif exploitable n’est pas confirmé.',
  };

  if (sourceUrl) normalized.sourceUrl = sourceUrl;
  if (assetUrl && (safeStatus === 'OFFICIAL_LOGO_FOUND' || safeStatus === 'PUBLIC_LOGO_CANDIDATE')) {
    normalized.assetUrl = assetUrl;
  }

  return normalized;
}

function normalizedNavigationBlocks(value: unknown): Array<{
  label: string;
  kind: 'navigation' | 'content_block' | 'conversion_cta';
}> {
  if (!Array.isArray(value)) return [];

  const allowedKinds = new Set(['navigation', 'content_block', 'conversion_cta']);
  const seen = new Set<string>();
  const blocks: Array<{
    label: string;
    kind: 'navigation' | 'content_block' | 'conversion_cta';
  }> = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    const kind = typeof item.kind === 'string' ? item.kind : '';
    if (!label || !allowedKinds.has(kind)) continue;
    const key = `${kind}:${label.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push({
      label,
      kind: kind as 'navigation' | 'content_block' | 'conversion_cta',
    });
  }

  return blocks;
}

function safeOpportunity(value: unknown, fallback?: string): 'A' | 'B' | 'C' | 'D' {
  if (value === 'A' || value === 'B' || value === 'C' || value === 'D') return value;
  if (fallback === 'A' || fallback === 'B' || fallback === 'C' || fallback === 'D') {
    return fallback;
  }
  return 'D';
}

/**
 * Keeps a locally generated research response from turning into a 500 when a
 * small model returns a valid JSON fragment instead of the requested object.
 * Missing scores deliberately become zero: the prospect is not promoted on
 * incomplete evidence, and no business fact is invented.
 */
const VALID_SITE_STATUSES = new Set([
  'HEALTHY', 'UNDER_CONSTRUCTION', 'REBUILDING', 'DEGRADED',
  'MAINTENANCE', 'PARKED', 'DOMAIN_FOR_SALE', 'UNREACHABLE', 'UNKNOWN',
]);

function normalizeSiteStatus(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const status = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return VALID_SITE_STATUSES.has(status) ? status : undefined;
}

export function normalizeResearchResult(
  output: unknown,
  prospect: RunnerProspect,
): Record<string, unknown> {
  const reasons: string[] = [];
  const source = isRecord(output) ? { ...output } : {};

  if (Array.isArray(output)) {
    source.sourceNavigationBlocks = normalizedNavigationBlocks(output);
    reasons.push('top-level array converted to a research object');
  }

  const rawScores = isRecord(source.scoreInputs) ? source.scoreInputs : {};
  const scoreInputs: Record<ScoreKey, number> = {
    digitalGap: 0,
    commercialStrength: 0,
    contactability: 0,
    localFit: 0,
    prototypeLeverage: 0,
    confidence: 0,
  };

  for (const key of SCORE_KEYS) {
    const score = boundedScore(rawScores[key]);
    if (score !== undefined) scoreInputs[key] = score;
  }
  if (!isRecord(source.scoreInputs) || SCORE_KEYS.some((key) => boundedScore(rawScores[key]) === undefined)) {
    reasons.push('missing or incomplete scoreInputs defaulted to zero');
  }

  const contactPlan = isRecord(source.contactPlan)
    ? source.contactPlan
    : {
        recommendedChannel: 'unknown',
        targetRole: 'unknown',
        routeReason: 'La sortie structurée du modèle était incomplète ; aucune voie de contact n’est validée.',
        nextAction: 'Rechercher une voie professionnelle publique avant toute approche.',
        sourceRefs: [],
        confidence: 0,
      };
  if (!isRecord(source.contactPlan)) reasons.push('missing contactPlan replaced with an unknown safe plan');

  // Phone and contactability are trust-boundary fields. The model may report
  // them for audit, but neither becomes canonical until the independent phone
  // enrichment stage attaches deterministic evidence.
  const sourcePhone = typeof source.phone === 'string' ? source.phone.trim() : '';
  const sourcePhoneUrl = safeHttpUrl(source.phoneSourceUrl);
  const hadModelPhone = sourcePhone.length > 0;
  const rawContactability = boundedScore(rawScores.contactability) ?? 0;
  if (hadModelPhone) reasons.push('model phone removed from canonical output pending independent evidence');
  if (rawContactability > 0) {
    reasons.push('contactability score held until independent evidence is attached');
    scoreInputs.contactability = 0;
  }

  const sources = Array.isArray(source.sources)
    ? source.sources.flatMap((item) => {
        if (!isRecord(item)) return [];
        const url = safeHttpUrl(item.url);
        let note = typeof item.note === 'string' ? item.note.trim() : '';
        const supports = Array.isArray(item.supports)
          ? [...new Set(item.supports.filter(
              (claim): claim is string => typeof claim === 'string' && ALLOWED_RESEARCH_CLAIMS.has(claim),
            ))]
          : [];

        // SECURITY INVARIANT: model claim MUST NOT manufacture the evidence used
        // to validate itself. The phone value is a model claim and must NOT be
        // injected into the source note. Evidence-integrity independently
        // determines phone trust from source-backed facts.
        // See: docs/evidence-contract.md

        return url && note && supports.length > 0
          ? [{ url, note, supports }]
          : [];
      })
    : [];

  if (scoreInputs.localFit > 0 && !evaluateResearchEvidenceIntegrity({ sources, scoreInputs })
    .acceptedSources.some((item) => item.supports.includes('localFit'))) {
    scoreInputs.localFit = 0;
    reasons.push('unsupported localFit score defaulted to zero');
  }

  const normalized: Record<string, unknown> = {
    ...source,
    activity: typeof source.activity === 'string' ? source.activity : prospect.activity ?? '',
    location: typeof source.location === 'string' ? source.location : prospect.location ?? '',
    websiteUrl: typeof source.websiteUrl === 'string' ? source.websiteUrl : prospect.websiteUrl ?? '',
    siteStatus: normalizeSiteStatus(source.siteStatus) ?? 'UNKNOWN',
    opportunity: safeOpportunity(source.opportunity, prospect.opportunity),
    primaryAsset:
      typeof source.primaryAsset === 'string' ? source.primaryAsset : prospect.primaryAsset ?? '',
    primaryFriction:
      typeof source.primaryFriction === 'string' ? source.primaryFriction : prospect.primaryFriction ?? '',
    primaryCta:
      typeof source.primaryCta === 'string' ? source.primaryCta : prospect.primaryCta ?? 'Nous contacter',
    brandAsset: normalizedBrandAsset(source.brandAsset),
    sourceNavigationBlocks: normalizedNavigationBlocks(source.sourceNavigationBlocks),
    sourceNavigationNote:
      typeof source.sourceNavigationNote === 'string'
        ? source.sourceNavigationNote
        : 'Aucun bloc de navigation supplémentaire n’a été confirmé par cette sortie.',
    contactPlan,
    scoreInputs,
    sources,
  };
  delete normalized.phone;
  delete normalized.phoneSourceUrl;

  // This property is inside the deterministic runner's trust boundary. A
  // model may emit an identically named field, so always strip it before the
  // independent fetch/extraction stage attaches verified evidence.
  delete normalized.derivedPhoneEvidence;
  // Operating facts must be extracted from independently fetched accepted pages.
  delete normalized.operatingEvidence;
  delete normalized.digitalPainEvidence;

  if (reasons.length > 0) {
    normalized.researchNormalization = {
      applied: true,
      reasons,
      safeScoring: true,
    };
  }

  return normalized;
}
