export interface DiscoveredProspect {
  companyName: string;
  legalName?: string;
  siren?: string;
  siret?: string;
  city?: string;
  location?: string;
  websiteUrl?: string;
  activity?: string;
  sourceUrl: string;
}

export interface DiscoveryQuery {
  location: string;
  categories?: string[];
  limit: number;
}

export interface ProspectDiscoveryProvider {
  discover(query: DiscoveryQuery): Promise<DiscoveredProspect[]>;
}
