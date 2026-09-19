import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCommercialBrandCollisions,
  boundedRecencyBonus,
  scoreCommercialEligibility,
  type CommercialEligibilityInput,
} from '../scoring/commercial-eligibility';

const base: CommercialEligibilityInput = {
  siren: '123456789',
  siret: '12345678900010',
  companyName: 'Entreprise Locale',
  legalName: 'Entreprise Locale',
  city: 'FORT-DE-FRANCE',
  sourceUrl:
    'https://annuaire-entreprises.data.gouv.fr/etablissement/12345678900010',
  companyActivity: '70.22Z',
  localActivity: '43.21A',
  companyCategory: 'PME',
  companyEmployeeBand: '03',
  localEmployeeBand: '03',
  isHeadOffice: true,
  numberOpenEstablishments: 4,
  legalNature: '5499',
  companyCreationDate: '2020-01-01',
  asOfDate: '2026-09-08',
};

test('local establishment activity wins over company activity for sector scoring', () => {
  const result = scoreCommercialEligibility({
    ...base,
    companyActivity: '47.78A',
    localActivity: '90.01Z',
  });

  assert.equal(result.activity, '90.01Z');
  assert.equal(result.localActivitySection, 'R');
  assert.equal(result.sectorSource, 'LOCAL_ESTABLISHMENT_ACTIVITY');
  assert.equal(result.sectorScore, 6);
});

test('COSTA DEL SOL uses local retail rather than company head-office activity', () => {
  const result = scoreCommercialEligibility({
    ...base,
    companyName: 'COSTA DEL SOL',
    companyActivity: '70.10Z',
    localActivity: '47.78A',
  });

  assert.equal(result.activity, '47.78A');
  assert.equal(result.localActivitySection, 'G');
  assert.equal(result.companyActivitySection, 'M');
  assert.equal(result.sectorScore, 10);
  assert.ok(!result.constraints.includes('NAF_70_10Z_NEUTRAL_SECTOR'));
});

test('70.10Z receives neutral sector treatment without being hard-rejected', () => {
  const result = scoreCommercialEligibility({
    ...base,
    companyActivity: '47.78A',
    localActivity: '70.10Z',
  });

  assert.equal(result.sectorScore, 5);
  assert.equal(result.classification, 'RESEARCH');
  assert.ok(result.constraints.includes('NAF_70_10Z_NEUTRAL_SECTOR'));
  assert.ok(result.constraints.includes('ICP_FIRST_WAVE_RESEARCH_CAP'));
});

test('non-target legal, head-office and administrative NAF activities cannot be high priority', () => {
  for (const localActivity of ['69.10Z', '69.20Z', '70.10Z', '82.11Z']) {
    const result = scoreCommercialEligibility({
      ...base,
      companyName: `Witness ${localActivity}`,
      localActivity,
      isHeadOffice: true,
      numberOpenEstablishments: 1,
    });

    assert.equal(result.classification, 'RESEARCH', localActivity);
    assert.ok(result.constraints.includes('ICP_FIRST_WAVE_RESEARCH_CAP'), localActivity);
  }
});

test('customer-facing ICP divisions remain high priority with comparable strong evidence', () => {
  for (const localActivity of ['47.78C', '56.10A', '56.30Z', '96.02B']) {
    const result = scoreCommercialEligibility({
      ...base,
      companyName: `ICP Witness ${localActivity}`,
      localActivity,
      isHeadOffice: true,
      numberOpenEstablishments: 1,
    });

    assert.equal(result.classification, 'HIGH_PRIORITY', localActivity);
    assert.ok(result.sectorScore >= 10, localActivity);
  }
});

test('retail outranks legal and administrative profiles in the first-wave surface', () => {
  const retail = scoreCommercialEligibility({ ...base, localActivity: '47.78C' });
  const legal = scoreCommercialEligibility({ ...base, localActivity: '69.10Z' });
  const administrative = scoreCommercialEligibility({ ...base, localActivity: '82.11Z' });

  assert.equal(retail.classification, 'HIGH_PRIORITY');
  assert.equal(legal.classification, 'RESEARCH');
  assert.equal(administrative.classification, 'RESEARCH');
});

test('non-target caps survive maximum recency and company-activity fallback', () => {
  for (const activity of ['69.10Z', '69.20Z', '70.10Z', '82.11Z']) {
    const local = scoreCommercialEligibility({
      ...base,
      localActivity: activity,
      companyCreationDate: '2026-09-01',
      asOfDate: '2026-09-08',
    });
    const fallback = scoreCommercialEligibility({
      ...base,
      localActivity: undefined,
      companyActivity: activity,
      companyCreationDate: '2026-09-01',
      asOfDate: '2026-09-08',
    });

    assert.equal(local.recencyScore, 10, activity);
    assert.equal(local.classification, 'RESEARCH', `${activity} local`);
    assert.equal(fallback.sectorSource, 'COMPANY_ACTIVITY_FALLBACK', activity);
    assert.equal(fallback.recencyScore, 10, `${activity} fallback`);
    assert.equal(fallback.classification, 'RESEARCH', `${activity} fallback`);
  }
});

test('recency bonus is bounded at ten points', () => {
  assert.equal(boundedRecencyBonus('2026-09-01', '2026-09-08'), 10);
  assert.ok(boundedRecencyBonus('2026-09-01', '2026-09-08') <= 10);
});

test('an old company receives no age penalty', () => {
  const old = scoreCommercialEligibility({
    ...base,
    companyCreationDate: '1980-01-01',
  });
  const missing = scoreCommercialEligibility({
    ...base,
    companyCreationDate: undefined,
  });

  assert.equal(old.recencyScore, 0);
  assert.equal(old.score, missing.score);
});

test('legal nature 7381 is deterministically institutional and rejected', () => {
  const result = scoreCommercialEligibility({ ...base, legalNature: '7381' });
  assert.equal(result.institutional, true);
  assert.equal(result.classification, 'REJECT');
});

test('public and parapublic witnesses remain rejected from structured evidence', () => {
  for (const companyName of [
    'CNRS',
    'INRAE',
    'CCIM',
    'SPL SOGES',
    'SEMAAG',
  ]) {
    const result = scoreCommercialEligibility({
      ...base,
      companyName,
      legalName: companyName,
    });
    assert.equal(result.classification, 'REJECT', companyName);
  }
});

test('all observed association legal-nature families are detected', () => {
  for (const legalNature of [
    '5195',
    '9210',
    '9220',
    '9221',
    '9222',
    '9223',
    '9224',
    '9230',
    '9240',
    '9260',
  ]) {
    assert.equal(
      scoreCommercialEligibility({ ...base, legalNature }).association,
      true,
      legalNature,
    );
  }
});

test('associations are capped at Research rather than universally rejected', () => {
  const result = scoreCommercialEligibility({ ...base, legalNature: '9220' });
  assert.equal(result.score, 85);
  assert.equal(result.classification, 'RESEARCH');
  assert.ok(result.constraints.includes('ASSOCIATION_RESEARCH_CAP'));
});

test('a controlled network cannot become high priority without autonomy evidence', () => {
  const blocked = scoreCommercialEligibility({
    ...base,
    companyName: 'FITNESS PARK GALLERIA',
    requiresNetworkAutonomyCheck: true,
    autonomyEvidence: 'UNVERIFIED',
  });
  const confirmed = scoreCommercialEligibility({
    ...base,
    companyName: 'Entreprise Locale Autonome',
    requiresNetworkAutonomyCheck: true,
    autonomyEvidence: 'CONFIRMED',
  });

  assert.equal(blocked.classification, 'RESEARCH');
  assert.equal(confirmed.classification, 'HIGH_PRIORITY');
});

test("L'UNIVERS DU PNEU preserves two identities in one collision group with one representative", () => {
  const results = applyCommercialBrandCollisions([
    scoreCommercialEligibility({
      ...base,
      siren: '521924241',
      siret: '52192424100016',
      companyName: "L'UNIVERS DU PNEU",
    }),
    scoreCommercialEligibility({
      ...base,
      siren: '487950107',
      siret: '48795010700010',
      companyName: "L'UNIVERS DU PNEU",
    }),
  ]);

  assert.equal(new Set(results.map((item) => item.identityKey)).size, 2);
  assert.deepEqual(
    new Set(results.map((item) => item.brandCollisionGroup)),
    new Set(['L UNIVERS DU PNEU']),
  );
  assert.equal(
    results.filter((item) => item.initialResearchRepresentative).length,
    1,
  );
});

test('generic NON-DIFFUSIBLE names never create a brand collision', () => {
  const results = applyCommercialBrandCollisions([
    scoreCommercialEligibility({
      ...base,
      siren: '429510712',
      siret: '42951071200046',
      companyName: '[NON-DIFFUSIBLE]',
    }),
    scoreCommercialEligibility({
      ...base,
      siren: '513085621',
      siret: '51308562100011',
      companyName: 'NON DIFFUSIBLE',
    }),
  ]);

  assert.notEqual(results[0].brandKey, results[1].brandKey);
  assert.ok(results.every((item) => item.brandCollisionGroup === null));
  assert.ok(results.every((item) => item.initialResearchRepresentative));
});

test('same-name AU BONHEUR DES DAMES records resolve by exact SIREN and SIRET', () => {
  const results = [
    scoreCommercialEligibility({
      ...base,
      siren: '397877622',
      siret: '39787762200019',
      companyName: 'AU BONHEUR DES DAMES',
    }),
    scoreCommercialEligibility({
      ...base,
      siren: '999999999',
      siret: '99999999900011',
      companyName: 'AU BONHEUR DES DAMES',
    }),
  ];

  const selected = results.find(
    (item) => item.identityKey === '397877622|39787762200019',
  );
  assert.equal(selected?.researchIdentity.siret, '39787762200019');
  assert.equal(results.length, 2);
});

test('Research identity always carries SIREN, SIRET, display name, city and source URL', () => {
  const identity = scoreCommercialEligibility(base).researchIdentity;
  assert.deepEqual(identity, {
    siren: '123456789',
    siret: '12345678900010',
    companyName: 'Entreprise Locale',
    city: 'FORT-DE-FRANCE',
    sourceUrl:
      'https://annuaire-entreprises.data.gouv.fr/etablissement/12345678900010',
  });
});

test('identical structured input produces an identical classification', () => {
  assert.deepEqual(
    scoreCommercialEligibility(base),
    scoreCommercialEligibility({ ...base }),
  );
});
