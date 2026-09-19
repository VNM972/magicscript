import type { DesignRequestV1, DesignVertical } from './design-request';

export const DESIGN_ARTIFACT_VERSION = 'DESIGN_ARTIFACT_V1' as const;
export type ArtifactContentKind = 'VERIFIED_FACT' | 'GENERIC_FRAMING' | 'DESIGN_PLACEHOLDER';
export interface ArtifactContentBlock { kind: ArtifactContentKind; text: string; evidenceIds?: string[] }
export interface DesignArtifactV1 {
  id: string; version: typeof DESIGN_ARTIFACT_VERSION; revision: number; designRequestId: string; prospectId: string; verticalProfile: DesignVertical; createdAt: string;
  provenance: { designRequestId: string; evidenceIds: string[]; executionMode?: 'MODEL' | 'DETERMINISTIC_FALLBACK'; model?: { provider: string; model: string } };
  strategy: { siteObjective: string; primaryUserIntent: string; primaryCta: string; secondaryCta?: string; informationHierarchy: string[]; siteStructure: 'SINGLE_PAGE' | 'MULTI_PAGE' };
  pages: Array<{ id: string; purpose: string; headingIntent: string; content: ArtifactContentBlock[]; ctaIntent: string; visualMediaIntent: string; evidenceIds: string[] }>;
  visualDirection: { mood: string; typography: string; layout: string; spacing: string; imageTreatment: string; interaction: string; responsivePriorities: string[] };
  buildGuidance: { componentHierarchy: string[]; sectionOrder: string[]; contentPriority: string[]; ctaPlacement: string[]; assetRequirements: string[] };
  status: 'DRAFT' | 'CORRECTION_REQUIRED' | 'APPROVED' | 'REVIEW_LIMIT_REACHED';
}

export interface DesignerProfile { vertical: DesignVertical; hierarchy: string[]; objective: string; primaryCta: string; sections: string[]; visualMood: string }
export const DESIGNER_PROFILES: Record<DesignVertical, DesignerProfile> = {
  RESTAURANT: { vertical: 'RESTAURANT', objective: 'Make the venue identity and next visit action immediately clear.', primaryCta: 'Découvrir le menu ou réserver', hierarchy: ['identity', 'menu discovery', 'visit action', 'location'], sections: ['hero', 'menu-or-offer', 'visit-information', 'location-and-contact'], visualMood: 'warm, appetite-led, image-forward' },
  BEAUTY: { vertical: 'BEAUTY', objective: 'Clarify verified services and make mobile booking intent effortless.', primaryCta: 'Prendre rendez-vous', hierarchy: ['service clarity', 'trust', 'booking action', 'practical information'], sections: ['hero', 'services', 'trust-and-proof', 'booking-and-contact'], visualMood: 'calm, tactile, reassuring' },
  LOCAL_SERVICE: { vertical: 'LOCAL_SERVICE', objective: 'Explain the service clearly and turn local intent into a request.', primaryCta: 'Demander un contact', hierarchy: ['what the company does', 'service area if known', 'reassurance', 'request action'], sections: ['hero', 'services', 'reassurance', 'request-and-contact'], visualMood: 'clear, dependable, practical' },
  GENERAL_LOCAL_BUSINESS: { vertical: 'GENERAL_LOCAL_BUSINESS', objective: 'Present a credible local business offer with a simple next step.', primaryCta: 'Contacter l’entreprise', hierarchy: ['identity', 'offer clarity', 'reassurance', 'contact action'], sections: ['hero', 'offer', 'reassurance', 'contact'], visualMood: 'balanced, approachable, credible' },
};

export function designerPrompt(request: DesignRequestV1, profile = DESIGNER_PROFILES[request.designInput.businessVertical]): string {
  return `COMMON DESIGNER CONSTITUTION: Use only supplied facts; omit unknowns; label generic framing; never invent claims, prices, hours, services, testimonials, team names or coverage. Do not research, score, contact, deploy or expose reasoning. Return JSON matching DESIGN_ARTIFACT_V1.\nVERTICAL PROFILE: ${JSON.stringify(profile)}\nDESIGN REQUEST: ${JSON.stringify(request)}`;
}

export function buildDeterministicArtifact(request: DesignRequestV1, now: string, model?: { provider: string; model: string }): DesignArtifactV1 {
  const profile = DESIGNER_PROFILES[request.designInput.businessVertical];
  const evidenceIds = request.designInput.evidence.map((_, i) => `evidence-${i + 1}`);
  const fact = (text: string, ids = evidenceIds): ArtifactContentBlock => ({ kind: 'VERIFIED_FACT', text, evidenceIds: ids });
  const generic = (text: string): ArtifactContentBlock => ({ kind: 'GENERIC_FRAMING', text });
  const name = request.identity.businessName;
  const pages = [{ id: 'home', purpose: profile.objective, headingIntent: `Clarifier la valeur de ${name}`, content: [fact(name, []), generic('Un accompagnement simple et clair pour passer à l’action.')], ctaIntent: profile.primaryCta, visualMediaIntent: 'Use only supplied or later-approved business imagery; no invented media claims.', evidenceIds }];
  return { id: `artifact-${request.id}-${DESIGN_ARTIFACT_VERSION}-r1`, version: DESIGN_ARTIFACT_VERSION, revision: 1, designRequestId: request.id, prospectId: request.prospectId, verticalProfile: request.designInput.businessVertical, createdAt: now, provenance: { designRequestId: request.id, evidenceIds, executionMode: model ? 'MODEL' : 'DETERMINISTIC_FALLBACK', ...(model ? { model } : {}) }, strategy: { siteObjective: profile.objective, primaryUserIntent: 'Understand the offer and take the next practical action.', primaryCta: profile.primaryCta, informationHierarchy: profile.hierarchy, siteStructure: 'SINGLE_PAGE' }, pages, visualDirection: { mood: profile.visualMood, typography: 'Readable, high-contrast sans-serif with optional expressive display accent.', layout: 'Single-column mobile-first flow with clear section boundaries.', spacing: 'Generous touch-friendly spacing.', imageTreatment: 'Authentic business imagery only when supplied or approved.', interaction: 'Calm, obvious, keyboard-accessible interactions.', responsivePriorities: ['390px mobile conversion path', 'touch targets', 'readable type', 'desktop widening without reordering CTA'] }, buildGuidance: { componentHierarchy: ['SiteShell', 'Header', 'Hero', 'ContentSections', 'PrimaryCta', 'Footer'], sectionOrder: profile.sections, contentPriority: ['identity', 'offer', 'primary action', 'practical details'], ctaPlacement: ['hero', 'after core offer', 'footer'], assetRequirements: ['logo if supplied', 'approved business imagery if supplied', 'no fabricated testimonials or pricing'] }, status: 'DRAFT' };
}

export function validateDesignArtifact(value: unknown, request: DesignRequestV1): DesignArtifactV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Design artifact must be an object');
  const artifact = value as Partial<DesignArtifactV1>;
  if (artifact.id !== `artifact-${request.id}-${DESIGN_ARTIFACT_VERSION}-r${artifact.revision ?? 1}`) throw new Error('Design artifact id is invalid');
  if (!Number.isInteger(artifact.revision) || (artifact.revision as number) < 1) throw new Error('Design artifact revision is invalid');
  if (!['DRAFT', 'CORRECTION_REQUIRED', 'APPROVED', 'REVIEW_LIMIT_REACHED'].includes(artifact.status as string)) throw new Error('Design artifact status is invalid');
  if (artifact.version !== DESIGN_ARTIFACT_VERSION || artifact.designRequestId !== request.id || artifact.prospectId !== request.prospectId) throw new Error('Design artifact identity/linkage is invalid');
  if (artifact.verticalProfile !== request.designInput.businessVertical || !Array.isArray(artifact.pages) || artifact.pages.length < 1 || !artifact.strategy || !artifact.visualDirection || !artifact.buildGuidance) throw new Error('Design artifact structure is invalid');
  const serialized = JSON.stringify(value).toLowerCase();
  if (/lorem ipsum|todo placeholder|fake testimonial/.test(serialized)) throw new Error('Forbidden placeholder content');
  for (const page of artifact.pages) if (!page || typeof page.id !== 'string' || !Array.isArray(page.content) || typeof page.headingIntent !== 'string') throw new Error('Invalid page structure');
  return value as DesignArtifactV1;
}

export interface DesignArtifactStore { get(designRequestId: string, version: typeof DESIGN_ARTIFACT_VERSION, revision?: number): Promise<DesignArtifactV1 | null>; save(artifact: DesignArtifactV1): Promise<void>; list?(designRequestId?: string): Promise<DesignArtifactV1[]> }
export class InMemoryDesignArtifactStore implements DesignArtifactStore { private readonly values = new Map<string, DesignArtifactV1>(); async get(id: string, version: typeof DESIGN_ARTIFACT_VERSION, revision = 1) { return this.values.get(`${id}:${version}:${revision}`) ?? null } async save(a: DesignArtifactV1) { this.values.set(`${a.designRequestId}:${a.version}:${a.revision}`, a) } async list(id?: string) { return [...this.values.values()].filter((a) => !id || a.designRequestId === id).sort((a, b) => a.revision - b.revision) } }

export async function executeVerticalDesigner(input: { request: DesignRequestV1; artifacts: DesignArtifactStore; previousArtifact?: DesignArtifactV1; correction?: { corrections: Array<{ targetArea: string; requiredChange: string }> }; revision?: number; now?: () => Date; generate?: (prompt: string) => Promise<unknown>; model?: { provider: string; model: string } }): Promise<DesignArtifactV1> {
  const revision = input.revision ?? (input.previousArtifact ? input.previousArtifact.revision + 1 : 1);
  const existing = await input.artifacts.get(input.request.id, DESIGN_ARTIFACT_VERSION, revision); if (existing) return existing;
  const now = (input.now ?? (() => new Date()))().toISOString();
  const prompt = `${designerPrompt(input.request)}\nREVISION: ${revision}\nPREVIOUS ARTIFACT: ${JSON.stringify(input.previousArtifact ?? null)}\nCORRECTION REQUEST: ${JSON.stringify(input.correction ?? null)}`;
  const candidate = input.generate ? await input.generate(prompt) : buildDeterministicArtifact(input.request, now, input.model);
  const artifact = validateDesignArtifact({ ...(candidate as object), id: `artifact-${input.request.id}-${DESIGN_ARTIFACT_VERSION}-r${revision}`, revision, status: 'DRAFT', provenance: { ...((candidate as DesignArtifactV1).provenance ?? {}), designRequestId: input.request.id, executionMode: input.model ? 'MODEL' : 'DETERMINISTIC_FALLBACK', ...(input.model ? { model: input.model } : {}) } }, input.request); await input.artifacts.save(artifact); return artifact;
}
