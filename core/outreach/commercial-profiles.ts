import type { CommercialContext } from './commercial-contract';

export const V1_VERTICAL_PROFILES = [
  'RESTAURANTS_BARS_CAFES',
  'BEAUTY_HAIR_BARBER',
  'LOCAL_RETAIL',
  'LOCAL_SERVICES',
] as const;
export type V1VerticalProfile = typeof V1_VERTICAL_PROFILES[number];
export type CommercialState = 'STANDARD' | 'SITE_UNDER_CONSTRUCTION';

export interface CommercialVerticalProfile {
  id: V1VerticalProfile | 'NEUTRAL_EVIDENCE_ONLY';
  version: 'CP03_VERTICAL_PROFILE_V1';
  commonCustomerGoals: readonly string[];
  websiteUseCases: readonly string[];
  observableThemes: readonly string[];
  demonstratedFeaturesOnly: readonly string[];
  forbiddenAssumptions: readonly string[];
  vocabulary: readonly string[];
  ctaTendency: string;
  exemplarIds: readonly string[];
}

const profiles: Record<V1VerticalProfile, CommercialVerticalProfile> = {
  RESTAURANTS_BARS_CAFES: { id: 'RESTAURANTS_BARS_CAFES', version: 'CP03_VERTICAL_PROFILE_V1', commonCustomerGoals: ['rendre la carte lisible', 'faciliter l’accès et les horaires'], websiteUseCases: ['carte', 'horaires', 'localisation', 'réservation existante'], observableThemes: ['menu/card readability', 'opening hours', 'location/access', 'existing booking link', 'offers presentation'], demonstratedFeaturesOnly: ['menu', 'opening-hours', 'location', 'booking'], forbiddenAssumptions: ['more bookings', 'full tables', 'revenue uplift'], vocabulary: ['carte', 'horaires', 'adresse'], ctaTendency: 'reaction about the prepared demo', exemplarIds: ['cp03-restaurant-email', 'cp03-strong-site-email'] },
  BEAUTY_HAIR_BARBER: { id: 'BEAUTY_HAIR_BARBER', version: 'CP03_VERTICAL_PROFILE_V1', commonCustomerGoals: ['présenter les services clairement', 'montrer le portfolio'], websiteUseCases: ['services', 'portfolio/gallery', 'public pricing', 'existing booking path'], observableThemes: ['services', 'portfolio/gallery', 'public pricing/services', 'existing booking path'], demonstratedFeaturesOnly: ['services', 'gallery', 'pricing', 'booking'], forbiddenAssumptions: ['full calendar', 'premium clientele', 'guaranteed appointments'], vocabulary: ['prestations', 'portfolio', 'rendez-vous'], ctaTendency: 'short reaction question', exemplarIds: ['cp03-beauty-mobile'] },
  LOCAL_RETAIL: { id: 'LOCAL_RETAIL', version: 'CP03_VERTICAL_PROFILE_V1', commonCustomerGoals: ['rendre les produits faciles à découvrir', 'indiquer horaires et accès'], websiteUseCases: ['ranges/products', 'opening hours', 'location', 'contact'], observableThemes: ['ranges/products', 'opening hours', 'location', 'contact', 'in-store discovery'], demonstratedFeaturesOnly: ['catalogue', 'opening-hours', 'location', 'contact'], forbiddenAssumptions: ['e-commerce', 'online payment', 'sales increase'], vocabulary: ['produits', 'sélection', 'en magasin'], ctaTendency: 'low-friction discovery question', exemplarIds: ['cp03-retail-email'] },
  LOCAL_SERVICES: { id: 'LOCAL_SERVICES', version: 'CP03_VERTICAL_PROFILE_V1', commonCustomerGoals: ['expliquer le service', 'rendre la demande de contact simple'], websiteUseCases: ['service clarity', 'service area', 'contact/request flow'], observableThemes: ['service clarity', 'service area', 'contact/request flow'], demonstratedFeaturesOnly: ['services', 'service-area', 'contact'], forbiddenAssumptions: ['automatic quote', 'immediate availability', 'guaranteed leads'], vocabulary: ['service', 'zone', 'demande'], ctaTendency: 'one short question', exemplarIds: ['cp03-services-mobile'] },
};

const neutral: CommercialVerticalProfile = { id: 'NEUTRAL_EVIDENCE_ONLY', version: 'CP03_VERTICAL_PROFILE_V1', commonCustomerGoals: [], websiteUseCases: [], observableThemes: [], demonstratedFeaturesOnly: [], forbiddenAssumptions: ['all sector-specific assumptions'], vocabulary: [], ctaTendency: 'one evidence-led reaction question', exemplarIds: ['cp03-ambiguous-abstention'] };

export function resolveVerticalProfile(vertical: string): CommercialVerticalProfile {
  return (V1_VERTICAL_PROFILES as readonly string[]).includes(vertical) ? profiles[vertical as V1VerticalProfile] : neutral;
}
export function verticalProfileFor(context: CommercialContext): CommercialVerticalProfile { return resolveVerticalProfile(context.prospect.vertical); }
export const SITE_UNDER_CONSTRUCTION_STATE: CommercialState = 'SITE_UNDER_CONSTRUCTION';
