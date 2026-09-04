import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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

async function responseJson(response) {
  return { status: response.status, body: await response.json() };
}

test('WP-02 exposes safe Sales Room lifecycle, tracking and review state', async () => {
  const db = new SqliteD1();
  const createdAt = '2026-08-20T10:00:00.000Z';
  db.exec(
    `INSERT INTO prospects (id, company_name, activity, location, state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'prospect-safiu',
    'Safiu Protection',
    'SÃ©curitÃ© privÃ©e',
    'Paris',
    'PROTOTYPE_DEPLOYED',
    createdAt,
    createdAt,
  );
  db.exec(
    `INSERT INTO prototypes (
       id, prospect_id, repo_path, deployment_url, status, qa_status,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'DEPLOYED', 'PASS', ?, ?)`,
    'prototype-safiu',
    'prospect-safiu',
    'prototypes/safiu-protection',
    'https://safiu-protection-demo.magicscript-demos-a185c139.pages.dev/',
    createdAt,
    createdAt,
  );

  const env = {
    DB: db,
    MAGICSCRIPT_PUBLIC_BASE_URL: 'https://magicscript.fr',
    MAGICSCRIPT_PUBLIC_SALES_ROOM_INGESTION_ENABLED: 'true',
    MAGICSCRIPT_SALES_ROOM_REVIEW_DAYS: '1',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
  };

  const rooms = await responseJson(await request('/api/sales-rooms', 'GET', undefined, env));
  assert.equal(rooms.status, 200);
  assert.equal(rooms.body.salesRooms.length, 1);
  const room = rooms.body.salesRooms[0];
  assert.equal(room.slug, 'safiu-protection');
  assert.equal(room.salesRoomPath, '/p/safiu-protection');
  assert.equal(room.salesRoomUrl, 'https://magicscript.fr/p/safiu-protection');
  assert.equal(room.ctaTarget, 'SALES_ROOM');
  assert.equal(room.reviewDue, true);
  assert.doesNotMatch(room.salesRoomUrl, /prospect-safiu|@|0658695073/);

  const publicShare = await responseJson(
    await request('/api/public/sales-room-event', 'POST', {
      type: 'SHARE_CLICKED',
      slug: 'safiu-protection',
      channel: 'email',
      idempotencyKey: 'public-share-safiu-1',
    }, env),
  );
  assert.equal(publicShare.status, 200);
  assert.equal(publicShare.body.resolved, true);
  assert.equal(
    db.database.prepare("SELECT state FROM prospects WHERE id = 'prospect-safiu'").get().state,
    'PROTOTYPE_DEPLOYED',
  );
  assert.equal(
    db.database.prepare("SELECT type FROM events WHERE id = ?").get(publicShare.body.eventId).type,
    'sales_room.share_clicked',
  );
  const publicShareReplay = await responseJson(
    await request('/api/public/sales-room-event', 'POST', {
      type: 'SHARE_CLICKED',
      slug: 'safiu-protection',
      channel: 'email',
      idempotencyKey: 'public-share-safiu-1',
    }, env),
  );
  assert.equal(publicShareReplay.status, 200);
  assert.equal(publicShareReplay.body.duplicate, true);
  const invalidPublicEvent = await responseJson(
    await request('/api/public/sales-room-event', 'POST', {
      type: 'SHARE_CLICKED',
      slug: 'safiu-protection',
      idempotencyKey: 'public share with spaces',
    }, env),
  );
  assert.equal(invalidPublicEvent.status, 400);

  const share = await responseJson(
    await request('/api/sales-rooms/events', 'POST', {
      type: 'SHARE_CLICKED',
      slug: 'safiu-protection',
      channel: 'whatsapp',
      idempotencyKey: 'share-safiu-1',
    }, env),
  );
  assert.equal(share.status, 200);
  assert.equal(share.body.resolved, true);
  const shareEvent = db.database
    .prepare(`SELECT type, payload_json FROM events WHERE id = ?`)
    .get(share.body.eventId);
  assert.equal(shareEvent.type, 'sales_room.share_clicked');
  assert.equal(JSON.parse(shareEvent.payload_json).channel, 'whatsapp');
  assert.doesNotMatch(shareEvent.payload_json, /received|read|delivered/i);

  const failed = await responseJson(
    await request('/api/sales-rooms/events', 'POST', {
      type: 'SALES_ROOM_RESOLUTION_FAILED',
      slug: 'safiu-protection',
      reason: 'MISSING_DATA',
      idempotencyKey: 'resolution-safiu-1',
    }, env),
  );
  assert.equal(failed.status, 200);
  assert.equal(
    db.database.prepare(`SELECT category FROM human_escalations WHERE prospect_id = ? ORDER BY created_at DESC LIMIT 1`).get('prospect-safiu').category,
    'MANUAL_REVIEW_REQUIRED',
  );

  const unknown = await responseJson(
    await request('/api/sales-rooms/events', 'POST', {
      type: 'SALES_ROOM_RESOLUTION_FAILED',
      slug: 'unknown-room',
      reason: 'UNKNOWN_SLUG',
      idempotencyKey: 'resolution-unknown-1',
    }, env),
  );
  assert.equal(unknown.status, 200);
  assert.equal(unknown.body.resolved, false);

  const disabled = await responseJson(
    await request('/api/sales-rooms/safiu-protection/disable', 'POST', {}, env),
  );
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.status, 'DISABLED');
  const afterDisable = await responseJson(await request('/api/sales-rooms', 'GET', undefined, env));
  assert.equal(afterDisable.body.salesRooms[0].status, 'DISABLED');
  assert.equal(afterDisable.body.salesRooms[0].salesRoomUrl, 'https://magicscript.fr/p/safiu-protection');

  const duplicateDisable = await responseJson(
    await request('/api/sales-rooms/safiu-protection/disable', 'POST', {}, env),
  );
  assert.equal(duplicateDisable.body.duplicate, true);
  assert.equal(db.database.prepare(`SELECT COUNT(*) AS count FROM events WHERE type = 'sales_room.disabled'`).get().count, 1);
  assert.equal(db.database.prepare(`SELECT COUNT(*) AS count FROM jobs WHERE kind LIKE 'SEND_%'`).get().count, 0);
  db.close();
});

test('WP-03 persists Sales Room messages and exchange requests without fake bookings', async () => {
  const db = new SqliteD1();
  const createdAt = '2026-09-03T10:00:00.000Z';
  for (const [id, company, prototypeId] of [
    ['prospect-message', 'Message Prospect', 'prototype-message'],
    ['prospect-meeting', 'Meeting Prospect', 'prototype-meeting'],
  ]) {
    db.exec(
      `INSERT INTO prospects (id, company_name, activity, location, state, created_at, updated_at)
       VALUES (?, ?, 'Conseil', 'Fort-de-France', 'PROTOTYPE_DEPLOYED', ?, ?)`,
      id,
      company,
      createdAt,
      createdAt,
    );
    db.exec(
      `INSERT INTO prototypes (
         id, prospect_id, repo_path, deployment_url, status, qa_status,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'DEPLOYED', 'PASS', ?, ?)`,
      prototypeId,
      id,
      `prototypes/${id}`,
      `https://${id}.example.test/`,
      createdAt,
      createdAt,
    );
  }

  const env = {
    DB: db,
    MAGICSCRIPT_PUBLIC_BASE_URL: 'https://magicscript.fr',
    MAGICSCRIPT_PUBLIC_SALES_ROOM_INGESTION_ENABLED: 'true',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
  };

  const messageBody = {
    slug: 'message-prospect',
    idempotencyKey: 'message-1',
    name: 'Dirigeant test',
    email: 'dirigeant@example.test',
    message: 'Je souhaite Ã©changer sur la proposition.',
  };
  const message = await responseJson(
    await request('/api/public/sales-room-message', 'POST', messageBody, env),
  );
  assert.equal(message.status, 200);
  assert.equal(message.body.state, 'INTERESTED');
  assert.equal(message.body.briefingReady, true);
  assert.equal(message.body.externalResponseCreated, false);
  assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM replies').get().count, 1);
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'sales_room.message_received'").get().count,
    1,
  );
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM human_escalations WHERE category = 'INTERESTED'").get().count,
    1,
  );
  assert.match(
    db.database.prepare("SELECT summary FROM human_escalations WHERE prospect_id = 'prospect-message'").get().summary,
    /Je souhaite Ã©changer/,
  );
  const messageEvent = db.database
    .prepare("SELECT payload_json FROM events WHERE type = 'sales_room.message_received'")
    .get();
  assert.equal(JSON.parse(messageEvent.payload_json).nextOwner, 'stephane');

  const duplicate = await responseJson(
    await request('/api/public/sales-room-message', 'POST', messageBody, env),
  );
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM replies').get().count, 1);

  const meeting = await responseJson(
    await request('/api/public/sales-room-meeting-requested', 'POST', {
      slug: 'meeting-prospect',
      idempotencyKey: 'meeting-1',
    }, env),
  );
  assert.equal(meeting.status, 200);
  assert.equal(meeting.body.state, 'INTERESTED');
  assert.equal(meeting.body.meetingBooked, false);
  assert.equal(
    db.database.prepare("SELECT state FROM prospects WHERE id = 'prospect-meeting'").get().state,
    'INTERESTED',
  );
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'commercial.meeting_requested'").get().count,
    1,
  );
  assert.equal(
    db.database.prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'commercial.meeting_booked'").get().count,
    0,
  );
  const meetingReplay = await responseJson(
    await request('/api/public/sales-room-meeting-requested', 'POST', {
      slug: 'meeting-prospect',
      idempotencyKey: 'meeting-1',
    }, env),
  );
  assert.equal(meetingReplay.status, 200);
  assert.equal(meetingReplay.body.duplicate, true);

  const directWonMutation = await responseJson(
    await request('/api/prospects/prospect-message', 'PATCH', { state: 'WON' }, env),
  );
  assert.equal(directWonMutation.status, 404);
  assert.equal(
    db.database.prepare("SELECT state FROM prospects WHERE id = 'prospect-message'").get().state,
    'INTERESTED',
  );

  const invalid = await responseJson(
    await request('/api/public/sales-room-message', 'POST', {
      slug: 'message-prospect',
      idempotencyKey: 'message-invalid',
      message: '',
    }, env),
  );
  assert.equal(invalid.status, 400);
  assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM replies').get().count, 1);

  const tooLong = await responseJson(
    await request('/api/public/sales-room-message', 'POST', {
      slug: 'message-prospect',
      idempotencyKey: 'message-too-long',
      message: 'x'.repeat(4001),
    }, env),
  );
  assert.equal(tooLong.status, 400);
  assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM replies').get().count, 1);

  const unsafeText = '<script>alert(1)</script><img src=x onerror=alert(2)>';
  const unsafe = await responseJson(
    await request('/api/public/sales-room-message', 'POST', {
      slug: 'message-prospect',
      idempotencyKey: 'message-html-1',
      name: unsafeText,
      email: 'dirigeant@example.test',
      message: unsafeText,
      ignoredField: 'must not affect routing',
    }, env),
  );
  assert.equal(unsafe.status, 200);
  assert.equal(
    db.database.prepare('SELECT raw_text FROM replies ORDER BY created_at DESC LIMIT 1').get().raw_text,
    `${unsafeText}\n\n${unsafeText}`,
  );

  const disabled = await responseJson(
    await request('/api/public/sales-room-message', 'POST', {
      ...messageBody,
      idempotencyKey: 'message-disabled',
    }, { ...env, MAGICSCRIPT_PUBLIC_SALES_ROOM_INGESTION_ENABLED: 'false' }),
  );
  assert.equal(disabled.status, 503);
  assert.equal(db.database.prepare('SELECT COUNT(*) AS count FROM replies').get().count, 2);

  assert.equal(db.database.prepare("SELECT COUNT(*) AS count FROM jobs WHERE kind LIKE 'SEND_%'").get().count, 0);
  db.close();
});

test('WP-09 accepts only the canonical Sales Room quote and records durable proof', async () => {
  const db = new SqliteD1();
  const now = '2026-09-04T18:00:00.000Z';

  db.exec(
    `INSERT INTO prospects (
       id, company_name, activity, location, state, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'prospect-wp09',
    'WP09 Fixture',
    'Services professionnels',
    'Paris',
    'QUOTE_PENDING',
    now,
    now,
  );

  db.exec(
    `INSERT INTO prototypes (
       id, prospect_id, repo_path, deployment_url, status, qa_status,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'DEPLOYED', 'PASS', ?, ?)`,
    'prototype-wp09',
    'prospect-wp09',
    'prototypes/wp09',
    'https://wp09.example.test/',
    now,
    now,
  );

  const canonical = JSON.stringify({
    quoteId: 'quote-wp09',
    quoteNumber: 'DEV-WP09-001',
    totalCents: 59000,
    currency: 'EUR',
    cgvReference: 'CGV-2026-09',
  });

  db.exec(
    `INSERT INTO commercial_quotes (
       id,
       prospect_id,
       quote_id,
       quote_number,
       quote_version_hash,
       canonical_json,
       issue_date,
       valid_until,
       delivery_deadline,
       cgv_reference,
       subtotal_cents,
       total_cents,
       currency,
       deposit_percent,
       balance_percent,
       published_at,
       created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', 50, 50, ?, ?)`,
    'commercial-quote-wp09',
    'prospect-wp09',
    'quote-wp09',
    'DEV-WP09-001',
    'server-hash-wp09',
    canonical,
    '2026-09-04',
    '2099-12-31',
    '2099-12-31',
    'CGV-2026-09',
    59000,
    59000,
    now,
    now,
  );

  const env = {
    DB: db,
    MAGICSCRIPT_PUBLIC_BASE_URL: 'https://magicscript.fr',
    MAGICSCRIPT_PUBLIC_SALES_ROOM_INGESTION_ENABLED: 'true',
    MAGICSCRIPT_SALES_ROOM_REVIEW_DAYS: '1',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
  };

  const accepted = await responseJson(
    await request('/api/public/sales-room-quote-accept', 'POST', {
      slug: 'wp09-fixture',
      idempotencyKey: 'wp09-acceptance-1',
      signerName: 'Jean Dupont',
      signerEmail: 'jean@example.test',
      signerCompanyName: 'WP09 Fixture',
      consentGiven: true,

      quoteId: 'client-forged-quote',
      quoteVersionHash: 'client-forged-hash',
      totalCents: 1,
      currency: 'USD',
      cgvReference: 'client-forged-cgv',
    }, env),
  );

  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.duplicate, false);
  assert.equal(accepted.body.state, 'COMMITTED');
  assert.equal(accepted.body.quoteId, 'quote-wp09');
  assert.equal(accepted.body.quoteVersionHash, 'server-hash-wp09');

  const proof = db.database
    .prepare(
      `SELECT
         quote_id,
         quote_number,
         quote_version_hash,
         signer_name,
         signer_email,
         signer_company_name,
         consent_given,
         consent_label,
         cgv_reference,
         total_cents,
         currency,
         source
       FROM quote_acceptance_proofs
       WHERE prospect_id = ?`,
    )
    .get('prospect-wp09');

  assert.equal(proof.quote_id, 'quote-wp09');
  assert.equal(proof.quote_number, 'DEV-WP09-001');
  assert.equal(proof.quote_version_hash, 'server-hash-wp09');
  assert.equal(proof.signer_name, 'Jean Dupont');
  assert.equal(proof.signer_email, 'jean@example.test');
  assert.equal(proof.signer_company_name, 'WP09 Fixture');
  assert.equal(proof.consent_given, 1);
  assert.equal(proof.consent_label, 'BON_POUR_ACCORD');
  assert.equal(proof.cgv_reference, 'CGV-2026-09');
  assert.equal(proof.total_cents, 59000);
  assert.equal(proof.currency, 'EUR');
  assert.equal(proof.source, 'SALES_ROOM');

  assert.equal(
    db.database.prepare(
      "SELECT state FROM prospects WHERE id = 'prospect-wp09'",
    ).get().state,
    'COMMITTED',
  );

  assert.equal(
    db.database.prepare(
      "SELECT COUNT(*) AS count FROM events WHERE prospect_id = 'prospect-wp09' AND type = 'commercial.quote_accepted'",
    ).get().count,
    1,
  );

  const replay = await responseJson(
    await request('/api/public/sales-room-quote-accept', 'POST', {
      slug: 'wp09-fixture',
      idempotencyKey: 'wp09-acceptance-1',
      signerName: 'Jean Dupont',
      signerEmail: 'jean@example.test',
      signerCompanyName: 'WP09 Fixture',
      consentGiven: true,
    }, env),
  );

  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);
  assert.equal(replay.body.state, 'COMMITTED');

  assert.equal(
    db.database.prepare(
      "SELECT COUNT(*) AS count FROM quote_acceptance_proofs WHERE prospect_id = 'prospect-wp09'",
    ).get().count,
    1,
  );

  assert.equal(
    db.database.prepare(
      "SELECT COUNT(*) AS count FROM events WHERE prospect_id = 'prospect-wp09' AND type = 'commercial.quote_accepted'",
    ).get().count,
    1,
  );

  db.close();
});

test('WP-09 derives canonical pricing only from direct Sales Room prospect messages', async () => {
  const db = new SqliteD1();
  const now = '2026-09-04T20:00:00.000Z';

  db.exec(
    `INSERT INTO prospects (
       id, company_name, activity, location, state, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'prospect-wp09-scope',
    'WP09 Scope Fixture',
    'Services professionnels',
    'Paris',
    'INTERESTED',
    now,
    now,
  );

  db.exec(
    `INSERT INTO prototypes (
       id, prospect_id, repo_path, deployment_url, status, qa_status,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'DEPLOYED', 'PASS', ?, ?)`,
    'prototype-wp09-scope',
    'prospect-wp09-scope',
    'prototypes/wp09-scope',
    'https://wp09-scope.example.test/',
    now,
    now,
  );

  const env = {
    DB: db,
    MAGICSCRIPT_PUBLIC_BASE_URL: 'https://magicscript.fr',
    MAGICSCRIPT_PUBLIC_SALES_ROOM_INGESTION_ENABLED: 'true',
    MAGICSCRIPT_SALES_ROOM_REVIEW_DAYS: '1',
    MAGICSCRIPT_SENDING_ENABLED: 'false',
    MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
  };

  const directMessage = await responseJson(
    await request('/api/public/sales-room-message', 'POST', {
      slug: 'wp09-scope-fixture',
      idempotencyKey: 'wp09-scope-direct-1',
      name: 'Jean Dupont',
      email: 'jean@example.test',
      message: 'Je veux un site vitrine de 5 pages.',
    }, env),
  );

  assert.equal(directMessage.status, 200);

  db.exec(
    `INSERT INTO replies (
       id, prospect_id, contact_id, provider_message_id, from_email,
       raw_text, classification, confidence, received_at, created_at
     ) VALUES (?, ?, NULL, ?, ?, ?, NULL, NULL, ?, ?)`,
    'reply-email-not-sales-room',
    'prospect-wp09-scope',
    'provider-email-wp09',
    'email@example.test',
    'Je veux un site vitrine de 1 page.',
    now,
    now,
  );

  const dossierResponse = await responseJson(
    await request('/api/quote-dossiers', 'POST', {
      prospectId: 'prospect-wp09-scope',
    }, env),
  );

  assert.equal(dossierResponse.status, 200);
  assert.equal(dossierResponse.body.dossier.commercialScope.siteKind, 'SHOWCASE');
  assert.equal(dossierResponse.body.dossier.commercialScope.pageCount, 5);
  assert.equal(dossierResponse.body.dossier.pricing.sourceRef, 'ESSENTIEL');
  assert.match(dossierResponse.body.dossier.pricing.value ?? '', /1190\.00 EUR/);

  assert.notEqual(dossierResponse.body.dossier.pricing.sourceRef, 'STARTER');

  db.close();
});

test('WP-09 publishes fixed canonical quotes only with server legal configuration', async () => {
  async function setup(id, company, message, legal = true) {
    const db = new SqliteD1();
    const now = '2026-09-04T21:00:00.000Z';
    db.exec(
      `INSERT INTO prospects (id, company_name, state, created_at, updated_at)
       VALUES (?, ?, 'INTERESTED', ?, ?)`,
      id,
      company,
      now,
      now,
    );
    db.exec(
      `INSERT INTO prototypes (
         id, prospect_id, repo_path, deployment_url, status, qa_status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, 'DEPLOYED', 'PASS', ?, ?)`,
      `prototype-${id}`,
      id,
      `prototypes/${id}`,
      `https://${id}.example.test/`,
      now,
      now,
    );
    const env = {
      DB: db,
      MAGICSCRIPT_PUBLIC_BASE_URL: 'https://magicscript.fr',
      MAGICSCRIPT_PUBLIC_SALES_ROOM_INGESTION_ENABLED: 'true',
      MAGICSCRIPT_SENDING_ENABLED: 'false',
      MAGICSCRIPT_EMAIL_PROVIDER: 'disabled',
      ...(legal
        ? {
            MAGICSCRIPT_QUOTE_VAT_NOTE: 'VAT configuration supplied by Magic Script',
            MAGICSCRIPT_QUOTE_CGV_REFERENCE: 'CGV-PRODUCTION-REFERENCE',
          }
        : {}),
    };
    const messageResponse = await responseJson(
      await request('/api/public/sales-room-message', 'POST', {
        slug: company.toLowerCase().replaceAll(' ', '-'),
        idempotencyKey: `${id}-message`,
        name: 'Jean Dupont',
        email: 'jean@example.test',
        message,
      }, env),
    );
    assert.equal(messageResponse.status, 200);
    const dossierResponse = await responseJson(
      await request('/api/quote-dossiers', 'POST', { prospectId: id }, env),
    );
    assert.equal(dossierResponse.status, 200);
    return { db, env, dossierId: dossierResponse.body.dossier.id };
  }

  const fixed = await setup(
    'prospect-wp09-publish',
    'WP09 Publish Fixture',
    'Je veux un site vitrine de 5 pages.',
  );
  const published = await responseJson(
    await request(
      `/api/quote-dossiers/${fixed.dossierId}/publish`,
      'POST',
      { totalCents: 1, quoteVersionHash: 'forged', cgvReference: 'forged' },
      fixed.env,
    ),
  );
  assert.equal(published.status, 200);
  assert.equal(published.body.totalCents, 119000);
  assert.equal(published.body.currency, 'EUR');
  assert.equal(published.body.depositPercent, 50);
  assert.equal(published.body.balancePercent, 50);
  assert.equal(published.body.state, 'QUOTE_PENDING');
  const quote = fixed.db.database
    .prepare('SELECT * FROM commercial_quotes WHERE prospect_id = ?')
    .get('prospect-wp09-publish');
  assert.equal(
    quote.quote_version_hash,
    `sha256:${createHash('sha256').update(quote.canonical_json).digest('hex')}`,
  );
  assert.equal(JSON.parse(quote.canonical_json).cgvReference, 'CGV-PRODUCTION-REFERENCE');
  assert.equal(
    fixed.db.database
      .prepare("SELECT COUNT(*) AS count FROM events WHERE type = 'commercial.quote_published'")
      .get().count,
    1,
  );
  const replay = await responseJson(
    await request(`/api/quote-dossiers/${fixed.dossierId}/publish`, 'POST', {}, fixed.env),
  );
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);
  assert.equal(
    fixed.db.database
      .prepare('SELECT COUNT(*) AS count FROM commercial_quotes WHERE prospect_id = ?')
      .get('prospect-wp09-publish').count,
    1,
  );
  fixed.db.close();

  const missingLegal = await setup(
    'prospect-wp09-missing-legal',
    'WP09 Missing Legal',
    'Je veux un site vitrine de 1 page.',
    false,
  );
  const missingLegalResult = await responseJson(
    await request(`/api/quote-dossiers/${missingLegal.dossierId}/publish`, 'POST', {}, missingLegal.env),
  );
  assert.equal(missingLegalResult.status, 409);
  assert.equal(
    missingLegal.db.database
      .prepare('SELECT COUNT(*) AS count FROM commercial_quotes')
      .get().count,
    0,
  );
  missingLegal.db.close();

  const premium = await setup(
    'prospect-wp09-premium',
    'WP09 Premium',
    'Je veux un site vitrine de 9 pages.',
  );
  const premiumResult = await responseJson(
    await request(`/api/quote-dossiers/${premium.dossierId}/publish`, 'POST', {}, premium.env),
  );
  assert.equal(premiumResult.status, 409);
  assert.equal(
    premium.db.database.prepare('SELECT COUNT(*) AS count FROM commercial_quotes').get().count,
    0,
  );
  premium.db.close();
});
