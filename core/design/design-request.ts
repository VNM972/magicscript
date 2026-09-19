import type { NormalizedContactOpportunityPack } from '../admission/contact-opportunity-pack';

export const DESIGN_REQUEST_VERSION = 'DESIGN_REQUEST_V1' as const;
export const V2_DESIGN_JOB_KIND = 'V2_DESIGN_REQUEST' as const;
export const GENERAL_LOCAL_BUSINESS = 'GENERAL_LOCAL_BUSINESS' as const;

export type DesignVertical = typeof GENERAL_LOCAL_BUSINESS | 'RESTAURANT' | 'BEAUTY' | 'LOCAL_SERVICE';

export interface DesignRequestV1 {
  id: string;
  version: typeof DESIGN_REQUEST_VERSION;
  prospectId: string;
  admission: { packId: string; schemaVersion: string };
  identity: { businessName: string; legalName?: string; siren?: string; siret?: string; websiteUrl?: string; domain?: string; city?: string; location?: string };
  opportunity: { observedOpportunity?: string; digitalFriction?: string; businessContext?: string; agent1Verdict?: string };
  designInput: { currentWebsiteUrl?: string; businessVertical: DesignVertical; brandContext?: string; frictionTrigger?: string; evidence: readonly { url: string; note: string; supports: readonly string[]; observedAt?: string }[] };
  createdAt: string;
}

function routeVertical(pack: NormalizedContactOpportunityPack): DesignVertical {
  const context = `${pack.opportunity.businessContext ?? ''} ${pack.opportunity.observedOpportunity ?? ''}`.toLowerCase();
  if (/restaurant|café|cafe|bar|food|bistro/.test(context)) return 'RESTAURANT';
  if (/salon|beauty|barber|coiff|esthétique|beaute/.test(context)) return 'BEAUTY';
  if (/service|artisan|local/.test(context)) return 'LOCAL_SERVICE';
  return GENERAL_LOCAL_BUSINESS;
}

export function createDesignRequest(prospectId: string, pack: NormalizedContactOpportunityPack, now: string): DesignRequestV1 {
  return {
    id: `dr-${prospectId}-${DESIGN_REQUEST_VERSION}`,
    version: DESIGN_REQUEST_VERSION,
    prospectId,
    admission: { packId: pack.packId, schemaVersion: pack.schemaVersion },
    identity: { ...pack.identity },
    opportunity: { ...pack.opportunity },
    designInput: {
      currentWebsiteUrl: pack.identity.websiteUrl,
      businessVertical: routeVertical(pack),
      brandContext: pack.opportunity.businessContext,
      frictionTrigger: pack.opportunity.digitalFriction,
      evidence: pack.evidence ? pack.evidence.map((item) => ({ ...item, supports: [...item.supports] })) : [],
    },
    createdAt: now,
  };
}

export interface DesignRequestStore {
  get(prospectId: string, version: typeof DESIGN_REQUEST_VERSION): Promise<DesignRequestV1 | null>;
  save(request: DesignRequestV1): Promise<void>;
}

export class InMemoryDesignRequestStore implements DesignRequestStore {
  private readonly requests = new Map<string, DesignRequestV1>();
  async get(prospectId: string, version: typeof DESIGN_REQUEST_VERSION): Promise<DesignRequestV1 | null> { return this.requests.get(`dr-${prospectId}-${version}`) ?? null; }
  async save(request: DesignRequestV1): Promise<void> { this.requests.set(request.id, request); }
  async list(): Promise<DesignRequestV1[]> { return [...this.requests.values()]; }
}
