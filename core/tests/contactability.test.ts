import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProspectContactability,
  isPublishedVerifiedContactCandidate,
} from '../orchestrator/contactability';
import { evaluateResearchEvidenceIntegrity } from '../research/evidence-integrity';
import type { MagicScriptEvent } from '../types/events';
import type { Prospect, ProspectContact } from '../types/prospect';

const prospect: Prospect = {
  id: 'prospect-397877622-00019',
  companyName: 'AU BONHEUR DES DAMES',
  siren: '397877622',
  siret: '39787762200019',
  state: 'QUALIFIED',
  createdAt: '2026-09-08T09:00:00.000Z',
  updatedAt: '2026-09-08T09:00:00.000Z',
};

const publishedContact: ProspectContact = {
  id: 'contact-published',
  prospectId: prospect.id,
  email: 'bonjour@example.fr',
  sourceUrl: 'https://example.fr/contact',
  sourceType: 'official_site',
  confidence: 92,
  isValidated: true,
  isSuppressed: false,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
};

function phoneEvidenceEvent(
  overrides: Partial<MagicScriptEvent> = {},
  independentlyObserved = true,
): MagicScriptEvent {
  const derivedPhoneEvidence = independentlyObserved
    ? {
        phone: '0596711010',
        normalizedDigits: '0596711010',
        sourceUrl: 'https://example.fr/contact',
        evidenceType: 'TEL_HREF',
        evidenceOrigin: 'FETCHED_SOURCE',
        independentlyObserved: true,
      }
    : undefined;
  const integrity = evaluateResearchEvidenceIntegrity({
    scoreInputs: {
      digitalGap: 90,
      commercialStrength: 85,
      // contactability is 0 because no trustedPhone exists — the dimension
      // cannot be supported and would otherwise fire UNSUPPORTED_SCORE.
      contactability: 0,
      localFit: 90,
      prototypeLeverage: 85,
      confidence: 90,
    },
    phone: '05 96 71 10 10',
    phoneSourceUrl: 'https://example.fr/contact',
    derivedPhoneEvidence,
    sources: [
      {
        url: 'https://directory.example.fr/prospect-397877622-00019',
        note: 'Public listing supports the scored observations.',
        supports: [
          'digitalGap',
          'commercialStrength',
          'localFit',
          'prototypeLeverage',
        ],
      },
      {
        url: 'https://example.fr/contact',
        note: 'Official contact page displays 05 96 71 10 10.',
        supports: ['phone'],
      },
    ],
  });
  assert.equal(integrity.passed, true);
  assert.equal(Boolean(integrity.trustedPhone), independentlyObserved);

  const event: MagicScriptEvent = {
    id: 'research-scored-phone-1',
    prospectId: prospect.id,
    actor: 'scoring-agent',
    type: 'research.scored',
    payload: {
      sources: integrity.acceptedSources,
      evidenceIntegrity: {
        passed: integrity.passed,
        reasons: integrity.reasons,
        rejectedSourceCount: integrity.rejectedSourceCount,
        supportedClaims: integrity.supportedClaims,
      },
      phoneEvidence: integrity.trustedPhone ?? null,
    },
    createdAt: '2026-09-08T10:30:00.000Z',
  };
  return { ...event, ...overrides };
}

function mutatePhoneEvidenceEvent(
  mutate: (event: MagicScriptEvent) => void,
): MagicScriptEvent {
  const event = structuredClone(phoneEvidenceEvent());
  mutate(event);
  return event;
}

test('a genuinely published and validated email is usable with provenance', () => {
  const result = buildProspectContactability(prospect, [publishedContact]);
  assert.equal(result.status, 'PUBLISHED_VERIFIED');
  assert.equal(result.channels[0].usableForFirstOutreach, true);
  assert.equal(result.channels[0].sourceUrl, 'https://example.fr/contact');
  assert.equal(result.channels[0].observedAt, '2026-09-08T10:00:00.000Z');
  assert.deepEqual(result.identity, {
    prospectId: prospect.id,
    siren: '397877622',
    siret: '39787762200019',
  });
});

test('a guessed email cannot masquerade as outreach-ready', () => {
  assert.equal(
    isPublishedVerifiedContactCandidate({
      sourceUrl: 'https://example.fr',
      confidence: 95,
      verified: true,
      observedExactValue: false,
      suppressed: false,
      minConfidence: 70,
    }),
    false,
  );
  const result = buildProspectContactability(prospect, [
    {
      ...publishedContact,
      id: 'contact-guessed',
      email: 'contact@example.fr',
      isValidated: false,
    },
  ]);

  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.channels[0].usableForFirstOutreach, false);
  assert.equal(result.preparation, null);
});

test('missing source evidence keeps a contact unverified', () => {
  const result = buildProspectContactability(prospect, [
    { ...publishedContact, sourceUrl: undefined },
  ]);
  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.preparation, null);
});

test('opposition and suppression both block preparation', () => {
  const opposed = buildProspectContactability(
    { ...prospect, state: 'DO_NOT_CONTACT' },
    [publishedContact],
  );
  const suppressed = buildProspectContactability(prospect, [
    { ...publishedContact, isSuppressed: true },
  ]);

  assert.equal(opposed.status, 'OPPOSED');
  assert.equal(opposed.preparation, null);
  assert.equal(suppressed.status, 'OPPOSED');
  assert.equal(suppressed.preparation, null);
});

test('missing contact produces no fake action', () => {
  const result = buildProspectContactability(prospect, []);
  assert.equal(result.status, 'MISSING');
  assert.equal(result.channels.length, 0);
  assert.equal(result.preparation, null);
});

test('Prepare Contact creates only a human mail-client draft and never sends', () => {
  const preparation = buildProspectContactability(prospect, [publishedContact])
    .preparation;

  assert.ok(preparation);
  assert.equal(preparation.kind, 'EMAIL_DRAFT');
  if (preparation.kind !== 'EMAIL_DRAFT') assert.fail('expected email draft');
  assert.equal(preparation.requiresHumanSend, true);
  assert.equal(preparation.sendsAutomatically, false);
  assert.match(preparation.mailtoHref, /^mailto:/);
  assert.match(decodeURIComponent(preparation.mailtoHref), /bonjour@example\.fr/);
});

test('contacts from another same-name prospect are never cross-wired', () => {
  const sameNameOtherIdentity: Prospect = {
    ...prospect,
    id: 'prospect-999999999-00011',
    siren: '999999999',
    siret: '99999999900011',
  };
  const result = buildProspectContactability(sameNameOtherIdentity, [
    publishedContact,
  ]);

  assert.equal(result.status, 'MISSING');
  assert.equal(result.channels.length, 0);
});

test('malformed or untrusted PHONE attestations fail closed without call preparation', () => {
  const validProspect = { ...prospect, phone: '05 96 71 10 10' };
  const setSourceUrl = (event: MagicScriptEvent, url: string): void => {
    const payload = event.payload as {
      sources: Array<{ url: string }>;
      phoneEvidence: { sourceUrl: string };
    };
    payload.sources[1]!.url = url;
    payload.phoneEvidence.sourceUrl = url;
  };
  const cases: Array<{
    name: string;
    candidate: Prospect;
    events: MagicScriptEvent[];
  }> = [
    {
      name: 'reviewer composite fail-open witness',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => {
        const payload = event.payload as Record<string, unknown>;
        (payload.evidenceIntegrity as Record<string, unknown>).passed = false;
        payload.sources = [];
        (payload.phoneEvidence as Record<string, unknown>).sourceUrl =
          'http://localhost/private';
        event.createdAt = 'not-a-timestamp';
      })],
    },
    {
      name: 'passed:false evidence',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => {
        (event.payload.evidenceIntegrity as Record<string, unknown>).passed = false;
      })],
    },
    {
      name: 'missing accepted source',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => {
        (event.payload as Record<string, unknown>).sources = [];
      })],
    },
    {
      name: 'source does not support phone',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => {
        const sources = (event.payload as { sources: Array<{ supports: string[] }> }).sources;
        sources[1]!.supports = ['website'];
      })],
    },
    {
      name: 'normalized digits do not match observed phone',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => {
        (event.payload.phoneEvidence as Record<string, unknown>).normalizedDigits = '0596000000';
      })],
    },
    { name: 'raw prospect.phone only', candidate: validProspect, events: [] },
    {
      name: 'phone mismatch',
      candidate: { ...prospect, phone: '05 96 00 00 00' },
      events: [phoneEvidenceEvent()],
    },
    {
      name: 'prospect mismatch',
      candidate: validProspect,
      events: [phoneEvidenceEvent({ prospectId: 'prospect-other' })],
    },
    {
      name: 'localhost URL',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => setSourceUrl(event, 'http://localhost/private'))],
    },
    {
      name: 'private-IP URL',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => setSourceUrl(event, 'http://192.168.1.10/private'))],
    },
    {
      name: 'IPv6 loopback URL',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => setSourceUrl(event, 'http://[::1]/private'))],
    },
    {
      name: 'IPv6 unique-local fc00 URL',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => setSourceUrl(event, 'http://[fc00::1]/private'))],
    },
    {
      name: 'IPv6 unique-local fd00 URL',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => setSourceUrl(event, 'http://[fd00::1]/private'))],
    },
    {
      name: 'IPv6 link-local URL',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => setSourceUrl(event, 'http://[fe80::1]/private'))],
    },
    {
      name: 'IPv6 unspecified URL',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => setSourceUrl(event, 'http://[::]/private'))],
    },
    {
      name: 'IPv4-mapped private IPv6 URL',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => setSourceUrl(event, 'http://[::ffff:192.168.1.10]/private'))],
    },
    {
      name: 'credential-bearing URL',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => setSourceUrl(event, 'https://user:secret@example.fr/contact'))],
    },
    {
      name: '.local hostname',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => setSourceUrl(event, 'https://directory.local/contact'))],
    },
    {
      name: 'malformed URL',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => setSourceUrl(event, 'not-a-url'))],
    },
    {
      name: 'missing observation timestamp',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => {
        delete (event as Partial<MagicScriptEvent>).createdAt;
      })],
    },
    {
      name: 'invalid observation timestamp',
      candidate: validProspect,
      events: [phoneEvidenceEvent({ createdAt: 'not-a-timestamp' })],
    },
    {
      name: 'mismatched source URL',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => {
        (event.payload.phoneEvidence as Record<string, unknown>).sourceUrl =
          'https://other.example.fr/contact';
      })],
    },
    {
      name: 'unsupported phone claim',
      candidate: validProspect,
      events: [mutatePhoneEvidenceEvent((event) => {
        (event.payload.evidenceIntegrity as Record<string, unknown>).supportedClaims = [];
      })],
    },
  ];

  for (const witness of cases) {
    const result = buildProspectContactability(witness.candidate, [], witness.events);
    assert.equal(
      result.channels.some((channel) => channel.type === 'PHONE'),
      false,
      witness.name,
    );
    assert.notEqual(result.preparation?.kind, 'PHONE_CALL_PREPARATION', witness.name);
  }
});

test('phone channel is not available without independent source evidence (fail-closed)', () => {
  // With the current architecture, phone evidence originates entirely from
  // the LLM and trustedPhone cannot be established. The contactability
  // builder correctly produces no PHONE channels and no phone preparation.
  const result = buildProspectContactability(
    { ...prospect, phone: '05 96 71 10 10' },
    [],
    [phoneEvidenceEvent({}, false)],
  );

  assert.equal(result.channels.length, 0,
    'no channels should exist without validated email or phone');
  assert.equal(result.status, 'MISSING',
    'status should be MISSING when no validated channels exist');
  assert.equal(result.preparation, null);
});

test('verified EMAIL provides contactability; phone remains unavailable without independent evidence', () => {
  const result = buildProspectContactability(
    { ...prospect, phone: '05 96 71 10 10' },
    [publishedContact],
    [phoneEvidenceEvent({}, false)],
  );

  // Only EMAIL channel should be present (phone trust requires independent
  // evidence which does not exist in the current architecture).
  assert.deepEqual(
    new Set(result.channels.map((channel) => channel.type)),
    new Set(['EMAIL']),
  );
  assert.equal(result.channels.length, 1, 'only EMAIL channel expected');
  assert.equal(result.preparation?.kind, 'EMAIL_DRAFT');
  if (result.preparation?.kind !== 'EMAIL_DRAFT') {
    assert.fail('verified email preparation must remain authoritative');
  }
  assert.equal(result.preparation.recipient, 'bonjour@example.fr');
  assert.equal(result.preparation.requiresHumanSend, true);
  assert.equal(result.preparation.sendsAutomatically, false);
});

test('DO_NOT_CONTACT and email suppression work without phone channels', () => {
  const event = phoneEvidenceEvent({}, false);
  const opposed = buildProspectContactability(
    { ...prospect, phone: '05 96 71 10 10', state: 'DO_NOT_CONTACT' },
    [],
    [event],
  );
  const emailSuppressed = buildProspectContactability(
    { ...prospect, phone: '05 96 71 10 10' },
    [{ ...publishedContact, isSuppressed: true }],
    [event],
  );

  assert.equal(opposed.status, 'OPPOSED');
  assert.equal(opposed.channels.length, 0);
  assert.equal(opposed.preparation, null);
  assert.equal(
    emailSuppressed.channels.find((channel) => channel.type === 'EMAIL')?.status,
    'OPPOSED',
  );
  // No PHONE channels exist because phone is not independently verifiable
  // in the current architecture.
  assert.equal(
    emailSuppressed.channels.find((channel) => channel.type === 'PHONE'),
    undefined,
    'no PHONE channel should exist without independent evidence',
  );
});

test('website-domain mismatch keeps an email unverified and non-actionable', () => {
  const result = buildProspectContactability(
    { ...prospect, websiteUrl: 'https://www.savoie.com' },
    [{ ...publishedContact, email: 'contact@saivoie.com', sourceUrl: 'https://www.savoie.com/contact' }],
  );

  assert.equal(result.status, 'UNVERIFIED');
  assert.equal(result.preparation, null);
  assert.equal(result.channels[0]?.status, 'UNVERIFIED');
  assert.equal(result.channels[0]?.usableForFirstOutreach, false);
});

test('independently fetched phone creates only a human-gated call preparation', () => {
  const result = buildProspectContactability(
    { ...prospect, phone: '0596711010' },
    [],
    [phoneEvidenceEvent()],
  );

  assert.equal(result.status, 'PUBLISHED_VERIFIED');
  assert.equal(result.channels[0]?.type, 'PHONE');
  assert.equal(result.preparation?.kind, 'PHONE_CALL_PREPARATION');
  if (result.preparation?.kind !== 'PHONE_CALL_PREPARATION') {
    assert.fail('expected a human-gated phone preparation');
  }
  assert.equal(result.preparation.requiresHumanDial, true);
  assert.equal(result.preparation.dialsAutomatically, false);
});
