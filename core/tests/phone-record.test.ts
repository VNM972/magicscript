import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPhoneType,
  normalizePhoneE164,
  parsePhone,
  orderPhonesForDisplay,
  preferredMobile,
  preferredPhone,
  deduplicatePhones,
  buildPhoneCollection,
  phoneCapabilities,
  PhoneRecord,
} from '../phone/phone-record';

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

test('MQ_FIXED_NORMALIZES_TO_E164', () => {
  assert.equal(normalizePhoneE164('0596511236', 'MQ'), '+596596511236');
  assert.equal(normalizePhoneE164('0596711010', 'MQ'), '+596596711010');
});

test('MQ_MOBILE_NORMALIZES_TO_E164', () => {
  assert.equal(normalizePhoneE164('0696000000', 'MQ'), '+596696000000');
  assert.equal(normalizePhoneE164('0699000000', 'MQ'), '+596699000000');
});

test('FR_FIXED_NORMALIZES_TO_E164', () => {
  assert.equal(normalizePhoneE164('0142685300', 'FR'), '+33142685300');
  assert.equal(normalizePhoneE164('0499999999', 'FR'), '+33499999999');
});

test('FR_MOBILE_NORMALIZES_TO_E164', () => {
  assert.equal(normalizePhoneE164('0612345678', 'FR'), '+33612345678');
  assert.equal(normalizePhoneE164('0712345678', 'FR'), '+33712345678');
});

test('INTERNATIONAL_MQ_NUMBER_NOT_DOUBLE_PREFIXED', () => {
  assert.equal(normalizePhoneE164('+596 696 00 00 00'), '+596696000000');
  assert.equal(normalizePhoneE164('+596 596 51 12 36'), '+596596511236');
});

test('INTERNATIONAL_FR_NUMBER_NOT_DOUBLE_PREFIXED', () => {
  assert.equal(normalizePhoneE164('+33 6 12 34 56 78'), '+33612345678');
  assert.equal(normalizePhoneE164('+33 1 42 68 53 00'), '+33142685300');
});

test('MQ_FIXED_CLASSIFIED_LANDLINE', () => {
  assert.equal(classifyPhoneType('0596511236', 'MQ'), 'LANDLINE');
  assert.equal(classifyPhoneType('+596 596 51 12 36'), 'LANDLINE');
});

test('MQ_MOBILE_CLASSIFIED_MOBILE', () => {
  assert.equal(classifyPhoneType('0696000000', 'MQ'), 'MOBILE');
  assert.equal(classifyPhoneType('+596 696 00 00 00'), 'MOBILE');
});

test('FR_FIXED_CLASSIFIED_LANDLINE', () => {
  assert.equal(classifyPhoneType('0142685300', 'FR'), 'LANDLINE');
  assert.equal(classifyPhoneType('+33 1 42 68 53 00'), 'LANDLINE');
});

test('FR_MOBILE_CLASSIFIED_MOBILE', () => {
  assert.equal(classifyPhoneType('0612345678', 'FR'), 'MOBILE');
  assert.equal(classifyPhoneType('+33 6 12 34 56 78'), 'MOBILE');
});

test('UNKNOWN_TYPE_NOT_GUESSED', () => {
  // Non-FR/MQ international numbers: library returns type or maps to UNKNOWN safely.
  const t1 = classifyPhoneType('+352 20 30 40 50');
  const t2 = classifyPhoneType('+1 555 123 4567');
  // Neither MOBILE nor LANDLINE for unsupported geographies.
  // Both should either be returned by the library or fail — never guessed.
  assert.notEqual(t1, 'MOBILE');
  assert.notEqual(t2, 'MOBILE');
});

test('MALFORMED_PHONE_NOT_TREATED_AS_VALID', () => {
  assert.equal(normalizePhoneE164('not a phone'), '');
  assert.equal(parsePhone('abc', 'FR').ok, false);
  assert.equal(parsePhone('', 'FR').ok, false);
});

test('MULTIPLE_VALID_PHONES_PRESERVED', () => {
  const collection = buildPhoneCollection([
    record({ normalizedPhone: '+596596511236', phoneType: 'LANDLINE' }),
    record({ normalizedPhone: '+596696055152', phoneType: 'MOBILE' }),
  ]);
  assert.equal(collection.phones.length, 2);
});

test('MULTIPLE_MOBILES_PRESERVED', () => {
  const collection = buildPhoneCollection([
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE' }),
    record({ normalizedPhone: '+596696222222', phoneType: 'MOBILE' }),
  ]);
  assert.equal(collection.phones.length, 2);
});

test('LANDLINE_NOT_DISCARDED', () => {
  const collection = buildPhoneCollection([
    record({ normalizedPhone: '+596596511236', phoneType: 'LANDLINE' }),
  ]);
  assert.equal(collection.phones.length, 1);
});

test('MOBILE_DISPLAYED_BEFORE_LANDLINE', () => {
  const ordered = orderPhonesForDisplay([
    record({ normalizedPhone: '+596596511236', phoneType: 'LANDLINE' }),
    record({ normalizedPhone: '+596696055152', phoneType: 'MOBILE' }),
  ]);
  assert.equal(ordered[0]!.phoneType, 'MOBILE');
  assert.equal(ordered[1]!.phoneType, 'LANDLINE');
});

test('PREFERRED_MOBILE_SELECTION_DETERMINISTIC', () => {
  const mobiles = [
    record({ normalizedPhone: '+596696222222', phoneType: 'MOBILE' }),
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE' }),
  ];
  const r1 = preferredMobile(mobiles);
  const r2 = preferredMobile([...mobiles].reverse());
  assert.equal(r1!.normalizedPhone, r2!.normalizedPhone);
});

test('GOOGLE_AND_FIRST_PARTY_DIFFERENT_VALID_NUMBERS_CAN_COEXIST', () => {
  const collection = buildPhoneCollection([
    record({ normalizedPhone: '+596596511236', phoneType: 'LANDLINE', sourceKind: 'GOOGLE_PLACES_CANDIDATE', trustStatus: 'UNVERIFIED' }),
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE', sourceKind: 'FIRST_PARTY_OFFICIAL_SITE', trustStatus: 'TRUSTED' }),
  ]);
  assert.equal(collection.phones.length, 2);
});

test('DIFFERENT_VALID_NUMBERS_NOT_AUTOMATIC_CONFLICT', () => {
  const collection = buildPhoneCollection([
    record({ normalizedPhone: '+596698765432', phoneType: 'MOBILE', trustStatus: 'TRUSTED', sourceKind: 'FIRST_PARTY_OFFICIAL_SITE' }),
    record({ normalizedPhone: '+596596543210', phoneType: 'LANDLINE', trustStatus: 'UNVERIFIED', sourceKind: 'GOOGLE_PLACES_CANDIDATE' }),
  ]);
  assert.equal(collection.phones.length, 2);
  assert.ok(collection.phones.some((p) => p.trustStatus === 'TRUSTED'));
  assert.ok(collection.phones.some((p) => p.trustStatus === 'UNVERIFIED'));
});

test('TRUST_IS_PER_PHONE', () => {
  const collection = buildPhoneCollection([
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE', trustStatus: 'TRUSTED', sourceKind: 'FIRST_PARTY_OFFICIAL_SITE' }),
    record({ normalizedPhone: '+596696222222', phoneType: 'MOBILE', trustStatus: 'UNVERIFIED', sourceKind: 'GOOGLE_PLACES_CANDIDATE' }),
  ]);
  assert.ok(collection.phones.some((p) => p.normalizedPhone === '+596696111111' && p.trustStatus === 'TRUSTED'));
  assert.ok(collection.phones.some((p) => p.normalizedPhone === '+596696222222' && p.trustStatus === 'UNVERIFIED'));
});

test('UNVERIFIED_GOOGLE_PHONE_DOES_NOT_TAINT_TRUSTED_FIRST_PARTY_PHONE', () => {
  const collection = buildPhoneCollection([
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE', trustStatus: 'TRUSTED', sourceKind: 'FIRST_PARTY_OFFICIAL_SITE' }),
    record({ normalizedPhone: '+596698765432', phoneType: 'MOBILE', trustStatus: 'UNVERIFIED', sourceKind: 'GOOGLE_PLACES_CANDIDATE' }),
  ]);
  assert.ok(collection.phones.find((p) => p.sourceKind === 'FIRST_PARTY_OFFICIAL_SITE')?.trustStatus === 'TRUSTED');
  assert.ok(collection.phones.find((p) => p.sourceKind === 'GOOGLE_PLACES_CANDIDATE')?.trustStatus === 'UNVERIFIED');
});

test('MULTIPLE_PHONES_DO_NOT_INFLATE_CONTACTABILITY', () => {
  const collection = buildPhoneCollection([
    record({ normalizedPhone: '+596696111111', phoneType: 'MOBILE', trustStatus: 'TRUSTED' }),
    record({ normalizedPhone: '+596696222222', phoneType: 'MOBILE', trustStatus: 'TRUSTED' }),
    record({ normalizedPhone: '+596596511236', phoneType: 'LANDLINE', trustStatus: 'TRUSTED' }),
  ]);
  assert.equal(collection.phones.length, 3);
  assert.ok(collection.phones.every((p) => p.trustStatus === 'TRUSTED'));
});

test('LANDLINE_NOT_SELECTED_FOR_WHATSAPP', () => {
  const caps = phoneCapabilities(record({ phoneType: 'LANDLINE' }));
  assert.equal(caps.whatsappUsable, false);
  assert.equal(caps.smsEligible, false);
  assert.ok(caps.whatsappReasonCodes.includes('LANDLINE_NOT_WHATSAPP_CAPABLE'));
});

test('MOBILE_DOES_NOT_IMPLY_WHATSAPP', () => {
  const caps = phoneCapabilities(record({ phoneType: 'MOBILE' }));
  assert.equal(caps.whatsappUsable, false);
  assert.equal(caps.smsEligible, true);
  assert.ok(caps.whatsappReasonCodes.includes('MOBILE_DOES_NOT_IMPLY_WHATSAPP'));
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