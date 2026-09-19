import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getActionableContactPreparation,
  projectBusinessUnitVisibility,
  projectActiveCommercialDeck,
  projectOperatorProspectQueue,
  projectSyntheticCreativeTrace,
  type ContactabilityChannel,
  type Escalation,
  type Job,
  type LiveEvent,
  type MeetingSummary,
  type ProspectSummary,
  type PrototypeSummary,
  type SalesRoomSummary,
} from './api';

const emailWithoutPhoneProvenance: ContactabilityChannel = {
  contactId: 'email-type-witness',
  prospectId: 'prospect-type-witness',
  type: 'EMAIL',
  value: 'type-witness@example.fr',
  observedAt: '2026-09-09T08:00:00.000Z',
  status: 'PUBLISHED_VERIFIED',
  usableForFirstOutreach: true,
};

// @ts-expect-error PHONE provenance cannot omit sourceUrl and evidenceEventId.
const phoneWithoutMandatoryProvenance: ContactabilityChannel = {
  contactId: 'phone-type-witness',
  prospectId: 'prospect-type-witness',
  type: 'PHONE',
  value: '05 96 71 10 10',
  observedAt: '2026-09-09T08:00:00.000Z',
  status: 'PUBLISHED_VERIFIED',
  usableForFirstOutreach: true,
};

void emailWithoutPhoneProvenance;
void phoneWithoutMandatoryProvenance;

function contactability(
  prospectId: string,
  status: 'PUBLISHED_VERIFIED' | 'UNVERIFIED' | 'OPPOSED' | 'MISSING',
): ProspectSummary['contactability'] {
  if (status === 'MISSING') {
    return {
      identity: { prospectId },
      status,
      channels: [],
      preparation: null,
    };
  }

  const usable = status === 'PUBLISHED_VERIFIED';
  return {
    identity: { prospectId },
    status,
    channels: [
      {
        contactId: `contact-${prospectId}`,
        prospectId,
        type: 'EMAIL',
        value: `${prospectId}@example.fr`,
        sourceUrl: 'https://example.fr/contact',
        sourceType: 'official_site',
        observedAt: '2026-09-09T08:00:00.000Z',
        status,
        usableForFirstOutreach: usable,
      },
    ],
    preparation: usable
      ? {
          kind: 'EMAIL_DRAFT',
          contactId: `contact-${prospectId}`,
          recipient: `${prospectId}@example.fr`,
          subject: 'Test',
          body: 'Test',
          mailtoHref: `mailto:${prospectId}@example.fr`,
          requiresHumanSend: true,
          sendsAutomatically: false,
        }
      : null,
  };
}

function prospect(
  id: string,
  category: ProspectSummary['commercialView']['category'],
  state = 'QUALIFIED',
): ProspectSummary {
  return {
    id,
    companyName: id.toUpperCase(),
    state,
    commercialView: {
      category,
      gateVersion: category === 'CURRENT' || category === 'REJECTED'
        ? 'COMMERCIAL_ELIGIBILITY_V2.6.0'
        : null,
      reason: category === 'CURRENT'
        ? 'CURRENT_GATE_ELIGIBLE'
        : category === 'LEGACY'
          ? 'PRE_GATE_OR_UNVERSIONED'
          : category === 'INTERNAL'
            ? 'SYNTHETIC_METADATA'
            : 'CURRENT_GATE_REJECTED',
    },
    updatedAt: '2026-09-09T08:00:00.000Z',
  };
}

function phoneProspect(id = 'phone-prospect'): ProspectSummary {
  const item = prospect(id, 'CURRENT', 'QUALIFIED');
  item.phone = '05 96 71 10 10';
  item.contactability = {
    identity: { prospectId: id },
    status: 'PUBLISHED_VERIFIED',
    channels: [
      {
        contactId: `phone-${id}`,
        prospectId: id,
        type: 'PHONE',
        value: item.phone,
        sourceUrl: 'https://example.fr/contact',
        observedAt: '2026-09-09T08:00:00.000Z',
        evidenceEventId: `evidence-${id}`,
        status: 'PUBLISHED_VERIFIED',
        usableForFirstOutreach: true,
      },
    ],
    preparation: {
      kind: 'PHONE_CALL_PREPARATION',
      contactId: `phone-${id}`,
      evidenceEventId: `evidence-${id}`,
      phone: item.phone,
      sourceUrl: 'https://example.fr/contact',
      requiresHumanDial: true,
      dialsAutomatically: false,
    },
  };
  return item;
}

function cloneProspect(item: ProspectSummary): ProspectSummary {
  return JSON.parse(JSON.stringify(item)) as ProspectSummary;
}

test('projects BU visibility without inferring UNKNOWN routing', () => {
  const known = prospect('known-bu', 'CURRENT');
  known.hubId = 'BTP';
  known.businessUnit = 'BU BTP';
  const unknown = prospect('unknown-bu', 'CURRENT');
  const result = projectBusinessUnitVisibility(
    [known, unknown],
    [
      {
        id: 'job-known', kind: 'BUILD_PROTOTYPE', prospectId: known.id,
        status: 'RUNNING', attempts: 1, runAfter: '', createdAt: '', updatedAt: '',
      },
      {
        id: 'job-unknown', kind: 'BUILD_PROTOTYPE', prospectId: unknown.id,
        status: 'RUNNING', attempts: 1, runAfter: '', createdAt: '', updatedAt: '',
      },
    ],
  );
  assert.equal(result.rows.find((row) => row.key === 'BTP')?.prospectCount, 1);
  assert.equal(result.rows.find((row) => row.key === 'BTP')?.activeJobCount, 1);
  assert.equal(result.unknown.prospectCount, 1);
  assert.equal(result.unknown.activeJobCount, 1);
  assert.equal(result.unknown.businessUnit, 'UNKNOWN');
});

function preparationRecord(item: ProspectSummary): Record<string, unknown> {
  return item.contactability?.preparation as unknown as Record<string, unknown>;
}

function firstChannelRecord(item: ProspectSummary): Record<string, unknown> {
  return item.contactability?.channels[0] as unknown as Record<string, unknown>;
}

function assertNotContactReady(item: ProspectSummary): void {
  assert.equal(getActionableContactPreparation(item), null);
  assert.equal(
    projectOperatorProspectQueue([item]).entries.some(
      (entry) => entry.nextAction === 'PRÊT À CONTACTER',
    ),
    false,
  );
}

function prototype(prospectId: string): PrototypeSummary {
  return {
    id: `prototype-${prospectId}`,
    prospect_id: prospectId,
    company_name: prospectId.toUpperCase(),
    status: 'READY',
    updated_at: '2026-09-09T08:00:00.000Z',
  };
}

function salesRoom(prospectId: string): SalesRoomSummary {
  return {
    prospectId,
    companyName: prospectId.toUpperCase(),
    slug: prospectId,
    status: 'ACTIVE',
    prototypeUrl: null,
    prototypeEntryPath: `/prototype/${prospectId}`,
    salesRoomPath: `/p/${prospectId}`,
    salesRoomUrl: null,
    ctaTarget: 'SALES_ROOM',
    createdAt: '2026-09-09T08:00:00.000Z',
    lastActivityAt: '2026-09-09T08:00:00.000Z',
    reviewDueAt: null,
    reviewDue: false,
    shareClicks: 0,
    lastResolutionError: null,
  };
}

function escalation(prospectId: string): Escalation {
  return {
    id: `escalation-${prospectId}`,
    prospect_id: prospectId,
    category: 'INTERESTED',
    summary: `Company: ${prospectId}`,
    status: 'OPEN',
    created_at: '2026-09-09T08:00:00.000Z',
  };
}

function meeting(prospectId: string): MeetingSummary {
  return {
    meetingId: `meeting-${prospectId}`,
    prospectId,
    companyName: prospectId.toUpperCase(),
    salesRoomSlug: prospectId,
    communicationMode: 'phone',
    startAtUtc: '2026-09-10T08:00:00.000Z',
    endAtUtc: '2026-09-10T08:30:00.000Z',
    prospectTimezone: 'Europe/Paris',
    prospectTime: '10:00',
    parisTime: '10:00',
    phone: '0000000000',
    status: 'CONFIRMED',
    confirmedAt: '2026-09-09T08:00:00.000Z',
    cancelledAt: null,
    rescheduledFromId: null,
    createdAt: '2026-09-09T08:00:00.000Z',
    updatedAt: '2026-09-09T08:00:00.000Z',
  };
}

function event(id: string, prospectId?: string): LiveEvent {
  return {
    id,
    prospectId,
    actor: 'test',
    type: 'sales_room.share_clicked',
    payload: {},
    createdAt: '2026-09-09T08:00:00.000Z',
  };
}

function job(id: string, prospectId?: string): Job {
  return {
    id,
    prospectId,
    kind: 'RUN_RESEARCH_SWARM',
    status: 'RUNNING',
    attempts: 1,
    runAfter: '2026-09-09T08:00:00.000Z',
    createdAt: '2026-09-09T08:00:00.000Z',
    updatedAt: '2026-09-09T08:00:00.000Z',
  };
}

test('H4 accepts an identity-bound PHONE preparation and keeps it manual', () => {
  const item = phoneProspect();
  const preparation = getActionableContactPreparation(item);

  assert.equal(preparation?.kind, 'PHONE_CALL_PREPARATION');
  assert.equal(
    preparation?.kind === 'PHONE_CALL_PREPARATION'
      ? preparation.requiresHumanDial
      : null,
    true,
  );
  assert.equal(
    preparation?.kind === 'PHONE_CALL_PREPARATION'
      ? preparation.dialsAutomatically
      : null,
    false,
  );
  assert.equal(
    projectOperatorProspectQueue([item]).entries[0]?.nextAction,
    'PRÊT À CONTACTER',
  );
});

test('H4 preserves valid human-send-only EMAIL behavior', () => {
  const item = prospect('email-prospect', 'CURRENT', 'QUALIFIED');
  item.contactability = contactability(item.id, 'PUBLISHED_VERIFIED');
  const preparation = getActionableContactPreparation(item);

  assert.equal(preparation?.kind, 'EMAIL_DRAFT');
  assert.equal(
    preparation?.kind === 'EMAIL_DRAFT' ? preparation.requiresHumanSend : null,
    true,
  );
  assert.equal(
    preparation?.kind === 'EMAIL_DRAFT' ? preparation.sendsAutomatically : null,
    false,
  );
  assert.equal(
    projectOperatorProspectQueue([item]).entries[0]?.nextAction,
    'PRÊT À CONTACTER',
  );
});

test('H4 keeps EMAIL preferred when verified EMAIL and PHONE coexist', () => {
  const item = prospect('dual-channel', 'CURRENT', 'QUALIFIED');
  item.contactability = contactability(item.id, 'PUBLISHED_VERIFIED');
  item.contactability?.channels.push({
    contactId: 'phone-dual-channel',
    prospectId: item.id,
    type: 'PHONE',
    value: '05 96 71 10 10',
    sourceUrl: 'https://example.fr/phone',
    observedAt: '2026-09-09T08:00:00.000Z',
    evidenceEventId: 'evidence-dual-channel',
    status: 'PUBLISHED_VERIFIED',
    usableForFirstOutreach: true,
  });

  assert.equal(getActionableContactPreparation(item)?.kind, 'EMAIL_DRAFT');
});

const invalidPhoneCases: Array<{
  name: string;
  mutate: (item: ProspectSummary) => void;
}> = [
  {
    name: 'wrong contactability prospect identity',
    mutate: (item) => {
      item.contactability!.identity.prospectId = 'different-prospect';
    },
  },
  {
    name: 'wrong channel prospect identity',
    mutate: (item) => {
      firstChannelRecord(item).prospectId = 'different-prospect';
    },
  },
  {
    name: 'channel mismatch',
    mutate: (item) => {
      firstChannelRecord(item).type = 'EMAIL';
    },
  },
  {
    name: 'PHONE contactId mismatch',
    mutate: (item) => {
      preparationRecord(item).contactId = 'different-contact';
    },
  },
  {
    name: 'PHONE evidenceEventId missing',
    mutate: (item) => {
      delete preparationRecord(item).evidenceEventId;
    },
  },
  {
    name: 'PHONE evidenceEventId mismatch',
    mutate: (item) => {
      preparationRecord(item).evidenceEventId = 'different-evidence';
    },
  },
  {
    name: 'PHONE sourceUrl missing',
    mutate: (item) => {
      delete preparationRecord(item).sourceUrl;
    },
  },
  {
    name: 'PHONE sourceUrl invalid',
    mutate: (item) => {
      preparationRecord(item).sourceUrl = 'not-a-public-url';
      firstChannelRecord(item).sourceUrl = 'not-a-public-url';
    },
  },
  {
    name: 'PHONE requiresHumanDial is not true',
    mutate: (item) => {
      preparationRecord(item).requiresHumanDial = false;
    },
  },
  {
    name: 'PHONE dialsAutomatically is not false',
    mutate: (item) => {
      preparationRecord(item).dialsAutomatically = true;
    },
  },
];

for (const invalidCase of invalidPhoneCases) {
  test(`H4 fails closed for ${invalidCase.name}`, () => {
    const item = cloneProspect(phoneProspect());
    invalidCase.mutate(item);
    assertNotContactReady(item);
  });
}

test('H4 fails closed for DO_NOT_CONTACT even with a valid preparation', () => {
  const item = phoneProspect();
  item.state = 'DO_NOT_CONTACT';
  assertNotContactReady(item);
});

test('H4 fails closed for OPPOSED contactability', () => {
  const item = phoneProspect();
  item.contactability!.status = 'OPPOSED';
  assertNotContactReady(item);
});

test('H4 fails closed when preparation is missing', () => {
  const item = phoneProspect();
  item.contactability!.preparation = null;
  assertNotContactReady(item);
});

test('H4 fails closed when preparation is malformed', () => {
  const item = phoneProspect();
  item.contactability!.preparation = {
    kind: 'PHONE_CALL_PREPARATION',
    contactId: `phone-${item.id}`,
  } as unknown as NonNullable<ProspectSummary['contactability']>['preparation'];
  assertNotContactReady(item);
});

test('H4 rejects automatic EMAIL preparation', () => {
  const item = prospect('automatic-email', 'CURRENT', 'QUALIFIED');
  item.contactability = contactability(item.id, 'PUBLISHED_VERIFIED');
  preparationRecord(item).sendsAutomatically = true;
  assertNotContactReady(item);
});

test('active commercial deck keeps CURRENT links and excludes every non-current category', () => {
  const prospects = [
    prospect('current', 'CURRENT', 'WAITING_REPLY'),
    prospect('legacy', 'LEGACY', 'FOLLOW_UP_DUE'),
    prospect('internal', 'INTERNAL', 'INTERESTED'),
    prospect('rejected', 'REJECTED', 'MEETING_BOOKED'),
  ];
  const linkedIds = prospects.map((item) => item.id);
  const projection = projectActiveCommercialDeck({
    prospects,
    prototypes: linkedIds.map(prototype),
    salesRooms: linkedIds.map(salesRoom),
    escalations: linkedIds.map(escalation),
    meetings: linkedIds.map(meeting),
    recentEvents: [
      ...linkedIds.map((id) => event(`event-${id}`, id)),
      event('system-event'),
    ],
    runningJobs: [
      ...linkedIds.map((id) => job(`job-${id}`, id)),
      job('system-job'),
    ],
  });

  assert.deepEqual(projection.prospects.map((item) => item.id), ['current']);
  assert.deepEqual(projection.qualifiedProspects.map((item) => item.id), ['current']);
  assert.deepEqual(projection.waitingReplyProspects.map((item) => item.id), ['current']);
  assert.equal(projection.followupDueProspects.length, 0);
  assert.deepEqual(projection.prototypes.map((item) => item.prospect_id), ['current']);
  assert.deepEqual(projection.salesRooms.map((item) => item.prospectId), ['current']);
  assert.deepEqual(projection.escalations.map((item) => item.prospect_id), ['current']);
  assert.deepEqual(projection.meetings.map((item) => item.prospectId), ['current']);
  assert.deepEqual(projection.prospectEvents.map((item) => item.prospectId), ['current']);
  assert.deepEqual(
    projection.operationalEvents.map((item) => item.id),
    ['event-current', 'system-event'],
  );
  assert.deepEqual(
    projection.operationalJobs.map((item) => item.id),
    ['job-current', 'system-job'],
  );
  assert.equal(projection.stateCounts.WAITING_REPLY, 1);
  assert.equal(prospects.length, 4, 'historical source records remain preserved');
});

test('active commercial deck exposes latest prototype jobs and strategy status for CURRENT prospects only', () => {
  const current = prospect('current', 'CURRENT', 'PROTOTYPE_BUILDING');
  const legacy = prospect('legacy', 'LEGACY', 'PROTOTYPE_READY');
  const strategyOld: Job = {
    ...job('strategy-old', current.id),
    kind: 'GENERATE_PROTOTYPE_STRATEGY',
    status: 'SUCCEEDED',
    updatedAt: '2026-09-09T08:00:00.000Z',
  };
  const strategyLatest: Job = {
    ...strategyOld,
    id: 'strategy-latest',
    status: 'FAILED',
    updatedAt: '2026-09-09T09:00:00.000Z',
  };
  const buildLatest: Job = {
    ...job('build-latest', current.id),
    kind: 'BUILD_PROTOTYPE',
    status: 'RUNNING',
    updatedAt: '2026-09-09T10:00:00.000Z',
  };
  const projection = projectActiveCommercialDeck({
    prospects: [current, legacy],
    prototypes: [],
    salesRooms: [],
    escalations: [],
    meetings: [],
    recentEvents: [],
    runningJobs: [],
    prototypeJobs: [strategyOld, strategyLatest, buildLatest, { ...strategyLatest, id: 'legacy-strategy', prospectId: legacy.id }],
  });

  assert.deepEqual(projection.prototypeJobs.map((item) => item.id), [
    'strategy-old', 'strategy-latest', 'build-latest',
  ]);
  assert.deepEqual(projection.latestPrototypeJobs.map((item) => item.id), ['build-latest']);
  assert.deepEqual(projection.prototypeStrategyStatus, { [current.id]: 'FAILED' });
});

test('empty CURRENT is a valid zero state and never falls back to history', () => {
  const historicalProspects = [
    prospect('legacy', 'LEGACY', 'WAITING_REPLY'),
    prospect('internal', 'INTERNAL', 'FOLLOW_UP_DUE'),
    prospect('rejected', 'REJECTED', 'INTERESTED'),
  ];
  const projection = projectActiveCommercialDeck({
    prospects: historicalProspects,
    prototypes: historicalProspects.map((item) => prototype(item.id)),
    salesRooms: historicalProspects.map((item) => salesRoom(item.id)),
    escalations: historicalProspects.map((item) => escalation(item.id)),
    meetings: historicalProspects.map((item) => meeting(item.id)),
    recentEvents: historicalProspects.map((item) => event(`event-${item.id}`, item.id)),
    runningJobs: historicalProspects.map((item) => job(`job-${item.id}`, item.id)),
  });

  assert.equal(projection.prospects.length, 0);
  assert.equal(projection.qualifiedProspects.length, 0);
  assert.equal(projection.waitingReplyProspects.length, 0);
  assert.equal(projection.followupDueProspects.length, 0);
  assert.equal(projection.prototypes.length, 0);
  assert.equal(projection.salesRooms.length, 0);
  assert.equal(projection.escalations.length, 0);
  assert.equal(projection.meetings.length, 0);
  assert.equal(projection.prospectEvents.length, 0);
  assert.equal(projection.operationalEvents.length, 0);
  assert.equal(projection.operationalJobs.length, 0);
  assert.deepEqual(projection.stateCounts, {});
  assert.deepEqual(
    historicalProspects.map((item) => item.commercialView.category),
    ['LEGACY', 'INTERNAL', 'REJECTED'],
  );
});

test('operator queue separates actionable CURRENT and pre-current work from active metrics', () => {
  const currentHuman = prospect('current-human', 'CURRENT', 'HUMAN_ACTION_REQUIRED');
  currentHuman.contactability = contactability(currentHuman.id, 'PUBLISHED_VERIFIED');
  const currentQualified = prospect('current-qualified', 'CURRENT', 'QUALIFIED');
  currentQualified.contactability = contactability(currentQualified.id, 'MISSING');
  const legacyDiscovered = prospect('legacy-discovered', 'LEGACY', 'DISCOVERED');
  legacyDiscovered.sourceUrl = 'https://annuaire.example/legacy-discovered';
  legacyDiscovered.contactability = contactability(legacyDiscovered.id, 'MISSING');
  const legacyQualified = prospect('legacy-qualified', 'LEGACY', 'QUALIFIED');
  legacyQualified.sourceUrl = 'https://annuaire.example/legacy-qualified';
  legacyQualified.contactability = contactability(legacyQualified.id, 'UNVERIFIED');
  const legacyContactFound = prospect('legacy-contact', 'LEGACY', 'CONTACT_FOUND');
  legacyContactFound.contactability = contactability(
    legacyContactFound.id,
    'PUBLISHED_VERIFIED',
  );
  const internal = prospect('internal', 'INTERNAL', 'DISCOVERED');
  internal.contactability = contactability(internal.id, 'MISSING');
  const rejected = prospect('rejected', 'REJECTED', 'CONTACT_FOUND');
  rejected.contactability = contactability(rejected.id, 'PUBLISHED_VERIFIED');
  const opposed = prospect('legacy-opposed', 'LEGACY', 'QUALIFIED');
  opposed.sourceUrl = 'https://annuaire.example/legacy-opposed';
  opposed.contactability = contactability(opposed.id, 'OPPOSED');
  const prospects = [
    currentQualified,
    legacyQualified,
    internal,
    legacyDiscovered,
    legacyContactFound,
    rejected,
    opposed,
    currentHuman,
  ];

  const queue = projectOperatorProspectQueue(prospects);
  const active = projectActiveCommercialDeck({
    prospects,
    prototypes: [],
    salesRooms: [],
    escalations: [],
    meetings: [],
    recentEvents: [],
    runningJobs: [],
  });

  assert.deepEqual(
    queue.entries.map((entry) => [entry.prospect.id, entry.nextAction]),
    [
      ['current-human', 'À VALIDER'],
      ['current-qualified', 'À ENRICHIR'],
      ['legacy-contact', 'À VALIDER'],
      ['legacy-discovered', 'À QUALIFIER'],
      ['legacy-qualified', 'À VÉRIFIER'],
    ],
  );
  assert.equal(queue.currentCount, 2);
  assert.equal(queue.preCurrentCount, 3);
  assert.deepEqual(active.prospects.map((item) => item.id).sort(), [
    'current-human',
    'current-qualified',
  ]);
});

test('valid no-contact DISCOVERED intake is available but does not inflate CURRENT', () => {
  const discovered = prospect('new-discovery', 'LEGACY', 'DISCOVERED');
  discovered.siren = '123456789';
  discovered.siret = '12345678900011';
  discovered.sourceUrl =
    'https://annuaire-entreprises.data.gouv.fr/etablissement/12345678900011';
  discovered.contactability = contactability(discovered.id, 'MISSING');
  discovered.commercialView = {
    category: 'LEGACY',
    gateVersion: 'COMMERCIAL_ELIGIBILITY_V2.6.0',
    reason: 'CURRENT_GATE_PRE_ACTIVE',
  };

  const queue = projectOperatorProspectQueue([discovered]);
  const active = projectActiveCommercialDeck({
    prospects: [discovered],
    prototypes: [],
    salesRooms: [],
    escalations: [],
    meetings: [],
    recentEvents: [],
    runningJobs: [],
  });

  assert.equal(queue.entries.length, 1);
  assert.equal(queue.entries[0]?.nextAction, 'À QUALIFIER');
  assert.match(queue.entries[0]?.reason ?? '', /pré-actif/);
  assert.equal(queue.currentCount, 0);
  assert.equal(queue.preCurrentCount, 1);
  assert.deepEqual(active.prospects, []);
});

test('stale LEGACY sales history is not treated as current operator work', () => {
  const waiting = prospect('legacy-waiting', 'LEGACY', 'WAITING_REPLY');
  waiting.contactability = contactability(waiting.id, 'PUBLISHED_VERIFIED');
  const prototypeReady = prospect('legacy-prototype', 'LEGACY', 'PROTOTYPE_READY');
  prototypeReady.contactability = contactability(
    prototypeReady.id,
    'PUBLISHED_VERIFIED',
  );
  const disqualified = prospect('legacy-disqualified', 'LEGACY', 'DISQUALIFIED');
  disqualified.contactability = contactability(disqualified.id, 'MISSING');
  const unprovenQualified = prospect('legacy-unproven', 'LEGACY', 'QUALIFIED');
  unprovenQualified.contactability = contactability(
    unprovenQualified.id,
    'MISSING',
  );

  const queue = projectOperatorProspectQueue([
    waiting,
    prototypeReady,
    disqualified,
    unprovenQualified,
  ]);

  assert.deepEqual(queue.entries, []);
  assert.equal(queue.currentCount, 0);
  assert.equal(queue.preCurrentCount, 0);
});
