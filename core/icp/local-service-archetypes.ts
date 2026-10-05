/**
 * Source-text signatures for service archetypes already named in
 * docs/agent1-v2-icp.md. This is a bounded evidence vocabulary, not a
 * fallback for every business that calls itself a service.
 */
export const SUPPORTED_LOCAL_SERVICE_ARCHETYPES = [
  'DRIVING_SCHOOL',
  'ELECTRICAL_INSTALLATION',
  'WEDDING_EVENT_PHOTOGRAPHY',
  'HVAC_REFRIGERATION',
  'LANDSCAPING_TREE_SERVICES',
] as const;

export type SupportedLocalServiceArchetype = typeof SUPPORTED_LOCAL_SERVICE_ARCHETYPES[number];

const signatures: Readonly<Record<SupportedLocalServiceArchetype, readonly RegExp[]>> = {
  DRIVING_SCHOOL: [/\bauto[ -]?ecole\b/, /\bformation a la conduite\b/, /\benseignement de la conduite\b/, /\bdriving school\b/],
  ELECTRICAL_INSTALLATION: [/\binstallation electrique\b/, /\belectricite generale\b/, /\bdepannage electrique\b/, /\belectrical installation\b/, /\belectrical repair\b/],
  WEDDING_EVENT_PHOTOGRAPHY: [/\bphotograph(?:e|ie) de mariage\b/, /\bphotographe mariage\b/, /\bphotograph(?:e|ie) evenementiel(?:le)?\b/, /\bphotographie d.evenements?\b/, /\bwedding photograph(?:er|y)\b/, /\bevent photograph(?:er|y)\b/],
  HVAC_REFRIGERATION: [/\bclimatisation\b/, /\bfroid (?:commercial|industriel)\b/, /\brefrigeration\b/, /\bair conditioning\b/, /\b(?:installation|maintenance|depannage|reparation|entretien)\b.{0,50}\bfroid\b/, /\bfroid\b.{0,50}\b(?:installation|maintenance|depannage|reparation|entretien)\b/],
  LANDSCAPING_TREE_SERVICES: [/\bpaysagist(?:e|es)\b/, /\belagage\b/, /\bentretien de jardins?\b/, /\bamenagement paysager\b/, /\blandscaping\b/, /\btree services?\b/],
};

const normalize = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/** One explicit supported activity per text span; ambiguity stays unresolved. */
export function matchSupportedLocalServiceText(value: string): SupportedLocalServiceArchetype | undefined {
  const text = normalize(value);
  if (!text || text.length > 600) return undefined;
  // Corporate-only photography and specialized-family language cannot be
  // promoted into the general service family by a nearby service mention.
  if (/\b(?:corporate photograph|photograph(?:e|ie) corporate|photograph(?:e|ie) d entreprise)\b/.test(text)) return undefined;
  if (/\b(?:restaurant|cafe|barbier|coiffure|salon de beaute|beauty salon|hair salon)\b/.test(text)) return undefined;
  const matches = SUPPORTED_LOCAL_SERVICE_ARCHETYPES.filter((archetype) => signatures[archetype].some((signature) => signature.test(text)));
  return matches.length === 1 ? matches[0] : undefined;
}

export function resolveLocalServicesFromOperatingFacts(
  facts: readonly { kind: string; value: string; evidenceType: string; supportingText?: string }[],
): 'LOCAL_SERVICES' | undefined {
  if (facts.some((fact) => fact.kind === 'SCHEMA_ORG_TYPE' && /^(?:Restaurant|CafeOrCoffeeShop|BarOrPub|BeautySalon|HairSalon|Store)$/.test(fact.value))) return undefined;
  const matches = new Set<SupportedLocalServiceArchetype>();
  for (const fact of facts) {
    if (fact.kind !== 'SERVICE_TYPE') continue;
    const match = fact.evidenceType === 'OWNED_PAGE_TEXT'
      ? fact.supportingText ? matchSupportedLocalServiceText(fact.supportingText) : undefined
      : matchSupportedLocalServiceText(fact.value);
    if (!match || (fact.evidenceType === 'OWNED_PAGE_TEXT' && match !== fact.value)) return undefined;
    matches.add(match);
  }
  return matches.size === 1 ? 'LOCAL_SERVICES' : undefined;
}
