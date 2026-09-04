import type { SwarmHubDefinition, SwarmHubId } from './registry';

export interface SpecialistDefinition {
  id: string;
  scope: string;
}

export interface BusinessUnitTeam {
  hubId: SwarmHubId;
  businessUnit: string;
  masterOfWork: string;
  specialists: readonly SpecialistDefinition[];
}

/**
 * Bounded role map for the existing hubs. This is intentionally one clear
 * specialist lane per hub, not a free-form agent factory or a second queue.
 */
const specialistByHub: Record<SwarmHubId, SpecialistDefinition> = {
  ASSOCIATIONS_MEMOIRE_MILITAIRE: {
    id: 'specialist-associations-research',
    scope: 'Vérifier les faits publics et les parcours de contact associatifs.',
  },
  BTP: {
    id: 'specialist-btp-research',
    scope: 'Vérifier les preuves métier, zones d’intervention et parcours de devis.',
  },
  SECURITE: {
    id: 'specialist-security-research',
    scope: 'Vérifier les offres, preuves métier et canaux professionnels publics.',
  },
  SERVICES_PUBLICS: {
    id: 'specialist-public-services-research',
    scope: 'Vérifier les informations institutionnelles et parcours de service.',
  },
  COIFFURE_BEAUTE: {
    id: 'specialist-beauty-research',
    scope: 'Vérifier prestations, galerie, rendez-vous et présence locale.',
  },
  FLEURISTES: {
    id: 'specialist-floral-research',
    scope: 'Vérifier catalogue, commande locale et informations saisonnières.',
  },
  RESTAURATION_HOTELLERIE: {
    id: 'specialist-hospitality-research',
    scope: 'Vérifier menu, réservation et informations pratiques publiques.',
  },
  COMMERCE_LOCAL: {
    id: 'specialist-local-commerce-research',
    scope: 'Vérifier produits, horaires, retrait local et contact public.',
  },
  SERVICES_PROFESSIONNELS: {
    id: 'specialist-professional-services-research',
    scope: 'Vérifier offre, expertises publiées et prise de rendez-vous.',
  },
  GENERALISTE: {
    id: 'specialist-generalist-research',
    scope: 'Vérifier les faits minimaux avant une spécialisation ultérieure.',
  },
};

export function resolveBusinessUnitTeam(hub: SwarmHubDefinition): BusinessUnitTeam {
  return {
    hubId: hub.id,
    businessUnit: hub.businessUnit,
    masterOfWork: hub.masterOfWork,
    specialists: [specialistByHub[hub.id]],
  };
}
