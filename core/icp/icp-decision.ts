/**
 * Magic Script V2 — Agent 1 ICP Decision Engine
 *
 * Canonical deterministic decision module for prospect qualification.
 *
 * Given a ContactOpportunityPackV2 (or equivalent discovery data),
 * the engine evaluates the prospect deterministically against five
 * canonical criteria:
 *
 *   A. Business fit
 *   B. Meaningful digital/commercial pain
 *   C. Magic Script capability
 *   D. Decision authority
 *   E. Contactability
 *   F. Website quality gate (where applicable)
 *
 * Outcomes:
 *   ADMIT                  — may proceed toward V2 admission
 *   CAPABILITY_GATED       — improvement requires unproven capability
 *   QUALITY_GATED          — already-professional site while gate = CLOSED
 *   NEEDS_CONTACT_DISCOVERY— valid target but no qualifying EMAIL/MOBILE
 *   REJECT                 — outside ICP / no meaningful improvement / no authority
 *
 * This module is SINGLE-THREADED, DETERMINISTIC and contains NO LLM calls,
 * NO database queries, and NO side effects.
 */

import {
  type ContactOpportunityPackV2,
  type NormalizedContactOpportunityPack,
  normalizePack,
  qualifyPackContact,
} from '../admission/contact-opportunity-pack';
import { matchSupportedLocalServiceText, SUPPORTED_LOCAL_SERVICE_ARCHETYPES } from './local-service-archetypes';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export const ICP_DECISION_VERSION = 'AGENT1_V2_ICP_V1' as const;

/**
 * Five canonical ICP decision outcomes.
 *
 * Order of precedence (highest-first) when a prospect matches multiple:
 *   REJECT → CAPABILITY_GATED → QUALITY_GATED → NEEDS_CONTACT_DISCOVERY → ADMIT
 */
export type IcpDecisionClass =
  | 'ADMIT'
  | 'CAPABILITY_GATED'
  | 'QUALITY_GATED'
  | 'NEEDS_CONTACT_DISCOVERY'
  | 'REJECT';

/**
 * Stable machine-readable reason codes for every outcome.
 */
export type IcpReasonCode =
  | 'SUPPORTED_EASY_WIN'
  | 'NO_QUALIFYING_CONTACT'
  | 'LANDLINE_SOCIAL_ONLY'
  | 'UNPROVEN_REQUIRED_CAPABILITY'
  | 'WEBSITE_QUALITY_GATE_CLOSED'
  | 'NO_LOCAL_DECISION_AUTHORITY'
  | 'NO_CLEAR_DIGITAL_PAIN'
  | 'OUTSIDE_COMMERCIAL_ICP'
  | 'UNPROVEN_VERTICAL'
  | 'PLANITY_NO_ADDITIONAL_VALUE'
  | 'NO_WEBSITE_GAP'
  | 'CORPORATE_PHOTOGRAPHER_NO_GAP'
  | 'LOCAL_RETAIL_FAIL_CLOSED';

export const ICP_REASON_CODES: readonly IcpReasonCode[] = [
  'SUPPORTED_EASY_WIN',
  'NO_QUALIFYING_CONTACT',
  'LANDLINE_SOCIAL_ONLY',
  'UNPROVEN_REQUIRED_CAPABILITY',
  'WEBSITE_QUALITY_GATE_CLOSED',
  'NO_LOCAL_DECISION_AUTHORITY',
  'NO_CLEAR_DIGITAL_PAIN',
  'OUTSIDE_COMMERCIAL_ICP',
  'UNPROVEN_VERTICAL',
  'PLANITY_NO_ADDITIONAL_VALUE',
  'NO_WEBSITE_GAP',
  'CORPORATE_PHOTOGRAPHER_NO_GAP',
  'LOCAL_RETAIL_FAIL_CLOSED',
];

/**
 * Result of a single ICP decision.
 */
export interface IcpDecision {
  outcome: IcpDecisionClass;
  reasonCode: IcpReasonCode;
  version: typeof ICP_DECISION_VERSION;
}

// ─────────────────────────────────────────────────────────────────────────────
// Commercial families (frozen spec)
// ─────────────────────────────────────────────────────────────────────────────

export type CommercialFamily =
  | 'RESTAURANTS_BARS_CAFES'
  | 'BEAUTY_HAIR_BARBER'
  | 'LOCAL_RETAIL'
  | 'LOCAL_SERVICES';

/**
 * Resolve the LOCAL_RETAIL family only from producer-backed NAF/APE evidence.
 * NAF division 47 is the complete authority for this slice; all other input,
 * including free text and malformed codes, fails closed.
 */
export function resolveCommercialFamilyFromNaf(nafCode: string | undefined): CommercialFamily | undefined {
  if (typeof nafCode !== 'string') return undefined;
  const normalized = nafCode.trim().toUpperCase().replace(/\s+/g, '');
  const match = /^(\d{2})(?:\.?([0-9]{2}[A-Z]?))?$/.exec(normalized);
  if (!match) return undefined;
  return match[1] === '47' ? 'LOCAL_RETAIL' : undefined;
}

const beautyOperatorTypes = new Set(['BeautySalon', 'HairSalon']);
const foodOperatorTypes = new Set(['Restaurant', 'CafeOrCoffeeShop', 'BarOrPub', 'FastFoodRestaurant']);

export function isCommercialFamilyOperatorType(value: string): boolean {
  return beautyOperatorTypes.has(value) || foodOperatorTypes.has(value);
}

/** Only operator-bound, accepted owned-page schema types establish these families. */
export function resolveCommercialFamilyFromOperatingFacts(
  facts: readonly { kind: string; value: string; evidenceType: string; sourceUrl: string; operatorUrl?: string }[],
): CommercialFamily | undefined {
  const schemaFacts = facts.filter((fact) => fact.kind === 'SCHEMA_ORG_TYPE' && fact.evidenceType === 'JSON_LD');
  const familyFacts = schemaFacts.filter((fact) => isCommercialFamilyOperatorType(fact.value));
  if (!familyFacts.length || familyFacts.some((fact) => fact.operatorUrl !== fact.sourceUrl)) return undefined;
  const family = beautyOperatorTypes.has(familyFacts[0].value) ? 'BEAUTY_HAIR_BARBER' : 'RESTAURANTS_BARS_CAFES';
  const compatibleTypes = family === 'BEAUTY_HAIR_BARBER'
    ? new Set([...beautyOperatorTypes, 'HealthAndBeautyBusiness'])
    : new Set([...foodOperatorTypes, 'FoodEstablishment']);
  if (schemaFacts.some((fact) => !compatibleTypes.has(fact.value))) return undefined;
  if (facts.some((fact) => fact.kind === 'SERVICE_TYPE' &&
    (SUPPORTED_LOCAL_SERVICE_ARCHETYPES.some((archetype) => archetype === fact.value) ||
      Boolean(matchSupportedLocalServiceText(fact.value))))) return undefined;
  return family;
}

/** R51 compatibility for callers that ask specifically for Beauty authority. */
export function resolveBeautyFamilyFromOperatingFacts(
  facts: readonly { kind: string; value: string; evidenceType: string; sourceUrl: string; operatorUrl?: string }[],
): CommercialFamily | undefined {
  const family = resolveCommercialFamilyFromOperatingFacts(facts);
  return family === 'BEAUTY_HAIR_BARBER' ? family : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Website quality gate authority
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Website Quality Gate state.
 *
 * CLOSED: prospects with already-professional sites cannot enter active
 * production until Magic Script V2 proves repeatable professional-quality
 * output through all five benchmark archetypes.
 */
export type WebsiteQualityGateState = 'CLOSED' | 'OPEN';

/**
 * Canonical runtime authority for the Website Quality Gate.
 *
 * The gate is FROZEN CLOSED. No runtime mechanism opens it — only explicit
 * spec change after all five benchmarks pass Visual QA.
 */
export const WEBSITE_QUALITY_GATE: WebsiteQualityGateState = 'CLOSED';

// ─────────────────────────────────────────────────────────────────────────────
// Website quality evidence (typed input to the decision engine)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Typed evidence about a prospect's current website quality.
 *
 * Agent 1 must supply this explicitly when it has observable evidence.
 * The engine NEVER infers quality from company size or name.
 */
export interface WebsiteQualityEvidence {
  /**
   * The website is already professionally designed, agency-grade,
   * or shows sophisticated modern execution.
   */
  isProfessional: boolean;

  /**
   * Specific observations supporting the assessment (optional).
   */
  observations?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision authority evidence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evidence about local decision-making authority.
 */
export interface DecisionAuthorityEvidence {
  /** True when the local location has independent website/marketing purchasing authority. */
  hasLocalAuthority: boolean;
  /** True when the business is part of a centrally managed network/chain. */
  isCentrallyManaged: boolean;
  /** Optional supporting observations. */
  observations?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical ICP decision engine input
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All evidence the ICP engine needs to make a deterministic decision.
 *
 * The engine NEVER infers evidence that Agent 1 has not supplied.
 * Missing evidence = fail safe (REJECT or more conservative outcome).
 */
export interface IcpDecisionInput {
  /** Unique pack identifier (for tracing). */
  packId?: string;

  /** Business name. */
  businessName: string;

  /** Website URL, if known. */
  websiteUrl?: string;

  /** Whether a useful website exists at all. */
  hasWebsite: boolean;

  /** Whether the normalized pack contains a qualifying EMAIL or MOBILE. */
  hasQualifyingContact?: boolean;

  /** Categorised commercial family, if determinable. */
  commercialFamily?: CommercialFamily;

  /**
   * Official NAF/APE activity code (e.g. "47.78C") produced deterministically
   * by upstream INSEE / Recherche Entreprises discovery. This is the producer-backed
   * authority that the canonical LOCAL_RETAIL family resolver requires.
   * Free-text or LLM-inferred values never substitute for this field.
   */
  nafCode?: string;

  /**
   * Website quality evidence.
   * Agent 1 must supply this when it observes professional quality;
   * absent → quality gate not triggered (allows EASY-WIN through).
   */
  websiteQuality?: WebsiteQualityEvidence;

  /**
   * Decision authority evidence.
   * Must be supplied for known-brand/network/chaint businesses.
   */
  decisionAuthority?: DecisionAuthorityEvidence;

  /**
   * Observed digital pain / friction signals.
   * These are the EASY-WIN signals from the frozen ICP spec.
   */
  digitalPainSignals?: readonly string[];

  /**
   * Whether the primary path to meaningful improvement requires
   * currently unproven complex capability (e-commerce, cart,
   * checkout, payment, live inventory, booking inventory, etc.).
   */
  requiresUnprovenCapability: boolean;

  /**
   * Whether the business is a restaurant/beauty using a booking platform
   * (TheFork, Planity) where no additional website value is evident.
   */
  bookingPlatformWithNoAdditionalValue?: boolean;

  /**
   * Whether the business is a corporate photographer with a modern site.
   */
  isCorporatePhotographerWithModernSite?: boolean;

  /**
   * Whether the business falls outside canonical commercial families
   * in a way that clearly indicates no commercial ICP fit.
   */
  outsideCommercialIcp?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic rule-based decision function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate one prospect candidate against the canonical ICP rules.
 *
 * This is the SINGLE canonical decision authority. Every caller — API,
 * route, test, store — must use this function and nowhere else.
 *
 * Decision precedence (first match wins):
 *
 * 1. COMMERCIAL / SECTOR REJECTIONS
 *    - Outside commercial ICP → REJECT
 *    - Planity-served beauty with no additional value → REJECT
 *    - Corporate photographer with modern site → REJECT
 *
 * 2. CAPABILITY GATE
 *    - Requires unproven e-commerce/inventory/booking → CAPABILITY_GATED
 *
 * 3. WEBSITE QUALITY GATE
 *    - Professional site + gate CLOSED → QUALITY_GATED
 *
 * 4. DECISION AUTHORITY
 *    - Centrally managed + no local authority → REJECT
 *
 * 5. DIGITAL PAIN / EASY-WIN CHECK
 *    - No clear digital pain / no website gap → REJECT
 *
 * 6. LOCAL_RETAIL AUTHORITY
 *    - LOCAL_RETAIL + no proven authority → REJECT (fail-closed)
 *
 * 7. CONTACTABILITY
 *    - No qualifying EMAIL or MOBILE → NEEDS_CONTACT_DISCOVERY
 *
 * 8. ADMIT
 *    - All checks pass + qualifying contact exists → ADMIT
 */
export function decideIcp(input: IcpDecisionInput): IcpDecision {
  // ── 1. Commercial / sector rejections ──────────────────────────────────

  if (input.outsideCommercialIcp === true) {
    return {
      outcome: 'REJECT',
      reasonCode: 'OUTSIDE_COMMERCIAL_ICP',
      version: ICP_DECISION_VERSION,
    };
  }

  if (input.bookingPlatformWithNoAdditionalValue === true) {
    return {
      outcome: 'REJECT',
      reasonCode: 'PLANITY_NO_ADDITIONAL_VALUE',
      version: ICP_DECISION_VERSION,
    };
  }

  if (input.isCorporatePhotographerWithModernSite === true) {
    return {
      outcome: 'REJECT',
      reasonCode: 'CORPORATE_PHOTOGRAPHER_NO_GAP',
      version: ICP_DECISION_VERSION,
    };
  }

  // ── 2. Decision authority ─────────────────────────────────────────────

  if (
    input.decisionAuthority?.isCentrallyManaged === true &&
    input.decisionAuthority?.hasLocalAuthority !== true
  ) {
    return {
      outcome: 'REJECT',
      reasonCode: 'NO_LOCAL_DECISION_AUTHORITY',
      version: ICP_DECISION_VERSION,
    };
  }

  // ── 3. Digital pain / easy-win check ──────────────────────────────────

  if (!input.requiresUnprovenCapability && !input.hasWebsite && !input.digitalPainSignals?.length) {
    return { outcome: 'REJECT', reasonCode: 'NO_CLEAR_DIGITAL_PAIN', version: ICP_DECISION_VERSION };
  }
  if (!input.requiresUnprovenCapability && input.hasWebsite && input.websiteQuality?.isProfessional !== true && !input.digitalPainSignals?.length) {
    return { outcome: 'REJECT', reasonCode: 'NO_CLEAR_DIGITAL_PAIN', version: ICP_DECISION_VERSION };
  }

  // ── 4. Capability gate ────────────────────────────────────────────────

  if (input.requiresUnprovenCapability) {
    return { outcome: 'CAPABILITY_GATED', reasonCode: 'UNPROVEN_REQUIRED_CAPABILITY', version: ICP_DECISION_VERSION };
  }

  // ── 5. Website quality gate ───────────────────────────────────────────

  if (WEBSITE_QUALITY_GATE === 'CLOSED' && input.websiteQuality?.isProfessional === true) {
    return { outcome: 'QUALITY_GATED', reasonCode: 'WEBSITE_QUALITY_GATE_CLOSED', version: ICP_DECISION_VERSION };
  }

  // ── 6. LOCAL_RETAIL fail-closed ───────────────────────────────────────

  if (input.commercialFamily === 'LOCAL_RETAIL') {
    // The family is valid only when resolved from official division-47 evidence.
    // A caller-supplied family without that authority fails closed.
    if (resolveCommercialFamilyFromNaf(input.nafCode) !== 'LOCAL_RETAIL') {
      return { outcome: 'REJECT', reasonCode: 'LOCAL_RETAIL_FAIL_CLOSED', version: ICP_DECISION_VERSION };
    }
  }

  // ── 7. Contactability check ─────────────────────────────────────────────
  if (input.hasQualifyingContact === false) {
    return { outcome: 'NEEDS_CONTACT_DISCOVERY', reasonCode: 'NO_QUALIFYING_CONTACT', version: ICP_DECISION_VERSION };
  }

  // ── 8. All checks passed → ADMIT ──────────────────────────────────────

  return {
    outcome: 'ADMIT',
    reasonCode: 'SUPPORTED_EASY_WIN',
    version: ICP_DECISION_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Qualifying contact check (re-exports from admission module)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluate ICP for a ContactOpportunityPackV2 using Agent 1's typed opportunity
 * evidence. Missing ICP evidence fails safe (no automatic ADMIT from absence).
 */
export function decidePackIcp(input: ContactOpportunityPackV2): IcpDecision {
  const icp = input.opportunity?.icp;
  return decideIcp({
    packId: input.packId,
    businessName: input.identity.businessName,
    websiteUrl: input.identity.websiteUrl,
    hasWebsite: Boolean(input.identity.websiteUrl?.trim()),
    hasQualifyingContact: hasQualifyingContact(normalizePack(input)),
    commercialFamily: icp?.commercialFamily ?? resolveCommercialFamilyFromNaf(icp?.nafCode),
    nafCode: icp?.nafCode,
    websiteQuality: icp?.websiteQuality,
    decisionAuthority: icp?.decisionAuthority,
    digitalPainSignals: icp?.digitalPainSignals,
    requiresUnprovenCapability: icp?.requiresUnprovenCapability === true,
    bookingPlatformWithNoAdditionalValue: icp?.bookingPlatformWithNoAdditionalValue ?? undefined,
    isCorporatePhotographerWithModernSite: icp?.isCorporatePhotographerWithModernSite ?? undefined,
    outsideCommercialIcp: icp?.outsideCommercialIcp ?? undefined,
  });
}

/**
 * Determine whether a pack has a qualifying contact for admission.
 *
 * A qualifying contact is:
 * - valid EMAIL (trustStatus === 'DERIVED_VALID'), OR
 * - valid MOBILE deterministically classified as MOBILE type.
 *
 * Landline, Instagram, Facebook and contact-form alone are NOT sufficient.
 *
 * This function re-exports the authority from the canonical admission module.
 */
export function hasQualifyingContact(pack: NormalizedContactOpportunityPack): boolean {
  return pack.contacts.some(qualifyPackContact);
}

/**
 * Check if the only available contacts are landline/social (no qualifying contact).
 */
export function hasOnlyNonQualifyingContacts(
  pack: NormalizedContactOpportunityPack,
): boolean {
  const valid = pack.contacts.filter((c) => c.trustStatus === 'DERIVED_VALID');
  const qualifying = valid.filter(qualifyPackContact);
  if (qualifying.length > 0) return false;
  if (valid.length === 0) return true;
  const nonQualifyingChannels = new Set(['LANDLINE', 'INSTAGRAM', 'FACEBOOK', 'CONTACT_FORM']);
  return valid.every((c) => nonQualifyingChannels.has(c.channel));
}
