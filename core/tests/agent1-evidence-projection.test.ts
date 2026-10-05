import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  projectAgent1EvidenceToContactOpportunityPackV2,
  type Agent1QualifiedEvidence,
} from '../admission/agent1-evidence-projection';
import { decidePackIcp } from '../icp/icp-decision';
import { extractDigitalPainEvidence } from '../research/digital-pain-evidence';

const painSource = { url: 'https://lecoin.example/', note: 'Fetched owned homepage', supports: ['website', 'digitalGap'] as const };
const painHtml = '<title>Site en construction</title>';
const typedPain = extractDigitalPainEvidence([painSource], [{ url: painSource.url, html: painHtml, snapshotDigest: `sha256:${createHash('sha256').update(painHtml).digest('hex')}` }]);

function evidence(overrides: Partial<Agent1QualifiedEvidence> = {}): Agent1QualifiedEvidence {
  return {
    prospectId: 'prospect-1', qualified: true, qualificationState: 'QUALIFIED',
    identity: { businessName: 'Restaurant Le Coin', city: 'Fort-de-France', location: 'Martinique', sourceRefs: ['source-identity'] },
    research: {
      acceptedSources: [painSource],
      supportedClaims: ['website', 'digitalGap'],
      website: { status: 'VERIFIED_PRESENT', url: 'https://lecoin.example' },
      digitalPainSignals: ['Site en construction'],
      digitalPainEvidence: typedPain,
    },
    classification: { commercialFamily: 'RESTAURANTS_BARS_CAFES', sourceRefs: ['source-family'] },
    contacts: [{ channel: 'EMAIL', value: 'hello@lecoin.example', validated: true, evidenceRef: 'contact-source' }],
    ...overrides,
  };
}

test('qualified weak restaurant projects and reaches canonical ADMIT', () => {
  const result = projectAgent1EvidenceToContactOpportunityPackV2(evidence());
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') assert.equal(decidePackIcp(result.pack).outcome, 'ADMIT');
});

test('legacy qualification flags alone cannot veto complete V2 evidence', () => {
  const result = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ qualified: false, qualificationState: 'OTHER' }));
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') assert.equal(decidePackIcp(result.pack).outcome, 'ADMIT');
});

test('raw discovery without website research fails closed', () => {
  const result = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ qualified: false, qualificationState: 'DISCOVERED', research: { ...evidence().research, website: undefined } }));
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
  if (result.status === 'INSUFFICIENT_EVIDENCE') assert.ok(result.reasons.some((reason) => reason.code === 'WEBSITE_STATUS_UNVERIFIED'));
});

test('provider missing website field is not verified absence', () => {
  const result = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ research: { ...evidence().research, website: { status: 'UNKNOWN' } } }));
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
});

test('fit and pain with no qualifying contact yields NEEDS_CONTACT_DISCOVERY', () => {
  const result = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ contacts: [{ channel: 'LANDLINE', value: '0596511236', validated: true, evidenceRef: 'contact-source' }] }));
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') assert.equal(decidePackIcp(result.pack).outcome, 'NEEDS_CONTACT_DISCOVERY');
});

test('unresolved pain cannot reach contact discovery', () => {
  const result = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ research: { ...evidence().research, digitalPainSignals: ['Narrative only'], digitalPainEvidence: undefined } }));
  assert.equal(result.status, 'INSUFFICIENT_EVIDENCE');
});

test('cultural institution is projected as explicit outside ICP', () => {
  const result = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ research: { ...evidence().research, outsideCommercialIcp: true }, classification: { commercialFamily: 'LOCAL_SERVICES', sourceRefs: ['source-family'] } }));
  assert.equal(result.status, 'PROJECTABLE');
  if (result.status === 'PROJECTABLE') assert.equal(decidePackIcp(result.pack).outcome, 'REJECT');
});

test('55.20Z unknown operating model fails closed and seasonal rental rejects', () => {
  const unknown = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ classification: { commercialFamily: 'LOCAL_SERVICES', nafCode: '55.20Z', sourceRefs: ['source-family'] } }));
  assert.equal(unknown.status, 'INSUFFICIENT_EVIDENCE');
  const seasonal = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ classification: { commercialFamily: 'LOCAL_SERVICES', nafCode: '55.20Z', sourceRefs: ['source-family'] }, research: { ...evidence().research, operatingModel: 'SEASONAL_AIRBNB_RENTAL' } }));
  assert.equal(seasonal.status, 'PROJECTABLE');
  if (seasonal.status === 'PROJECTABLE') assert.equal(decidePackIcp(seasonal.pack).outcome, 'REJECT');
});

test('legacy taxonomy is never emitted as canonical family; NAF 47 resolves retail', () => {
  const legacy = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ classification: { commercialFamily: 'HOSPITALITY', sourceRefs: ['source-family'] } }));
  assert.equal(legacy.status, 'INSUFFICIENT_EVIDENCE');
  const retail = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ classification: { nafCode: '47.78C', sourceRefs: ['source-family'] } }));
  assert.equal(retail.status, 'PROJECTABLE');
  if (retail.status === 'PROJECTABLE') assert.equal(retail.pack.opportunity.icp?.commercialFamily, 'LOCAL_RETAIL');
});

test('unproven capability and professional site preserve canonical gates', () => {
  const capability = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ research: { ...evidence().research, requiresUnprovenCapability: true } }));
  assert.equal(capability.status, 'PROJECTABLE');
  if (capability.status === 'PROJECTABLE') assert.equal(decidePackIcp(capability.pack).outcome, 'CAPABILITY_GATED');
  const quality = projectAgent1EvidenceToContactOpportunityPackV2(evidence({ research: { ...evidence().research, websiteQuality: { isProfessional: true } } }));
  assert.equal(quality.status, 'PROJECTABLE');
  if (quality.status === 'PROJECTABLE') assert.equal(decidePackIcp(quality.pack).outcome, 'QUALITY_GATED');
});
