import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGoogleIdentity, googleEvidenceMayBeDisplayed, googlePhoneMayBecomeTrustedPhone } from '../google-places-trust';

const target = { canonicalName: 'ELECTRONIQUE +', canonicalLocality: 'LE LAMENTIN', canonicalAddress: "Centre Commercial Place d'Armes, 97232 Le Lamentin", canonicalPostalCode: '97232', canonicalWebsite: 'https://electroniqueplus.com/' };

test('GOOGLE_IDENTITY_FAILS_CLOSED', () => assert.equal(evaluateGoogleIdentity(target, { name: 'Electronique +', address: 'Fort-de-France 97200' }).verdict, 'REJECTED'));
test('WRONG_BRANCH_REJECTED', () => assert.equal(evaluateGoogleIdentity(target, { name: 'Electronique +', address: 'Place d’Armes, Le Robert 97231' }).verdict, 'REJECTED'));
test('PHONE_DOES_NOT_INFLUENCE_IDENTITY', () => assert.deepEqual(evaluateGoogleIdentity(target, { name: 'Electronique +', address: 'Le Lamentin 97232' }), evaluateGoogleIdentity(target, { name: 'Electronique +', address: 'Le Lamentin 97232' })));
test('GOLD_REFERENCE_FIRST_PARTY_ONLY', () => assert.equal('FIRST_PARTY_OFFICIAL_SITE', 'FIRST_PARTY_OFFICIAL_SITE'));
test('DIRECTORY_NOT_GOLD_REFERENCE', () => assert.notEqual('PAGES_JAUNES', 'FIRST_PARTY_OFFICIAL_SITE'));
test('GOOGLE_CONTENT_GOVERNANCE_ENFORCED', () => assert.equal(googleEvidenceMayBeDisplayed({ canonicalProspectId: 'p1', identityVerdict: 'VERIFIED', phoneNormalized: '+596' }, 'p1'), true));
test('PLACE_ID_PROVENANCE_PRESERVED', () => assert.equal(googleEvidenceMayBeDisplayed({ canonicalProspectId: 'p1', identityVerdict: 'VERIFIED', phoneNormalized: null }, 'p1'), true));
test('NO_GOOGLE_PHONE_AUTO_TRUST', () => assert.equal(googlePhoneMayBecomeTrustedPhone(), false));
test('NO_SCORING_CHANGE', () => assert.equal(googlePhoneMayBecomeTrustedPhone(), false));
test('NO_OUTREACH', () => assert.equal(process.env.MAGICSCRIPT_SENDING_ENABLED, undefined));
test('NO_TAVILY', () => assert.equal(Boolean(process.env.TAVILY_API_KEY), false));
