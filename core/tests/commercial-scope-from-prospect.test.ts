import assert from 'node:assert/strict';
import test from 'node:test';
import { extractCommercialScopeFromProspectTexts } from '../orchestrator/commercial-scope-from-prospect';

test('extracts explicit showcase scope from direct prospect wording', () => {
  const result = extractCommercialScopeFromProspectTexts([
    'Je veux un site vitrine de 5 pages.',
  ]);

  assert.equal(result.profile.siteKind, 'SHOWCASE');
  assert.equal(result.profile.pageCount, 5);
  assert.deepEqual(result.profile.lightweightFeatures, []);
  assert.deepEqual(result.profile.complexRequirements, []);
  assert.equal(result.complete, true);
});

test('extracts supported lightweight features without choosing a price itself', () => {
  const result = extractCommercialScopeFromProspectTexts([
    'Je souhaite un site vitrine de 5 pages avec Calendly et un blog.',
  ]);

  assert.equal(result.profile.siteKind, 'SHOWCASE');
  assert.equal(result.profile.pageCount, 5);
  assert.deepEqual(
    new Set(result.profile.lightweightFeatures),
    new Set(['THIRD_PARTY_BOOKING', 'SIMPLE_BLOG']),
  );
});

test('detects complex commercial requirements explicitly stated by the prospect', () => {
  const result = extractCommercialScopeFromProspectTexts([
    'Je veux un site vitrine de 4 pages avec un espace client et paiement en ligne.',
  ]);

  assert.equal(result.profile.siteKind, 'SHOWCASE');
  assert.equal(result.profile.pageCount, 4);
  assert.deepEqual(
    new Set(result.profile.complexRequirements),
    new Set(['CLIENT_PORTAL', 'BUSINESS_PAYMENT']),
  );
});

test('keeps vague wording incomplete instead of inventing a package', () => {
  const result = extractCommercialScopeFromProspectTexts([
    'Je voudrais quelque chose de moderne et assez complet.',
  ]);

  assert.equal(result.profile.siteKind, null);
  assert.equal(result.profile.pageCount, null);
  assert.equal(result.complete, false);
  assert.deepEqual(result.conflicts, []);
});

test('merges explicit dimensions across multiple direct prospect messages', () => {
  const result = extractCommercialScopeFromProspectTexts([
    'Ce sera un site vitrine.',
    'Je pense partir sur 5 pages.',
    'Je veux aussi Calendly.',
  ]);

  assert.equal(result.profile.siteKind, 'SHOWCASE');
  assert.equal(result.profile.pageCount, 5);
  assert.deepEqual(result.profile.lightweightFeatures, ['THIRD_PARTY_BOOKING']);
  assert.equal(result.complete, true);
});

test('fails closed on contradictory page counts or site kinds', () => {
  const pageConflict = extractCommercialScopeFromProspectTexts([
    'Je veux un site vitrine de 4 pages.',
    'Finalement ce sera 6 pages.',
  ]);

  assert.equal(pageConflict.profile.pageCount, null);
  assert.equal(pageConflict.complete, false);
  assert.ok(pageConflict.conflicts.includes('commercial_page_count_conflict'));

  const kindConflict = extractCommercialScopeFromProspectTexts([
    'Je veux un site vitrine de 5 pages.',
    'Je veux finalement une boutique e-commerce de 5 pages.',
  ]);

  assert.equal(kindConflict.profile.siteKind, null);
  assert.equal(kindConflict.complete, false);
  assert.ok(kindConflict.conflicts.includes('commercial_site_kind_conflict'));
});
