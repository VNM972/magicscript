import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import worker from './index.ts';

class SqliteD1 {
  constructor() {
    this.database = new DatabaseSync(':memory:');
    this.database.exec(readFileSync(new URL('../../../database/schema.sql', import.meta.url), 'utf8'));
  }

  prepare(query) {
    const statement = this.database.prepare(query);
    let bindings = [];
    return {
      bind: (...values) => {
        bindings = values;
        return {
          first: async () => statement.get(...bindings) ?? null,
          all: async () => ({ results: statement.all(...bindings) }),
          run: async () => statement.run(...bindings),
        };
      },
      first: async () => statement.get(...bindings) ?? null,
      all: async () => ({ results: statement.all(...bindings) }),
      run: async () => statement.run(...bindings),
    };
  }

  exec(sql, ...bindings) {
    this.database.prepare(sql).run(...bindings);
  }

  close() {
    this.database.close();
  }
}

function request(path, method, body, env) {
  return worker.fetch(
    new Request(`https://local.test${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env,
  );
}

async function jsonResponse(response) {
  return { status: response.status, body: await response.json() };
}

function seedProspect(db, id, company, state, createdAt) {
  db.exec(
    `INSERT INTO prospects (id, company_name, activity, location, state, created_at, updated_at)
     VALUES (?, ?, 'Sécurité', 'Fort-de-France', ?, ?, ?)`,
    id,
    company,
    state,
    createdAt,
    createdAt,
  );
  db.exec(
    `INSERT INTO prototypes (
       id, prospect_id, repo_path, deployment_url, status, qa_status,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'DEPLOYED', 'PASS', ?, ?)`,
    `prototype-${id}`,
    id,
    `prototypes/${id}`,
    `https://${id}.example.test/`,
    createdAt,
    createdAt,
  );
}

test('WP-04 integrates communication modes, booking, timezone, concurrency, lifecycle and reminders', async () => {
  const db = new SqliteD1();
  const createdAt = '2026-09-03T10:00:00.000Z';
  seedProspect(db, 'p-email', 'Email Prospect', 'PROTOTYPE_DEPLOYED', createdAt);
  seedProspect(db, 'p-phone-a', 'Phone Prospect A', 'PROTOTYPE_DEPLOYED', createdAt);
  seedProspect(db, 'p-phone-b', 'Phone Prospect B', 'PROTOTYPE_DEPLOYED', createdAt);
  seedProspect(db, 'p-cancel', 'Cancel Prospect', 'PROTOTYPE_DEPLOYED', createdAt);

  const env = {
    DB: db,
    MAGICSCRIPT_PUBLIC_BASE_URL: 'https://magicscript.fr',
    MAGICSCRIPT_PUBLIC_SALES_ROOM_INGESTION_ENABLED: 'true',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
    MAGICSCRIPT_SMS_ENABLED: 'false',
  };

  const availability = await jsonResponse(
    await request(
      '/api/public/sales-room-availability?slug=phone-prospect-a&from=2099-01-05&days=1&timeZone=America%2FMartinique',
      'GET',
      undefined,
      env,
    ),
  );
  assert.equal(availability.status, 200);
  assert.equal(availability.body.availabilityTimeZone, 'America/Martinique');
  assert.equal(availability.body.durationMinutes, 30);
  assert.ok(availability.body.slots.length >= 2);
  const firstSlot = availability.body.slots[0];
  const secondSlot = availability.body.slots[1];
  assert.equal(firstSlot.prospectTimeZone, 'America/Martinique');
  assert.match(firstSlot.prospectLabel, /07:00/);
  assert.match(firstSlot.parisLabel, /12:00/);

  const email = await jsonResponse(
    await request('/api/public/sales-room-message', 'POST', {
      slug: 'email-prospect',
      idempotencyKey: 'email-mode-1',
      email: 'owner@example.test',
      message: 'Je préfère continuer par email.',
      communicationMode: 'email',
    }, env),
  );
  assert.equal(email.status, 200);
  assert.equal(email.body.state, 'INTERESTED');
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM meetings WHERE prospect_id = 'p-email'").get().count,
    0,
  );
  assert.equal(
    db.database.prepare("SELECT json_extract(payload_json, '$.communicationMode') AS mode FROM events WHERE type = 'commercial.communication_mode_selected' AND prospect_id = 'p-email'").get().mode,
    'email',
  );
  const missingEmail = await jsonResponse(
    await request('/api/public/sales-room-message', 'POST', {
      slug: 'email-prospect',
      idempotencyKey: 'email-mode-missing',
      message: 'Je veux une réponse écrite.',
      communicationMode: 'email',
    }, env),
  );
  assert.equal(missingEmail.status, 400);

  const bookBodies = [
    {
      slug: 'phone-prospect-a',
      communicationMode: 'phone',
      startAtUtc: firstSlot.startAtUtc,
      prospectTimezone: 'America/Martinique',
      phone: '+596 696 00 00 00',
      name: 'Contact A',
      idempotencyKey: 'phone-booking-a-1',
    },
    {
      slug: 'phone-prospect-b',
      communicationMode: 'phone',
      startAtUtc: firstSlot.startAtUtc,
      prospectTimezone: 'America/Martinique',
      phone: '+596 696 00 00 01',
      name: 'Contact B',
      idempotencyKey: 'phone-booking-b-1',
    },
  ];
  const concurrent = await Promise.all(
    bookBodies.map((body) => request('/api/public/sales-room-booking', 'POST', body, env).then(jsonResponse)),
  );
  assert.deepEqual(concurrent.map((result) => result.status).sort((a, b) => a - b), [200, 409]);
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM meetings WHERE start_at_utc = ? AND status = 'CONFIRMED'").get(firstSlot.startAtUtc).count,
    1,
  );
  const winnerIndex = concurrent.findIndex((result) => result.status === 200);
  const winnerBody = bookBodies[winnerIndex];
  const winner = concurrent[winnerIndex].body;
  assert.equal(winner.state, 'MEETING_BOOKED');
  assert.equal(winner.meeting.communicationMode, 'phone');
  assert.equal(winner.confirmationEmail.dryRun, true);
  assert.equal(winner.confirmationEmail.externalSend, false);
  assert.equal(winner.briefing.owner, 'stephane');
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'commercial.meeting_booked'").get().count,
    1,
  );
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM human_escalations WHERE category = 'MEETING_BOOKED'").get().count,
    1,
  );

  const replay = await jsonResponse(
    await request('/api/public/sales-room-booking', 'POST', winnerBody, env),
  );
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM meetings WHERE idempotency_key = 'phone-booking-a-1' OR idempotency_key = 'phone-booking-b-1'").get().count,
    1,
  );

  const cancel = await jsonResponse(
    await request('/api/public/sales-room-meeting-cancel', 'POST', {
      slug: winnerBody.slug,
      meetingId: winner.meeting.meetingId,
      idempotencyKey: 'phone-cancel-1',
    }, env),
  );
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.state, 'INTERESTED');
  assert.equal(
    db.database.prepare('SELECT status FROM meetings WHERE id = ?').get(winner.meeting.meetingId).status,
    'CANCELLED',
  );
  const afterCancel = await jsonResponse(
    await request(
      '/api/public/sales-room-availability?slug=phone-prospect-a&from=2099-01-05&days=1&timeZone=America%2FMartinique',
      'GET',
      undefined,
      env,
    ),
  );
  assert.ok(afterCancel.body.slots.some((slot) => slot.startAtUtc === firstSlot.startAtUtc));

  const rebook = await jsonResponse(
    await request('/api/public/sales-room-booking', 'POST', {
      ...winnerBody,
      idempotencyKey: 'phone-rebook-1',
    }, env),
  );
  assert.equal(rebook.status, 200);
  const rebookId = rebook.body.meeting.meetingId;
  const reschedule = await jsonResponse(
    await request('/api/public/sales-room-booking', 'POST', {
      ...winnerBody,
      startAtUtc: secondSlot.startAtUtc,
      idempotencyKey: 'phone-reschedule-1',
      rescheduledFromMeetingId: rebookId,
    }, env),
  );
  assert.equal(reschedule.status, 200);
  assert.equal(reschedule.body.meeting.rescheduledFromId, rebookId);
  assert.equal(db.database.prepare('SELECT status FROM meetings WHERE id = ?').get(rebookId).status, 'RESCHEDULED');
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM meetings WHERE prospect_id = ? AND status = 'CONFIRMED'").get(winnerBody.slug === 'phone-prospect-a' ? 'p-phone-a' : 'p-phone-b').count,
    1,
  );

  const schedule = await jsonResponse(
    await request('/api/meetings?from=2099-01-04T00:00:00.000Z&to=2099-01-06T00:00:00.000Z', 'GET', undefined, env),
  );
  assert.equal(schedule.status, 200);
  assert.equal(schedule.body.timeZone, 'Europe/Paris');
  assert.equal(schedule.body.meetings.filter((meeting) => meeting.status === 'CONFIRMED').length, 1);
  assert.equal(schedule.body.meetings.find((meeting) => meeting.status === 'CONFIRMED').briefingAvailable, true);
  assert.equal(schedule.body.meetings.find((meeting) => meeting.status === 'CONFIRMED').parisTime.includes('12:30'), true);

  const reminderNow = new Date(new Date(secondSlot.startAtUtc).getTime() - 23 * 60 * 60 * 1000).toISOString();
  const reminder = await jsonResponse(
    await request('/api/system/meeting-reminders', 'POST', { nowUtc: reminderNow }, env),
  );
  assert.equal(reminder.status, 200);
  assert.equal(reminder.body.prepared, 1);
  const reminderReplay = await jsonResponse(
    await request('/api/system/meeting-reminders', 'POST', { nowUtc: reminderNow }, env),
  );
  assert.equal(reminderReplay.status, 200);
  assert.equal(reminderReplay.body.prepared, 0);
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'meeting.reminder_draft'").get().count,
    1,
  );
  const reminderEvent = db.database.prepare("SELECT payload_json FROM events WHERE type = 'meeting.reminder_draft'").get();
  assert.equal(JSON.parse(reminderEvent.payload_json).externalSend, false);
  assert.equal(JSON.parse(reminderEvent.payload_json).requestedChannel, 'SMS');
  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind LIKE 'SEND_%'").get().count, 0);

  const cancelFixtureAvailability = await jsonResponse(
    await request(
      '/api/public/sales-room-availability?slug=cancel-prospect&from=2099-01-05&days=1&timeZone=America%2FMartinique',
      'GET',
      undefined,
      env,
    ),
  );
  const cancelSlot = cancelFixtureAvailability.body.slots[0];
  const cancelBooking = await jsonResponse(
    await request('/api/public/sales-room-booking', 'POST', {
      slug: 'cancel-prospect',
      communicationMode: 'phone',
      startAtUtc: cancelSlot.startAtUtc,
      prospectTimezone: 'America/Martinique',
      phone: '+596 696 00 00 02',
      idempotencyKey: 'cancel-before-reminder-1',
    }, env),
  );
  assert.equal(cancelBooking.status, 200);
  const cancelBeforeDue = await jsonResponse(
    await request('/api/public/sales-room-meeting-cancel', 'POST', {
      slug: 'cancel-prospect',
      meetingId: cancelBooking.body.meeting.meetingId,
      idempotencyKey: 'cancel-before-reminder-2',
    }, env),
  );
  assert.equal(cancelBeforeDue.status, 200);
  const afterCancelledReminder = await jsonResponse(
    await request('/api/system/meeting-reminders', 'POST', {
      nowUtc: new Date(new Date(cancelSlot.startAtUtc).getTime() - 23 * 60 * 60 * 1000).toISOString(),
    }, env),
  );
  assert.equal(afterCancelledReminder.status, 200);
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'meeting.reminder_draft' AND json_extract(payload_json, '$.meetingId') = ?").get(cancelBooking.body.meeting.meetingId).count,
    0,
  );
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'commercial.meeting_requested'").get().count,
    0,
  );
  db.close();
});
