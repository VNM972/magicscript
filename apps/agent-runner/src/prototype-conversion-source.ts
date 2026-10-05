export interface PrototypeConversionExpectation {
  salesRoomUrl?: string | null;
  salesRoomSlug?: string | null;
  ctaTarget?: string | null;
}

const DIRECT_COMMERCIAL_WRITE_PATHS = [
  '/api/public/sales-room-message',
  '/api/public/meeting-requested',
  '/api/public/event',
  '/api/public/booking',
  '/api/public/meeting-cancel',
  '/api/contact',
] as const;

function extractStringConstants(source: string): Map<string, string> {
  const constants = new Map<string, string>();
  const pattern =
    /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(["'`])([^"'`]+)\2\s*;/g;

  for (const match of source.matchAll(pattern)) {
    constants.set(match[1], match[3]);
  }

  return constants;
}

function resolveAnchorHref(
  attributes: string,
  constants: ReadonlyMap<string, string>,
): string | null {
  const literalMatch = attributes.match(
    /\bhref\s*=\s*(?:{\s*)?(["'`])([^"'`]+)\1(?:\s*})?/i,
  );

  if (literalMatch) {
    return literalMatch[2];
  }

  const variableMatch = attributes.match(
    /\bhref\s*=\s*{\s*([A-Za-z_$][\w$]*)\s*}/i,
  );

  if (!variableMatch) {
    return null;
  }

  return constants.get(variableMatch[1]) ?? null;
}

function primaryCtaHasExpectedHref(
  source: string,
  expectedHref: string,
  primaryCtaLabels: readonly string[],
): boolean {
  const normalizedLabels = [
    ...new Set(
      primaryCtaLabels
        .map(normalizePrimaryCtaLabel)
        .filter(Boolean),
    ),
  ];

  if (normalizedLabels.length === 0) {
    return false;
  }

  const constants = extractStringConstants(source);

  for (const match of source.matchAll(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
  )) {
    const text = normalizePrimaryCtaLabel(
      visibleAnchorText(match[2]),
    );

    if (!normalizedLabels.includes(text)) {
      continue;
    }

    const href = resolveAnchorHref(
      match[1],
      constants,
    );

    if (href === expectedHref) {
      return true;
    }
  }

  return false;
}

export function validatePrototypeConversionSource(
  sourceSnapshot: string,
  conversion?: PrototypeConversionExpectation | null,
  primaryCtaLabels: readonly string[] = [],
): string[] {
  const blockingFindings: string[] = [];

  if (/<form\b/i.test(sourceSnapshot)) {
    blockingFindings.push(
      'Prototype contains a local form; commercial conversion must be handled by the Magic Script Sales Room.',
    );
  }

  const lowerSource = sourceSnapshot.toLowerCase();
  const directWritePaths = DIRECT_COMMERCIAL_WRITE_PATHS.filter(
    (path) => lowerSource.includes(path.toLowerCase()),
  );

  if (directWritePaths.length > 0) {
    blockingFindings.push(
      `Prototype contains direct commercial write endpoint references: ${directWritePaths.join(', ')}`,
    );
  }

  const expectedSalesRoomUrl =
    conversion?.salesRoomUrl?.trim() || null;

  if (expectedSalesRoomUrl) {
    if (
      !primaryCtaHasExpectedHref(
        sourceSnapshot,
        expectedSalesRoomUrl,
        primaryCtaLabels,
      )
    ) {
      blockingFindings.push(
        `Prototype primary conversion href does not match the expected Sales Room URL: ${expectedSalesRoomUrl}`,
      );
    }
  }

  return blockingFindings;
}
export interface PrototypeConversionRepairResult {
  source: string;
  patched: boolean;
  patchedCount: number;
}

function visibleAnchorText(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePrimaryCtaLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function repairPrototypePrimaryCtaSource(
  source: string,
  conversion: PrototypeConversionExpectation | null | undefined,
  primaryCtaLabels: readonly string[],
): PrototypeConversionRepairResult {
  const expectedSalesRoomUrl = conversion?.salesRoomUrl?.trim() || null;

  if (!expectedSalesRoomUrl) {
    return {
      source,
      patched: false,
      patchedCount: 0,
    };
  }

  const labels = [...new Set(
    primaryCtaLabels
      .map((label) => label.trim())
      .filter(Boolean),
  )];

  if (labels.length === 0) {
    return {
      source,
      patched: false,
      patchedCount: 0,
    };
  }

  let patchedCount = 0;

  const repaired = source.replace(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
    (anchor, attributes: string, body: string) => {
      const text = normalizePrimaryCtaLabel(
        visibleAnchorText(body),
      );

      if (
        !labels.some(
          (label) =>
            normalizePrimaryCtaLabel(label) === text,
        )
      ) {
        return anchor;
      }

      const literalHref =
        /\bhref\s*=\s*(["'])([^"']*)\1/i;

      if (!literalHref.test(attributes)) {
        return anchor;
      }

      const nextAttributes = attributes.replace(
        literalHref,
        `href="${expectedSalesRoomUrl}"`,
      );

      if (nextAttributes === attributes) {
        return anchor;
      }

      patchedCount += 1;
      return `<a${nextAttributes}>${body}</a>`;
    },
  );

  return {
    source: repaired,
    patched: patchedCount > 0,
    patchedCount,
  };
}