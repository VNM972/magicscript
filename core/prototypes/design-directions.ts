export type DesignDirectionId =
  | 'restaurant-hospitality'
  | 'btp-artisan-architecture'
  | 'energy-solar-hvac-technical'
  | 'b2b-security-consulting'
  | 'corporate-premium'
  | 'digital-agency';

export interface DesignDirection {
  id: DesignDirectionId;
  label: string;
  eligibleSectors: readonly string[];
  positioning: readonly string[];
  visualPrinciples: readonly string[];
  heroStrategy: string;
  sectionGrammar: readonly string[];
  ctaStrategy: string;
  imageStrategy: string;
  typographicCharacter: string;
  density: 'LOW' | 'MEDIUM' | 'HIGH';
  motionBudget: 'NONE' | 'LOW' | 'MEDIUM';
  mobileBehavior: readonly string[];
  proofRequirements: readonly string[];
  antiPatterns: readonly string[];
}

export interface DesignDirectionSelectionInput {
  sector?: string | null;
  positioning?: string | null;
  availableAssets?: readonly string[];
  contentDensity?: 'LOW' | 'MEDIUM' | 'HIGH';
  conversionObjective?: string | null;
  proofQuality?: 'VERIFIED' | 'MIXED' | 'LIMITED';
}

const COMMON_ANTI_PATTERNS = [
  'robot imagery',
  'AI brain',
  'random circuitry',
  'generic SaaS dashboard',
  'generic dashboard layout',
  'excessive glassmorphism',
  'meaningless neon',
  'gratuitous gradient',
  'excessive rounded cards',
  'card-wall composition',
  'repeated identical section layouts',
  'repetitive boxed sections',
  'hero assembled from interchangeable blocks without a clear art direction',
  'flat visual hierarchy',
  'insufficient real imagery when verified visual assets exist',
  'insufficient negative space',
  'monotonous editorial rhythm',
  'floating blobs',
  'fake metrics',
  'fake trust logos',
  'generic stock-template hierarchy',
] as const;

export const MAGIC_SCRIPT_DESIGN_DIRECTIONS: readonly DesignDirection[] = [
  {
    id: 'restaurant-hospitality',
    label: 'Restaurant / Hospitality',
    eligibleSectors: ['restaurant', 'restauration', 'hotel', 'hotellerie', 'hospitality', 'traiteur', 'bar'],
    positioning: ['convivial', 'gastronomique', 'local', 'experience'],
    visualPrinciples: ['sensory hierarchy', 'generous photography', 'clear practical information'],
    heroStrategy: 'Lead with the verified place, dish or guest experience and one reservation or visit action.',
    sectionGrammar: ['hero', 'signature offer', 'atmosphere', 'practical information', 'primary action'],
    ctaStrategy: 'Prefer one visit, call or third-party reservation action supported by the available facts.',
    imageStrategy: 'Use verified venue, team or product imagery; otherwise use restrained material and color cues.',
    typographicCharacter: 'Warm editorial display paired with highly readable service text.',
    density: 'MEDIUM',
    motionBudget: 'LOW',
    mobileBehavior: ['show the primary action without horizontal scroll', 'keep practical information scannable at 390px'],
    proofRequirements: ['never invent menu items, prices, ratings, opening hours or awards'],
    antiPatterns: COMMON_ANTI_PATTERNS,
  },
  {
    id: 'btp-artisan-architecture',
    label: 'BTP / Artisan / Architecture',
    eligibleSectors: ['btp', 'batiment', 'construction', 'artisan', 'architecture', 'travaux', 'renovation'],
    positioning: ['solide', 'precision', 'savoir-faire', 'chantier'],
    visualPrinciples: ['structural grid', 'material contrast', 'work-first evidence'],
    heroStrategy: 'Make the verified trade and strongest real project asset understandable in five seconds.',
    sectionGrammar: ['hero', 'capabilities', 'verified work', 'method', 'service area if verified', 'quote action'],
    ctaStrategy: 'Use a direct quote or project-discussion action without claiming an operational form.',
    imageStrategy: 'Prioritize verified worksite, craft detail, plan or completed-project imagery.',
    typographicCharacter: 'Technical grotesk with strong hierarchy and restrained display accents.',
    density: 'MEDIUM',
    motionBudget: 'LOW',
    mobileBehavior: ['stack evidence before decorative content', 'keep quote action clear at 390px'],
    proofRequirements: ['certifications, guarantees, years, project counts and service areas require direct evidence'],
    antiPatterns: COMMON_ANTI_PATTERNS,
  },
  {
    id: 'energy-solar-hvac-technical',
    label: 'Energy / Solar / HVAC / Technical',
    eligibleSectors: ['energie', 'solaire', 'photovoltaique', 'climatisation', 'hvac', 'electricite', 'technique'],
    positioning: ['efficacite', 'expertise', 'installation', 'maintenance'],
    visualPrinciples: ['system clarity', 'technical credibility', 'controlled contrast'],
    heroStrategy: 'Explain the verified technical activity plainly, then expose the safest next action.',
    sectionGrammar: ['hero', 'solutions', 'process', 'verified technical proof', 'contact action'],
    ctaStrategy: 'Prefer an assessment, quote or call action grounded in the confirmed service model.',
    imageStrategy: 'Use verified equipment, installation or team imagery; diagrams must describe only supported capabilities.',
    typographicCharacter: 'Precise contemporary sans with numeric restraint.',
    density: 'MEDIUM',
    motionBudget: 'LOW',
    mobileBehavior: ['translate technical detail into short blocks', 'avoid dense comparison tables at 390px'],
    proofRequirements: ['performance figures, subsidies, certifications and savings claims require exact sources'],
    antiPatterns: COMMON_ANTI_PATTERNS,
  },
  {
    id: 'b2b-security-consulting',
    label: 'B2B Services / Security / Consulting',
    eligibleSectors: ['securite', 'gardiennage', 'consulting', 'conseil', 'b2b', 'audit', 'services professionnels'],
    positioning: ['confiance', 'discretion', 'expertise', 'accompagnement'],
    visualPrinciples: ['trust hierarchy', 'operational clarity', 'restrained authority'],
    heroStrategy: 'State the verified business problem, audience and next professional conversation.',
    sectionGrammar: ['hero', 'situations handled', 'method', 'verified credentials', 'conversation action'],
    ctaStrategy: 'Use one consultation, audit or quote action without suggesting guaranteed outcomes.',
    imageStrategy: 'Favor real team, operational context or abstract material detail over staged handshake stock.',
    typographicCharacter: 'Confident neutral sans with compact evidence labels.',
    density: 'MEDIUM',
    motionBudget: 'NONE',
    mobileBehavior: ['put trust evidence near its claim', 'keep service distinctions readable at 390px'],
    proofRequirements: ['clients, certifications, response times, coverage and results require direct evidence'],
    antiPatterns: [...COMMON_ANTI_PATTERNS, 'staged handshake stock'],
  },
  {
    id: 'corporate-premium',
    label: 'Corporate Premium',
    eligibleSectors: ['corporate', 'institutionnel', 'finance', 'patrimoine', 'immobilier', 'direction'],
    positioning: ['premium', 'haut de gamme', 'institutionnel', 'strategie'],
    visualPrinciples: ['quiet confidence', 'editorial spacing', 'evidence-led restraint'],
    heroStrategy: 'Lead with the verified positioning and decision value, using space rather than decorative effects.',
    sectionGrammar: ['hero', 'value thesis', 'expertise', 'selected evidence', 'engagement path'],
    ctaStrategy: 'Invite one qualified conversation or dossier review.',
    imageStrategy: 'Use verified portrait, environment or architectural detail with disciplined cropping.',
    typographicCharacter: 'Editorial serif accent with sober sans-serif reading text.',
    density: 'LOW',
    motionBudget: 'LOW',
    mobileBehavior: ['preserve whitespace without hiding key proof', 'keep the primary action visible at 390px'],
    proofRequirements: ['mandates, assets, returns, clients and track record require direct evidence'],
    antiPatterns: COMMON_ANTI_PATTERNS,
  },
  {
    id: 'digital-agency',
    label: 'Digital Agency',
    eligibleSectors: ['agence', 'digital', 'web', 'design', 'communication', 'marketing', 'studio'],
    positioning: ['creatif', 'innovation', 'conversion', 'sur mesure'],
    visualPrinciples: ['distinct art direction', 'case-study rhythm', 'functional experimentation'],
    heroStrategy: 'Demonstrate the verified creative or conversion capability through the page itself.',
    sectionGrammar: ['hero', 'selected work', 'capabilities', 'process', 'project action'],
    ctaStrategy: 'Use one project-start or brief-discussion action with explicit scope.',
    imageStrategy: 'Prefer verified work and original interface crops; avoid generic device mockups as primary proof.',
    typographicCharacter: 'Expressive display type controlled by a rigorous reading system.',
    density: 'HIGH',
    motionBudget: 'MEDIUM',
    mobileBehavior: ['reduce motion and layered effects at 390px', 'keep work samples and CTA sequential'],
    proofRequirements: ['case studies, clients and performance outcomes require direct evidence'],
    antiPatterns: COMMON_ANTI_PATTERNS,
  },
] as const;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function selectDesignDirection(
  input: DesignDirectionSelectionInput,
): DesignDirection {
  const primaryText = normalize([
    input.sector ?? '',
    input.positioning ?? '',
    input.conversionObjective ?? '',
  ].join(' '));
  const assetText = normalize((input.availableAssets ?? []).join(' '));

  let selected = MAGIC_SCRIPT_DESIGN_DIRECTIONS[4];
  let selectedScore = 0;

  for (const direction of MAGIC_SCRIPT_DESIGN_DIRECTIONS) {
    const sectorScore = direction.eligibleSectors.reduce(
      (score, term) => score + (primaryText.includes(normalize(term)) ? 4 : 0),
      0,
    );
    const positioningScore = direction.positioning.reduce(
      (score, term) => score + (primaryText.includes(normalize(term)) ? 2 : 0),
      0,
    );
    const assetScore = direction.eligibleSectors.reduce(
      (score, term) => score + (assetText.includes(normalize(term)) ? 1 : 0),
      0,
    );
    const score = sectorScore + positioningScore + assetScore;

    if (score > selectedScore) {
      selected = direction;
      selectedScore = score;
    }
  }

  return selected;
}
