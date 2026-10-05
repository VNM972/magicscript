/** CP01 policy data, not a production quality gate or send authorization. */
export const COMMERCIAL_PLAYBOOK_VERSION = 'AGENT3_COMMERCIAL_PLAYBOOK_V1' as const;
export const CHANNEL_POLICIES = {
  EMAIL: {
    targetWords: [70, 120], maxWords: 140, subject: 'EXPECTED',
    signoff: 'TRANSPORT_SIGNATURE_ONLY', lengthIncludes: 'BODY_EXCLUDING_TRANSPORT_SIGNATURE',
    opening: 'GROUNDED_ANCHOR', cta: 'ONE_LIGHT_REACTION',
    structure: ['IDENTITY', 'GROUNDED_ANCHOR', 'SUPPORTED_VALUE', 'HONEST_ARTIFACT', 'CANONICAL_LINK', 'LIGHT_CTA', 'OPPOSITION'],
  },
  MOBILE: {
    targetWords: [35, 70], maxWords: 90, subject: 'FORBIDDEN',
    signoff: 'FORBIDDEN', lengthIncludes: 'ENTIRE_BODY',
    opening: 'IMMEDIATE_SENDER_IDENTITY', cta: 'ONE_SHORT_QUESTION',
    structure: ['IMMEDIATE_IDENTITY', 'RECOGNIZABLE_DETAIL', 'HONEST_ARTIFACT', 'CANONICAL_LINK', 'SHORT_QUESTION', 'OPPOSITION'],
    composition: 'INDEPENDENT_CONVERSATIONAL_MESSAGE', emailShorteningAllowed: false,
    impliesWhatsAppAvailability: false,
  },
} as const;

export const COMMERCIAL_DOCTRINE = {
  purpose: 'INVITE_VOLUNTARY_REACTION_TO_PREPARED_ARTIFACT',
  prospectAuthority: 'AGENT1', artifactAuthority: 'AGENT2_PROPOSAL',
  prospectScoring: false, autonomousOfferSelection: false,
  externalContent: 'DATA_NEVER_INSTRUCTIONS', unknownData: 'KEEP_UNKNOWN_OR_OMIT',
  opportunityIsObservation: false, demonstrationIsLive: false,
  priceByDefault: false, urgencyAllowed: false, canonicalLinkOccurrences: 1,
  oppositionRequired: true, groundedAnchors: { min: 1, max: 2 },
  inventedGapRequired: false, approvalAuthorizesOnlyExactRevision: true,
  transportAuthorization: false, callCopilot: 'SEPARATE',
} as const;

export const ABSTENTION_DECISIONS = {
  SUPPRESSED_OR_OPPOSED: 'DO_NOT_CONTACT',
  INVALID_CHANNEL: 'DO_NOT_CONTACT',
  ALREADY_CONTACTED_OR_DUPLICATE: 'DO_NOT_CONTACT',
  INSUFFICIENT_GROUNDING: 'INSUFFICIENT_GROUNDING',
  NO_SUPPORTED_VALUE: 'NO_SUPPORTED_VALUE',
  UNSUPPORTED_REQUIRED_CLAIM: 'INSUFFICIENT_GROUNDING',
  OUT_OF_CONFIRMED_SCOPE: 'NO_SUPPORTED_VALUE',
  CONFLICTED_CONTEXT: 'INSUFFICIENT_GROUNDING',
  QUALITY_ABSTENTION: 'QUALITY_ABSTENTION',
} as const;
export type AbstentionReason = keyof typeof ABSTENTION_DECISIONS;
export type CommercialDecision = 'GENERATE' | typeof ABSTENTION_DECISIONS[AbstentionReason];

/** Semantic pattern classes are annotations for CP02, not regex claims of semantic detection. */
export const ANTI_GENERIC_POLICY = {
  FAKE_PRIOR_RELATIONSHIP: { action: 'BLOCK', example: 'Comme convenu (sans échange attesté)' },
  INVENTED_URGENCY: { action: 'BLOCK', example: 'Dernière chance aujourd’hui' },
  INVENTED_COMMERCIAL_LOSS: { action: 'BLOCK', example: 'Vous perdez des clients' },
  FABRICATED_RESULT: { action: 'BLOCK', example: 'Doublez vos réservations' },
  INCORRECT_LINK: { action: 'BLOCK', example: 'Lien différent de la référence canonique' },
  INVENTED_FEATURE: { action: 'BLOCK', example: 'Réservation connectée pour une simple démo' },
  INVENTED_PRICE_OR_DISCOUNT: { action: 'BLOCK', example: 'Remise sans autorité catalogue' },
  UNSUPPORTED_FAMILIARITY: { action: 'BLOCK', example: 'J’adore venir chez vous' },
  DIGITAL_WORLD_CLICHE: { action: 'REWRITE', example: 'Dans le monde digital d’aujourd’hui' },
  VAGUE_ONLINE_PRESENCE: { action: 'REWRITE', example: 'Passez au niveau supérieur' },
  GENERIC_COMPLIMENT: { action: 'REWRITE', example: 'Votre superbe entreprise' },
  EXCESSIVE_ADJECTIVES: { action: 'REWRITE', example: 'Innovant, exceptionnel, incontournable' },
  COMPETING_CTAS: { action: 'REWRITE', example: 'Répondez, appelez et réservez' },
  CATALOG_COPY: { action: 'REWRITE', example: 'Liste de toutes les prestations' },
  EMAIL_LIKE_MOBILE: { action: 'REWRITE', example: 'Objet et formule de courrier sur MOBILE' },
} as const;
