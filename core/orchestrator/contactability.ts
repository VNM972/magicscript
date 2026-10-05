import type { Prospect, ProspectContact } from '../types/prospect';
import type { MagicScriptEvent } from '../types/events';
import { evaluateResearchPhoneEvidenceIntegrity } from '../research/evidence-integrity';

export type ContactabilityStatus =
  | 'PUBLISHED_VERIFIED'
  | 'UNVERIFIED'
  | 'OPPOSED';

interface ContactabilityChannelBase {
  contactId: string;
  prospectId: string;
  siren?: string;
  siret?: string;
  value: string;
  sourceUrl?: string;
  sourceType?: ProspectContact['sourceType'];
  observedAt: string;
  evidenceEventId?: string;
  confidence?: number;
  status: ContactabilityStatus;
  usableForFirstOutreach: boolean;
}

export interface EmailContactabilityChannel extends ContactabilityChannelBase {
  type: 'EMAIL';
  sourceUrl?: string;
  sourceType?: ProspectContact['sourceType'];
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
  status: ContactabilityStatus | 'MISSING';
  channels: ContactabilityChannel[];
  preparation: ContactPreparation | null;
}

function isPublicHttpUrl(value?: string): boolean {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isPublishedVerifiedContactCandidate(input: {
  sourceUrl?: string;
  confidence: number;
  verified: boolean;
  observedExactValue: boolean;
  suppressed: boolean;
  minConfidence: number;
}): boolean {
  return (
    input.observedExactValue &&
    input.verified &&
    isPublicHttpUrl(input.sourceUrl) &&
    Number.isFinite(input.confidence) &&
    input.confidence >= input.minConfidence &&
    !input.suppressed
  );
}

function cleanEmail(value: string): string {
  return value.trim().toLowerCase();
}

function emailMatchesWebsiteDomain(email: string, websiteUrl?: string): boolean {
  if (!websiteUrl) return true;
  try {
    const websiteHost = new URL(websiteUrl).hostname.toLowerCase().replace(/^www\./, '');
    const emailDomain = email.split('@')[1]?.toLowerCase();
    return Boolean(emailDomain && (emailDomain === websiteHost || emailDomain.endsWith(`.${websiteHost}`)));
  } catch {
    return false;
  }
}

function trustedPhoneFromEvent(
  event: MagicScriptEvent,
  prospectId: string,
  persistedPhone?: string,
): {
  phone: string;
  sourceUrl: string;
  observedAt: string;
  evidenceEventId: string;
} | null {
  if (
    event.prospectId !== prospectId ||
    event.actor !== 'scoring-agent' ||
    event.type !== 'research.scored' ||
    typeof persistedPhone !== 'string' ||
    typeof event.id !== 'string' ||
    !event.id.trim() ||
    typeof event.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(event.createdAt))
  ) {
    return null;
  }

  const payload =
    typeof event.payload === 'object' &&
    event.payload !== null &&
    !Array.isArray(event.payload)
      ? event.payload as Record<string, unknown>
      : null;
  if (!payload) return null;

  const integrity = payload.evidenceIntegrity;
  const phoneEvidence = payload.phoneEvidence;
  const supportedClaims =
    typeof integrity === 'object' && integrity !== null
      ? (integrity as Record<string, unknown>).supportedClaims
      : undefined;
  if (
    typeof integrity !== 'object' ||
    integrity === null ||
    (integrity as Record<string, unknown>).passed !== true ||
    !Array.isArray(supportedClaims) ||
    !supportedClaims.includes('phone') ||
    !Array.isArray(payload.sources) ||
    typeof phoneEvidence !== 'object' ||
    phoneEvidence === null
  ) {
    return null;
  }

  const evidence = phoneEvidence as Record<string, unknown>;
  if (
    typeof evidence.phone !== 'string' ||
    typeof evidence.sourceUrl !== 'string'
  ) {
    return null;
  }

  // Re-validate the complete deterministic provenance persisted by the
  // scoring event. Model fields or source.supports without this evidence
  // remain fail-closed.
  const validated = evaluateResearchPhoneEvidenceIntegrity({
    sources: payload.sources,
    phone: evidence.phone,
    phoneSourceUrl: evidence.sourceUrl,
    derivedPhoneEvidence: evidence,
  });
  const trustedPhone = validated.trustedPhone;
  if (
    !trustedPhone ||
    validated.rejectedSourceCount !== 0 ||
    validated.acceptedSources.length !== payload.sources.length ||
    evidence.phone !== trustedPhone.phone ||
    evidence.sourceUrl !== trustedPhone.sourceUrl ||
    persistedPhone.trim() !== trustedPhone.phone
  ) {
    return null;
  }

  return {
    ...trustedPhone,
    observedAt: event.createdAt,
    evidenceEventId: event.id,
  };
}

function prepareEmailDraft(
  prospect: Pick<Prospect, 'companyName'>,
  channel: EmailContactabilityChannel,
): PreparedContactDraft {
  const subject = `Échange au sujet de ${prospect.companyName.trim()}`;
  const body = [
    'Bonjour,',
    '',
    "Je vous contacte au nom de Magic Script au sujet de la présence web de votre entreprise.",
    '',
    'Si le sujet peut vous être utile, je vous propose un bref échange. Vous pouvez également me demander de ne plus vous contacter.',
    '',
    'Bien cordialement,',
    'Stéphane',
  ].join('\n');
  const mailtoHref = `mailto:${encodeURIComponent(channel.value)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return {
    kind: 'EMAIL_DRAFT',
    contactId: channel.contactId,
    recipient: channel.value,
    subject,
    body,
    mailtoHref,
    requiresHumanSend: true,
    sendsAutomatically: false,
  };
}

function preparePhoneCall(channel: PhoneContactabilityChannel): PreparedPhoneCall {
  return {
    kind: 'PHONE_CALL_PREPARATION',
    contactId: channel.contactId,
    evidenceEventId: channel.evidenceEventId,
    phone: channel.value,
    sourceUrl: channel.sourceUrl,
    requiresHumanDial: true,
    dialsAutomatically: false,
  };
}

export function buildProspectContactability(
  prospect: Pick<
    Prospect,
    'id' | 'companyName' | 'siren' | 'siret' | 'phone' | 'state' | 'websiteUrl'
  >,
  contacts: readonly ProspectContact[],
  events: readonly MagicScriptEvent[] = [],
): ProspectContactability {
  const prospectOpposed = prospect.state === 'DO_NOT_CONTACT';
  const emailChannels = contacts
    .filter((contact) => contact.prospectId === prospect.id)
    .map((contact): EmailContactabilityChannel => {
      const sourceIsUsable = isPublicHttpUrl(contact.sourceUrl);
      const opposed = prospectOpposed || contact.isSuppressed;
      const publishedVerified =
        contact.isValidated &&
        sourceIsUsable &&
        emailMatchesWebsiteDomain(cleanEmail(contact.email), prospect.websiteUrl) &&
        !opposed;
      const status: ContactabilityStatus = opposed
        ? 'OPPOSED'
        : publishedVerified
          ? 'PUBLISHED_VERIFIED'
          : 'UNVERIFIED';

      return {
        contactId: contact.id,
        prospectId: contact.prospectId,
        siren: prospect.siren,
        siret: prospect.siret,
        type: 'EMAIL',
        value: cleanEmail(contact.email),
        sourceUrl: contact.sourceUrl,
        sourceType: contact.sourceType,
        observedAt: contact.createdAt,
        confidence: contact.confidence,
        status,
        usableForFirstOutreach: publishedVerified,
      };
    });

  const trustedPhoneEvent = events
    .map((event) => ({
      event,
      evidence: trustedPhoneFromEvent(event, prospect.id, prospect.phone),
    }))
    .filter(
      (candidate): candidate is {
        event: MagicScriptEvent;
        evidence: {
          phone: string;
          sourceUrl: string;
          observedAt: string;
          evidenceEventId: string;
        };
      } => candidate.evidence !== null,
    )
    .sort(
      (left, right) =>
        right.event.createdAt.localeCompare(left.event.createdAt) ||
        right.event.id.localeCompare(left.event.id),
    )[0];

  const phoneChannels: PhoneContactabilityChannel[] = trustedPhoneEvent
    ? [
        {
          contactId: trustedPhoneEvent.evidence.evidenceEventId,
          prospectId: prospect.id,
          siren: prospect.siren,
          siret: prospect.siret,
          type: 'PHONE',
          value: trustedPhoneEvent.evidence.phone,
          sourceUrl: trustedPhoneEvent.evidence.sourceUrl,
          observedAt: trustedPhoneEvent.evidence.observedAt,
          evidenceEventId: trustedPhoneEvent.evidence.evidenceEventId,
          status: prospectOpposed ? 'OPPOSED' : 'PUBLISHED_VERIFIED',
          usableForFirstOutreach: !prospectOpposed,
        },
      ]
    : [];

  const channels = [...emailChannels, ...phoneChannels]
    .sort(
      (left, right) =>
        Number(right.usableForFirstOutreach) -
          Number(left.usableForFirstOutreach) ||
        (right.confidence ?? 0) - (left.confidence ?? 0) ||
        left.value.localeCompare(right.value),
    );

  const usableEmail =
    channels.find(
      (channel): channel is EmailContactabilityChannel =>
        channel.type === 'EMAIL' && channel.usableForFirstOutreach,
    );
  const usablePhone = channels.find(
    (channel): channel is PhoneContactabilityChannel =>
      channel.type === 'PHONE' && channel.usableForFirstOutreach,
  );
  const usable = usableEmail ?? usablePhone;
  const status: ProspectContactability['status'] = prospectOpposed
    ? 'OPPOSED'
    : channels.length === 0
      ? 'MISSING'
      : usable
        ? 'PUBLISHED_VERIFIED'
        : channels.some((channel) => channel.status === 'OPPOSED')
          ? 'OPPOSED'
          : 'UNVERIFIED';

  return {
    identity: {
      prospectId: prospect.id,
      siren: prospect.siren,
      siret: prospect.siret,
    },
    status,
    channels,
    preparation: usable
      ? usable.type === 'EMAIL'
        ? prepareEmailDraft(prospect, usable)
        : preparePhoneCall(usable)
      : null,
  };
}
