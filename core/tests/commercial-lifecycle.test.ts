import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCommercialBriefing,
  canTransition,
  commercialTransition,
  getNextAction,
  planInterestFollowups,
  stateForInboundClassification,
} from '../index';

const prospect = {
  companyName: 'Entreprise de test',
  activity: 'Sécurité',
  location: 'Fort-de-France',
  websiteUrl: 'https://example.test',
  primaryFriction: 'Parcours de contact peu lisible',
  primaryAsset: 'Expertise locale vérifiée',
};

test('activity is not explicit interest and positive interest never queues a prototype', () => {
  assert.equal(stateForInboundClassification('NO_INTEREST'), null);
  assert.equal(canTransition('PROTOTYPE_DEPLOYED', 'INTERESTED'), true);
  assert.equal(canTransition('POSITIVE_REPLY', 'PROTOTYPE_REQUIRED'), false);
  assert.equal(stateForInboundClassification('POSITIVE_INTEREST'), 'INTERESTED');
  assert.equal(getNextAction('INTERESTED'), 'ESCALATE_TO_HUMAN');
});

test('commercial briefing keeps the message, facts, unknowns, owner and history explicit', () => {
  const briefing = buildCommercialBriefing({
    source: 'inbound_message',
    prospect,
    contact: 'contact@example.test',
    message: 'Oui, je veux en savoir plus.',
    summary: 'Le prospect demande une présentation.',
    confidence: 96,
    prototype: { id: 'prototype-1', url: 'https://demo.example.test' },
    engagementHistory: [{ type: 'email.reply_received', createdAt: '2026-09-03T10:00:00.000Z' }],
  });

  assert.equal(briefing.owner, 'stephane');
  assert.equal(briefing.message, 'Oui, je veux en savoir plus.');
  assert.equal(briefing.primaryGap, prospect.primaryFriction);
  assert.equal(briefing.prototype?.url, 'https://demo.example.test');
  assert.deepEqual(briefing.unknowns, []);
  assert.equal(briefing.engagementHistory[0]?.type, 'email.reply_received');
  assert.equal(briefing.nextAction, 'HUMAN_REVIEW');
});

test('meeting booking and quote lifecycle stay human-gated and deposit is the won boundary', () => {
  assert.equal(commercialTransition('INTERESTED', 'MEETING_BOOKED').to, 'MEETING_BOOKED');
  assert.equal(commercialTransition('MEETING_BOOKED', 'QUOTE_DRAFTED').to, 'QUOTE_PENDING');
  assert.throws(
    () => commercialTransition('QUOTE_PENDING', 'QUOTE_ACCEPTED'),
    /quote acceptance proof reference/,
  );
  assert.equal(
    commercialTransition('QUOTE_PENDING', 'QUOTE_ACCEPTED', {
      quoteAcceptanceProofReference: 'acceptance-proof:fixture-1',
    }).to,
    'COMMITTED',
  );
  assert.equal(canTransition('COMMITTED', 'WON'), true);
  assert.throws(
    () => commercialTransition('COMMITTED', 'DEPOSIT_CONFIRMED'),
    /payment confirmation reference/,
  );
  assert.equal(
    commercialTransition('COMMITTED', 'DEPOSIT_CONFIRMED', {
      paymentConfirmationReference: 'fixture-payment-1',
    }).to,
    'WON',
  );
  assert.equal(canTransition('HUMAN_ACTION_REQUIRED', 'CLOSED_WON'), false);
});

test('interest follow-ups are bounded drafts and stop after a new inbound signal', () => {
  const interestAt = '2026-09-01T10:00:00.000Z';
  const j2 = planInterestFollowups({
    state: 'INTERESTED',
    interestAt,
    now: '2026-09-03T10:00:00.000Z',
    firstDraftPrepared: false,
    secondDraftPrepared: false,
    hasNewInbound: false,
  });
  assert.deepEqual(j2.map((action) => action.kind === 'PREPARE_DRAFT' && action.sequence), [1]);

  const j7 = planInterestFollowups({
    state: 'INTERESTED',
    interestAt,
    now: '2026-09-08T10:00:00.000Z',
    firstDraftPrepared: true,
    secondDraftPrepared: false,
    hasNewInbound: false,
  });
  assert.deepEqual(
    j7.map((action) => (action.kind === 'PREPARE_DRAFT' ? action.sequence : action.kind)),
    [2, 'MARK_DORMANT'],
  );

  assert.deepEqual(
    planInterestFollowups({
      state: 'INTERESTED',
      interestAt,
      now: '2026-09-05T10:00:00.000Z',
      firstDraftPrepared: true,
      secondDraftPrepared: false,
      hasNewInbound: true,
    }),
    [],
  );
  assert.deepEqual(
    planInterestFollowups({
      state: 'DO_NOT_CONTACT',
      interestAt,
      now: '2026-09-08T10:00:00.000Z',
      firstDraftPrepared: false,
      secondDraftPrepared: false,
      hasNewInbound: false,
    }),
    [],
  );
});
