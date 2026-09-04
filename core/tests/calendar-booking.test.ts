import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_AVAILABILITY,
  buildH24ReminderPlan,
  formatInTimeZone,
  generateAvailability,
  slotForStart,
  zonedLocalToUtc,
} from '../index';

test('converts Martinique booking times to Paris with IANA timezone rules', () => {
  const winter = zonedLocalToUtc('2026-01-15', '07:00', 'America/Martinique');
  const summer = zonedLocalToUtc('2026-07-15', '07:00', 'America/Martinique');

  assert.equal(winter, '2026-01-15T11:00:00.000Z');
  assert.equal(summer, '2026-07-15T11:00:00.000Z');
  assert.match(formatInTimeZone(winter, 'Europe/Paris'), /12:00/);
  assert.match(formatInTimeZone(summer, 'Europe/Paris'), /13:00/);
});

test('generates bounded weekday slots and rejects occupied or invalid starts', () => {
  const nowUtc = '2026-09-03T00:00:00.000Z';
  const slots = generateAvailability({
    fromDate: '2026-09-03',
    nowUtc,
    config: DEFAULT_AVAILABILITY,
    days: 1,
    occupiedStarts: ['2026-09-03T11:00:00.000Z'],
    prospectTimeZone: 'America/Martinique',
  });

  assert.equal(slots[0]?.startAtUtc, '2026-09-03T11:30:00.000Z');
  assert.equal(slots.every((slot) => slot.durationMinutes === 30), true);
  assert.equal(
    slotForStart({
      startAtUtc: '2026-09-03T11:00:00.000Z',
      nowUtc,
      config: DEFAULT_AVAILABILITY,
      prospectTimeZone: 'America/Martinique',
    })?.startAtUtc,
    '2026-09-03T11:00:00.000Z',
  );
});

test('prepares one H-24 email fallback and never an SMS', () => {
  const startAtUtc = '2026-09-10T11:00:00.000Z';
  const plan = buildH24ReminderPlan({
    company: 'Prospect fixture',
    startAtUtc,
    endAtUtc: '2026-09-10T11:30:00.000Z',
    prospectTimeZone: 'America/Martinique',
    communicationMode: 'phone',
    status: 'CONFIRMED',
    nowUtc: '2026-09-09T12:00:00.000Z',
    alreadyPrepared: false,
  });

  assert.equal(plan?.channel, 'EMAIL');
  assert.equal(plan?.requestedChannel, 'SMS');
  assert.equal(plan?.fallbackReason, 'SMS_PROVIDER_NOT_CONFIGURED');
  assert.equal(plan?.dueAt, '2026-09-09T11:00:00.000Z');
  assert.equal(
    buildH24ReminderPlan({
      company: 'Prospect fixture',
      startAtUtc,
      endAtUtc: '2026-09-10T11:30:00.000Z',
      prospectTimeZone: 'America/Martinique',
      communicationMode: 'phone',
      status: 'CONFIRMED',
      nowUtc: '2026-09-09T12:00:00.000Z',
      alreadyPrepared: true,
    }),
    null,
  );
});
