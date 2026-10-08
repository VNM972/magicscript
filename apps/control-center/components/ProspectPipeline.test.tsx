import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ProspectPipeline from './ProspectPipeline';
import { openProspectDetails } from './ProspectDetailsLink';
import {
  projectOperatorProspectQueue,
  type ProspectSummary,
} from '../lib/api';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function prospect(
  id: string,
  email: string,
  status: 'PUBLISHED_VERIFIED' | 'UNVERIFIED',
): ProspectSummary {
  const usable = status === 'PUBLISHED_VERIFIED';
  return {
    id,
    companyName: 'ENTREPRISE HOMONYME',
    siren: id === 'p-one' ? '111111111' : '222222222',
    siret: id === 'p-one' ? '11111111100011' : '22222222200022',
    state: 'QUALIFIED',
    score: 80,
    commercialEligibility: 'HIGH_PRIORITY',
    commercialView: {
      category: 'CURRENT',
      gateVersion: 'COMMERCIAL_ELIGIBILITY_V2.6.0',
      reason: 'CURRENT_GATE_ELIGIBLE',
    },
    phone: '0696123456',
    updatedAt: '2026-09-08T12:00:00.000Z',
    contactability: {
      identity: {
        prospectId: id,
        siren: id === 'p-one' ? '111111111' : '222222222',
        siret: id === 'p-one' ? '11111111100011' : '22222222200022',
      },
      status,
      channels: [
        {
          contactId: `contact-${id}`,
          prospectId: id,
          type: 'EMAIL',
          value: email,
          sourceUrl: `https://example.fr/${id}`,
          observedAt: '2026-09-08T11:00:00.000Z',
          confidence: 90,
          status,
          usableForFirstOutreach: usable,
        },
      ],
      preparation: usable
        ? {
            kind: 'EMAIL_DRAFT',
            contactId: `contact-${id}`,
            recipient: email,
            subject: 'Echange',
            body: 'Bonjour',
            mailtoHref: `mailto:${email}?subject=Echange&body=Bonjour`,
            requiresHumanSend: true,
            sendsAutomatically: false,
          }
        : null,
    },
  };
}

function phoneProspect(): ProspectSummary {
  const item = prospect(
    'p-phone',
    'unverified@example.fr',
    'UNVERIFIED',
  );
  item.phone = '05 96 71 10 10';
  item.contactability = {
    identity: { prospectId: 'p-phone', siren: '222222222', siret: '22222222200022' },
    status: 'PUBLISHED_VERIFIED',
    channels: [
      {
        contactId: 'research-scored-phone-1',
        prospectId: 'p-phone',
        type: 'PHONE',
        value: '05 96 71 10 10',
        sourceUrl: 'https://example.fr/contact',
        observedAt: '2026-09-08T10:30:00.000Z',
        evidenceEventId: 'research-scored-phone-1',
        status: 'PUBLISHED_VERIFIED',
        usableForFirstOutreach: true,
      },
    ],
    preparation: {
      kind: 'PHONE_CALL_PREPARATION',
      contactId: 'research-scored-phone-1',
      evidenceEventId: 'research-scored-phone-1',
      phone: '05 96 71 10 10',
      sourceUrl: 'https://example.fr/contact',
      requiresHumanDial: true,
      dialsAutomatically: false,
    },
  };
  return item;
}

function renderProspects(prospects: ProspectSummary[]): string {
  return renderToStaticMarkup(
    <ProspectPipeline
      prospects={prospects}
      operatorQueue={projectOperatorProspectQueue(prospects)}
      prototypes={[]}
      salesRooms={[]}
      escalations={[]}
    />,
  );
}

test('Deck shows provenance and only exposes Prepare Contact for a usable channel', () => {
  const rawDiagnostic =
    'Company: ENTREPRISE HOMONYME | Reason: Automation job BUILD_PROTOTYPE could not recover after retries: Unable to create process using "C:\\Users\\tester\\python.exe" "D:\\AiderBin\\aider.exe" --model qwen2.5-coder:3b | Recommended action: inspect';
  const html = renderToStaticMarkup(
    <ProspectPipeline
      prospects={[
        prospect('p-one', 'published@example.fr', 'PUBLISHED_VERIFIED'),
        prospect('p-two', 'guessed@example.fr', 'UNVERIFIED'),
      ]}
      operatorQueue={projectOperatorProspectQueue([
        prospect('p-one', 'published@example.fr', 'PUBLISHED_VERIFIED'),
        prospect('p-two', 'guessed@example.fr', 'UNVERIFIED'),
      ])}
      prototypes={[]}
      salesRooms={[]}
      escalations={[
        {
          id: 'escalation-one',
          prospect_id: 'p-one',
          category: 'MANUAL_REVIEW_REQUIRED',
          summary: rawDiagnostic,
          status: 'OPEN',
          created_at: '2026-09-08T12:00:00.000Z',
        },
      ]}
    />,
  );

  assert.match(html, /published@example\.fr/);
  assert.match(html, /guessed@example\.fr/);
  assert.match(html, /111111111/);
  assert.match(html, /11111111100011/);
  assert.match(html, /https:\/\/example\.fr\/p-one/);
  assert.match(html, /mailto:published@example\.fr/);
  assert.doesNotMatch(html, /mailto:guessed@example\.fr/);
  assert.match(html, /PREPARER/);
  assert.match(html, /envoi manuel obligatoire/);
  assert.match(html, /À TRAITER \/ DISPONIBLES \(2\)/);
  assert.match(html, /PROCHAINE ACTION/);
  assert.match(html, /ID p-one · CURRENT · Qualifi/);
  assert.match(html, /PRÊT À CONTACTER/);
  assert.match(html, /À VÉRIFIER/);
  assert.doesNotMatch(html, />APPELER</);
  assert.doesNotMatch(html, />WHATSAPP</);

  const disclosureStart = html.indexOf(
    '<details class="prospectTechnicalDisclosure">',
  );
  assert.ok(disclosureStart > 0);
  const founderVisibleMarkup = html.slice(0, disclosureStart);
  assert.match(founderVisibleMarkup, /Prototype bloqué/);
  assert.match(
    founderVisibleMarkup,
    /Le build ou la génération du prototype doit être repris/,
  );
  assert.doesNotMatch(founderVisibleMarkup, /D:\\AiderBin|python\.exe|qwen2\.5/);
  assert.match(html.slice(disclosureStart), /Voir le diagnostic technique/);
  assert.match(html.slice(disclosureStart), /D:\\AiderBin/);
  assert.match(html.slice(disclosureStart), /qwen2\.5-coder:3b/);
});

test('Deck keeps a clean empty CURRENT view instead of falling back to legacy', () => {
  const legacy = {
    ...prospect('legacy-one', 'legacy@example.fr', 'UNVERIFIED'),
    companyName: 'ENTREPRISE LEGACY',
    state: 'WAITING_REPLY',
    commercialEligibility: undefined,
    commercialView: {
      category: 'LEGACY' as const,
      gateVersion: null,
      reason: 'PRE_GATE_OR_UNVERSIONED' as const,
    },
  };
  const html = renderToStaticMarkup(
    <ProspectPipeline
      prospects={[legacy]}
      operatorQueue={projectOperatorProspectQueue([legacy])}
      prototypes={[]}
      salesRooms={[]}
      escalations={[]}
    />,
  );

  assert.match(html, /À TRAITER \/ DISPONIBLES \(0\)/);
  assert.match(
    html,
    /Aucun prospect disponible ne possède actuellement une prochaine action prouvée/,
  );
  assert.match(html, /ACTIFS V2\.5 \(0\)/);
  assert.match(html, /HISTORIQUE \/ LEGACY \(1\)/);
  assert.doesNotMatch(html, /<strong>ENTREPRISE LEGACY<\/strong>/);
});

test('Deck blocks email preparation while prototype lifecycle is unresolved', () => {
  const item = prospect('p-prototype', 'contact@example.fr', 'PUBLISHED_VERIFIED');
  item.state = 'PROTOTYPE_REQUIRED';

  const html = renderProspects([item]);

  assert.match(html, /Prototype requis/);
  assert.match(html, /PRÉPARER LE PROTOTYPE/);
  assert.match(html, /DIFFÉRER/);
  assert.match(html, /À VALIDER/);
  assert.doesNotMatch(html, /REVUE CANONIQUE/);
  assert.doesNotMatch(html, /PREPARER L&apos;EMAIL/);
  assert.doesNotMatch(html, /href="mailto:/);
});

test('Deck exposes only inert human PHONE preparation with H2.5 provenance', () => {
  const phone = phoneProspect();

  const html = renderToStaticMarkup(
    <ProspectPipeline
      prospects={[phone]}
      operatorQueue={projectOperatorProspectQueue([phone])}
      prototypes={[]}
      salesRooms={[]}
      escalations={[]}
    />,
  );

  assert.match(html, /PHONE · 05 96 71 10 10/);
  assert.match(html, /research-scored-phone-1/);
  assert.match(html, /https:\/\/example\.fr\/contact/);
  assert.match(html, /PHONE_CALL_PREPARATION/);
  assert.match(html, /PRÊT À CONTACTER/);
  assert.match(html, /composer manuellement/);
  assert.match(html, /Appel humain obligatoire/);
  assert.match(html, /aucune composition automatique/);
  assert.doesNotMatch(html, /href="tel:/);
  assert.doesNotMatch(html, /whatsapp/i);
});

test('Deck keeps EMAIL action preferred when valid EMAIL and PHONE coexist', () => {
  const item = prospect('p-one', 'published@example.fr', 'PUBLISHED_VERIFIED');
  item.contactability?.channels.push({
    contactId: 'phone-p-one',
    prospectId: 'p-one',
    type: 'PHONE',
    value: '05 96 71 10 10',
    sourceUrl: 'https://example.fr/phone',
    observedAt: '2026-09-08T10:30:00.000Z',
    evidenceEventId: 'evidence-phone-p-one',
    status: 'PUBLISHED_VERIFIED',
    usableForFirstOutreach: true,
  });

  const html = renderProspects([item]);

  assert.match(html, /href="mailto:published@example\.fr/);
  assert.match(html, /envoi manuel obligatoire/);
  assert.doesNotMatch(html, /PHONE_CALL_PREPARATION/);
  assert.doesNotMatch(html, /href="tel:/);
});

test('Deck suppresses actionable controls for malformed PHONE preparation', () => {
  const item = phoneProspect();
  item.contactability!.preparation = {
    kind: 'PHONE_CALL_PREPARATION',
    contactId: 'research-scored-phone-1',
  } as unknown as NonNullable<ProspectSummary['contactability']>['preparation'];

  const html = renderProspects([item]);

  assert.match(html, /À VÉRIFIER/);
  assert.doesNotMatch(html, /PHONE_CALL_PREPARATION/);
  assert.doesNotMatch(html, /composer manuellement/);
  assert.doesNotMatch(html, /href="tel:/);
  assert.doesNotMatch(html, /href="mailto:/);
});

test('Deck exposes no contact control for DO_NOT_CONTACT or OPPOSED', () => {
  const doNotContact = phoneProspect();
  doNotContact.state = 'DO_NOT_CONTACT';
  const opposed = phoneProspect();
  opposed.id = 'p-opposed';
  opposed.contactability!.identity.prospectId = 'p-opposed';
  opposed.contactability!.channels[0]!.prospectId = 'p-opposed';
  opposed.contactability!.status = 'OPPOSED';

  const html = renderProspects([doNotContact, opposed]);

  assert.match(html, /À TRAITER \/ DISPONIBLES \(0\)/);
  assert.doesNotMatch(html, /PHONE_CALL_PREPARATION/);
  assert.doesNotMatch(html, /composer manuellement/);
  assert.doesNotMatch(html, /href="tel:|href="mailto:/);
});

test('Client prospect action opens the exact details target without lifecycle mutation', () => {
  class FakeDetails {
    open = false;
    scrollCalls: unknown[] = [];
    scrollIntoView(options: unknown) {
      this.scrollCalls.push(options);
    }
  }

  const target = new FakeDetails();
  const previousDocument = globalThis.document;
  const previousDetails = globalThis.HTMLDetailsElement;
  globalThis.HTMLDetailsElement = FakeDetails as unknown as typeof HTMLDetailsElement;
  globalThis.document = {
    getElementById(id: string) {
      if (id === 'prospect-73576dde-c29e-44ec-9a0d-fa7c0e0fb712') return target as unknown as HTMLElement;
      return null;
    },
  } as unknown as Document;

  try {
    assert.equal(openProspectDetails('73576dde-c29e-44ec-9a0d-fa7c0e0fb712'), true);
    assert.equal(target.open, true);
    assert.deepEqual(target.scrollCalls, [{ behavior: 'smooth', block: 'start' }]);
    assert.equal(openProspectDetails('missing-prospect'), false);
  } finally {
    globalThis.document = previousDocument;
    globalThis.HTMLDetailsElement = previousDetails;
  }
});
