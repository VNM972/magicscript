import { normalizeCommercialName } from '../scoring/commercial-eligibility';

export type DoNotProspectDecision = 'KNOWN_PROJECT' | 'INTERNAL' | 'OPERATOR_EXCLUDED';

export type DoNotProspectEntityKey =
  | 'SUNELEK' | 'MAGIC_SCRIPT' | 'NORD_PNEU_CARAIBES'
  | 'MENHIR_IMMOBILIER' | 'LA_BALADE_DU_SOLEIL' | 'SOMARLOC'
  | 'YOUYOU_MARKET' | 'APAVE' | 'GROUPE_FONTAINE' | 'FIDUCIAL_SOFIRAL'
  | 'STATION_VITO' | 'ENVIE_D_AILLEURS' | 'JEAN_PIERRE_EUVRARD'
  | 'RODOLPHO_ALEXANDER' | 'LADYBUG' | 'KAY_JUJU'
  | 'AUX_DEUX_GOUTTES_D_EAU' | 'BEAUTY_FIXTURE';

export interface ProspectIdentityCandidate {
  companyName?: string;
  legalName?: string;
  siren?: string;
  siret?: string;
  websiteUrl?: string;
}

export interface DoNotProspectMatch {
  entityKey: DoNotProspectEntityKey;
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
  {
    entityKey: 'NORD_PNEU_CARAIBES', decision: 'OPERATOR_EXCLUDED',
    sirets: ['52192424100016'], sirens: ['521924241'], domains: [],
    displayAliases: ["L'UNIVERS DU PNEU", 'NORD PNEU CARAIBES'],
  },
  {
    entityKey: 'MENHIR_IMMOBILIER', decision: 'OPERATOR_EXCLUDED',
    sirets: ['51870544700010'], sirens: ['518705447'], domains: [],
    displayAliases: ["GUY HOQUET L'IMMOBILIER", 'MENHIR IMMOBILIER FRANCHISE'],
  },
  {
    entityKey: 'LA_BALADE_DU_SOLEIL', decision: 'OPERATOR_EXCLUDED',
    sirets: [], sirens: [], domains: ['labaladedusoleil.com'],
    displayAliases: ['La Balade du Soleil'],
  },
  {
    entityKey: 'SOMARLOC', decision: 'OPERATOR_EXCLUDED',
    sirets: ['44471474500015'], sirens: ['444714745'], domains: [],
    displayAliases: ['SOMARLOC', 'SOCIETE MARTINIQUAISE DE LOCATION', 'SOCIETE MARTINIQUAISE DE LOCATION (SOMARLOC)'],
  },
  {
    entityKey: 'YOUYOU_MARKET', decision: 'OPERATOR_EXCLUDED',
    sirets: ['84274162100010'], sirens: ['842741621'], domains: [],
    displayAliases: ['YOUYOU MARKET', 'SASU-YOUYOU-MARKET'],
  },
  {
    entityKey: 'APAVE', decision: 'OPERATOR_EXCLUDED',
    sirets: [], sirens: [], domains: ['find-us.apave.com'],
    displayAliases: ['APAVE', 'APAVE EXPLOITATION FRANCE', 'APAVE INFRASTRUCTURES ET CONSTRUCTION FRANCE'],
  },
  {
    entityKey: 'GROUPE_FONTAINE', decision: 'OPERATOR_EXCLUDED',
    sirets: ['75355242100012'], sirens: ['753552421'], domains: [],
    displayAliases: ['GROUPE FONTAINE COMPTABILITE ET ADMINISTRATION'],
  },
  {
    entityKey: 'FIDUCIAL_SOFIRAL', decision: 'OPERATOR_EXCLUDED',
    sirets: [], sirens: [], domains: [],
    displayAliases: ['SOC FIDUCIAIRE NAT JURIDIQUE FISCALE', 'FIDUCIAL SOFIRAL AVOCATS', 'SOC FIDUCIAIRE NAT JURIDIQUE FISCALE (FIDUCIAL SOFIRAL AVOCATS)'],
  },
  {
    entityKey: 'STATION_VITO', decision: 'OPERATOR_EXCLUDED',
    sirets: [], sirens: [], domains: [], displayAliases: ['STATION VITO'],
  },
  {
    entityKey: 'ENVIE_D_AILLEURS', decision: 'OPERATOR_EXCLUDED',
    sirets: ['51391970400017'], sirens: ['513919704'], domains: [],
    displayAliases: ['ENVIE D AILLEURS', 'E D A FEELING'],
  },
  {
    entityKey: 'JEAN_PIERRE_EUVRARD', decision: 'OPERATOR_EXCLUDED',
    sirets: ['41113428100012'], sirens: ['411134281'], domains: [],
    displayAliases: ['JEAN-PIERRE EUVRARD'],
  },
  {
    entityKey: 'RODOLPHO_ALEXANDER', decision: 'OPERATOR_EXCLUDED',
    sirets: ['83030240200011'], sirens: ['830302402'], domains: [],
    displayAliases: ['RODOLPHO ALEXANDER'],
  },
  {
    entityKey: 'LADYBUG', decision: 'OPERATOR_EXCLUDED',
    sirets: ['82113215600018'], sirens: ['821132156'], domains: [],
    displayAliases: ['LADYBUG'],
  },
  {
    entityKey: 'KAY_JUJU', decision: 'OPERATOR_EXCLUDED',
    sirets: ['92024781400014'], sirens: ['920247814'], domains: [],
    displayAliases: ['KAY JUJU'],
  },
  {
    entityKey: 'AUX_DEUX_GOUTTES_D_EAU', decision: 'OPERATOR_EXCLUDED',
    sirets: [], sirens: [], domains: [], displayAliases: ["Aux Deux Gouttes d'Eau"],
  },
  {
    entityKey: 'BEAUTY_FIXTURE', decision: 'INTERNAL',
    sirets: ['62345678900003'], sirens: ['623456789'], domains: [],
    displayAliases: ['BEAUTY_FIXTURE'],
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
