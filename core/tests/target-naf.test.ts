import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BROAD_DISCOVERY_NAF_DIVISIONS,
  FIRST_WAVE_ACTIVITY_CODES,
  STRONG_ICP_NAF_DIVISION_SCORES,
  TARGET_NAF_DIVISIONS,
  isBroadDiscoveryNafActivity,
  isTargetNafDivision,
  nafDivision,
  strongIcpScoreForNaf,
} from '../icp/target-naf';

test('BROAD_DISCOVERY_NAF_DIVISIONS preserves the historical 19-division policy', () => {
  assert.deepEqual([...BROAD_DISCOVERY_NAF_DIVISIONS], [
    '41', '42', '43', '45', '47', '55', '56', '68', '71', '73', '74', '77', '79', '81', '90', '91', '93', '95', '96',
  ]);
});

test('TARGET_NAF_DIVISIONS lists the six real-target divisions', () => {
  assert.deepEqual([...TARGET_NAF_DIVISIONS], ['45', '47', '55', '56', '95', '96']);
});

test('TARGET_NAF_DIVISIONS is a subset of BROAD_DISCOVERY_NAF_DIVISIONS', () => {
  for (const division of TARGET_NAF_DIVISIONS) {
    assert.ok((BROAD_DISCOVERY_NAF_DIVISIONS as readonly string[]).includes(division), division);
  }
});

test('STRONG_ICP_NAF_DIVISION_SCORES matches the historical weights', () => {
  assert.equal(STRONG_ICP_NAF_DIVISION_SCORES.get('45'), 10);
  assert.equal(STRONG_ICP_NAF_DIVISION_SCORES.get('47'), 10);
  assert.equal(STRONG_ICP_NAF_DIVISION_SCORES.get('55'), 14);
  assert.equal(STRONG_ICP_NAF_DIVISION_SCORES.get('56'), 14);
  assert.equal(STRONG_ICP_NAF_DIVISION_SCORES.get('95'), 10);
  assert.equal(STRONG_ICP_NAF_DIVISION_SCORES.get('96'), 10);
  assert.equal(STRONG_ICP_NAF_DIVISION_SCORES.size, 6);
});

test('FIRST_WAVE_ACTIVITY_CODES keeps the exact 5-char codes per sector', () => {
  assert.ok(FIRST_WAVE_ACTIVITY_CODES.FOOD_SERVICE.includes('56.10A'));
  assert.ok(FIRST_WAVE_ACTIVITY_CODES.FOOD_SERVICE.includes('56.30Z'));
  assert.ok(FIRST_WAVE_ACTIVITY_CODES.HAIR_BEAUTY.includes('96.02A'));
  assert.ok(FIRST_WAVE_ACTIVITY_CODES.HAIR_BEAUTY.includes('96.02B'));
  assert.ok(FIRST_WAVE_ACTIVITY_CODES.LOCAL_RETAIL.includes('47.11A'));
  assert.ok(FIRST_WAVE_ACTIVITY_CODES.LOCAL_RETAIL.includes('47.99B'));
  assert.equal(FIRST_WAVE_ACTIVITY_CODES.FOOD_SERVICE.length, 7);
  assert.equal(FIRST_WAVE_ACTIVITY_CODES.HAIR_BEAUTY.length, 2);
  assert.equal(FIRST_WAVE_ACTIVITY_CODES.LOCAL_RETAIL.length, 50);
});

test('nafDivision normalizes and extracts the 2-char division', () => {
  assert.equal(nafDivision('56.10A'), '56');
  assert.equal(nafDivision(' 47.11A '), '47');
  assert.equal(nafDivision(''), undefined);
  assert.equal(nafDivision(undefined), undefined);
  assert.equal(nafDivision(null), undefined);
  assert.equal(nafDivision('AB'), undefined);
});

test('isBroadDiscoveryNafActivity preserves the historical broad behavior', () => {
  assert.equal(isBroadDiscoveryNafActivity('56.10A'), true);
  assert.equal(isBroadDiscoveryNafActivity('43.22B'), true);
  assert.equal(isBroadDiscoveryNafActivity('96.02A'), true);
  assert.equal(isBroadDiscoveryNafActivity('01.11Z'), false);
  assert.equal(isBroadDiscoveryNafActivity(undefined), false);
});

test('isTargetNafDivision restricts to the six real-target divisions', () => {
  assert.equal(isTargetNafDivision('56.10A'), true);
  assert.equal(isTargetNafDivision('96.02A'), true);
  assert.equal(isTargetNafDivision('47.11A'), true);
  assert.equal(isTargetNafDivision('43.22B'), false);
  assert.equal(isTargetNafDivision('70.10Z'), false);
  assert.equal(isTargetNafDivision(undefined), false);
});

test('strongIcpScoreForNaf returns the historical weights', () => {
  assert.equal(strongIcpScoreForNaf('56.10A'), 14);
  assert.equal(strongIcpScoreForNaf('47.11A'), 10);
  assert.equal(strongIcpScoreForNaf('43.22B'), undefined);
  assert.equal(strongIcpScoreForNaf(undefined), undefined);
});
