import type { Prospect } from '../types/prospect';

export type SwarmHubId =
  | 'ASSOCIATIONS_MEMOIRE_MILITAIRE'
  | 'BTP'
  | 'SECURITE'
  | 'SERVICES_PUBLICS'
  | 'COIFFURE_BEAUTE'
  | 'FLEURISTES'
  | 'RESTAURATION_HOTELLERIE'
  | 'COMMERCE_LOCAL'
  | 'SERVICES_PROFESSIONNELS'
  | 'GENERALISTE';

export interface SwarmHubDefinition {
  id: SwarmHubId;
  label: string;
  businessUnit: string;
  masterOfWork: string;
  purpose: string;
  matchTerms: readonly string[];
  publicResearchScope: readonly string[];
  concurrencyCap: number;
}

export const DESIGN_SYSTEM_HUB = {
  id: 'DESIGN_SYSTEM',
  label: 'Design system transversal',
  businessUnit: 'BU Design transversal',
  masterOfWork: 'MO Web Design',
  purpose: 'Maintenir les patterns, l’accessibilité, le responsive et les tendances visuelles.',
  concurrencyCap: 1,
} as const;

export const SWARM_HUBS: readonly SwarmHubDefinition[] = [
  {
    id: 'ASSOCIATIONS_MEMOIRE_MILITAIRE',
    label: 'Associations mémoire militaire',
    businessUnit: 'BU Associations mémoire militaire',
    masterOfWork: 'MO Associations mémoire militaire',
    purpose: 'Observer les associations, institutions mémorielles et parcours d’entraide.',
    matchTerms: ['snemm', 'militaire', 'militaires', 'vétéran', 'anciens combattants', 'mémoire', 'entraide', 'médaille'],
    publicResearchScope: ['associations de mémoire', 'anciens combattants', 'entraide militaire', 'médailles militaires'],
    concurrencyCap: 1,
  },
  {
    id: 'BTP',
    label: 'Bâtiment et travaux publics',
    businessUnit: 'BU BTP',
    masterOfWork: 'MO BTP',
    purpose: 'Comparer les parcours de devis, réalisations, zones d’intervention et preuves métier.',
    matchTerms: ['bâtiment', 'batiment', 'travaux publics', 'gros œuvre', 'gros oeuvre', 'construction', 'maçon', 'plombier', 'électricien', 'charpentier'],
    publicResearchScope: ['entreprises BTP locales', 'artisans construction', 'sites de devis travaux'],
    concurrencyCap: 1,
  },
  {
    id: 'SECURITE',
    label: 'Sécurité et protection',
    businessUnit: 'BU Sécurité',
    masterOfWork: 'MO Sécurité',
    purpose: 'Comparer les offres de protection, la crédibilité institutionnelle et les demandes qualifiées.',
    matchTerms: ['sécurité', 'securite', 'protection', 'gardiennage', 'surveillance', 'sûreté', 'surete'],
    publicResearchScope: ['entreprises sécurité privée', 'protection des personnes', 'sécurité événementielle'],
    concurrencyCap: 1,
  },
  {
    id: 'SERVICES_PUBLICS',
    label: 'Services publics et territoire',
    businessUnit: 'BU Services publics',
    masterOfWork: 'MO Services publics',
    purpose: 'Observer la lisibilité des démarches, l’information citoyenne et l’accès aux services.',
    matchTerms: ['mairie', 'municipalité', 'municipalite', 'collectivité', 'collectivite', 'service public', 'institution', 'office public'],
    publicResearchScope: ['services publics locaux', 'collectivités territoriales', 'portails citoyens'],
    concurrencyCap: 1,
  },
  {
    id: 'COIFFURE_BEAUTE',
    label: 'Coiffure et beauté',
    businessUnit: 'BU Coiffure beauté',
    masterOfWork: 'MO Coiffure beauté',
    purpose: 'Comparer la prise de rendez-vous, la galerie, les prestations et la preuve locale.',
    matchTerms: ['coiffeur', 'coiffure', 'barbier', 'institut', 'beauté', 'beaute', 'esthétique', 'esthetique', 'salon'],
    publicResearchScope: ['salons de coiffure', 'instituts beauté', 'barbiers locaux'],
    concurrencyCap: 1,
  },
  {
    id: 'FLEURISTES',
    label: 'Fleuristes et artisanat floral',
    businessUnit: 'BU Fleuristes',
    masterOfWork: 'MO Fleuristes',
    purpose: 'Comparer le catalogue, la commande locale, la saisonnalité et les parcours de contact.',
    matchTerms: ['fleuriste', 'fleurs', 'floral', 'bouquet', 'jardinerie'],
    publicResearchScope: ['fleuristes locaux', 'artisans floraux', 'livraison fleurs locale'],
    concurrencyCap: 1,
  },
  {
    id: 'RESTAURATION_HOTELLERIE',
    label: 'Restauration et hôtellerie',
    businessUnit: 'BU Restauration hôtellerie',
    masterOfWork: 'MO Restauration hôtellerie',
    purpose: 'Comparer le menu, la réservation, l’expérience locale et les informations pratiques.',
    matchTerms: ['restaurant', 'restauration', 'traiteur', 'hôtel', 'hotel', 'café', 'cafe', 'bar', 'brasserie'],
    publicResearchScope: ['restaurants locaux', 'hôtels indépendants', 'traiteurs locaux'],
    concurrencyCap: 1,
  },
  {
    id: 'COMMERCE_LOCAL',
    label: 'Commerce local',
    businessUnit: 'BU Commerce local',
    masterOfWork: 'MO Commerce local',
    purpose: 'Comparer la découverte produit, les horaires, le retrait local et le contact.',
    matchTerms: ['commerce', 'boutique', 'magasin', 'épicerie', 'epicerie', 'librairie', 'opticien'],
    publicResearchScope: ['commerces indépendants', 'boutiques locales', 'services de proximité'],
    concurrencyCap: 1,
  },
  {
    id: 'SERVICES_PROFESSIONNELS',
    label: 'Services professionnels',
    businessUnit: 'BU Services professionnels',
    masterOfWork: 'MO Services professionnels',
    purpose: 'Comparer l’offre, les expertises vérifiables, les secteurs servis et la prise de rendez-vous.',
    matchTerms: ['conseil', 'consultant', 'expert-comptable', 'avocat', 'formation', 'agence', 'bureau d’études', "bureau d'etudes"],
    publicResearchScope: ['cabinets et agences locaux', 'services B2B régionaux', 'professionnels indépendants'],
    concurrencyCap: 1,
  },
  {
    id: 'GENERALISTE',
    label: 'Généraliste',
    businessUnit: 'BU Généraliste',
    masterOfWork: 'MO Généraliste',
    purpose: 'Accueillir les fiches qui ne justifient pas encore un hub vertical.',
    matchTerms: [],
    publicResearchScope: ['entreprises locales tous secteurs'],
    concurrencyCap: 1,
  },
];

const normalized = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR');

export function resolveSwarmHub(
  prospect: Pick<Prospect, 'companyName' | 'legalName' | 'activity' | 'primaryAsset'>,
): SwarmHubDefinition {
  const haystack = normalized([
    prospect.companyName,
    prospect.legalName,
    prospect.activity,
    prospect.primaryAsset,
  ].filter(Boolean).join(' '));

  let best = SWARM_HUBS.at(-1)!;
  let bestScore = 0;

  for (const hub of SWARM_HUBS.slice(0, -1)) {
    const score = hub.matchTerms.reduce(
      (total, term) => total + (haystack.includes(normalized(term)) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      best = hub;
      bestScore = score;
    }
  }

  return best;
}

export function hubForId(id: string): SwarmHubDefinition | undefined {
  return SWARM_HUBS.find((hub) => hub.id === id);
}
