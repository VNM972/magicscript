import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveProspectCommercialView,
  partitionProspectsByCommercialView,
  sortCurrentCommercialProspects,
} from '../orchestrator/prospect-commercial-view';
import type { MagicScriptEvent } from '../types/events';
import type { Prospect } from '../types/prospect';

function prospect(overrides: Partial<Prospect> = {}): Prospect {
  return {
    id: 'prospect-current',
    companyName: 'Entreprise locale',
    siren: '111111111',
    siret: '11111111100011',
    commercialEligibility: 'HIGH_PRIORITY',
    state: 'DISCOVERED',
    score: 80,
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-08T10:00:00.000Z',
    ...overrides,
  };
}

const gateEvent: MagicScriptEvent = {
  id: 'gate-event',
  prospectId: 'prospect-current',
  actor: 'research-agent',
  type: 'discovery.prospect_created',
  payload: { gateVersion: 'COMMERCIAL_ELIGIBILITY_V2.6.0' },
  createdAt: '2026-09-08T10:00:00.000Z',
};

test('post-gate eligible prospect appears in CURRENT', () => {
  assert.equal(
    deriveProspectCommercialView(prospect({ state: 'QUALIFIED' }), [gateEvent]).category,
    'CURRENT',
  );
});

test('new post-gate discovery remains pre-active while staying operator-actionable', () => {
  assert.deepEqual(deriveProspectCommercialView(prospect(), [gateEvent]), {
    category: 'LEGACY',
    gateVersion: 'COMMERCIAL_ELIGIBILITY_V2.6.0',
    reason: 'CURRENT_GATE_PRE_ACTIVE',
  });
});

test('pre-gate and UNKNOWN legacy prospects never become current from an old score', () => {
  const view = deriveProspectCommercialView(
    prospect({ commercialEligibility: undefined, score: 99 }),
    [],
  );
  assert.equal(view.category, 'LEGACY');
  assert.equal(view.gateVersion, null);
});

test('explicit metadata and deterministic fixture ids stay INTERNAL', () => {
  assert.equal(
    deriveProspectCommercialView(prospect(), [gateEvent], {
      syntheticMetadata: true,
    }).category,
    'INTERNAL',
  );
  assert.equal(
    deriveProspectCommercialView(
      prospect({ id: '00000000-0000-4000-8000-000000000001' }),
      [],
    ).category,
    'INTERNAL',
  );
});

test('known project and Magic Script legal identities stay INTERNAL', () => {
  assert.deepEqual(
    deriveProspectCommercialView(
      prospect({
        companyName: 'SUNeLEK - WhatsApp E2E',
        siren: '831275631',
        siret: '83127563100024',
      }),
      [gateEvent],
    ),
    {
      category: 'INTERNAL',
      gateVersion: null,
      reason: 'KNOWN_PROJECT_IDENTITY',
    },
  );
  assert.deepEqual(
    deriveProspectCommercialView(
      prospect({
        companyName: 'MIRE STEPHANE',
        siren: '504451477',
        siret: '50445147700039',
      }),
      [gateEvent],
    ),
    {
      category: 'INTERNAL',
      gateVersion: null,
      reason: 'INTERNAL_BUSINESS_IDENTITY',
    },
  );
});

test('current-gate REJECT and invalid identity stay out of CURRENT', () => {
  assert.equal(
    deriveProspectCommercialView(
      prospect({ commercialEligibility: 'REJECT' }),
      [gateEvent],
    ).category,
    'REJECTED',
  );
  assert.equal(
    deriveProspectCommercialView(prospect({ siret: undefined }), [gateEvent])
      .category,
    'REJECTED',
  );
});

test('contact-level opposition stays out of CURRENT even when lifecycle is not DO_NOT_CONTACT', () => {
  assert.deepEqual(
    deriveProspectCommercialView(prospect(), [gateEvent], {
      contactabilityOpposed: true,
    }),
    {
      category: 'REJECTED',
      gateVersion: 'COMMERCIAL_ELIGIBILITY_V2.6.0',
      reason: 'CURRENT_GATE_OPPOSED',
    },
  );
});

test('same-name history stays as separate legal records with every id preserved', () => {
  const rows = [
    { ...prospect({ id: 'legacy-a', companyName: 'APAVE' }), commercialView: deriveProspectCommercialView(prospect({ id: 'legacy-a' }), []) },
    { ...prospect({ id: 'legacy-b', companyName: 'APAVE' }), commercialView: deriveProspectCommercialView(prospect({ id: 'legacy-b' }), []) },
  ];
  const partition = partitionProspectsByCommercialView(rows);
  assert.deepEqual(partition.legacy.map((item) => item.id), [
    'legacy-a',
    'legacy-b',
  ]);
});

test('current ranking uses classification, contactability, then stored score without recomputing it', () => {
  const baseView = deriveProspectCommercialView(prospect(), [gateEvent]);
  const ordered = sortCurrentCommercialProspects([
    { ...prospect({ id: 'research', commercialEligibility: 'RESEARCH', score: 100 }), commercialView: baseView },
    { ...prospect({ id: 'high-no-contact', score: 90 }), commercialView: baseView },
    { ...prospect({ id: 'high-contact', score: 70 }), commercialView: baseView, contactability: { preparation: {} } },
  ]);
  assert.deepEqual(ordered.map((item) => item.id), [
    'high-contact',
    'high-no-contact',
    'research',
  ]);
  assert.deepEqual(ordered.map((item) => item.score), [70, 90, 100]);
});

test('an empty CURRENT partition stays empty and never falls back to legacy', () => {
  const legacy = prospect({ id: 'legacy-only', commercialEligibility: undefined });
  const partition = partitionProspectsByCommercialView([
    { ...legacy, commercialView: deriveProspectCommercialView(legacy, []) },
  ]);
  assert.deepEqual(partition.current, []);
  assert.equal(partition.legacy.length, 1);
});

test('previous eligibility policy events remain legacy until rescored', () => {
  const previousGateEvent = {
    ...gateEvent,
    payload: { gateVersion: 'COMMERCIAL_ELIGIBILITY_V2.5.1' },
  };
  assert.equal(
    deriveProspectCommercialView(prospect({ state: 'QUALIFIED' }), [previousGateEvent]).category,
    'LEGACY',
  );
});

test('operator exclusions reject both historical and current-gate businesses', () => {
  for (const events of [[], [gateEvent]]) {
    assert.deepEqual(
      deriveProspectCommercialView(prospect({ companyName: 'APAVE', state: 'WAITING_REPLY' }), events),
      { category: 'REJECTED', gateVersion: null, reason: 'OPERATOR_EXCLUDED_IDENTITY' },
    );
  }
  const rows = ['legacy-a', 'legacy-b'].map((id) => {
    const row = prospect({ id, companyName: 'APAVE', state: 'DO_NOT_CONTACT' });
    return { ...row, commercialView: deriveProspectCommercialView(row, []) };
  });
  const partition = partitionProspectsByCommercialView(rows);
  assert.deepEqual(partition.current, []);
  assert.deepEqual(partition.rejected.map((row) => row.id), ['legacy-a', 'legacy-b']);
});

test('blacklisted BEAUTY_FIXTURE remains INTERNAL rather than an operator exclusion', () => {
  assert.deepEqual(
    deriveProspectCommercialView(prospect({ companyName: 'BEAUTY_FIXTURE', state: 'DO_NOT_CONTACT' }), []),
    { category: 'INTERNAL', gateVersion: null, reason: 'INTERNAL_BUSINESS_IDENTITY' },
  );
});
