'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  VIEWPORTS,
  parseArgs,
  routesFor,
  viewportsFor,
} = require('./qa-surface.cjs');

test('qa surface defaults cover the three local commercial surfaces', () => {
  const args = parseArgs([]);
  assert.deepEqual(routesFor(args), [
    { name: 'public', route: '/' },
    { name: 'prototype', route: '/demo/snemm' },
    { name: 'sales-room', route: '/p/snemm' },
  ]);
  assert.deepEqual(viewportsFor(args.viewport), [VIEWPORTS.desktop, VIEWPORTS.mobile]);
});

test('qa surface accepts a bounded route and exact viewport', () => {
  const args = parseArgs(['--surface', 'sales-room', '--fixture', 'safiu-protection', '--viewport', 'mobile']);
  assert.deepEqual(routesFor(args), [{ name: 'sales-room', route: '/p/safiu-protection' }]);
  assert.deepEqual(viewportsFor(args.viewport), [VIEWPORTS.mobile]);
});

test('qa surface rejects traversal and invalid viewport input', () => {
  assert.throws(() => parseArgs(['--route', '/../secret']), /without traversal/);
  assert.throws(() => parseArgs(['--viewport', 'tablet']), /desktop, mobile, or both/);
});
