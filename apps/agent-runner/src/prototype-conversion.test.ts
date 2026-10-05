import assert from 'node:assert/strict';
import test from 'node:test';

import type { ClaimedJob } from './api';
import { buildPrompt } from './prompts';

function claim(
  kind: 'BUILD_PROTOTYPE' | 'RUN_PROTOTYPE_QA',
  salesRoomUrl: string | null,
): ClaimedJob {
  return {
    job: {
      id: 'job-wp08',
      kind,
      payload: {},
    },
    prospect: {
      id: 'prospect-wp08',
      companyName: 'Entreprise WP08',
      state: 'PROTOTYPE_REQUIRED',
      primaryCta: 'Demander un devis',
    },
    contacts: [],
    prototypeContext: {
      id: 'prototype-wp08',
      prospect_id: 'prospect-wp08',
      repo_path: 'D:\\MagicScript\\repository\\prototypes\\wp08',
      status: 'BUILDING',
      qa_status: null,
    },
    prototypeConversion: {
      salesRoomUrl,
      salesRoomSlug: 'entreprise-wp08-prospect-wp08',
      ctaTarget: 'SALES_ROOM',
    },
    prototypeStrategy: {
      objective: 'Transformer un intérêt en échange qualifié',
      primaryAsset: 'Expertise vérifiée',
      primaryFriction: 'Conversion',
      hero: {
        primaryCta: 'Demander un devis',
      },
      factsAllowed: [],
      factsForbiddenOrUnverified: [],
    },
  } as unknown as ClaimedJob;
}

test('WP-08 gives BUILD_PROTOTYPE the exact Sales Room conversion destination', () => {
  const url =
    'https://magicscript.example/p/entreprise-wp08-prospect-wp08';

  const prompt = buildPrompt(
    claim('BUILD_PROTOTYPE', url),
  );

  assert.ok(prompt.includes(url));
  assert.match(
    prompt,
    /primary CTA MUST link exactly to that salesRoomUrl/,
  );
  assert.match(
    prompt,
    /MUST NOT implement its own lead\/contact form/,
  );
  assert.match(
    prompt,
    /do not POST directly from the prototype/,
  );
});

test('WP-08 QA fails closed on wrong CTA routing or prototype-local commercial forms', () => {
  const url =
    'https://magicscript.example/p/entreprise-wp08-prospect-wp08';

  const prompt = buildPrompt(
    claim('RUN_PROTOTYPE_QA', url),
  );

  assert.ok(prompt.includes(url));
  assert.match(
    prompt,
    /missing or different href is BLOCKING/,
  );
  assert.match(
    prompt,
    /prototype-local lead\/contact form/,
  );
});

test('WP-08 keeps conversion demonstrative when no Sales Room URL is available', () => {
  const prompt = buildPrompt(
    claim('BUILD_PROTOTYPE', null),
  );

  assert.match(
    prompt,
    /if salesRoomUrl is null, do not fake connected conversion/,
  );
});
