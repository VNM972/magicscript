import assert from 'node:assert/strict';
import test from 'node:test';

import { validatePrototypeConversionSource } from './prototype-conversion-source';

const salesRoomUrl =
  'https://magicscript.example/p/wp08-prospect';

const primaryCtaLabels = [
  'Demander un devis',
];

test('WP-08 validator accepts the exact Sales Room href on the primary CTA', () => {
  const findings = validatePrototypeConversionSource(
    `<a href="${salesRoomUrl}">Demander un devis</a>`,
    {
      salesRoomUrl,
      ctaTarget: 'SALES_ROOM',
    },
    primaryCtaLabels,
  );

  assert.deepEqual(findings, []);
});

test('WP-08 validator resolves a local href constant on the primary CTA', () => {
  const findings = validatePrototypeConversionSource(
    `const conversionUrl = '${salesRoomUrl}';
     export default function Page() {
       return <a href={conversionUrl}>Demander un devis</a>;
     }`,
    {
      salesRoomUrl,
      ctaTarget: 'SALES_ROOM',
    },
    primaryCtaLabels,
  );

  assert.deepEqual(findings, []);
});

test('WP-08 validator normalizes CTA accents and punctuation', () => {
  const findings = validatePrototypeConversionSource(
    `<a href="${salesRoomUrl}">Découvrir les actions de la PAULINE COIFFURE</a>`,
    {
      salesRoomUrl,
      ctaTarget: 'SALES_ROOM',
    },
    [
      'Decouvrir les actions de la PAULINE COIFFURE.',
    ],
  );

  assert.deepEqual(findings, []);
});

test('WP-08 validator rejects a wrong primary CTA href', () => {
  const findings = validatePrototypeConversionSource(
    '<a href="https://example.test/contact">Demander un devis</a>',
    {
      salesRoomUrl,
      ctaTarget: 'SALES_ROOM',
    },
    primaryCtaLabels,
  );

  assert.equal(
    findings.some((finding) =>
      finding.includes(
        'does not match the expected Sales Room URL',
      ),
    ),
    true,
  );
});

test('WP-08 validator rejects the correct URL when it exists only on an unrelated link', () => {
  const findings = validatePrototypeConversionSource(
    `<a href="${salesRoomUrl}">Mentions légales</a>
     <a href="#contact">Demander un devis</a>`,
    {
      salesRoomUrl,
      ctaTarget: 'SALES_ROOM',
    },
    primaryCtaLabels,
  );

  assert.equal(
    findings.some((finding) =>
      finding.includes(
        'does not match the expected Sales Room URL',
      ),
    ),
    true,
  );
});

test('WP-08 validator fails closed when no primary CTA label is available', () => {
  const findings = validatePrototypeConversionSource(
    `<a href="${salesRoomUrl}">Continuer</a>`,
    {
      salesRoomUrl,
      ctaTarget: 'SALES_ROOM',
    },
    [],
  );

  assert.equal(
    findings.some((finding) =>
      finding.includes(
        'does not match the expected Sales Room URL',
      ),
    ),
    true,
  );
});

test('WP-08 validator rejects URL text without a matching primary CTA href', () => {
  const findings = validatePrototypeConversionSource(
    `<p>${salesRoomUrl}</p>
     <a href="#contact">Demander un devis</a>`,
    {
      salesRoomUrl,
      ctaTarget: 'SALES_ROOM',
    },
    primaryCtaLabels,
  );

  assert.equal(
    findings.some((finding) =>
      finding.includes(
        'does not match the expected Sales Room URL',
      ),
    ),
    true,
  );
});

test('WP-08 validator rejects a prototype-local form', () => {
  const findings = validatePrototypeConversionSource(
    `<form><input name="email" /></form>
     <a href="${salesRoomUrl}">Demander un devis</a>`,
    {
      salesRoomUrl,
      ctaTarget: 'SALES_ROOM',
    },
    primaryCtaLabels,
  );

  assert.equal(
    findings.some((finding) =>
      finding.includes('local form'),
    ),
    true,
  );
});

test('WP-08 validator rejects direct Sales Room writes', () => {
  const findings = validatePrototypeConversionSource(
    `fetch('/api/public/sales-room-message', {
       method: 'POST'
     });
     <a href="${salesRoomUrl}">Demander un devis</a>`,
    {
      salesRoomUrl,
      ctaTarget: 'SALES_ROOM',
    },
    primaryCtaLabels,
  );

  assert.equal(
    findings.some((finding) =>
      finding.includes(
        'direct commercial write endpoint',
      ),
    ),
    true,
  );
});

test('WP-08 validator rejects the legacy local contact API', () => {
  const findings = validatePrototypeConversionSource(
    `fetch('/api/contact', { method: 'POST' });
     <a href="${salesRoomUrl}">Demander un devis</a>`,
    {
      salesRoomUrl,
      ctaTarget: 'SALES_ROOM',
    },
    primaryCtaLabels,
  );

  assert.equal(
    findings.some((finding) =>
      finding.includes('/api/contact'),
    ),
    true,
  );
});