import type {
  CommercialScopeProfile,
  CommercialSiteKind,
  ComplexCommercialRequirement,
  LightweightCommercialFeature,
} from './commercial-scope';

export interface ProspectCommercialScopeExtraction {
  profile: CommercialScopeProfile;
  complete: boolean;
  conflicts: string[];
  sourceTexts: string[];
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function extractPageCounts(text: string): number[] {
  const counts: number[] = [];
  for (const match of text.matchAll(/\b(\d{1,2})\s*(?:pages?|page)\b/g)) {
    const value = Number(match[1]);
    if (Number.isInteger(value) && value > 0 && value <= 50) counts.push(value);
  }
  return unique(counts);
}

function extractSiteKinds(text: string): CommercialSiteKind[] {
  const kinds: CommercialSiteKind[] = [];

  if (/\b(?:site\s+)?e[- ]?commerce\b|\bboutique\s+en\s+ligne\b/.test(text)) {
    kinds.push('ECOMMERCE');
  }

  if (
    /\bapplication\s+metier\b|\bapplication\s+web\b|\boutil\s+metier\b|\bplateforme\s+sur\s+mesure\b/.test(text)
  ) {
    kinds.push('CUSTOM_APPLICATION');
  }

  if (/\bsite\s+vitrine\b|\bvitrine\s+(?:web|internet)\b/.test(text)) {
    kinds.push('SHOWCASE');
  }

  return unique(kinds);
}

function extractLightweightFeatures(text: string): LightweightCommercialFeature[] {
  const features: LightweightCommercialFeature[] = [];

  if (
    /\bcalendly\b|\bprise\s+de\s+rendez[- ]?vous\b|\breservation\s+(?:via|avec)\s+(?:un\s+)?outil\s+tiers\b/.test(text)
  ) {
    features.push('THIRD_PARTY_BOOKING');
  }

  if (/\bblog\b|\bactualites?\b/.test(text)) {
    features.push('SIMPLE_BLOG');
  }

  if (
    /\bformulaire\s+avance\b|\bformulaire\s+multi[- ]?etapes?\b|\bformulaire\s+conditionnel\b/.test(text)
  ) {
    features.push('ADVANCED_FORM');
  }

  if (
    /\bintegration\s+legere\b|\bconnexion\s+(?:simple|legere)\s+a\b|\bwebhook\s+simple\b/.test(text)
  ) {
    features.push('LIGHT_INTEGRATION');
  }

  return unique(features);
}

function extractComplexRequirements(text: string): ComplexCommercialRequirement[] {
  const requirements: ComplexCommercialRequirement[] = [];

  if (
    /\bdeveloppement\s+sur\s+mesure\b|\bfonctionnalite\s+sur\s+mesure\b|\bdeveloppement\s+metier\b/.test(text)
  ) {
    requirements.push('CUSTOM_DEVELOPMENT');
  }

  if (
    /\bintegration\s+complexe\b|\bconnexion\s+erp\b|\bconnexion\s+crm\b|\bapi\s+complexe\b/.test(text)
  ) {
    requirements.push('COMPLEX_INTEGRATION');
  }

  if (
    /\bespace\s+client\b|\bcompte\s+client\b|\bportail\s+client\b|\bconnexion\s+client\b/.test(text)
  ) {
    requirements.push('CLIENT_PORTAL');
  }

  if (
    /\bpaiement\s+en\s+ligne\b|\bpaiement\s+sur\s+le\s+site\b|\bencaissement\s+en\s+ligne\b/.test(text)
  ) {
    requirements.push('BUSINESS_PAYMENT');
  }

  if (
    /\bgros\s+catalogue\b|\bgrand\s+catalogue\b|\bplus\s+de\s+\d{2,}\s+produits\b/.test(text)
  ) {
    requirements.push('LARGE_CATALOG');
  }

  if (
    /\bbesoin\s+atypique\b|\bfonctionnement\s+tres\s+specifique\b|\bworkflow\s+metier\b/.test(text)
  ) {
    requirements.push('ATYPICAL_REQUIREMENT');
  }

  return unique(requirements);
}

export function extractCommercialScopeFromProspectTexts(
  sourceTexts: readonly string[],
): ProspectCommercialScopeExtraction {
  const normalizedTexts = sourceTexts
    .map((value) => value.trim())
    .filter(Boolean);

  const siteKinds: CommercialSiteKind[] = [];
  const pageCounts: number[] = [];
  const lightweightFeatures: LightweightCommercialFeature[] = [];
  const complexRequirements: ComplexCommercialRequirement[] = [];

  for (const rawText of normalizedTexts) {
    const text = normalize(rawText);
    siteKinds.push(...extractSiteKinds(text));
    pageCounts.push(...extractPageCounts(text));
    lightweightFeatures.push(...extractLightweightFeatures(text));
    complexRequirements.push(...extractComplexRequirements(text));
  }

  const uniqueSiteKinds = unique(siteKinds);
  const uniquePageCounts = unique(pageCounts);
  const conflicts: string[] = [];

  if (uniqueSiteKinds.length > 1) {
    conflicts.push('commercial_site_kind_conflict');
  }

  if (uniquePageCounts.length > 1) {
    conflicts.push('commercial_page_count_conflict');
  }

  const profile: CommercialScopeProfile = {
    siteKind:
      conflicts.includes('commercial_site_kind_conflict')
        ? null
        : uniqueSiteKinds[0] ?? null,
    pageCount:
      conflicts.includes('commercial_page_count_conflict')
        ? null
        : uniquePageCounts[0] ?? null,
    lightweightFeatures: unique(lightweightFeatures),
    complexRequirements: unique(complexRequirements),
  };

  return {
    profile,
    complete:
      conflicts.length === 0 &&
      profile.siteKind !== null &&
      profile.pageCount !== null,
    conflicts,
    sourceTexts: normalizedTexts,
  };
}
