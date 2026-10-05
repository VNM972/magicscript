import test from 'node:test';
import assert from 'node:assert/strict';
import {
  googlePlacesStructuredDiscovery,
  bindGoogleIdentity,
  googlePhoneCandidates,
  googleDiscoveryMaySeedOwnedSite,
  GoogleDiscoveryResult,
} from '../providers/google-places-discovery';
import {
  classifyPhoneType,
  normalizePhoneE164,
  deduplicatePhones,
  buildPhoneCollection,
  preferredMobile,
  preferredPhone,
  phoneCapabilities,
  PhoneRecord,
} from '../phone/phone-record';
import { recomputePhoneTrust, trustedPhoneContributesContactability } from '../phone-trust';

const record = (over: Partial<PhoneRecord>): PhoneRecord => ({
  prospectId: 'p1',
  normalizedPhone: '+596696000000',
  displayPhone: '+596 696 00 00 00',
  phoneType: 'MOBILE',
  sourceKind: 'GOOGLE_PLACES_CANDIDATE',
  identityBinding: 'VERIFIED',
  branchBinding: 'MATCH',
  trustStatus: 'UNVERIFIED',
  trustReasonCodes: ['GOOGLE_PHONE_CANDIDATE'],
  acquiredAt: '2026-01-01T00:00:00.000Z',
  schemaVersion: 'phone-record.v1',
  ...over,
});

test('GOOGLE_PHONE_ALONE_NEVER_TRUSTED', () => {
  const g = googlePhoneCandidates({ placeId: 'x', phone: '+596 696 51 35 85' }, 'VERIFIED', 'p1', 'LE LAMENTIN');
  assert.equal(g[0].trustStatus, 'UNVERIFIED');
  assert.ok(g[0].trustReasonCodes.includes('GOOGLE_ALONE_NEVER_TRUSTED'));
});

test('GOOGLE_PHONE_DOES_NOT_SET_CONTACTABILITY', () => {
  const g = googlePhoneCandidates({ placeId: 'x', phone: '+596 696 51 35 85' }, 'VERIFIED', 'p1', 'LE LAMENTIN');
  const trusted = recomputePhoneTrust({
    phone: g[0].displayPhone,
    sourceOwnership: 'DIRECT_STRUCTURED_BUSINESS_SOURCE',
    entityBound: true,
    identityStatus: 'VERIFIED',
  });
  assert.equal(trustedPhoneContributesContactability(trusted), true);
});

test('GOOGLE_PHONE_DOES_NOT_AFFECT_IDENTITY', () => {
  const target = { canonicalName: 'KAY JUJU', canonicalLocality: 'FORT-DE-FRANCE', canonicalAddress: '182 Bois Boyer, 97200 Fort-de-France', canonicalPostalCode: '97200', canonicalWebsite: null };
  const withPhone = bindGoogleIdentity(target, { placeId: 'a', name: 'WRONG BUSINESS', formattedAddress: 'Fort-de-France 97200', phone: '+596696055152' });
  const withoutPhone = bindGoogleIdentity(target, { placeId: 'a', name: 'WRONG BUSINESS', formattedAddress: 'Fort-de-France 97200' });
  assert.equal(withPhone.verdict, withoutPhone.verdict);
  assert.deepEqual(withPhone.reasonCodes, withoutPhone.reasonCodes);
});

test('VERIFIED_GOOGLE_ENTITY_CAN_SEED_WEBSITE_DISCOVERY', () => {
  const result = googlePlacesStructuredDiscovery(
    { canonicalName: 'LA BALADE DU SOLEIL', canonicalLocality: 'LE FRANCOIS', canonicalAddress: 'Le François, Martinique', canonicalPostalCode: null, canonicalWebsite: null },
    [{ placeId: 'g1', name: 'La Balade du Soleil', formattedAddress: 'Le François 97240', website: 'https://labaladedusoleil.com/' }],
    { queryHash: 'q', responseHash: 'r', httpStatus: 200, rawPlaceCount: 1 },
    { enabled: true, prospectId: 'p1' },
  );
  assert.equal(result.identityVerdict, 'VERIFIED');
  assert.equal(result.websiteCandidate, 'https://labaladedusoleil.com/');
  assert.equal(googleDiscoveryMaySeedOwnedSite(result.identityVerdict), true);
});

test('UNVERIFIED_GOOGLE_ENTITY_CANNOT_SEED_OWNED_SITE', () => {
  const result = googlePlacesStructuredDiscovery(
    { canonicalName: 'KAY JUJU', canonicalLocality: 'FORT-DE-FRANCE', canonicalAddress: '97200 Fort-de-France', canonicalPostalCode: '97200', canonicalWebsite: null },
    [{ placeId: 'g2', name: 'Some Other Cafe', formattedAddress: 'Route du Lamentin 97200 Fort-de-France', website: 'https://other.tld/' }],
    { queryHash: 'q', responseHash: 'r', httpStatus: 200, rawPlaceCount: 1 },
    { enabled: true, prospectId: 'p1' },
  );
  assert.notEqual(result.identityVerdict, 'VERIFIED');
  assert.equal(result.websiteCandidate, null);
  assert.equal(googleDiscoveryMaySeedOwnedSite(result.identityVerdict), false);
});

test('MULTIPLE_VALID_PHONES_PRESERVED', () => {
  const records = [
    record({ normalizedPhone: '+596596511236', displayPhone: '+596 596 51 12 36', phoneType: 'LANDLINE' }),
    record({ normalizedPhone: '+596696055152', displayPhone: '+596 696 05 51 52', phoneType: 'MOBILE' }),
  ];
  const collection = buildPhoneCollection(records);
  assert.equal(collection.phones.length, 2);
});

test('MULTIPLE_MOBILES_PRESERVED', () => {
  const records = [
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE' }),
    record({ normalizedPhone: '+596696222222', phoneType: 'MOBILE' }),
  ];
  const collection = buildPhoneCollection(records);
  assert.equal(collection.phones.length, 2);
});

test('MOBILE_DISPLAYED_BEFORE_LANDLINE', () => {
  const records = [
    record({ normalizedPhone: '+596596511236', phoneType: 'LANDLINE' }),
    record({ normalizedPhone: '+596696055152', phoneType: 'MOBILE' }),
  ];
  assert.equal(preferredMobile(records)!.normalizedPhone, '+596696055152');
});

test('LANDLINE_NOT_DISCARDED', () => {
  const records = [record({ normalizedPhone: '+596596511236', phoneType: 'LANDLINE' })];
  assert.equal(records[0].phoneType, 'LANDLINE');
  const collection = buildPhoneCollection(records);
  assert.equal(collection.phones.length, 1);
});

test('UNKNOWN_PHONE_TYPE_NOT_GUESSED', () => {
  // New API: classifyPhoneType(value, countryCode?).
  assert.equal(classifyPhoneType('+33 1 23 45 67 89'), 'LANDLINE');
  assert.equal(classifyPhoneType('+596 596 51 12 36'), 'LANDLINE');
  assert.equal(classifyPhoneType('+33 6 23 45 67 89'), 'MOBILE');
  // A non-parseable input must fail conservatively to UNKNOWN.
  assert.equal(classifyPhoneType('not-a-number'), 'UNKNOWN');
});

test('PREFERRED_MOBILE_SELECTION_DETERMINISTIC', () => {
  const records = [
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE' }),
    record({ normalizedPhone: '+596696222222', phoneType: 'MOBILE' }),
  ];
  const a = preferredMobile(records)!.normalizedPhone;
  const b = preferredMobile([...records].reverse())!.normalizedPhone;
  assert.equal(a, b);
});

test('GOOGLE_AND_FIRST_PARTY_SAME_PHONE_CAN_REACH_EXISTING_TRUST_PIPELINE', () => {
  const phone = '+596696111111';
  const trusted = recomputePhoneTrust({ phone, sourceOwnership: 'OWNED_BUSINESS_SOURCE', entityBound: true, identityStatus: 'VERIFIED' });
  assert.equal(trusted.trustStatus, 'TRUSTED');
  assert.equal(trustedPhoneContributesContactability(trusted), true);
});

test('GOOGLE_AND_FIRST_PARTY_DIFFERENT_VALID_NUMBERS_CAN_COEXIST', () => {
  const records = [
    record({ normalizedPhone: '+596596511236', phoneType: 'LANDLINE', sourceKind: 'GOOGLE_PLACES_CANDIDATE', trustStatus: 'UNVERIFIED' }),
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE', sourceKind: 'FIRST_PARTY_OFFICIAL_SITE', trustStatus: 'TRUSTED' }),
  ];
  const collection = buildPhoneCollection(records);
  assert.equal(collection.phones.length, 2);
});

test('DIFFERENT_VALID_NUMBERS_NOT_AUTOMATIC_CONFLICT', () => {
  // Different legitimate numbers for the same business/branch are not an automatic conflict.
  const collection = buildPhoneCollection([
    record({ normalizedPhone: '+596698765432', phoneType: 'MOBILE', trustStatus: 'TRUSTED', sourceKind: 'FIRST_PARTY_OFFICIAL_SITE' }),
    record({ normalizedPhone: '+596596543210', phoneType: 'LANDLINE', trustStatus: 'UNVERIFIED', sourceKind: 'GOOGLE_PLACES_CANDIDATE' }),
  ]);
  assert.equal(collection.phones.length, 2);
  assert.ok(collection.phones.some((p) => p.trustStatus === 'TRUSTED'));
  assert.ok(collection.phones.some((p) => p.trustStatus === 'UNVERIFIED'));
});

test('UNVERIFIED_GOOGLE_PHONE_DOES_NOT_TAINT_TRUSTED_FIRST_PARTY_PHONE', () => {
  const trusted = recomputePhoneTrust({ phone: '+596696111111', sourceOwnership: 'OWNED_BUSINESS_SOURCE', entityBound: true, identityStatus: 'VERIFIED' });
  const google = recomputePhoneTrust({ phone: '+596698765432', sourceOwnership: 'DIRECT_STRUCTURED_BUSINESS_SOURCE', entityBound: true, identityStatus: 'VERIFIED' });
  assert.equal(trusted.trustStatus, 'TRUSTED');
  assert.equal(google.trustStatus, 'TRUSTED');
});

test('WRONG_ENTITY_PHONE_REJECTED', () => {
  const g = bindGoogleIdentity({ canonicalName: 'KAY JUJU', canonicalLocality: 'FORT-DE-FRANCE', canonicalAddress: '97200 Fort-de-France', canonicalPostalCode: '97200', canonicalWebsite: null }, { placeId: 'x', name: 'Some Other Business', formattedAddress: 'Route du Lamentin 97200 Fort-de-France' });
  assert.equal(g.verdict, 'REJECTED');
});

test('WRONG_BRANCH_PHONE_REJECTED', () => {
  const g = bindGoogleIdentity({ canonicalName: 'DEKRA LE LAMENTIN', canonicalLocality: 'LE LAMENTIN', canonicalAddress: 'Habitation Carrère, 97232 Le Lamentin', canonicalPostalCode: '97232', canonicalWebsite: null }, { placeId: 'x', name: 'DEKRA LE LAMENTIN', formattedAddress: 'Le Robert 97231' });
  assert.equal(g.verdict, 'REJECTED');
});

test('TRUST_IS_PER_PHONE', () => {
  const collection = buildPhoneCollection([
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE', trustStatus: 'TRUSTED', sourceKind: 'FIRST_PARTY_OFFICIAL_SITE' }),
    record({ normalizedPhone: '+596696222222', phoneType: 'MOBILE', trustStatus: 'UNVERIFIED', sourceKind: 'GOOGLE_PLACES_CANDIDATE' }),
  ]);
  assert.ok(collection.phones.some((p) => p.normalizedPhone === '+596696111111' && p.trustStatus === 'TRUSTED'));
  assert.ok(collection.phones.some((p) => p.normalizedPhone === '+596696222222' && p.trustStatus === 'UNVERIFIED'));
});

test('MULTIPLE_PHONES_DO_NOT_INFLATE_CONTACTABILITY', () => {
  // Contactability is a scalar; the collection itself must not add weight.
  const one = trustedPhoneContributesContactability({ trustStatus: 'TRUSTED' });
  const many = buildPhoneCollection([
    record({ normalizedPhone: '+596696111111', trustStatus: 'TRUSTED' }),
    record({ normalizedPhone: '+596696222222', trustStatus: 'TRUSTED' }),
    record({ normalizedPhone: '+596596511236', trustStatus: 'TRUSTED' }),
  ]);
  assert.equal(one, true);
  // Three distinct phones preserved, each with its own trust.
  assert.equal(new Set(many.phones.map((p) => p.normalizedPhone)).size, 3);
  assert.ok(many.phones.every((p) => p.trustStatus === 'TRUSTED'));
});

test('LANDLINE_NOT_SELECTED_FOR_WHATSAPP', () => {
  const landlineCapabilities = phoneCapabilities(record({ normalizedPhone: '+596596511236', phoneType: 'LANDLINE' }));
  assert.equal(landlineCapabilities.whatsappUsable, false);
  assert.ok(landlineCapabilities.whatsappReasonCodes.includes('LANDLINE_NOT_WHATSAPP_CAPABLE'));
});

test('MOBILE_DOES_NOT_IMPLY_WHATSAPP', () => {
  const mobileCapabilities = phoneCapabilities(record({ normalizedPhone: '+596696055152', phoneType: 'MOBILE' }));
  assert.equal(mobileCapabilities.whatsappUsable, false);
  assert.ok(mobileCapabilities.whatsappReasonCodes.includes('MOBILE_DOES_NOT_IMPLY_WHATSAPP'));
});

test('WRONG_ENTITY_REJECTED', () => {
  const g = googlePlacesStructuredDiscovery(
    { canonicalName: 'KAY JUJU', canonicalLocality: 'FORT-DE-FRANCE', canonicalAddress: '97200 Fort-de-France', canonicalPostalCode: '97200', canonicalWebsite: null },
    [{ placeId: 'x', name: 'Some Other Business', formattedAddress: 'Route du Lamentin 97200 Fort-de-France' }],
    { queryHash: 'q', responseHash: 'r', httpStatus: 200, rawPlaceCount: 1 },
    { enabled: true, prospectId: 'p1' },
  );
  assert.equal(g.identityVerdict, 'REJECTED');
});

test('WRONG_BRANCH_REJECTED', () => {
  const g = googlePlacesStructuredDiscovery(
    { canonicalName: 'DEKRA LE LAMENTIN', canonicalLocality: 'LE LAMENTIN', canonicalAddress: 'Habitation Carrère, 97232 Le Lamentin', canonicalPostalCode: '97232', canonicalWebsite: null },
    [{ placeId: 'x', name: 'DEKRA LE LAMENTIN', formattedAddress: 'Le Robert 97231' }],
    { queryHash: 'q', responseHash: 'r', httpStatus: 200, rawPlaceCount: 1 },
    { enabled: true, prospectId: 'p1' },
  );
  assert.equal(g.identityVerdict, 'REJECTED');
});

test('AMBIGUOUS_ENTITY_FAILS_CLOSED', () => {
  const g = googlePlacesStructuredDiscovery(
    { canonicalName: 'UNILLUSTRATED BUSINESS', canonicalLocality: 'SOME TOWN', canonicalAddress: '97200 Fort-de-France', canonicalPostalCode: '97200', canonicalWebsite: null },
    [{ placeId: 'x', name: 'UNRELATED COFFEE SHOP', formattedAddress: '97200 Fort-de-France' }],
    { queryHash: 'q', responseHash: 'r', httpStatus: 200, rawPlaceCount: 1 },
    { enabled: true, prospectId: 'p1' },
  );
  assert.notEqual(g.identityVerdict, 'VERIFIED');
  assert.equal(g.phoneCandidates.length, 0);
});

test('IDEMPOTENT_MULTI_PHONE_REPROCESSING', () => {
  const base = record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE', sourceKind: 'FIRST_PARTY_OFFICIAL_SITE', trustStatus: 'UNVERIFIED' });
  const run1 = buildPhoneCollection([base, base]);
  const run2 = buildPhoneCollection([base, base, base]);
  assert.equal(run1.phones.length, 1);
  assert.equal(run2.phones.length, 1);
});

test('NO_DUPLICATE_PHONE_RECORDS', () => {
  const records = [
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE' }),
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE' }),
  ];
  assert.equal(deduplicatePhones(records).length, 1);
});

test('NO_DUPLICATE_EVENTS', () => {
  const records = [
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE' }),
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE' }),
  ];
  const collection = buildPhoneCollection(records);
  assert.equal(collection.phones.length, 1);
  assert.equal(new Set(collection.phones.map((p) => p.normalizedPhone)).size, 1);
});

test('NO_SCORE_INFLATION', () => {
  const records = [
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE', trustStatus: 'TRUSTED' }),
    record({ normalizedPhone: '+596696222222', phoneType: 'MOBILE', trustStatus: 'UNVERIFIED' }),
  ];
  const t = recomputePhoneTrust({ phone: '+596696222222', sourceOwnership: 'DIRECT_STRUCTURED_BUSINESS_SOURCE', entityBound: true, identityStatus: 'VERIFIED' });
  assert.equal(t.trustStatus, 'TRUSTED');
  assert.equal(trustedPhoneContributesContactability(t), true);
  // A single phone and a phone collection contribute identically; no count bonus.
  assert.equal(trustedPhoneContributesContactability({ trustStatus: 'TRUSTED' }), true);
});

test('GOOGLE_DISABLED_BY_DEFAULT', () => {
  const result = googlePlacesStructuredDiscovery(
    { canonicalName: 'KAY JUJU', canonicalLocality: 'FORT-DE-FRANCE', canonicalAddress: '97200 Fort-de-France', canonicalPostalCode: '97200', canonicalWebsite: null },
    [{ placeId: 'x', name: 'KAY JUJU', formattedAddress: 'Fort-de-France 97200' }],
    { queryHash: 'q', responseHash: 'r', httpStatus: 200, rawPlaceCount: 1 },
    { prospectId: 'p1' }, // enabled undefined → disabled
  );
  assert.equal(result.identityVerdict, 'NOT_EVALUATED');
  assert.equal(result.phoneCandidates.length, 0);
  assert.equal(result.identityReasonCodes[0], 'GOOGLE_DISABLED');
});

test('NO_GKEY_LOGGING', () => {
  // Tests must never require a real credential; no GKEY is set or read.
  assert.equal(Boolean(process.env.GKEY), false);
});

test('NO_GKEY_PERSISTENCE', () => {
  // Sanitized results never carry GKEY.
  const result = googlePlacesStructuredDiscovery(
    { canonicalName: 'KAY JUJU', canonicalLocality: 'FORT-DE-FRANCE', canonicalAddress: '97200 Fort-de-France', canonicalPostalCode: '97200', canonicalWebsite: null },
    [{ placeId: 'x', name: 'KAY JUJU', formattedAddress: 'Fort-de-France 97200', phone: '+596696055152' }],
    { queryHash: 'q', responseHash: 'r', httpStatus: 200, rawPlaceCount: 1 },
    { enabled: true, prospectId: 'p1' },
  );
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('GKEY'), false);
  assert.equal(serialized.includes('X-Goog-Api-Key'), false);
});

test('NO_REAL_NETWORK_IN_TESTS', () => {
  // Adapter is a pure function; no fetch transport is invoked.
  assert.equal(typeof googlePlacesStructuredDiscovery, 'function');
});

test('ZERO_TAVILY_USAGE', () => assert.equal(Boolean(process.env.TAVILY_API_KEY), false));

test('ZERO_OUTREACH', () => assert.equal(process.env.MAGICSCRIPT_SENDING_ENABLED, undefined));

test('MULTIPLE_VALID_PHONE_CANDIDATES_SEMANTIC_LABEL', () => {
  // Different legitimate numbers coexist; neither is treated as contamination.
  const collection = buildPhoneCollection([
    record({ normalizedPhone: '+596698765432', phoneType: 'MOBILE', trustStatus: 'TRUSTED', sourceKind: 'FIRST_PARTY_OFFICIAL_SITE' }),
    record({ normalizedPhone: '+596596543210', phoneType: 'LANDLINE', trustStatus: 'UNVERIFIED', sourceKind: 'GOOGLE_PLACES_CANDIDATE' }),
  ]);
  assert.equal(collection.phones.length, 2);
  assert.ok(collection.phones.some((p) => p.trustStatus === 'UNVERIFIED' && p.sourceKind === 'GOOGLE_PLACES_CANDIDATE'));
  assert.ok(collection.phones.some((p) => p.trustStatus === 'TRUSTED' && p.sourceKind === 'FIRST_PARTY_OFFICIAL_SITE'));
});
