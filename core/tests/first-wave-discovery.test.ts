import assert from 'node:assert/strict';
import test from 'node:test';

import { firstWaveDiscoveryTier, rankFirstWaveDiscoveryCandidates } from '../providers/first-wave-discovery';
import { scoreCommercialEligibility } from '../scoring/commercial-eligibility';

const candidate = (id: number, activity: string, overrides: Record<string, unknown> = {}) => {
  const siren = String(100000000 + id);
  const siret = `${siren}00010`;
  return {
    siren,
    siret,
    eligibility: scoreCommercialEligibility({
      siren, siret, companyName: `Business ${id}`, legalName: `Business ${id}`,
      city: 'FORT-DE-FRANCE', sourceUrl: `https://example.test/${siret}`,
      localActivity: activity, companyActivity: activity,
      companyCategory: 'PME', companyEmployeeBand: '01', isHeadOffice: true,
      numberOpenEstablishments: 1, asOfDate: '2026-09-27',
      ...overrides,
    }),
  };
};

test('official local restaurant, hair/beauty and division 47 activities are first-wave signals', () => {
  for (const activity of ['56.10A', '56.30Z', '96.02A', '96.02B', '47.78C']) {
    assert.equal(firstWaveDiscoveryTier(candidate(1, activity).eligibility), 1, activity);
  }
  assert.equal(firstWaveDiscoveryTier(candidate(2, '47.78C', { localActivity: undefined }).eligibility), 2);
  assert.equal(firstWaveDiscoveryTier(candidate(13, '47.bad').eligibility), 2);
  assert.equal(firstWaveDiscoveryTier(candidate(14, '56.bad').eligibility), 2);
});

test('target-activity list is research-plausible without inventing a V2 family', () => {
  // Cible reelle (Phase C-2) : divisions 45,47,55,56,95,96 + 90.03B exact.
  // Ces codes sont tier 2 (research-plausible) sans etre tier 1.
  for (const activity of ['45.31Z', '55.20Z', '95.22Z']) {
    assert.equal(firstWaveDiscoveryTier(candidate(3, activity).eligibility), 2, activity);
  }
  // Divisions historiques larges desormais hors cible (Phase C-2) : tier 3.
  for (const activity of ['43.22B', '71.20B']) {
    assert.equal(firstWaveDiscoveryTier(candidate(3, activity).eligibility), 3, activity);
  }
  for (const activity of ['70.10Z', '70.22Z']) {
    assert.equal(firstWaveDiscoveryTier(candidate(4, activity).eligibility), 3, activity);
  }
});

test('tier outranks provider order and generic legacy score, including division 45 versus 47', () => {
  const highScore45 = candidate(5, '45.31Z');
  const lowerScore47 = candidate(6, '47.78C', { companyCategory: 'GE', companyEmployeeBand: '21', numberOpenEstablishments: 20 });
  const neutral = candidate(7, '70.22Z');
  const restaurant = candidate(8, '56.10A');
  const beauty = candidate(9, '96.02B');
  const ranked = rankFirstWaveDiscoveryCandidates([neutral, highScore45, beauty, restaurant, lowerScore47]);
  assert.deepEqual(ranked.map((item) => firstWaveDiscoveryTier(item.eligibility)), [1, 1, 1, 2, 3]);
  assert.ok(highScore45.eligibility.score > lowerScore47.eligibility.score);
  assert.ok(ranked.indexOf(lowerScore47) < ranked.indexOf(highScore45));
});

test('network uncertainty preserves research eligibility and first-wave tier', () => {
  const network = candidate(10, '47.72A', {
    companyName: 'LOCAL SHOE BRANCH', legalName: 'NETWORK GROUP',
    requiresNetworkAutonomyCheck: true, autonomyEvidence: 'UNVERIFIED',
  });
  assert.equal(network.eligibility.classification, 'RESEARCH');
  assert.equal(firstWaveDiscoveryTier(network.eligibility), 1);
});

test('when first-wave supply is short, tier 2 precedes tier 3 without changing intake eligibility', () => {
  const broad = candidate(11, '70.10Z');
  const plausible = candidate(12, '45.31Z');
  assert.equal(broad.eligibility.classification, 'RESEARCH');
  assert.deepEqual(rankFirstWaveDiscoveryCandidates([broad, plausible]).map((item) => item.siret), [plausible.siret, broad.siret]);
});
