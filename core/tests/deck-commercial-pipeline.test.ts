import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ACTIVE_PRODUCTION_PROSPECTS,
  activeProductionCount,
  hasActiveProductionCapacity,
  projectDeckCommercialPipeline,
  projectDeckCommercialStage,
} from '../orchestrator/deck-commercial-pipeline';

const p = (id: string, state: string) => ({ id, state: state as never });

test('commercial stage projection is deterministic and maps human pipeline states', () => {
  assert.equal(projectDeckCommercialStage('DISCOVERED'), 'A_CONTACTER');
  assert.equal(projectDeckCommercialStage('EMAIL_SENT'), 'ENVOYES');
  assert.equal(projectDeckCommercialStage('WAITING_REPLY'), 'RELANCES');
  assert.equal(projectDeckCommercialStage('MEETING_BOOKED'), 'RDV');
  assert.equal(projectDeckCommercialStage('QUOTE_PENDING'), 'DEVIS');
  assert.equal(projectDeckCommercialStage('WON'), 'GAGNES');
  assert.equal(projectDeckCommercialStage('CLOSED_LOST'), 'PERDUS');
  assert.deepEqual(projectDeckCommercialPipeline({ prospect: p('a', 'DISCOVERED') }), projectDeckCommercialPipeline({ prospect: p('a', 'DISCOVERED') }));
});

test('active pre-contact production states consume a slot; contacted and later states do not', () => {
  assert.equal(projectDeckCommercialPipeline({ prospect: p('a', 'PROTOTYPE_REQUIRED') }).activeSlot, true);
  assert.equal(projectDeckCommercialPipeline({ prospect: p('b', 'CONTACTED') }).activeSlot, false);
  assert.equal(projectDeckCommercialPipeline({ prospect: p('c', 'MEETING_BOOKED') }).activeSlot, false);
  assert.equal(projectDeckCommercialPipeline({ prospect: p('d', 'QUOTE_PENDING') }).activeSlot, false);
  assert.equal(projectDeckCommercialPipeline({ prospect: p('e', 'FOLLOW_UP_DUE') }).activeSlot, false);
});

test('unsupported state fails closed and archive is not falsely projected without authority', () => {
  const unsupported = projectDeckCommercialPipeline({ prospect: p('u', 'NOT_A_CANONICAL_STATE') });
  assert.equal(unsupported.commercialStage, null);
  assert.equal(unsupported.productionEligible, false);
  assert.equal(unsupported.productionEligibilityReason, 'UNSUPPORTED_STATE');
  const archived = projectDeckCommercialPipeline({ prospect: p('a', 'ARCHIVED') });
  assert.equal(archived.commercialStage, null);
  assert.equal(archived.productionEligible, false);
  assert.equal(archived.productionEligibilityReason, 'UNSUPPORTED_STATE');
});

test('twenty is a hard active production capacity boundary', () => {
  const twenty = Array.from({ length: MAX_ACTIVE_PRODUCTION_PROSPECTS }, (_, i) => `p${i}`);
  assert.equal(activeProductionCount(twenty.map(() => 'PROTOTYPE_REQUIRED')), 20);
  assert.equal(hasActiveProductionCapacity(twenty.map(() => 'PROTOTYPE_REQUIRED')), false);
  assert.equal(hasActiveProductionCapacity([...twenty.slice(1).map(() => 'PROTOTYPE_REQUIRED')]), true);
});

test('projection preserves existing Proposal/readiness without adding technical authority', () => {
  const projected = projectDeckCommercialPipeline({
    prospect: p('proposal', 'PROTOTYPE_DEPLOYED'),
    proposal: { ready: true, entryPath: '/p/canonical' },
    contactability: { available: true, channels: ['EMAIL'] },
  });
  assert.deepEqual(projected.proposal, { ready: true, entryPath: '/p/canonical' });
  assert.equal('hash' in projected, false);
  assert.equal('score' in projected, false);
  assert.equal('salesRoom' in projected, false);
});
