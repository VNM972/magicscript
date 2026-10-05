import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAGIC_SCRIPT_DESIGN_DIRECTIONS,
  selectDesignDirection,
} from '../prototypes/design-directions';

test('defines the six initial Magic Script design directions as structured data', () => {
  assert.equal(MAGIC_SCRIPT_DESIGN_DIRECTIONS.length, 6);
  assert.equal(new Set(MAGIC_SCRIPT_DESIGN_DIRECTIONS.map((item) => item.id)).size, 6);

  for (const direction of MAGIC_SCRIPT_DESIGN_DIRECTIONS) {
    assert.ok(direction.heroStrategy);
    assert.ok(direction.sectionGrammar.length > 0);
    assert.ok(direction.mobileBehavior.some((rule) => rule.includes('390px')));
    assert.ok(direction.proofRequirements.length > 0);
    assert.ok(direction.antiPatterns.includes('fake metrics'));
    assert.ok(direction.antiPatterns.includes('generic SaaS dashboard'));
    assert.ok(direction.antiPatterns.includes('card-wall composition'));
    assert.ok(direction.antiPatterns.includes('repetitive boxed sections'));
    assert.ok(direction.antiPatterns.includes('hero assembled from interchangeable blocks without a clear art direction'));
    assert.ok(direction.antiPatterns.includes('flat visual hierarchy'));
    assert.ok(direction.antiPatterns.includes('insufficient real imagery when verified visual assets exist'));
    assert.ok(direction.antiPatterns.includes('insufficient negative space'));
    assert.ok(direction.antiPatterns.includes('monotonous editorial rhythm'));
  }
});

test('selects a deterministic sector direction and keeps the same input stable', () => {
  const input = {
    sector: 'Bâtiment et travaux publics',
    positioning: 'Savoir-faire local',
    availableAssets: ['Photos de chantier vérifiées'],
    contentDensity: 'MEDIUM' as const,
    conversionObjective: 'Demander un devis',
    proofQuality: 'MIXED' as const,
  };

  assert.equal(selectDesignDirection(input).id, 'btp-artisan-architecture');
  assert.deepEqual(selectDesignDirection(input), selectDesignDirection(input));
});

test('maps technical and security sectors without relying on an LLM', () => {
  assert.equal(
    selectDesignDirection({ sector: 'Installation solaire et climatisation' }).id,
    'energy-solar-hvac-technical',
  );
  assert.equal(
    selectDesignDirection({ sector: 'Sécurité et gardiennage B2B' }).id,
    'b2b-security-consulting',
  );
});

test('uses a restrained corporate fallback when evidence is insufficient', () => {
  assert.equal(
    selectDesignDirection({ sector: null, positioning: null, proofQuality: 'LIMITED' }).id,
    'corporate-premium',
  );
});
