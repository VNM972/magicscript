import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/contact.js';

const validPayload = {
  nom: 'Test local',
  email: 'test@example.com',
  activite: 'Entreprise de test',
  telephone: '0600000000',
  message: 'Demande de test sans transmission réelle.',
};

function context(payload, env = { CONTACT_EMAIL_ENABLED: 'false' }) {
  return {
    request: new Request('https://preview.example/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://preview.example' },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    }),
    env,
  };
}

async function body(response) {
  return response.json();
}

test('rejects invalid JSON', async () => {
  const response = await onRequestPost(context('{'));
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, 'invalid_json');
});

test('rejects invalid fields without sending', async () => {
  const response = await onRequestPost(context({ ...validPayload, email: 'not-an-email' }));
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, 'invalid_fields');
});

test('accepts honeypot submissions without sending', async () => {
  const response = await onRequestPost(context({ ...validPayload, website: 'bot' }, {
    CONTACT_EMAIL_ENABLED: 'true',
    EMAIL: { send: async () => { throw new Error('must not send'); } },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await body(response), { ok: true });
});

test('keeps valid submissions disabled until reception is enabled', async () => {
  const response = await onRequestPost(context(validPayload));
  assert.equal(response.status, 503);
  assert.equal((await body(response)).error, 'email_not_configured');
});

test('sends only through the configured binding when explicitly enabled', async () => {
  const sent = [];
  const response = await onRequestPost(context(validPayload, {
    CONTACT_EMAIL_ENABLED: 'true',
    CONTACT_TO: 'contact@magicscript.fr',
    CONTACT_FROM: 'commercial@magicscript.fr',
    EMAIL: { send: async (message) => { sent.push(message); return { messageId: 'test-message' }; } },
  }));
  assert.equal(response.status, 200);
  assert.equal((await body(response)).messageId, 'test-message');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'contact@magicscript.fr');
  assert.equal(sent[0].replyTo, validPayload.email);
  assert.match(sent[0].html, /Entreprise de test/);
});
