import {
  partitionProspectsByCommercialView,
  SWARM_HUBS,
  type ProspectCommercialView,
} from '@magicscript/core';
import { projectProspectBuSummaries } from './bu-summary';

export interface ApiHealth {
  ok: boolean;
  service: string;
  databaseConfigured: boolean;
  autopilotEnabled: boolean;
  sendingEnabled: boolean;
  emailProvider: string;
  testEmailMode: boolean;
  testRecipientConfigured: boolean;
  prototypeDeployEnabled: boolean;
}

export interface Escalation {
  id: string;
  prospect_id: string;
  category: string;
  summary: string;
  status: string;
  created_at: string;
  priority?: 'URGENT' | 'HIGH' | 'NORMAL';
}

export interface SyntheticCreativeTrace {
  kind: 'CREATIVE_WEB_DESIGN_SYNTHETIC';
  synthetic: true;
  fixtureId: string;
  technicalJobStatus: string;
  creativeVerdict: string;
  iterationCount: number;
  maxIterations: number;
  qaPreflight: { passed: boolean; blockers: string[] };
  qaFinal: { passed: boolean; blockers: string[] };
  filesChanged: string[];
  rebuildStatuses: string[];
  renderEvidence: { desktop: boolean; mobile: boolean; method: string } | null;
  blockers: string[];
  artifactPath?: string | null;
  artifactEntryPath?: string | null;
  externalActions: [];
}

export interface SyntheticPrototypeQaTrace {
  kind: 'RUN_SYNTHETIC_PROTOTYPE_QA';
  synthetic: boolean;
  safeForOutreach: boolean;
  artifactRoot: string;
  artifactEntry: string;
  qaStatus: 'PASS' | 'FAIL' | 'UNKNOWN' | string;
  checks: string[];
  findings: string[];
  blockingIssues: string[];
  warnings: string[];
  technicalBuildPassed: boolean | null;
  staticOutputReady: boolean | null;
  webDesignReviewStatus: string;
  generatedAt: string;
  resultPath: string;
  evidence?: unknown;
}

export interface Job {
  id: string;
  kind: string;
  prospectId?: string;
  status: string;
  attempts: number;
  runAfter: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string | null;
  result?: unknown;
  syntheticCreativeTrace?: SyntheticCreativeTrace;
  syntheticPrototypeQaTrace?: SyntheticPrototypeQaTrace;
}

export interface Runner {
  runner_id: string;
  hostname?: string;
  status: string;
  version?: string;
  current_job_id?: string | null;
  started_at: string;
  last_seen_at: string;
}

export interface ProviderUsage {
  period: string;
  rechercheEntreprises: {
    configured: boolean;
    authRequired: boolean;
    monetaryCost: number;
    documentedRateLimitPerSecond: number;
    purpose: string;
  };
  sirene: {
    configured: boolean;
    cost: string;
    purpose: string;
  };
  hunter: {
    configured: boolean;
    used: number;
    budget: number;
    remainingInternalBudget: number;
    purpose?: string;
  };
}

export interface OutreachStatus {
  sendingEnabled: boolean;
  provider: string;
  daily: {
    limit: number;
    sent: number;
    inFlight: number;
    available: number;
  };
  maxFollowups: number;
  followup1Days: number;
  followup2Days: number;
  waitingReply: number;
  followupDue: number;
}

export interface PrototypeSummary {
  id: string;
  prospect_id: string;
  company_name: string;
  status: string;
  qa_status?: string | null;
  web_design_status?: string | null;
  web_design_ready?: boolean;
  deployment_url?: string | null;
  prototype_url?: string | null;
  personalized_url?: string | null;
  prototype_entry_url?: string | null;
  sales_room_url?: string | null;
  sales_room_slug?: string | null;
  sales_room_status?: 'ACTIVE' | 'DISABLED';
  sales_room_review_due?: boolean;
  sales_room_review_due_at?: string | null;
  sales_room_last_activity_at?: string | null;
  sales_room_share_clicks?: number;
  personalized_entry_enabled?: boolean;
  runner_id?: string | null;
  updated_at: string;
}

export interface SalesRoomSummary {
  prospectId: string;
  companyName: string;
  slug: string;
  status: 'ACTIVE' | 'DISABLED';
  prototypeUrl: string | null;
  prototypeEntryPath: string;
  salesRoomPath: string;
  salesRoomUrl: string | null;
  ctaTarget: 'SALES_ROOM';
  createdAt: string;
  lastActivityAt: string;
  reviewDueAt: string | null;
  reviewDue: boolean;
  shareClicks: number;
  lastResolutionError: string | null;
}

export interface LiveEvent {
  id: string;
  prospectId?: string;
  actor: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ProspectEngagement {
  score_total: number;
  activity_score: number;
  intent_score: number;
  trend: 'RISING' | 'STABLE' | 'COOLING';
  top_contributors: Array<{
    signal: string;
    contribution: number;
    baseWeight: number;
    decay: number;
    occurredAt: string;
    sourceType?: string;
    sourceId?: string;
    reason: string;
  }>;
  last_meaningful_event: string | null;
  computed_at: string;
}

interface ContactabilityChannelBase {
  contactId: string;
  prospectId: string;
  siren?: string;
  siret?: string;
  value: string;
  sourceUrl?: string;
  sourceType?: 'official_site' | 'directory' | 'social' | 'other_public_source';
  observedAt: string;
  evidenceEventId?: string;
  confidence?: number;
  status: 'PUBLISHED_VERIFIED' | 'UNVERIFIED' | 'OPPOSED';
  usableForFirstOutreach: boolean;
}

export interface EmailContactabilityChannel extends ContactabilityChannelBase {
  type: 'EMAIL';
  sourceUrl?: string;
  sourceType?: 'official_site' | 'directory' | 'social' | 'other_public_source';
  confidence?: number;
}

export interface PhoneContactabilityChannel extends ContactabilityChannelBase {
  type: 'PHONE';
  sourceUrl: string;
  evidenceEventId: string;
  status: 'PUBLISHED_VERIFIED' | 'OPPOSED';
}

export type ContactabilityChannel =
  | EmailContactabilityChannel
  | PhoneContactabilityChannel;

export interface PreparedContactDraft {
  kind: 'EMAIL_DRAFT';
  contactId: string;
  recipient: string;
  subject: string;
  body: string;
  mailtoHref: string;
  requiresHumanSend: true;
  sendsAutomatically: false;
}

export interface PreparedPhoneCall {
  kind: 'PHONE_CALL_PREPARATION';
  contactId: string;
  evidenceEventId: string;
  phone: string;
  sourceUrl: string;
  requiresHumanDial: true;
  dialsAutomatically: false;
}

export type ContactPreparation = PreparedContactDraft | PreparedPhoneCall;

export interface ProspectContactability {
  identity: {
    prospectId: string;
    siren?: string;
    siret?: string;
  };
  status: 'PUBLISHED_VERIFIED' | 'UNVERIFIED' | 'OPPOSED' | 'MISSING';
  channels: ContactabilityChannel[];
  preparation: ContactPreparation | null;
}

export interface PrototypeCostGateSummary {
  id: string;
  prospectId: string;
  decision: 'GO' | 'LIGHT' | 'NO-GO';
  authorization: 'FULL' | 'LIGHT' | 'NONE';
  policyScore: number;
  computeClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  estimatedExternalCost:
    | {
        kind: 'KNOWN';
        amountEur: number | null;
        source: string | null;
      }
    | {
        kind: 'UNKNOWN';
        reason: string | null;
      };
  reasonCodes: string[];
  evaluatedAt: string;
  reevaluateAt: string | null;
}
export interface ContactPresenceField {
  status: 'UNKNOWN' | 'VERIFIED' | 'N/A' | 'REJECTED';
  values: string[];
  evidence: Array<{ value: string; sourceUrl: string; kind: string; evidenceType: string }>;
}

export interface ContactPresenceProjection {
  status: 'UNKNOWN' | 'VERIFIED' | 'N/A' | 'REJECTED';
  identity: { status: string; matched: boolean; reason: string };
  phone: ContactPresenceField;
  email: ContactPresenceField;
  website: ContactPresenceField;
  instagram: ContactPresenceField;
  facebook: ContactPresenceField;
  tiktok: ContactPresenceField;
  whatsapp: ContactPresenceField;
  contactForm: ContactPresenceField;
  sourcesChecked: string[];
  reasons: string[];
  enrichedAt: string;
}

export interface ProspectSummary {
  id: string;
  companyName: string;
  /** Read-only routing metadata; absent means the BU is UNKNOWN, never inferred in the cockpit. */
  hubId?: string;
  businessUnit?: string;
  masterOfWork?: string;
  siren?: string;
  siret?: string;
  sourceUrl?: string;
  state: string;
  score?: number;
  scoreType?: 'CALIBRATED_RESEARCH' | 'INTAKE_COMMERCIAL_ELIGIBILITY' | 'LEGACY_SCALAR' | 'UNKNOWN';
  scoreSource?: string;
  scoreUpdatedAt?: string;
  activity?: string;
  location?: string;
  websiteUrl?: string;
  phone?: string;
  commercialEligibility?:
    | 'HIGH_PRIORITY'
    | 'RESEARCH'
    | 'LOW_PRIORITY'
    | 'REJECT';
  commercialView: ProspectCommercialView;
  contactability?: ProspectContactability;
  contactPresence?: ContactPresenceProjection | null;
  createdAt?: string;
  updatedAt: string;
  engagement?: ProspectEngagement;
  prototypeCostGate?: PrototypeCostGateSummary | null;
}

export interface MeetingSummary {
  meetingId: string;
  prospectId: string;
  companyName: string | null;
  salesRoomSlug: string;
  communicationMode: 'email' | 'phone';
  startAtUtc: string;
  endAtUtc: string;
  prospectTimezone: string;
  prospectTime: string;
  parisTime: string;
  phone: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED';
  confirmedAt: string;
  cancelledAt: string | null;
  rescheduledFromId: string | null;
  createdAt: string;
  updatedAt: string;
  briefingAvailable?: boolean;
}

export interface Readiness {
  dryRunReady: boolean;
  checks: {
    database: boolean;
    autopilot: boolean;
    runnerOnline: boolean;
    safeTransport: boolean;
    publicDiscovery: boolean;
    noDeadLetters: boolean;
  };
  runner: {
    runner_id: string;
    status: string;
    last_seen_at: string;
  } | null;
  prospects: number;
  timestamp: string;
}

export interface ControlCenterData {
  connected: boolean;
  health: ApiHealth | null;
  escalations: Escalation[];
  runningJobs: Job[];
  prototypeJobs: Job[];
  runners: Runner[];
  providerUsage: ProviderUsage | null;
  outreachStatus: OutreachStatus | null;
  prototypes: PrototypeSummary[];
  salesRooms: SalesRoomSummary[];
  recentEvents: LiveEvent[];
  prospects: ProspectSummary[];
  meetings: MeetingSummary[];
  commercial: ActiveCommercialDeck;
  operatorQueue: OperatorProspectQueue;
  readiness: Readiness | null;
  buSummaries?: ProspectBuSummary[];
  error?: string;
}

export type BuTerritory = 'AGENT_1' | 'RESEARCH' | 'ORCHESTRATOR' | 'AGENT_2' | 'WEB_DESIGN' | 'QA' | 'COMMERCIAL';
export interface BuSummaryItem { territory: BuTerritory; status: string; decision: string; provenance: string; timestamp: string | null; summary: string; blockers: string[]; identifiers: string[]; }
export interface ProspectBuSummary { prospectId: string; companyName: string; items: BuSummaryItem[]; }

export interface ActiveCommercialDeck {
  prospects: ProspectSummary[];
  qualifiedProspects: ProspectSummary[];
  waitingReplyProspects: ProspectSummary[];
  followupDueProspects: ProspectSummary[];
  prototypes: PrototypeSummary[];
  salesRooms: SalesRoomSummary[];
  escalations: Escalation[];
  meetings: MeetingSummary[];
  prospectEvents: LiveEvent[];
  operationalEvents: LiveEvent[];
  operationalJobs: Job[];
  /** Prototype lifecycle jobs scoped to CURRENT prospects. */
  prototypeJobs: Job[];
  /** Most recently updated prototype job for each CURRENT prospect. */
  latestPrototypeJobs: Job[];
  /** Latest strategy-job status keyed by CURRENT prospect id. */
  prototypeStrategyStatus: Record<string, string>;
  stateCounts: Record<string, number>;
}

export type OperatorNextAction =
  | 'À QUALIFIER'
  | 'À ENRICHIR'
  | 'À VÉRIFIER'
  | 'À VALIDER'
  | 'PRÊT À CONTACTER'
  | 'PRÉPARER L’EMAIL'
  | 'EN ATTENTE'
  | 'RELANCER';

export interface OperatorProspectQueueEntry {
  prospect: ProspectSummary;
  nextAction: OperatorNextAction;
  reason: string;
  priority: number;
}

export interface OperatorProspectQueue {
  entries: OperatorProspectQueueEntry[];
  currentCount: number;
  preCurrentCount: number;
}

export interface BusinessUnitVisibilityRow {
  key: string;
  label: string;
  businessUnit: string;
  masterOfWork: string;
  prospectCount: number;
  activeJobCount: number;
  known: boolean;
}

export interface BusinessUnitVisibility {
  rows: BusinessUnitVisibilityRow[];
  unknown: BusinessUnitVisibilityRow;
}

/**
 * Compact, read-only BU projection for the cockpit. Missing or untrusted
 * routing metadata is intentionally grouped as UNKNOWN rather than inferred.
 */
export function projectBusinessUnitVisibility(
  prospects: ProspectSummary[],
  runningJobs: Job[],
): BusinessUnitVisibility {
  const rows = SWARM_HUBS.map((hub) => {
    const members = prospects.filter(
      (prospect) =>
        prospect.hubId === hub.id || prospect.businessUnit === hub.businessUnit,
    );
    const memberIds = new Set(members.map((prospect) => prospect.id));
    return {
      key: hub.id,
      label: hub.label,
      businessUnit: hub.businessUnit,
      masterOfWork: hub.masterOfWork,
      prospectCount: members.length,
      activeJobCount: runningJobs.filter(
        (job) => Boolean(job.prospectId && memberIds.has(job.prospectId)),
      ).length,
      known: true,
    };
  });

  const knownIds = new Set(
    rows.flatMap((row) =>
      prospects
        .filter(
          (prospect) =>
            prospect.hubId === row.key || prospect.businessUnit === row.businessUnit,
        )
        .map((prospect) => prospect.id),
    ),
  );
  const unknownProspects = prospects.filter((prospect) => !knownIds.has(prospect.id));
  const unknownIds = new Set(unknownProspects.map((prospect) => prospect.id));
  return {
    rows,
    unknown: {
      key: 'UNKNOWN',
      label: 'Routage non confirmé',
      businessUnit: 'UNKNOWN',
      masterOfWork: 'UNKNOWN',
      prospectCount: unknownProspects.length,
      activeJobCount: runningJobs.filter(
        (job) => Boolean(job.prospectId && unknownIds.has(job.prospectId)),
      ).length,
      known: false,
    },
  };
}

const LEGACY_PRE_COMMERCIAL_STATES = new Set([
  'DISCOVERED',
  'RESEARCHING',
  'RESEARCH_COMPLETE',
  'QUALIFIED',
  'CONTACT_DISCOVERY',
  'CONTACT_FOUND',
  'CONTACT_INVALID',
]);

const NON_ACTIONABLE_STATES = new Set([
  'SAS_PENDING',
  'DISQUALIFIED',
  'NEGATIVE_REPLY',
  'DO_NOT_CONTACT',
  'WON',
  'CLOSED_WON',
  'CLOSED_LOST',
  'DORMANT',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }

export function projectSyntheticPrototypeQaTrace(job: Job): SyntheticPrototypeQaTrace | undefined {
  if (job.kind !== 'RUN_SYNTHETIC_PROTOTYPE_QA' || !isRecord(job.result) || job.result.kind !== job.kind) return undefined;
  const result = job.result;
  const review = isRecord(result.webDesignReview) ? result.webDesignReview : null;
  const blockingFindings = stringArray(result.blockingFindings);
  const warnings = stringArray(result.warnings);
  const technicalBuildPassed = typeof result.technicalBuildPassed === 'boolean' ? result.technicalBuildPassed : null;
  const staticOutputReady = typeof result.staticOutputReady === 'boolean' ? result.staticOutputReady : null;
  return {
    kind: job.kind,
    synthetic: result.synthetic === true,
    safeForOutreach: result.safeForOutreach === true,
    artifactRoot: typeof result.artifactRoot === 'string' ? result.artifactRoot : '',
    artifactEntry: typeof result.artifactEntry === 'string' ? result.artifactEntry : '',
    qaStatus: result.pass === true ? 'PASS' : result.pass === false ? 'FAIL' : 'UNKNOWN',
    checks: stringArray(review?.checks),
    findings: blockingFindings,
    blockingIssues: blockingFindings,
    warnings,
    technicalBuildPassed,
    staticOutputReady,
    webDesignReviewStatus: typeof review?.status === 'string' ? review.status : 'UNKNOWN',
    generatedAt: typeof review?.checkedAt === 'string' ? review.checkedAt : job.updatedAt,
    resultPath: typeof result.resultPath === 'string' ? result.resultPath : '',
    evidence: result.evidence,
  };
}

export function projectSyntheticCreativeTrace(job: Job): SyntheticCreativeTrace | undefined {
  if (job.kind !== 'CREATIVE_WEB_DESIGN_SYNTHETIC' || !isRecord(job.result) || job.result.synthetic !== true || job.result.kind !== job.kind || typeof job.result.fixtureId !== 'string') return undefined;
  const result = job.result; const fixtureId = result.fixtureId as string; const iterations = Array.isArray(result.iterations) ? result.iterations : [];
  const qa = (value: unknown): { passed: boolean; blockers: string[] } => isRecord(value) ? { passed: value.passed === true, blockers: stringArray(value.blockers) } : { passed: false, blockers: ['UNKNOWN'] };
  const filesChanged = iterations.flatMap((item) => isRecord(item) ? stringArray(item.filesChanged) : []).filter((value, index, all) => all.indexOf(value) === index);
  const rebuildStatuses = iterations.flatMap((item) => isRecord(item) && isRecord(item.buildResult) && typeof item.buildResult.status === 'string' ? [item.buildResult.status] : []);
  const evidence = isRecord(result.after) && isRecord(result.after.renderEvidence) ? result.after.renderEvidence : null;
  return { kind: job.kind, synthetic: true, fixtureId, technicalJobStatus: typeof result.technicalJobStatus === 'string' ? result.technicalJobStatus : 'UNKNOWN', creativeVerdict: typeof result.creativeVerdict === 'string' ? result.creativeVerdict : 'UNKNOWN', iterationCount: iterations.length, maxIterations: 3, qaPreflight: qa(result.qaPreflight), qaFinal: qa(result.qaFinal), filesChanged, rebuildStatuses, renderEvidence: evidence ? { desktop: isRecord(evidence.desktop) && evidence.desktop.checked === true, mobile: isRecord(evidence.mobile) && evidence.mobile.checked === true, method: typeof evidence.method === 'string' ? evidence.method : 'UNKNOWN' } : null, blockers: stringArray(result.blockers), externalActions: Array.isArray(result.externalActions) && result.externalActions.length === 0 ? [] : [], artifactPath: typeof result.artifactPath === 'string' ? result.artifactPath : null, artifactEntryPath: typeof result.artifactEntryPath === 'string' ? result.artifactEntryPath : null };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPublicHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function matchesProspectIdentity(
  prospect: ProspectSummary,
  identity: unknown,
): boolean {
  if (!isRecord(identity) || identity.prospectId !== prospect.id) return false;

  return (['siren', 'siret'] as const).every((field) => {
    const identityValue = identity[field];
    return (
      identityValue === undefined ||
      (isNonEmptyString(identityValue) && identityValue === prospect[field])
    );
  });
}

function isMatchingVerifiedChannel(
  prospect: ProspectSummary,
  channel: unknown,
  expected: {
    contactId: string;
    type: 'EMAIL' | 'PHONE';
    value: string;
  },
): channel is ContactabilityChannel {
  if (!isRecord(channel)) return false;

  return (
    channel.contactId === expected.contactId &&
    channel.prospectId === prospect.id &&
    channel.type === expected.type &&
    channel.value === expected.value &&
    channel.status === 'PUBLISHED_VERIFIED' &&
    channel.usableForFirstOutreach === true &&
    (channel.siren === undefined || channel.siren === prospect.siren) &&
    (channel.siret === undefined || channel.siret === prospect.siret)
  );
}

function isMatchingMailto(mailtoHref: unknown, recipient: string): boolean {
  if (!isNonEmptyString(mailtoHref)) return false;

  try {
    const url = new URL(mailtoHref);
    return url.protocol === 'mailto:' && decodeURIComponent(url.pathname) === recipient;
  } catch {
    return false;
  }
}

export function getActionableContactPreparation(
  prospect: ProspectSummary,
): ContactPreparation | null {
  const contactability = prospect.contactability;
  if (
    prospect.state === 'DO_NOT_CONTACT' ||
    !contactability ||
    contactability.status !== 'PUBLISHED_VERIFIED' ||
    !matchesProspectIdentity(prospect, contactability.identity) ||
    !Array.isArray(contactability.channels)
  ) {
    return null;
  }

  const preparation: unknown = contactability.preparation;
  if (!isRecord(preparation) || !isNonEmptyString(preparation.contactId)) {
    return null;
  }

  if (preparation.kind === 'EMAIL_DRAFT') {
    if (
      !isNonEmptyString(preparation.recipient) ||
      !isNonEmptyString(preparation.subject) ||
      !isNonEmptyString(preparation.body) ||
      !isMatchingMailto(preparation.mailtoHref, preparation.recipient) ||
      preparation.requiresHumanSend !== true ||
      preparation.sendsAutomatically !== false
    ) {
      return null;
    }

    const contactId = preparation.contactId;
    const recipient = preparation.recipient;
    const channel = contactability.channels.find((candidate) =>
      isMatchingVerifiedChannel(prospect, candidate, {
        contactId,
        type: 'EMAIL',
        value: recipient,
      }),
    );

    return channel ? (preparation as unknown as PreparedContactDraft) : null;
  }

  if (preparation.kind === 'PHONE_CALL_PREPARATION') {
    if (
      !isNonEmptyString(preparation.evidenceEventId) ||
      !isNonEmptyString(preparation.phone) ||
      !isPublicHttpUrl(preparation.sourceUrl) ||
      preparation.requiresHumanDial !== true ||
      preparation.dialsAutomatically !== false
    ) {
      return null;
    }

    const contactId = preparation.contactId;
    const phone = preparation.phone;
    const evidenceEventId = preparation.evidenceEventId;
    const sourceUrl = preparation.sourceUrl;
    const channel = contactability.channels.find(
      (candidate) =>
        isMatchingVerifiedChannel(prospect, candidate, {
          contactId,
          type: 'PHONE',
          value: phone,
        }) &&
        candidate.evidenceEventId === evidenceEventId &&
        candidate.sourceUrl === sourceUrl &&
        isPublicHttpUrl(candidate.sourceUrl),
    );

    return channel ? (preparation as unknown as PreparedPhoneCall) : null;
  }

  return null;
}

function hasOperatorProvenance(prospect: ProspectSummary): boolean {
  const hasLegalIdentity =
    /^\d{9}$/.test(prospect.siren ?? '') &&
    /^\d{14}$/.test(prospect.siret ?? '');
  if (hasLegalIdentity) return true;

  const isPublicSource = (value: string | undefined): boolean => {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  };

  if (isPublicSource(prospect.sourceUrl)) return true;

  return Boolean(
    prospect.contactability?.channels.some(
      (channel) =>
        channel.status !== 'OPPOSED' &&
        [
          'official_site',
          'directory',
          'social',
          'other_public_source',
        ].includes(channel.sourceType ?? '') &&
        isPublicSource(channel.sourceUrl),
    ),
  );
}

function operatorNextAction(
  prospect: ProspectSummary,
): Omit<OperatorProspectQueueEntry, 'prospect'> | null {
  const contactability = prospect.contactability?.status ?? 'MISSING';
  const hasPreparedContact = Boolean(getActionableContactPreparation(prospect));

  if (
    prospect.commercialView.category === 'INTERNAL' ||
    prospect.commercialView.category === 'REJECTED' ||
    contactability === 'OPPOSED' ||
    NON_ACTIONABLE_STATES.has(prospect.state)
  ) {
    return null;
  }

  if (
    prospect.commercialView.category === 'LEGACY' &&
    (!LEGACY_PRE_COMMERCIAL_STATES.has(prospect.state) ||
      !hasOperatorProvenance(prospect))
  ) {
    return null;
  }

  const legacyReason =
    prospect.commercialView.reason === 'CURRENT_GATE_PRE_ACTIVE'
      ? ' Dossier V2.5.1 pré-actif : la prochaine étape opérateur est requise avant activation commerciale.'
      : prospect.commercialView.category === 'LEGACY'
        ? ' Commercial View LEGACY : la preuve du gate V2.5.1 doit être établie avant activation commerciale.'
        : '';

  switch (prospect.state) {
    case 'DISCOVERED':
      return {
        nextAction: 'À QUALIFIER',
        reason: `Fiche découverte : la recherche et la qualification ne sont pas achevées.${legacyReason}`,
        priority: 20,
      };
    case 'RESEARCHING':
      return {
        nextAction: 'À VÉRIFIER',
        reason: `Recherche en cours : les faits et l’identité restent à consolider.${legacyReason}`,
        priority: 20,
      };
    case 'RESEARCH_COMPLETE':
      return {
        nextAction: 'À QUALIFIER',
        reason: `Recherche terminée : l’éligibilité commerciale doit être évaluée.${legacyReason}`,
        priority: 20,
      };
    case 'QUALIFIED':
    case 'CONTACT_DISCOVERY':
      return contactability === 'MISSING'
        ? {
            nextAction: 'À ENRICHIR',
            reason: `Prospect qualifié sans canal public exploitable : rechercher et sourcer un contact.${legacyReason}`,
            priority: 20,
          }
        : contactability === 'UNVERIFIED'
          ? {
              nextAction: 'À VÉRIFIER',
              reason: `Un canal existe mais sa provenance ou sa validation ne permet pas encore de le préparer.${legacyReason}`,
              priority: 20,
            }
          : prospect.commercialView.category === 'LEGACY'
            ? {
                nextAction: 'À VALIDER',
                reason: `Le canal public est vérifié, mais l’éligibilité V2.5.1 doit l’être avant tout contact.${legacyReason}`,
                priority: 20,
              }
            : hasPreparedContact
              ? {
                  nextAction: 'PRÊT À CONTACTER',
                  reason: 'Le canal public est vérifié et une préparation manuelle cohérente est disponible.',
                  priority: 30,
                }
              : {
                  nextAction: 'À VÉRIFIER',
                  reason: 'Le canal est vérifié, mais aucune préparation manuelle cohérente ne lui correspond.',
                  priority: 20,
                };
    case 'CONTACT_INVALID':
    case 'BOUNCED':
      return {
        nextAction: 'À ENRICHIR',
        reason: `Le canal précédent est invalide : une nouvelle source de contact est requise.${legacyReason}`,
        priority: 20,
      };
    case 'CONTACT_FOUND':
      return hasPreparedContact
        ? prospect.commercialView.category === 'LEGACY'
          ? {
              nextAction: 'À VALIDER',
              reason: `Le contact est vérifié, mais l’éligibilité V2.5.1 doit l’être avant tout contact.${legacyReason}`,
              priority: 20,
            }
          : {
              nextAction: 'PRÊT À CONTACTER',
              reason: 'Le contact publié est vérifié ; toute prise de contact reste manuelle.',
              priority: 30,
            }
        : {
            nextAction: 'À VÉRIFIER',
            reason: `Un contact a été trouvé mais aucun canal n’est encore préparé.${legacyReason}`,
            priority: 20,
          };
    case 'OUTREACH_READY':
      return {
        nextAction: 'PRÉPARER L’EMAIL',
        reason: 'Le lifecycle autorise la préparation d’un brouillon ; aucun envoi automatique.',
        priority: 30,
      };
    case 'OUTREACH_DRAFTED':
    case 'DEMO_REPLY_READY':
    case 'INFORMATION_RESPONSE_DRAFTED':
      return {
        nextAction: 'À VÉRIFIER',
        reason: 'Un brouillon existe et doit être contrôlé avant toute action externe.',
        priority: 10,
      };
    case 'OUTREACH_VERIFIED':
    case 'INFORMATION_RESPONSE_VERIFIED':
      return hasPreparedContact
        ? {
            nextAction: 'PRÊT À CONTACTER',
            reason: 'Le contenu est vérifié ; toute prise de contact reste manuelle.',
            priority: 30,
          }
        : {
            nextAction: 'À VÉRIFIER',
            reason: 'Le contenu est vérifié, mais aucune préparation manuelle cohérente ne lui correspond.',
            priority: 20,
          };
    case 'EMAIL_SENT':
    case 'WAITING_REPLY':
    case 'FOLLOW_UP_SENT':
    case 'DEMO_REPLY_SENT':
      return {
        nextAction: 'EN ATTENTE',
        reason: 'Le lifecycle indique une attente de réponse ; ne pas relancer avant échéance.',
        priority: 40,
      };
    case 'FOLLOW_UP_DUE':
      return {
        nextAction: 'RELANCER',
        reason: 'Le lifecycle indique explicitement qu’une relance est arrivée à échéance.',
        priority: 10,
      };
    case 'REPLY_RECEIVED':
    case 'POSITIVE_REPLY':
    case 'HOT_LEAD':
    case 'INTERESTED':
    case 'MEETING_REQUESTED':
    case 'MEETING_BOOKED':
    case 'PRICING_REQUESTED':
    case 'CUSTOM_REQUEST':
    case 'HUMAN_ACTION_REQUIRED':
    case 'QUOTE_PENDING':
    case 'COMMITTED':
    case 'INFORMATION_REQUEST_RECEIVED':
      return {
        nextAction: 'À VALIDER',
        reason: 'Le lifecycle requiert une décision ou une validation humaine explicite.',
        priority: 0,
      };
    case 'PROTOTYPE_REQUIRED':
    case 'PROTOTYPE_STRATEGY_GENERATED':
    case 'PROTOTYPE_BUILDING':
    case 'PROTOTYPE_QA':
    case 'PROTOTYPE_READY':
    case 'PROTOTYPE_DEPLOYING':
    case 'PROTOTYPE_DEPLOYED':
      return {
        nextAction: 'À VALIDER',
        reason: 'Le lifecycle du prototype demande une revue avant la prochaine étape commerciale.',
        priority: 50,
      };
    default:
      return null;
  }
}

export function projectOperatorProspectQueue(
  prospects: ProspectSummary[],
): OperatorProspectQueue {
  const entries = prospects
    .flatMap((prospect) => {
      const action = operatorNextAction(prospect);
      return action ? [{ prospect, ...action }] : [];
    })
    .sort((left, right) => {
      const priorityDelta = left.priority - right.priority;
      if (priorityDelta !== 0) return priorityDelta;

      const leftUpdatedAt = new Date(left.prospect.updatedAt).getTime();
      const rightUpdatedAt = new Date(right.prospect.updatedAt).getTime();
      const updatedDelta =
        (Number.isFinite(rightUpdatedAt) ? rightUpdatedAt : 0) -
        (Number.isFinite(leftUpdatedAt) ? leftUpdatedAt : 0);
      if (updatedDelta !== 0) return updatedDelta;

      return left.prospect.id.localeCompare(right.prospect.id);
    });

  return {
    entries,
    currentCount: entries.filter(
      (entry) => entry.prospect.commercialView.category === 'CURRENT',
    ).length,
    preCurrentCount: entries.filter(
      (entry) => entry.prospect.commercialView.category !== 'CURRENT',
    ).length,
  };
}

interface ActiveCommercialDeckSource {
  prospects: ProspectSummary[];
  prototypes: PrototypeSummary[];
  salesRooms: SalesRoomSummary[];
  escalations: Escalation[];
  meetings: MeetingSummary[];
  recentEvents: LiveEvent[];
  runningJobs: Job[];
  prototypeJobs?: Job[];
}

const UNQUALIFIED_STATES = new Set([
  'SAS_PENDING',
  'DISCOVERED',
  'RESEARCHING',
  'RESEARCH_COMPLETE',
  'DISQUALIFIED',
]);

const WAITING_REPLY_STATES = new Set([
  'WAITING_REPLY',
  'EMAIL_SENT',
  'FOLLOW_UP_SENT',
  'DEMO_REPLY_SENT',
]);

export function projectActiveCommercialDeck(
  source: ActiveCommercialDeckSource,
): ActiveCommercialDeck {
  const prospects = partitionProspectsByCommercialView(source.prospects).current;
  const currentProspectIds = new Set(prospects.map((prospect) => prospect.id));
  const isCurrentProspect = (prospectId: string | undefined): prospectId is string =>
    Boolean(prospectId && currentProspectIds.has(prospectId));
  const stateCounts = prospects.reduce<Record<string, number>>((counts, prospect) => {
    counts[prospect.state] = (counts[prospect.state] ?? 0) + 1;
    return counts;
  }, {});
  const prototypeJobs = (source.prototypeJobs ?? []).filter((job) =>
    isCurrentProspect(job.prospectId),
  );
  const latestByProspect = new Map<string, Job>();
  for (const job of prototypeJobs) {
    if (!job.prospectId) continue;
    const previous = latestByProspect.get(job.prospectId);
    const jobTime = Date.parse(job.updatedAt);
    const previousTime = previous ? Date.parse(previous.updatedAt) : Number.NEGATIVE_INFINITY;
    if (
      !previous ||
      (Number.isFinite(jobTime) && (!Number.isFinite(previousTime) || jobTime > previousTime)) ||
      (jobTime === previousTime && job.id.localeCompare(previous.id) > 0)
    ) {
      latestByProspect.set(job.prospectId, job);
    }
  }
  const latestPrototypeJobs = [...latestByProspect.values()];
  const latestStrategyByProspect = new Map<string, Job>();
  for (const job of prototypeJobs) {
    if (job.kind !== 'GENERATE_PROTOTYPE_STRATEGY' || !job.prospectId) continue;
    const previous = latestStrategyByProspect.get(job.prospectId);
    const jobTime = Date.parse(job.updatedAt);
    const previousTime = previous ? Date.parse(previous.updatedAt) : Number.NEGATIVE_INFINITY;
    if (
      !previous ||
      (Number.isFinite(jobTime) && (!Number.isFinite(previousTime) || jobTime > previousTime)) ||
      (jobTime === previousTime && job.id.localeCompare(previous.id) > 0)
    ) {
      latestStrategyByProspect.set(job.prospectId, job);
    }
  }
  const prototypeStrategyStatus = Object.fromEntries(
    [...latestStrategyByProspect.entries()].map(([prospectId, job]) => [prospectId, job.status]),
  );

  return {
    prospects,
    qualifiedProspects: prospects.filter(
      (prospect) => !UNQUALIFIED_STATES.has(prospect.state),
    ),
    waitingReplyProspects: prospects.filter((prospect) =>
      WAITING_REPLY_STATES.has(prospect.state),
    ),
    followupDueProspects: prospects.filter(
      (prospect) => prospect.state === 'FOLLOW_UP_DUE',
    ),
    prototypes: source.prototypes.filter((prototype) =>
      isCurrentProspect(prototype.prospect_id),
    ),
    salesRooms: source.salesRooms.filter((room) =>
      isCurrentProspect(room.prospectId),
    ),
    escalations: source.escalations.filter((escalation) =>
      isCurrentProspect(escalation.prospect_id),
    ),
    meetings: source.meetings.filter((meeting) =>
      isCurrentProspect(meeting.prospectId),
    ),
    prospectEvents: source.recentEvents.filter((event) =>
      isCurrentProspect(event.prospectId),
    ),
    operationalEvents: source.recentEvents.filter(
      (event) => !event.prospectId || isCurrentProspect(event.prospectId),
    ),
    operationalJobs: source.runningJobs.filter(
      (job) => !job.prospectId || isCurrentProspect(job.prospectId),
    ),
    prototypeJobs,
    latestPrototypeJobs,
    prototypeStrategyStatus,
    stateCounts,
  };
}

const isProduction = process.env.NODE_ENV === 'production';
const baseUrl = (
  process.env.MAGICSCRIPT_API_BASE_URL ||
  (isProduction ? '' : 'http://127.0.0.1:8787')
).replace(/\/$/, '');
const apiToken =
  process.env.MAGICSCRIPT_API_TOKEN ||
  (isProduction ? undefined : 'dev-api-token');

async function getJson<T>(path: string): Promise<T> {
  if (!baseUrl) {
    throw new Error('MAGICSCRIPT_API_BASE_URL is not configured');
  }

  const headers = new Headers();
  if (apiToken) {
    headers.set('authorization', `Bearer ${apiToken}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    cache: 'no-store',
    headers,
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export async function getControlCenterData(): Promise<ControlCenterData> {
  try {
    const health = await getJson<ApiHealth>('/health');

    if (!health.databaseConfigured) {
      const commercial = projectActiveCommercialDeck({
        prospects: [],
        prototypes: [],
        salesRooms: [],
        escalations: [],
        meetings: [],
        recentEvents: [],
        runningJobs: [],
        prototypeJobs: [],
      });
      return {
        connected: true,
        health,
        escalations: [],
        runningJobs: [],
        prototypeJobs: [],
        runners: [],
        providerUsage: null,
        outreachStatus: null,
        prototypes: [],
        salesRooms: [],
        recentEvents: [],
        prospects: [],
        meetings: [],
        commercial,
        operatorQueue: projectOperatorProspectQueue([]),
        readiness: null,
        error: 'API connected, but D1 is not configured yet.',
      };
    }

    // The local Wrangler/D1 runtime is intentionally read with bounded
    // concurrency. A burst of every dashboard query at once can make the
    // long-lived local workerd restart, which turns truthful data into an
    // intermittent all-UNKNOWN cockpit.
    const escalationData = await getJson<{ escalations: Escalation[] }>(
      '/api/escalations?limit=20',
    );
    const jobData = await getJson<{ jobs: Job[] }>('/api/jobs?status=RUNNING');
    const allJobData = await getJson<{ jobs: Job[] }>('/api/jobs');
    const prototypeJobs = allJobData.jobs.filter((job) => ['GENERATE_PROTOTYPE_STRATEGY', 'BUILD_PROTOTYPE', 'RUN_PROTOTYPE_QA', 'RUN_SYNTHETIC_PROTOTYPE_QA', 'DEPLOY_PROTOTYPE', 'CREATIVE_WEB_DESIGN_SYNTHETIC'].includes(job.kind)).map((job) => ({ ...job, syntheticCreativeTrace: projectSyntheticCreativeTrace(job), syntheticPrototypeQaTrace: projectSyntheticPrototypeQaTrace(job) }));
    const runnerData = await getJson<{ runners: Runner[] }>('/api/runners');
    const providerUsage = await getJson<ProviderUsage>('/api/providers/usage');
    const outreachStatus = await getJson<OutreachStatus>('/api/outreach/status');
    const prototypeData = await getJson<{ prototypes: PrototypeSummary[] }>(
      '/api/prototypes',
    );
    const salesRoomData = await getJson<{ salesRooms: SalesRoomSummary[] }>(
      '/api/sales-rooms',
    );
    const eventData = await getJson<{ events: LiveEvent[] }>('/api/events?limit=20');
    const prospectData = await getJson<{ prospects: ProspectSummary[] }>('/api/prospects');
    const meetingData = await getJson<{ meetings: MeetingSummary[] }>('/api/meetings');
    const readiness = await getJson<Readiness>('/api/readiness');
    const commercial = projectActiveCommercialDeck({
      prospects: prospectData.prospects,
      prototypes: prototypeData.prototypes,
      salesRooms: salesRoomData.salesRooms,
      escalations: escalationData.escalations,
      meetings: meetingData.meetings,
      recentEvents: eventData.events,
      runningJobs: jobData.jobs,
       prototypeJobs,
    });
    const operatorQueue = projectOperatorProspectQueue(prospectData.prospects);

    return {
      connected: true,
      health,
      escalations: escalationData.escalations,
      runningJobs: jobData.jobs,
       prototypeJobs,
      runners: runnerData.runners,
      providerUsage,
      outreachStatus,
      prototypes: prototypeData.prototypes,
      salesRooms: salesRoomData.salesRooms,
      recentEvents: eventData.events,
      prospects: prospectData.prospects,
      meetings: meetingData.meetings,
      commercial,
      operatorQueue,
      readiness,
      buSummaries: prospectData.prospects.map((prospect) => ({
        prospectId: prospect.id,
        companyName: prospect.companyName,
        items: projectProspectBuSummaries({
          prospect,
          jobs: allJobData.jobs,
          events: eventData.events,
          prototypes: prototypeData.prototypes,
          escalations: escalationData.escalations,
        }),
      })),
    };
  } catch (error) {
    const commercial = projectActiveCommercialDeck({
      prospects: [],
      prototypes: [],
      salesRooms: [],
      escalations: [],
      meetings: [],
      recentEvents: [],
      runningJobs: [],
      prototypeJobs: [],
    });
    return {
      connected: false,
      health: null,
      escalations: [],
      runningJobs: [],
      prototypeJobs: [],
      runners: [],
      providerUsage: null,
      outreachStatus: null,
      prototypes: [],
      salesRooms: [],
      recentEvents: [],
      prospects: [],
      meetings: [],
      commercial,
      operatorQueue: projectOperatorProspectQueue([]),
      readiness: null,
      error: error instanceof Error ? error.message : 'Unknown backend error',
    };
  }
}
