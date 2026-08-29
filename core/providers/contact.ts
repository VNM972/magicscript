export interface ContactCandidate {
  email: string;
  sourceUrl: string;
  sourceType: 'official_site' | 'directory' | 'social' | 'other_public_source';
  confidence: number;
  verified: boolean;
}

export interface ContactDiscoveryInput {
  companyName: string;
  websiteUrl?: string;
  location?: string;
}

export interface ContactDiscoveryProvider {
  findContacts(input: ContactDiscoveryInput): Promise<ContactCandidate[]>;
}
