import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_SYSTEM_HUB, resolveSwarmHub } from '../hubs/registry';

test('routes SNEMM to the memory and military associations hub', () => {
  const hub = resolveSwarmHub({
    companyName: 'SNEMM',
    activity: 'Association nationale d’entraide et de mémoire',
    primaryAsset: 'Accompagnement des militaires et vétérans',
  });

  assert.equal(hub.id, 'ASSOCIATIONS_MEMOIRE_MILITAIRE');
  assert.equal(hub.businessUnit, 'BU Associations mémoire militaire');
  assert.equal(hub.masterOfWork, 'MO Associations mémoire militaire');
});

test('routes an unclassified activity to the bounded generalist hub', () => {
  const hub = resolveSwarmHub({
    companyName: 'Entreprise locale',
    activity: 'Activité à confirmer',
  });

  assert.equal(hub.id, 'GENERALISTE');
  assert.equal(hub.concurrencyCap, 1);
});

test('keeps the design master transversal instead of duplicating a prospect hub', () => {
  assert.equal(DESIGN_SYSTEM_HUB.masterOfWork, 'MO Web Design');
  assert.equal(DESIGN_SYSTEM_HUB.concurrencyCap, 1);
});
