import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAGIC_SCRIPT_PRICING_POLICY,
  resolvePricingPackage,
} from '../orchestrator/pricing-policy';

test('exposes the canonical Magic Script commercial pricing policy', () => {
  assert.equal(MAGIC_SCRIPT_PRICING_POLICY.packages.STARTER.priceCents, 79000);
  assert.equal(MAGIC_SCRIPT_PRICING_POLICY.packages.ESSENTIEL.priceCents, 119000);
  assert.equal(MAGIC_SCRIPT_PRICING_POLICY.packages.BUSINESS.priceCents, 169000);
  assert.equal(MAGIC_SCRIPT_PRICING_POLICY.packages.PREMIUM.priceCents, 229000);
  assert.equal(MAGIC_SCRIPT_PRICING_POLICY.annualCareCents, 19900);
  assert.equal(MAGIC_SCRIPT_PRICING_POLICY.depositPercent, 50);
  assert.equal(MAGIC_SCRIPT_PRICING_POLICY.balancePercent, 50);
});

test('keeps fixed-price packages deterministic', () => {
  const starter = resolvePricingPackage('STARTER');
  const essentiel = resolvePricingPackage('ESSENTIEL');
  const business = resolvePricingPackage('BUSINESS');

  assert.equal(starter.status, 'FIXED');
  assert.equal(starter.priceCents, 79000);
  assert.equal(starter.includedRevisionRounds, 1);

  assert.equal(essentiel.status, 'FIXED');
  assert.equal(essentiel.priceCents, 119000);
  assert.equal(essentiel.includedRevisionRounds, 2);

  assert.equal(business.status, 'FIXED');
  assert.equal(business.priceCents, 169000);
  assert.equal(business.includedRevisionRounds, 3);
});

test('treats Premium as a floor price rather than an invented final quote', () => {
  const premium = resolvePricingPackage('PREMIUM');

  assert.equal(premium.status, 'FROM');
  assert.equal(premium.priceCents, 229000);
  assert.equal(premium.commercialName, 'Premium');
  assert.equal(premium.includedRevisionRounds, null);
});

test('fails closed for custom or unknown pricing', () => {
  const custom = resolvePricingPackage('CUSTOM');
  const unknown = resolvePricingPackage('enterprise-super-package');
  const missing = resolvePricingPackage(null);

  assert.equal(custom.status, 'CUSTOM');
  assert.equal(custom.priceCents, null);

  assert.equal(unknown.status, 'UNKNOWN');
  assert.equal(unknown.priceCents, null);

  assert.equal(missing.status, 'UNKNOWN');
  assert.equal(missing.priceCents, null);
});
