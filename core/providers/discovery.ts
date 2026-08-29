export interface DiscoveredProspect {
  companyName: string;
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
