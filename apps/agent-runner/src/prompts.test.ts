import assert from 'node:assert/strict';
import test from 'node:test';

import type { ClaimedJob } from './api';
import { buildPrompt } from './prompts';

test('prototype strategy prompt receives the deterministic design direction as constraints, not facts', () => {
  const claim = {
    job: {
      id: 'job-design-direction',
      kind: 'GENERATE_PROTOTYPE_STRATEGY',
      prospectId: 'prospect-design-direction',
      payload: {
        designDirection: {
          id: 'btp-artisan-architecture',
          label: 'BTP / Artisan / Architecture',
          visualPrinciples: ['structural grid'],
          heroStrategy: 'Lead with verified work.',
          sectionGrammar: ['hero', 'verified work', 'quote action'],
          ctaStrategy: 'Use one quote action.',
          imageStrategy: 'Use verified project imagery.',
          typographicCharacter: 'Technical grotesk.',
          density: 'MEDIUM',
          motionBudget: 'LOW',
          mobileBehavior: ['keep quote action clear at 390px'],
          proofRequirements: ['claims require evidence'],
          antiPatterns: ['fake metrics'],
        },
      },
      status: 'RUNNING',
      attempts: 1,
      maxAttempts: 3,
    },
    prospect: {
      id: 'prospect-design-direction',
      companyName: 'Fixture BTP',
      activity: 'Bâtiment',
      state: 'PROTOTYPE_REQUIRED',
    },
    contacts: [],
  } satisfies ClaimedJob;

  const prompt = buildPrompt(claim);
  assert.match(prompt, /btp-artisan-architecture/);
  assert.match(prompt, /internal visual constraint, not a source of prospect facts/);
  assert.match(prompt, /fake metrics/);
});

test('contact discovery is identity-bound and forbids company-name-only resolution', () => {
  const prompt = buildPrompt({
    job: {
      id: 'contact-identity-job',
      kind: 'DISCOVER_CONTACT',
      payload: {},
      status: 'RUNNING',
      attempts: 1,
      maxAttempts: 3,
    },
    prospect: {
      id: 'prospect-contact-identity',
      companyName: 'Entreprise Homonyme',
      siren: '111111111',
      siret: '11111111100011',
      state: 'CONTACT_DISCOVERY',
    },
    contacts: [],
  });

  assert.match(prompt, /111111111/);
  assert.match(prompt, /11111111100011/);
  assert.match(prompt, /never resolve a contact from companyName alone/);
  assert.match(prompt, /observedExactValue=true only when the exact complete email/);
});

test('prototype build and QA prompts enforce the shared anti-slop composition gate', () => {
  const designDirection = {
    id: 'corporate-premium',
    label: 'Corporate Premium',
    visualPrinciples: ['quiet confidence', 'editorial spacing'],
    heroStrategy: 'Lead with verified positioning and decision value.',
    sectionGrammar: ['hero', 'value thesis', 'selected evidence', 'engagement path'],
    ctaStrategy: 'Invite one qualified conversation.',
    imageStrategy: 'Use verified environmental imagery with disciplined cropping.',
    typographicCharacter: 'Editorial serif accent with sober sans-serif reading text.',
    density: 'LOW',
    motionBudget: 'LOW',
    mobileBehavior: ['preserve whitespace at 390px'],
    proofRequirements: ['claims require evidence'],
    antiPatterns: ['card-wall composition', 'generic SaaS dashboard'],
  };

  const base = {
    prospect: {
      id: 'prospect-composition-gate',
      companyName: 'Fixture Corporate',
      activity: 'Services professionnels',
      state: 'PROTOTYPE_REQUIRED',
    },
    contacts: [],
    prototypeContext: {
      id: 'prototype-composition-gate',
      prospect_id: 'prospect-composition-gate',
      repo_path: 'prototypes/fixture-corporate',
      status: 'BUILT',
    },
  };

  for (const kind of ['BUILD_PROTOTYPE', 'RUN_PROTOTYPE_QA'] as const) {
    const claim = {
      ...base,
      job: {
        id: `job-${kind.toLowerCase()}`,
        kind,
        prospectId: 'prospect-composition-gate',
        payload: { designDirection },
        status: 'RUNNING',
        attempts: 1,
        maxAttempts: 3,
      },
    } satisfies ClaimedJob;

    const prompt = buildPrompt(claim);
    assert.match(prompt, /single composition contract/);
    assert.match(prompt, /BLOCK any unjustified card-wall/);
    assert.match(prompt, /hero assembled from interchangeable blocks without a clear art direction/);
    assert.match(prompt, /insufficient negative space/);
    assert.match(prompt, /monotonous editorial rhythm/);
    assert.match(prompt, /not a sector justification/);
    if (kind === 'RUN_PROTOTYPE_QA') {
      assert.match(prompt, /WEB DESIGN COMPOSITION CHECKER/);
      assert.match(prompt, /do not downgrade it to a note/);
    }
  }
});
