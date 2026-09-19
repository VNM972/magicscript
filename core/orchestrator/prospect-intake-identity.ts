import { normalizeCommercialName } from '../scoring/commercial-eligibility';

export type DoNotProspectDecision = 'KNOWN_PROJECT' | 'INTERNAL';

export interface ProspectIdentityCandidate {
  companyName?: string;
  legalName?: string;
  siren?: string;
  siret?: string;
  websiteUrl?: string;
}

export interface DoNotProspectMatch {
  entityKey: 'SUNELEK' | 'MAGIC_SCRIPT';
  decision: DoNotProspectDecision;
  matchedBy: 'SIRET' | 'SIREN' | 'DOMAIN' | 'DISPLAY_ALIAS';
}

interface DoNotProspectIdentity {
  entityKey: DoNotProspectMatch['entityKey'];
  decision: DoNotProspectDecision;
  sirets: readonly string[];
  sirens: readonly string[];
  domains: readonly string[];
  displayAliases: readonly string[];
}

const DO_NOT_PROSPECT_IDENTITIES: readonly DoNotProspectIdentity[] = [
  {
    entityKey: 'SUNELEK',
    decision: 'KNOWN_PROJECT',
    sirets: ['83127563100024'],
    sirens: ['831275631'],
    domains: ['sunelek-caraibes.com'],
    displayAliases: [
      'SUNELEK',
      'SUNELEK Caraïbes',
      'SUNeLEK - WhatsApp E2E',
    ],
  },
  {
    entityKey: 'MAGIC_SCRIPT',
    decision: 'INTERNAL',
    sirets: ['50445147700039'],
    sirens: ['504451477'],
    domains: ['magicscript.fr'],
    displayAliases: ['MAGIC SCRIPT'],
  },
];

function digits(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\D/g, '');
  return normalized || undefined;
}

export function canonicalProspectDomain(
  value: string | undefined,
): string | undefined {
  if (!value?.trim()) return undefined;

  try {
    const url = new URL(
      value.includes('://') ? value : `https://${value}`,
    );
    return url.hostname.toLowerCase().replace(/^www\./, '') || undefined;
  } catch {
    return undefined;
  }
}

export function classifyDoNotProspectIdentity(
  candidate: ProspectIdentityCandidate,
): DoNotProspectMatch | null {
  const siret = digits(candidate.siret);
  const siren = digits(candidate.siren);
  const domain = canonicalProspectDomain(candidate.websiteUrl);
  const names = [candidate.companyName, candidate.legalName]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeCommercialName);

  for (const identity of DO_NOT_PROSPECT_IDENTITIES) {
    if (siret && identity.sirets.includes(siret)) {
      return { entityKey: identity.entityKey, decision: identity.decision, matchedBy: 'SIRET' };
    }
    if (siren && identity.sirens.includes(siren)) {
      return { entityKey: identity.entityKey, decision: identity.decision, matchedBy: 'SIREN' };
    }
    if (domain && identity.domains.includes(domain)) {
      return { entityKey: identity.entityKey, decision: identity.decision, matchedBy: 'DOMAIN' };
    }

    const aliases = identity.displayAliases.map(normalizeCommercialName);
    if (names.some((name) => aliases.includes(name))) {
      return {
        entityKey: identity.entityKey,
        decision: identity.decision,
        matchedBy: 'DISPLAY_ALIAS',
      };
    }
  }

  return null;
}
