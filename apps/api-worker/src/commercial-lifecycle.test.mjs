import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialContentRef } from '@magicscript/core';
import { evaluateServerCommercialEdit, qualityLinkage } from './commercial-lifecycle.ts';

test('CP04 edit identity is separate from operational hash and exact to revision', () => {
  const candidate = { channel: 'EMAIL', subject: 'Subject', body: 'Bonjour Magic Script. https://demo.example.test/p', transportSignature: null, composition: 'EMAIL_ORIGINAL', assertions: [], catalogMentions: [], revision: 2, contentRef: '', approval: null };
  candidate.contentRef = commercialContentRef(candidate);
  assert.equal(candidate.contentRef, commercialContentRef(candidate));
  assert.notEqual(candidate.contentRef, 'm010-operational-hash');
});

test('CP04 linkage carries immutable context and revision fields', () => {
  const server = { context: { contextId: 'cpc-1', contextVersion: 'COMMERCIAL_PREPARATION_CONTEXT_V1', trace: { preparationVersion: 'CP04_PREPARATION_V1', cp02Version: 'CP02_QUALITY_GATE_V1' }, artifact: { buildArtifactId: 'build-1', version: 'PROPOSAL_V1' }, catalog: { version: 'CATALOG_V1' }, commercialState: 'STANDARD', vertical: { profile: 'LOCAL_SERVICES' } }, commercial: { channel: 'EMAIL' }, canonicalLink: 'https://example.test/p/1' };
  const candidate = { channel: 'EMAIL', subject: 'S', body: 'B', transportSignature: null, composition: 'EMAIL_ORIGINAL', assertions: [], catalogMentions: [], revision: 2, contentRef: 'cp04-ref', approval: null };
  const gate = { qualityGateVersion: 'AGENT3_COMMERCIAL_QUALITY_GATE_V1', decision: 'READY_FOR_OPERATOR', totalScore: 100, blockers: [], warnings: [], qualityDimensions: {}, contentIdentity: { revision: 2, fingerprint: 'x' } };
  const linkage = qualityLinkage(server, gate, candidate, 2, 1);
  assert.equal(linkage.contextId, 'cpc-1'); assert.equal(linkage.revision, 2); assert.equal(linkage.cp04ContentRef, 'cp04-ref');
});
