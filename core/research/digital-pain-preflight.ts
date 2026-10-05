import { noticeType } from './digital-pain-evidence';

export type NonAuthoritativeDigitalPainPreflightReason =
  | 'CANONICAL_NOTICE_MATCHED' | 'NO_CANONICAL_NOTICE' | 'CONFLICTING_NOTICES'
  | 'MISSING_ORIGIN' | 'MISSING_CONTENT' | 'UNSUPPORTED_CONTENT' | 'UNUSABLE_CONTENT';

/** Caller-supplied bookkeeping only; it establishes no source acceptance or ownership. */
export interface DigitalPainPreflightSeedProvenance {
  kind: 'CANDIDATE_URL' | 'FACTUAL_ORIGIN';
  reference: string;
}

export interface SuppliedDigitalPainPreflightInput {
  /** Candidate URL seed or factual origin identifier. Never resolved or fetched. */
  origin: string;
  /** Factual, already-extracted visible text only. HTML and model narrative are unsupported. */
  content?: { kind: 'TITLE_H1'; title?: string; h1?: readonly string[] };
  seedProvenance?: DigitalPainPreflightSeedProvenance;
}

/** Observational prioritization hint, never DigitalPainObservation or scored evidence. */
export type NonAuthoritativeDigitalPainPreflightResult = {
  authority: 'NON_AUTHORITATIVE';
  seedProvenance?: DigitalPainPreflightSeedProvenance;
} & (
  | { state: 'LIKELY_CANONICAL_PAIN'; condition: 'SITE_UNDER_CONSTRUCTION' | 'SITE_REBUILDING';
      reason: 'CANONICAL_NOTICE_MATCHED'; matchedText: string }
  | { state: 'NO_PAIN_SIGNAL'; condition: null; reason: 'NO_CANONICAL_NOTICE'; matchedText: null }
  | { state: 'UNKNOWN'; condition: null;
      reason: Exclude<NonAuthoritativeDigitalPainPreflightReason, 'CANONICAL_NOTICE_MATCHED' | 'NO_CANONICAL_NOTICE'>;
      matchedText: null }
);

/** Synchronous supplied-content inspection. UNKNOWN stays eligible for later research.
 * NO_PAIN_SIGNAL means only that no V1 title/H1 notice was detected, never site health.
 */
export function inspectSuppliedDigitalPainPreflight(
  input: SuppliedDigitalPainPreflightInput,
): NonAuthoritativeDigitalPainPreflightResult {
  const base: { authority: 'NON_AUTHORITATIVE'; seedProvenance?: DigitalPainPreflightSeedProvenance } =
    { authority: 'NON_AUTHORITATIVE' };
  const unknown = (reason: Extract<NonAuthoritativeDigitalPainPreflightResult, { state: 'UNKNOWN' }>['reason']):
    NonAuthoritativeDigitalPainPreflightResult =>
    ({ ...base, state: 'UNKNOWN', condition: null, reason, matchedText: null });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return unknown('UNSUPPORTED_CONTENT');
  if (input.seedProvenance !== undefined) {
    const provenance = input.seedProvenance;
    if (!provenance || !['CANDIDATE_URL', 'FACTUAL_ORIGIN'].includes(provenance.kind) ||
        typeof provenance.reference !== 'string' || !provenance.reference.trim()) return unknown('UNSUPPORTED_CONTENT');
    // Copy only the narrow bookkeeping fields, never arbitrary caller authority fields.
    base.seedProvenance = { kind: provenance.kind, reference: provenance.reference };
  }
  if (typeof input.origin !== 'string' || !input.origin.trim()) return unknown('MISSING_ORIGIN');
  const content = input.content;
  if (content === undefined || content === null) return unknown('MISSING_CONTENT');
  if (typeof content !== 'object' || Array.isArray(content) || content.kind !== 'TITLE_H1' ||
      (content.title !== undefined && typeof content.title !== 'string') ||
      (content.h1 !== undefined && (!Array.isArray(content.h1) || Array.from(content.h1).some((text) => typeof text !== 'string')))) {
    return unknown('UNSUPPORTED_CONTENT');
  }
  const texts = [content.title ?? '', ...(content.h1 ?? [])].filter((text) => text.trim());
  if (!texts.length) return unknown('MISSING_CONTENT');
  // Markup, replacement characters and non-whitespace controls are not safely extracted text.
  if (texts.some((text) => /[<>\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text))) {
    return unknown('UNUSABLE_CONTENT');
  }
  let signal: { condition: 'SITE_UNDER_CONSTRUCTION' | 'SITE_REBUILDING'; matchedText: string } | undefined;
  for (const text of texts) {
    const type = noticeType(text);
    if (type !== 'UNDER_CONSTRUCTION' && type !== 'REBUILDING') continue;
    const condition = type === 'UNDER_CONSTRUCTION' ? 'SITE_UNDER_CONSTRUCTION' : 'SITE_REBUILDING';
    if (signal && signal.condition !== condition) return unknown('CONFLICTING_NOTICES');
    signal ??= { condition, matchedText: text };
  }
  return signal
    ? { ...base, ...signal, state: 'LIKELY_CANONICAL_PAIN', reason: 'CANONICAL_NOTICE_MATCHED' }
    : { ...base, state: 'NO_PAIN_SIGNAL', condition: null, reason: 'NO_CANONICAL_NOTICE', matchedText: null };
}
