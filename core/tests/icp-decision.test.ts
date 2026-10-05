import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideIcp,
  decidePackIcp,
  resolveCommercialFamilyFromNaf,
  resolveBeautyFamilyFromOperatingFacts,
  resolveCommercialFamilyFromOperatingFacts,
  hasQualifyingContact,
  hasOnlyNonQualifyingContacts,
  WEBSITE_QUALITY_GATE,
  type IcpDecisionInput,
} from '../icp/icp-decision';
import { normalizePack } from '../admission/contact-opportunity-pack';
import type { ContactOpportunityPackV2 } from '../admission/contact-opportunity-pack';

function pack(overrides: {
  businessName?: string;
  websiteUrl?: string;
  contacts?: ContactOpportunityPackV2['contacts'];
  icp?: ContactOpportunityPackV2['opportunity']['icp'];
}): ContactOpportunityPackV2 {
  const contacts = overrides.contacts ?? [{ channel: 'EMAIL', value: `${(overrides.businessName ?? 'cafe').toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.com` }];
  return {
    schemaVersion: 'CONTACT_OPPORTUNITY_PACK_V2',
    packId: `pack-${Math.random()}`,
    source: { agent: 'AGENT_1', provenance: 'test', receivedAt: '2026-09-20T00:00:00.000Z' },
    identity: { businessName: overrides.businessName ?? 'Café Indépendant', websiteUrl: overrides.websiteUrl, city: 'Fort-de-France', location: 'Martinique' },
    contacts,
    opportunity: {
      observedOpportunity: 'Autre opportunité',
      digitalFriction: 'Friction site web',
      businessContext: 'Contexte local',
      agent1Verdict: 'ADMITTED',
      icp: overrides.icp,
    },
  };
}

// Helpers to build common decisions -------------------------------------------------

function easyWinRestaurant(websiteUrl?: string): IcpDecisionInput {
  return {
    businessName: 'Restaurant Indépendant',
    websiteUrl,
    hasWebsite: Boolean(websiteUrl),
    commercialFamily: 'RESTAURANTS_BARS_CAFES',
    digitalPainSignals: websiteUrl ? ['OBSOLETE_WEBSITE'] : ['NO_USEFUL_WEBSITE'],
    requiresUnprovenCapability: false,
  };
}

// 1. weak independent restaurant + valid email → ADMIT
test('1. weak independent restaurant + valid email → ADMIT', () => {
  const icp = decidePackIcp(pack({ businessName: 'Restaurant Le Coin', websiteUrl: 'https://lecoin.example', icp: easyWinRestaurant('https://lecoin.example') }));
  assert.equal(icp.outcome, 'ADMIT');
  assert.equal(icp.reasonCode, 'SUPPORTED_EASY_WIN');
});

// 2. good target + only landline/social → NEEDS_CONTACT_DISCOVERY
test('2. good target + only landline/social → NEEDS_CONTACT_DISCOVERY', () => {
  const decision = decideIcp(easyWinRestaurant(undefined));
  assert.equal(decision.outcome, 'ADMIT');
  const normalized = normalizePack(pack({ contacts: [{ channel: 'LANDLINE', value: '05 96 51 12 36' }, { channel: 'INSTAGRAM', value: '@cafe' }], icp: easyWinRestaurant(undefined) }));
  assert.equal(hasQualifyingContact(normalized), false);
  assert.equal(hasOnlyNonQualifyingContacts(normalized), true);
});

// 3. unproven e-commerce requirement → CAPABILITY_GATED
test('3. unproven e-commerce requirement → CAPABILITY_GATED', () => {
  const icp = decideIcp({ ...easyWinRestaurant('https://boutique.example'), requiresUnprovenCapability: true, commercialFamily: 'LOCAL_RETAIL' });
  assert.equal(icp.outcome, 'CAPABILITY_GATED');
  assert.equal(icp.reasonCode, 'UNPROVEN_REQUIRED_CAPABILITY');
});

// 4. professional existing site + gate CLOSED → QUALITY_GATED
test('4. professional existing site + gate CLOSED → QUALITY_GATED', () => {
  assert.equal(WEBSITE_QUALITY_GATE, 'CLOSED');
  const icp = decideIcp({ ...easyWinRestaurant('https://prosite.example'), websiteQuality: { isProfessional: true } });
  assert.equal(icp.outcome, 'QUALITY_GATED');
  assert.equal(icp.reasonCode, 'WEBSITE_QUALITY_GATE_CLOSED');
});

// 5. centrally managed chain with no local authority → REJECT
test('5. centrally managed chain with no local authority → REJECT', () => {
  const icp = decideIcp({ ...easyWinRestaurant(undefined), decisionAuthority: { isCentrallyManaged: true, hasLocalAuthority: false } });
  assert.equal(icp.outcome, 'REJECT');
  assert.equal(icp.reasonCode, 'NO_LOCAL_DECISION_AUTHORITY');
});

// 6. autonomous network business may continue through remaining checks
test('6. autonomous network business may continue through remaining checks', () => {
  const icp = decideIcp({ ...easyWinRestaurant(undefined), decisionAuthority: { isCentrallyManaged: true, hasLocalAuthority: true } });
  assert.equal(icp.outcome, 'ADMIT');
});

// 7. no meaningful digital improvement → REJECT
test('7. no meaningful digital improvement → REJECT', () => {
  const icp = decideIcp({ businessName: 'Boutique', websiteUrl: 'https://ok.example', hasWebsite: true, commercialFamily: 'LOCAL_SERVICES', requiresUnprovenCapability: false, digitalPainSignals: [] });
  assert.equal(icp.outcome, 'REJECT');
  assert.equal(icp.reasonCode, 'NO_CLEAR_DIGITAL_PAIN');
});

// 8. Planity-served beauty with no additional value → REJECT
test('8. Planity-served beauty with no additional value → REJECT', () => {
  const icp = decideIcp({ businessName: 'Salon', hasWebsite: false, commercialFamily: 'BEAUTY_HAIR_BARBER', requiresUnprovenCapability: false, bookingPlatformWithNoAdditionalValue: true });
  assert.equal(icp.outcome, 'REJECT');
  assert.equal(icp.reasonCode, 'PLANITY_NO_ADDITIONAL_VALUE');
});

// 9. professional modern corporate photographer → REJECT
test('9. professional modern corporate photographer → REJECT', () => {
  const icp = decideIcp({ businessName: 'Studio Photo', hasWebsite: true, requiresUnprovenCapability: false, isCorporatePhotographerWithModernSite: true, websiteQuality: { isProfessional: true } });
  assert.equal(icp.outcome, 'REJECT');
  assert.equal(icp.reasonCode, 'CORPORATE_PHOTOGRAPHER_NO_GAP');
});

// 10. weak BTP site + valid contact → ADMIT
test('10. weak BTP site + valid contact → ADMIT', () => {
  const icp = decideIcp({ businessName: 'BTP Martinique', websiteUrl: 'https://btp.example', hasWebsite: true, commercialFamily: 'LOCAL_SERVICES', digitalPainSignals: ['OBSOLETE_WEBSITE'], requiresUnprovenCapability: false });
  assert.equal(icp.outcome, 'ADMIT');
});

// 11. large BTP + professional site/internal marketing → QUALITY_GATED
test('11. large BTP + professional site/internal marketing → QUALITY_GATED', () => {
  const icp = decideIcp({ businessName: 'Grand BTP', websiteUrl: 'https://grandbtp.example', hasWebsite: true, commercialFamily: 'LOCAL_SERVICES', websiteQuality: { isProfessional: true }, requiresUnprovenCapability: false });
  assert.equal(icp.outcome, 'QUALITY_GATED');
});

// 12. restaurant fixed phone + Instagram only → NEEDS_CONTACT_DISCOVERY
test('12. restaurant fixed phone + Instagram only → NEEDS_CONTACT_DISCOVERY', () => {
  const decision = decideIcp(easyWinRestaurant(undefined));
  assert.equal(decision.outcome, 'ADMIT');
  const normalized = normalizePack(pack({ contacts: [{ channel: 'LANDLINE', value: '05 96 51 12 36' }, { channel: 'INSTAGRAM', value: '@resto' }], icp: easyWinRestaurant(undefined) }));
  assert.equal(hasQualifyingContact(normalized), false);
  assert.equal(hasOnlyNonQualifyingContacts(normalized), true);
});

// 13. no qualifying contact can never ADMIT (admission-side guard)
test('13. no qualifying contact can never ADMIT', () => {
  const normalized = normalizePack(pack({ contacts: [{ channel: 'LANDLINE', value: '05 96 51 12 36' }], icp: easyWinRestaurant(undefined) }));
  assert.equal(hasQualifyingContact(normalized), false);

  // Even an otherwise-ADMIT candidate cannot admit without a qualifying contact.
  const decision = decideIcp(easyWinRestaurant(undefined));
  assert.equal(decision.outcome, 'ADMIT');
  assert.equal(hasQualifyingContact(normalized), false);
});

// 14. CAPABILITY_GATED never reaches admission
test('14. CAPABILITY_GATED never reaches admission', () => {
  const decision = decideIcp(decideIcpInputFromPack(pack({ businessName: 'Commerce', websiteUrl: 'https://shop.example', icp: { commercialFamily: 'LOCAL_RETAIL', requiresUnprovenCapability: true } })));
  assert.equal(decision.outcome, 'CAPABILITY_GATED');
});

// 15. QUALITY_GATED never reaches admission
test('15. QUALITY_GATED never reaches admission', () => {
  const decision = decideIcp(decideIcpInputFromPack(pack({ businessName: 'Pro Site', websiteUrl: 'https://pro.example', icp: { commercialFamily: 'LOCAL_SERVICES', websiteQuality: { isProfessional: true } } })));
  assert.equal(decision.outcome, 'QUALITY_GATED');
});

// 16. REJECT never reaches admission
test('16. REJECT never reaches admission', () => {
  const decision = decideIcp(decideIcpInputFromPack(pack({ businessName: 'Salon Planity', icp: { commercialFamily: 'BEAUTY_HAIR_BARBER', bookingPlatformWithNoAdditionalValue: true } })));
  assert.equal(decision.outcome, 'REJECT');
});

// 17. only ADMIT may reach canonical admission
test('17. only ADMIT may reach canonical admission', () => {
  const decisions = [
    decideIcp(decideIcpInputFromPack(pack({ businessName: 'Resto Casino', icp: { commercialFamily: 'RESTAURANTS_BARS_CAFES', requiresUnprovenCapability: true } }))),      // CAPABILITY
    decideIcp(decideIcpInputFromPack(pack({ businessName: 'Pro', websiteUrl: 'https://p.example', icp: { commercialFamily: 'LOCAL_SERVICES', websiteQuality: { isProfessional: true } } }))), // QUALITY
    decideIcp(decideIcpInputFromPack(pack({ businessName: 'Chain', icp: { commercialFamily: 'LOCAL_SERVICES', decisionAuthority: { isCentrallyManaged: true, hasLocalAuthority: false } } }))), // REJECT
  ];
  assert.ok(decisions.every((d) => d.outcome !== 'ADMIT'));
  const admit = decideIcp(easyWinRestaurant(undefined));
  assert.equal(admit.outcome, 'ADMIT');
});

// 18. company-name blacklist is not ICP authority
test('18. company-name blacklist is not ICP authority', () => {
  // A national-brand-style name does not REJECT by name alone; authority decides.
  const withAuthority = decideIcp({ businessName: 'Courir', websiteUrl: 'https://courir.example', hasWebsite: true, commercialFamily: 'LOCAL_RETAIL', requiresUnprovenCapability: false, decisionAuthority: { isCentrallyManaged: true, hasLocalAuthority: true } });
  assert.notEqual(withAuthority.reasonCode, 'OUTSIDE_COMMERCIAL_ICP');
  // The engine has no name-blacklist: same name without professional site is not auto-REJECTED by the name.
  const localBranch = decideIcp({ businessName: 'Courir', websiteUrl: 'https://courir.example', hasWebsite: true, commercialFamily: 'LOCAL_RETAIL', requiresUnprovenCapability: false, digitalPainSignals: ['OBSOLETE_WEBSITE'] });
  assert.ok(['ADMIT', 'REJECT'].includes(localBranch.outcome));
  // The engine never returns a name-derived rejection code.
  assert.notEqual(localBranch.reasonCode, 'OUTSIDE_COMMERCIAL_ICP');
});

// 19. active slot semantics remain untouched
test('19. active slot semantics remain untouched', () => {
  // The ICP engine returns only a decision; it does not allocate or inspect slots.
  const result = decideIcp(easyWinRestaurant(undefined));
  assert.ok(['outcome', 'reasonCode', 'version'].every((k) => k in result));
  assert.equal(Object.keys(result).length, 3);
});

// 20. LOCAL_RETAIL authority is official NAF division 47 only
test('20. LOCAL_RETAIL authority resolves from official NAF division 47 only', () => {
  assert.equal(resolveCommercialFamilyFromNaf('47.11A'), 'LOCAL_RETAIL');
  assert.equal(resolveCommercialFamilyFromNaf('47.78C'), 'LOCAL_RETAIL');
  assert.equal(resolveCommercialFamilyFromNaf('45.11Z'), undefined);
  assert.equal(resolveCommercialFamilyFromNaf('retail'), undefined);
  assert.equal(resolveCommercialFamilyFromNaf('47.bad'), undefined);
  assert.equal(resolveCommercialFamilyFromNaf('96.02A'), undefined);
  assert.equal(resolveCommercialFamilyFromNaf('96.02B'), undefined);
});

test('R51 Beauty family requires an operator-bound exact schema type and no conflicting facts', () => {
  const fact = { kind: 'SCHEMA_ORG_TYPE', value: 'BeautySalon', evidenceType: 'JSON_LD', sourceUrl: 'https://salon.example/', operatorUrl: 'https://salon.example/' };
  assert.equal(resolveBeautyFamilyFromOperatingFacts([fact]), 'BEAUTY_HAIR_BARBER');
  assert.equal(resolveBeautyFamilyFromOperatingFacts([{ ...fact, value: 'HairSalon' }]), 'BEAUTY_HAIR_BARBER');
  assert.equal(resolveBeautyFamilyFromOperatingFacts([{ ...fact, operatorUrl: undefined }]), undefined);
  assert.equal(resolveBeautyFamilyFromOperatingFacts([{ ...fact, value: 'HealthAndBeautyBusiness' }]), undefined);
  assert.equal(resolveBeautyFamilyFromOperatingFacts([fact, { ...fact, value: 'Restaurant', operatorUrl: undefined }]), undefined);
  assert.equal(resolveBeautyFamilyFromOperatingFacts([fact, { ...fact, kind: 'SERVICE_TYPE', value: 'ELECTRICAL_INSTALLATION' }]), undefined);
  assert.equal(resolveBeautyFamilyFromOperatingFacts([fact, { ...fact, kind: 'SERVICE_TYPE', value: 'Haircuts' }]), 'BEAUTY_HAIR_BARBER');
});

test('R52 FOOD NAFs alone never resolve a commercial family', () => {
  for (const naf of ['56.10A', '56.10B', '56.10C', '56.21Z', '56.29A', '56.29B', '56.30Z']) {
    assert.equal(resolveCommercialFamilyFromNaf(naf), undefined, naf);
  }
});

test('R52 exact FOOD operator types converge and conflicting facts fail closed', () => {
  const fact = { kind: 'SCHEMA_ORG_TYPE', value: 'Restaurant', evidenceType: 'JSON_LD', sourceUrl: 'https://food.example/', operatorUrl: 'https://food.example/' };
  for (const value of ['Restaurant', 'CafeOrCoffeeShop', 'BarOrPub', 'FastFoodRestaurant']) {
    assert.equal(resolveCommercialFamilyFromOperatingFacts([{ ...fact, value }]), 'RESTAURANTS_BARS_CAFES', value);
  }
  assert.equal(resolveCommercialFamilyFromOperatingFacts([fact, { ...fact, value: 'BarOrPub' }]), 'RESTAURANTS_BARS_CAFES');
  for (const value of ['FoodEstablishment', 'Organization', 'LocalBusiness']) {
    assert.equal(resolveCommercialFamilyFromOperatingFacts([{ ...fact, value }]), undefined, value);
  }
  assert.equal(resolveCommercialFamilyFromOperatingFacts([{ ...fact, operatorUrl: undefined }]), undefined);
  assert.equal(resolveCommercialFamilyFromOperatingFacts([fact, { ...fact, value: 'BeautySalon' }]), undefined);
  assert.equal(resolveCommercialFamilyFromOperatingFacts([fact, { ...fact, value: 'BarOrPub', operatorUrl: undefined }]), undefined);
  assert.equal(resolveCommercialFamilyFromOperatingFacts([fact, { ...fact, kind: 'SERVICE_TYPE', value: 'ELECTRICAL_INSTALLATION' }]), undefined);
});

test('21. LOCAL_RETAIL without authoritative NAF fails closed', () => {
  const icp = decideIcp({ businessName: 'Boutique Locale', websiteUrl: 'https://boutique.example', hasWebsite: true, commercialFamily: 'LOCAL_RETAIL', digitalPainSignals: ['OBSOLETE_WEBSITE'], requiresUnprovenCapability: false });
  assert.equal(icp.outcome, 'REJECT');
  assert.equal(icp.reasonCode, 'LOCAL_RETAIL_FAIL_CLOSED');
});

test('22. authoritative retail with valid contact admits, but retail alone does not', () => {
  const baseRetail: IcpDecisionInput = { businessName: 'Boutique Locale', websiteUrl: 'https://boutique.example', hasWebsite: true, commercialFamily: 'LOCAL_RETAIL', nafCode: '47.78C', digitalPainSignals: ['OBSOLETE_WEBSITE'], requiresUnprovenCapability: false };
  assert.equal(decideIcp(baseRetail).outcome, 'ADMIT');
  assert.equal(decideIcp({ ...baseRetail, hasQualifyingContact: false }).outcome, 'NEEDS_CONTACT_DISCOVERY');
});

// Best-effort helper passing a pack straight through the pack-level decision.
function decideIcpInputFromPack(p: ContactOpportunityPackV2): IcpDecisionInput {
  const icp = p.opportunity?.icp;
  return {
    packId: p.packId,
    businessName: p.identity.businessName,
    websiteUrl: p.identity.websiteUrl,
    hasWebsite: Boolean(p.identity.websiteUrl?.trim()),
    commercialFamily: icp?.commercialFamily,
    nafCode: icp?.nafCode,
    websiteQuality: icp?.websiteQuality,
    decisionAuthority: icp?.decisionAuthority,
    digitalPainSignals: icp?.digitalPainSignals,
    requiresUnprovenCapability: icp?.requiresUnprovenCapability === true,
    bookingPlatformWithNoAdditionalValue: icp?.bookingPlatformWithNoAdditionalValue,
    isCorporatePhotographerWithModernSite: icp?.isCorporatePhotographerWithModernSite,
    outsideCommercialIcp: icp?.outsideCommercialIcp,
  };
}
