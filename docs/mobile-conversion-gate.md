# Magic Script — Mobile Conversion Gate

Status: CANONICAL QUALITY GATE
Version: 1
Scope: Magic Script client prototypes and production websites, especially local-service and Martinique-oriented projects.

## Principle

For Magic Script, mobile is a primary product surface, not a reduced desktop layout.

A prototype or production site MUST NOT be considered commercially ready merely because it is responsive.

For mobile-first local businesses, the design must optimize the real customer path:

DISCOVER → UNDERSTAND → CHOOSE → CONTACT / BOOK / REQUEST A QUOTE

The primary commercial action should normally be reachable within three meaningful interactions from arrival.

## 1. Primary mobile journey

Before design, identify one explicit primary journey.

Examples:

- Discover → Understand → Choose → Book
- Need → Proof → Offer → Request quote
- Activity → Date / Level → Price → WhatsApp
- Product → Proof → Availability → Contact

Do not mirror the company's internal organization when that creates unnecessary navigation.

## 2. Primary CTA

The primary commercial CTA MUST:

- be visible or immediately understandable from the first mobile screen;
- use an action-oriented label;
- remain easy to reach after scrolling;
- work correctly on a real device;
- not compete with several equally prominent actions.

Relevant examples:

- Réserver
- WhatsApp
- Appeler
- Demander un devis
- Choisir une date
- Vérifier une disponibilité

When appropriate, a restrained fixed mobile action bar may be used, for example:

Appeler | WhatsApp | Réserver

Only expose channels the client actually operates.

## 3. Navigation

Target:

- maximum 4–5 primary destinations where possible;
- no unnecessary nested navigation;
- no critical hover-only interaction;
- obvious return path;
- primary commercial information never buried several levels deep.

Navigation must answer:

"What does this visitor need next?"

not:

"How is this company internally organized?"

## 4. First mobile viewport

At the reference width of 390 px, the visitor should quickly understand:

- who the business is;
- what it offers;
- where it operates when location matters;
- why the offer is relevant;
- what action to take next.

Hard warning signs:

- oversized decorative hero;
- oversized logo;
- abstract slogan without commercial meaning;
- animation delaying useful content;
- CTA pushed below the useful first screen;
- consent UI dominating the experience.

## 5. Touch ergonomics

Internal target:

- important touch targets approximately 44 × 44 px or larger;
- sufficient spacing between actions;
- no tiny close buttons;
- no microscopic text link as the main CTA;
- comfortable form controls;
- no zoom required;
- no interaction requiring precision better suited to a mouse.

The interface must remain usable one-handed.

## 6. Forms

Every requested field must justify its existence.

For simple lead generation, prefer the minimum viable information.

Typical example:

- name;
- phone / WhatsApp;
- need, date or request;
- submit.

Avoid collecting unnecessary information before the business needs it.

Forms must also provide:

- appropriate mobile keyboard/input type;
- autofill where useful;
- clear inline validation;
- understandable error states;
- no silent loss of entered data after an error;
- clear success state;
- consent only where required by the actual processing.

## 7. WhatsApp

When WhatsApp is an actual business channel, treat it as a first-class conversion path rather than a footer icon.

Where useful, prefill commercial context so the customer does not need to reconstruct the request manually.

Example intent:

"Bonjour, je souhaiterais des informations pour [service/date] pour [nombre] personnes."

Do not expose a WhatsApp CTA if the business does not actually monitor it.

## 8. Calls and location

When relevant:

- phone numbers must be directly callable;
- location actions should open an appropriate map/navigation application;
- address, opening times and access information must be easy to find.

## 9. Performance

Visual effects must not materially impair conversion.

Prefer:

- correctly sized and compressed images;
- limited font payload;
- deferred non-critical JavaScript;
- stable layout during loading;
- fast rendering of useful content;
- no unnecessary autoplay video;
- no oversized dependency for decorative animation.

A user on a mediocre connection should be able to start using the page before all decorative assets finish loading.

## 10. Mobile content hierarchy

Do not simply shrink desktop copy.

Prefer:

- shorter headlines;
- short paragraphs;
- scannable prices;
- immediately understandable offers;
- proof close to the decision point;
- FAQs near the objections they resolve;
- accordions only for secondary information;
- clear location, schedule, equipment, conditions and pricing information.

## 11. Readability

Requirements:

- comfortable text without zoom;
- sufficient contrast;
- sensible line lengths;
- adequate line spacing;
- no essential information embedded only in an image;
- no low-contrast "premium" typography that becomes unreadable outdoors.

## 12. Required interaction states

Critical flows must be considered in relevant states:

- normal;
- loading;
- empty;
- error;
- success;
- mobile keyboard open.

Weak-network behavior should also be considered when materially relevant.

## 13. Required viewport checks

At minimum verify:

- 360 px
- 375 px
- 390 px
- 430 px

Also verify at least one tablet and desktop layout.

390 px is the reference mobile design viewport, not the only tested viewport.

## 14. Real-device requirement

Browser DevTools alone cannot produce the final Mobile Conversion Gate PASS.

Before final production/client readiness, test on real mobile hardware when available.

Target coverage:

- Android real device;
- iPhone real device when available;
- portrait orientation;
- keyboard-open interaction;
- one-handed use;
- non-ideal network condition where relevant.

## 15. Ten-second comprehension test

A person unfamiliar with the project should be able to determine quickly:

1. What does this business sell?
2. Where does it operate?
3. What does it cost, or how do I obtain the price?
4. How do I contact / book / request?
5. Why should I continue?

If the user has to search for these answers, investigate before passing the gate.

## Hard blockers

Any single applicable blocker below prevents PASS:

- horizontal overflow;
- broken or inaccessible primary CTA;
- incorrect phone or WhatsApp destination;
- form cannot be completed;
- blocking navigation defect;
- essential information unreadable;
- fixed UI obscures content or action;
- critical interaction requires hover;
- contradictory price, opening time or address;
- loading makes the critical journey practically unusable;
- consent UI unnecessarily blocks navigation;
- JavaScript error breaks the critical journey.

Hard blockers are non-compensatory.

A strong score elsewhere cannot compensate for a broken conversion path.

## Final gate

All applicable dimensions must pass:

MOBILE UX = PASS
MOBILE CONVERSION = PASS
MOBILE TECHNICAL = PASS
MOBILE REAL-DEVICE = PASS

Only then:

MOBILE CONVERSION GATE = PASS

And only after the relevant project gates:

PROTOTYPE / SITE = READY FOR CLIENT

## Commercial interpretation

Magic Script should not sell "responsive websites" as a differentiator.

The intended standard is:

A site designed around how the client's customers actually discover, understand and contact or buy from the business on mobile.

For Martinique-oriented local businesses, assume mobile usage is strategically important unless evidence for the specific client indicates otherwise.

Do not invent client behavior, traffic, conversion data or device-share statistics.

Validate claims from observable evidence whenever they are used commercially.
