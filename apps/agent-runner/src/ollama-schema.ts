const stringArray = {
  type: 'array',
  items: { type: 'string' },
} as const;

export function schemaForAgentJob(
  jobKind: string,
): Record<string, unknown> | undefined {
  if (jobKind === 'RUN_PROTOTYPE_QA') {
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'pass',
        'safeForOutreach',
        'blockingFindings',
        'warnings',
        'recommendedFixes',
      ],
      properties: {
        pass: { type: 'boolean' },
        safeForOutreach: { type: 'boolean' },
        blockingFindings: stringArray,
        warnings: stringArray,
        recommendedFixes: stringArray,
      },
    };
  }

  if (jobKind === 'GENERATE_PROTOTYPE_STRATEGY') {
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'objective',
        'targetCustomer',
        'primaryAsset',
        'primaryFriction',
        'valueProposition',
        'brandAsset',
        'hero',
        'sections',
        'sourceNavigationBlocks',
        'sourceNavigationNote',
        'commercialProof',
        'factsAllowed',
        'factsForbiddenOrUnverified',
        'mobilePriorities',
        'conversionStrategy',
        'confidence',
        'humanRequired',
        'blockingReasons',
      ],
      properties: {
        objective: { type: 'string' },
        targetCustomer: { type: 'string' },
        primaryAsset: { type: 'string' },
        primaryFriction: { type: 'string' },
        valueProposition: { type: 'string' },
        brandAsset: {
          type: 'object',
          additionalProperties: false,
          required: ['status', 'reuseDecision', 'note'],
          properties: {
            status: {
              enum: ['OFFICIAL_LOGO_FOUND', 'PUBLIC_LOGO_CANDIDATE', 'NOT_FOUND', 'UNKNOWN'],
            },
            sourceUrl: { type: 'string' },
            assetUrl: { type: 'string' },
            reuseDecision: {
              enum: ['REUSE_IF_RIGHTS_CLEAR', 'DO_NOT_REUSE', 'CREATE_ONLY_IF_NO_USABLE_IDENTITY', 'UNKNOWN'],
            },
            note: { type: 'string' },
          },
        },
        hero: {
          type: 'object',
          additionalProperties: false,
          required: ['headlineDirection', 'supportingMessage', 'primaryCta'],
          properties: {
            headlineDirection: { type: 'string' },
            supportingMessage: { type: 'string' },
            primaryCta: { type: 'string' },
          },
        },
        sections: stringArray,
        sourceNavigationBlocks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'kind'],
            properties: {
              label: { type: 'string' },
              kind: { enum: ['navigation', 'content_block', 'conversion_cta'] },
            },
          },
        },
        sourceNavigationNote: { type: 'string' },
        commercialProof: stringArray,
        factsAllowed: stringArray,
        factsForbiddenOrUnverified: stringArray,
        mobilePriorities: stringArray,
        conversionStrategy: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 100 },
        humanRequired: { type: 'boolean' },
        blockingReasons: stringArray,
      },
    };
  }

  return undefined;
}
