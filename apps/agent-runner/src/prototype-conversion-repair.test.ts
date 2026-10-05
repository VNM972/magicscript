import test from 'node:test';
import assert from 'node:assert/strict';

import { repairPrototypePrimaryCtaSource } from './prototype-conversion-source';

test('repairs the verified primary CTA href to the canonical Sales Room URL', () => {
  const source = `
    <main>
      <a className="button button-primary" href="#parcours">
        Découvrir les actions de la SNEMM
        <span>→</span>
      </a>
      <a href="https://www.snemm.fr">Visiter snemm.fr</a>
      <a className="button button-dark" href="#parcours">
        Découvrir les actions de la SNEMM
      </a>
    </main>
  `;

  const result = repairPrototypePrimaryCtaSource(
    source,
    {
      salesRoomUrl: 'http://127.0.0.1:4173/p/snemm',
      salesRoomSlug: 'snemm',
      ctaTarget: 'SALES_ROOM',
    },
    ['Découvrir les actions de la SNEMM'],
  );

  assert.equal(result.patched, true);
  assert.equal(result.patchedCount, 2);
  assert.equal(
    result.source.match(/href="http:\/\/127\.0\.0\.1:4173\/p\/snemm"/g)?.length,
    2,
  );
  assert.match(result.source, /href="https:\/\/www\.snemm\.fr"/);
});

test('does not invent a conversion destination when Sales Room URL is unavailable', () => {
  const source =
    '<a href="#contact">Demander un devis</a>';

  const result = repairPrototypePrimaryCtaSource(
    source,
    {
      salesRoomUrl: null,
      salesRoomSlug: null,
      ctaTarget: 'SALES_ROOM',
    },
    ['Demander un devis'],
  );

  assert.equal(result.patched, false);
  assert.equal(result.patchedCount, 0);
  assert.equal(result.source, source);
});

test('does not rewrite unrelated anchors when the verified CTA label is absent', () => {
  const source =
    '<a href="#mission">Découvrir notre mission</a>';

  const result = repairPrototypePrimaryCtaSource(
    source,
    {
      salesRoomUrl: 'http://127.0.0.1:4173/p/test',
      salesRoomSlug: 'test',
      ctaTarget: 'SALES_ROOM',
    },
    ['Demander un devis'],
  );

  assert.equal(result.patched, false);
  assert.equal(result.patchedCount, 0);
  assert.equal(result.source, source);
});