import type { ClaimedJob } from './api';

const JSON_ONLY = `
Return ONLY valid JSON matching the requested schema.
The top-level JSON value MUST be one object matching the schema, never an array, fragment, or single nested field.
Do not wrap the final answer in prose.
Do not invent facts.
If a fact cannot be verified, omit it or lower confidence.
`;

const DESIGN_COMPOSITION_GATE = `
Magic Script Design Composition Gate:
- use the selected Design Direction as the single composition contract; inspect its visualPrinciples, heroStrategy, sectionGrammar, imageStrategy, density and antiPatterns instead of inventing a parallel visual system;
- BLOCK any unjustified card-wall, generic dashboard layout, repeated boxed sections, hero assembled from interchangeable blocks without a clear art direction, flat hierarchy, missing real imagery when verified reusable visual assets exist, insufficient negative space, or monotonous editorial rhythm;
- an exception is valid only when the selected Design Direction explicitly justifies that composition for the sector and the review records the exact rationale; "modern", "clean", "premium" or "more readable" is not a sector justification;
- when verified real imagery is unavailable, create direction with typography, material, cropping, color, negative space and editorial rhythm; do not compensate with generic stock imagery or more cards.
`;

function compactRecord(
  value: unknown,
  keys: string[],
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const compact: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in record) compact[key] = record[key];
  }
  return Object.keys(compact).length > 0 ? compact : null;
}

export function buildPrompt(claim: ClaimedJob): string {
  const {
    job,
    prospect,
    contacts,
    outreachDraft,
    researchContext,
    agent1Context,
    latestReply,
    prototypeContext,
    prototypeConversion,
    prototypeStrategy,
  } = claim;
  const handoff = compactRecord(job.payload.handoff, [
    'id',
    'sourceAgent',
    'nextOwner',
    'objective',
    'context',
    'inputs',
    'constraints',
    'expectedOutput',
    'verifier',
    'provenance',
    'confidence',
    'blockers',
    'decisionScope',
    'hubId',
  ]);
  const handoffContext = handoff
    ? `\nValidated work handoff (preserve every field and stay inside decisionScope):\n${JSON.stringify(handoff, null, 2)}\n`
    : '';
  const designDirection = compactRecord(job.payload.designDirection, [
    'id',
    'label',
    'visualPrinciples',
    'heroStrategy',
    'sectionGrammar',
    'ctaStrategy',
    'imageStrategy',
    'typographicCharacter',
    'density',
    'motionBudget',
    'mobileBehavior',
    'proofRequirements',
    'antiPatterns',
  ]);

  switch (job.kind) {
    case 'DISCOVER_PROSPECTS': {
      const location = String(job.payload.location ?? 'Martinique');
      const limit = Number(job.payload.limit ?? 20);

      return `
You are the Magic Script Discovery Swarm.

${handoffContext}

Goal: find up to ${limit} real local businesses in ${location} that could credibly benefit from a better website or digital conversion path.

Use parallel sub-agents when the configured provider supports them; otherwise perform the same research yourself and return one consolidated result.
Use public web sources only.
Prioritize active businesses with a real commercial opportunity.
Do not select a company merely because its website looks old.
Do not collect private personal data.
Do not fabricate URLs, websites, activities or locations.
Deduplicate the final list.

Required schema:
{
  "prospects": [
    {
      "companyName": "string",
      "legalName": "string optional",
      "siren": "9 digits, required when publicly verified",
      "siret": "14 digits, required when publicly verified",
      "city": "string, required when identity is publicly verified",
      "activity": "string optional",
      "location": "string optional",
      "websiteUrl": "string optional",
      "sourceUrl": "public source proving the business exists",
      "commercialSignal": "string optional",
      "digitalPresence": "string optional",
      "opportunity": "A|B|C|D optional",
      "score": 0,
      "primaryFriction": "string optional",
      "primaryAsset": "string optional",
      "primaryCta": "string optional",
      "prototypeRecommendation": "string optional",
      "agent2Type": "string optional",
      "evidence": [{"url":"https://...","note":"what the public source visibly supports","supports":["companyName","activity"]}]
    }
  ]
}
Each candidate MUST include valid siren, siret, city and at least one evidence entry, otherwise omit it rather than inventing identity. The runner will submit this result to the canonical Agent 1 batch adapter; do not return a legacy discovery shape without identity evidence.

${JSON_ONLY}
`;
    }

    case 'RUN_RESEARCH_SWARM': {
      if (!prospect) throw new Error('Research job missing prospect context');

      return `
You are the Magic Script Research Swarm.

${handoffContext}

Prospect:
${JSON.stringify(prospect, null, 2)}

Agent 1 intake context (preserve and verify; do not discard useful leads):
${JSON.stringify(agent1Context ?? null, null, 2)}

Use this as a research lead sheet: verify each useful observation against current public sources, preserve supported details in the output, and explicitly mark unsupported details as unknown rather than silently dropping them.

Investigate in parallel when the configured provider supports sub-agents; otherwise perform these checks yourself:
1. business facts and official identity;
2. current website and mobile/conversion friction;
3. public reputation and commercial assets;
4. official social presence;
5. local competitor digital standards;
6. public professional contactability;
7. the most credible public route to reach the owner, manager or responsible business contact;
8. when a websiteUrl exists, the visible source-site navigation and major content/conversion blocks.
9. the prospect's existing logo or other official brand asset, before considering any new visual identity.

Cross-check important facts across multiple sources where possible.
Every source must declare exactly which decision claims it supports. A source URL and note alone are not evidence for every claim. For every non-zero score except confidence, include at least one source whose supports array names that score key. Also name activity, location, website, phone, opportunity, primaryAsset, primaryFriction or brandAsset only on sources that visibly support those claims. Never claim support merely because the model produced a value.
When no usable website is found, check the prospect's official Facebook page as a priority public source, especially for Martinique businesses. Distinguish an official business page from a personal profile, group, community relay or third-party directory. A logo visible on an official Facebook page may be recorded as an official public brand asset; do not treat a personal photo or an unverified repost as the business logo.
The most important output is ONE credible primary digital friction, not a list of artificial weaknesses.
For contact research, prefer a business channel over a private personal channel. Identify the owner or manager by name only when an official public source explicitly identifies that role; otherwise use the most appropriate business role or generic channel.
For telephone research, return only a public PROFESSIONAL business number explicitly observed in a public HTTP(S) source. Never infer, reconstruct, guess or transform a missing number. Do not use a private personal number. When a phone is returned, phoneSourceUrl must identify the public source that visibly supports that exact number. If the number or its source cannot be verified, omit both phone and phoneSourceUrl.
When a source website exists, record the exact visible labels of its primary navigation, major menu/content blocks and prominent conversion blocks in sourceNavigationBlocks. Preserve the observed wording and language; do not infer labels from the business category. If no source website exists or its navigation cannot be verified, return an empty array and explain why in sourceNavigationNote.
For brand assets, check the official website and official public channels first, including Facebook. Distinguish an official logo from an unverified public candidate, a confirmed absence and an unknown result. Record only a public HTTP(S) source URL when one is actually observed. Reuse an existing official logo in the prototype when the asset is usable and rights are clear; do not create a new visual identity merely for convenience. Create a restrained identity only when no usable prospect identity is confirmed. Never invent a logo, brand mark, source URL or reuse permission.

Score every metric from 0 to 100:
- digitalGap: how meaningful the current digital gap is;
- commercialStrength: strength of the underlying business/assets;
- contactability: likelihood of finding a legitimate professional contact channel;
- localFit: fit for Magic Script's local-business offer;
- prototypeLeverage: how clearly a prototype could demonstrate value;
- confidence: confidence in the research based on source quality.

Opportunity:
A = creation, B = substantial redesign, C = targeted optimization, D = weak opportunity.

Required schema:
{
  "activity": "string optional",
  "location": "string optional",
  "websiteUrl": "string optional",
  "phone": "public professional business phone string optional",
  "phoneSourceUrl": "public HTTP(S) source visibly supporting the exact phone optional",
  "opportunity": "A|B|C|D",
  "primaryAsset": "string",
  "primaryFriction": "string",
  "primaryCta": "string",
  "brandAsset": {
    "status": "OFFICIAL_LOGO_FOUND|PUBLIC_LOGO_CANDIDATE|NOT_FOUND|UNKNOWN",
    "sourceUrl": "https://source-that-shows-the-asset.example optional",
    "assetUrl": "https://public-asset-url.example optional",
    "reuseDecision": "REUSE_IF_RIGHTS_CLEAR|DO_NOT_REUSE|CREATE_ONLY_IF_NO_USABLE_IDENTITY|UNKNOWN",
    "note": "what was verified and what remains uncertain"
  },
  "sourceNavigationBlocks": [
    {"label": "exact observed source label", "kind": "navigation|content_block|conversion_cta"}
  ],
  "sourceNavigationNote": "what was verified or why the source navigation was unavailable",
  "contactPlan": {
    "recommendedChannel": "official_email|contact_form|phone|official_social_dm|professional_directory|unknown",
    "targetRole": "owner_or_manager|direction|commercial|reception|generic_business_contact|unknown",
    "publicContactName": "string optional",
    "routeReason": "string",
    "nextAction": "string",
    "sourceRefs": ["https://source-that-supports-the-route.example"],
    "confidence": 0
  },
  "scoreInputs": {
    "digitalGap": 0,
    "commercialStrength": 0,
    "contactability": 0,
    "localFit": 0,
    "prototypeLeverage": 0,
    "confidence": 0
  },
  "sources": [
    {
      "url": "https://...",
      "note": "what is visibly supported by this source",
      "supports": ["digitalGap", "activity", "website"]
    }
  ]
}

${JSON_ONLY}
`;
    }

    case 'DISCOVER_CONTACT': {
      if (!prospect) throw new Error('Contact job missing prospect context');

      return `
You are the Magic Script Contact Discovery Agent.

${handoffContext}

Prospect:
${JSON.stringify(prospect, null, 2)}

Find public PROFESSIONAL email addresses that are genuinely associated with this business.
Bind the research to the supplied prospect id, SIREN and SIRET. If the deterministic
SIREN + SIRET establishment identity is missing, return an empty contacts array;
never resolve a contact from companyName alone.
Prioritize:
1. official website contact pages;
2. official legal/contact pages;
3. reliable professional directories;
4. official business social profiles.

Never invent an email from a guessed naming pattern.
If an address is only inferred, set verified=false, observedExactValue=false and confidence below 60.
Avoid private personal addresses unless the business itself publicly presents that address for professional contact.
Set observedExactValue=true only when the exact complete email address is visibly
published by the cited source. A domain, naming convention or likely mailbox is
not evidence of an exact address.

Required schema:
{
  "contacts": [
    {
      "email": "string",
      "sourceUrl": "https://...",
      "sourceType": "official_site|directory|social|other_public_source",
      "confidence": 0,
      "verified": true,
      "observedExactValue": true
    }
  ]
}

An empty contacts array is acceptable if nothing reliable is found.

${JSON_ONLY}
`;
    }

    case 'GENERATE_OUTREACH': {
      if (!prospect) throw new Error('Outreach job missing prospect context');

      return `
You are the Magic Script B2B Outreach Agent.

${handoffContext}

Prospect:
${JSON.stringify(prospect, null, 2)}

Validated contacts:
${JSON.stringify(contacts, null, 2)}

Verified research context:
${JSON.stringify(researchContext ?? null, null, 2)}

Verified deployed prototype context:
${JSON.stringify(prototypeContext ?? null, null, 2)}

Write a concise first-contact B2B email in French.
This is the FIRST commercial contact: never write "comme convenu", never imply a prior exchange, meeting, request or relationship.
The email MUST include the exact verified prototype deployment_url from the prototype context as the concrete demonstration link.
If prototypeContext.deployment_url is absent, not HTTPS, or not on an approved Magic Script / Cloudflare demo host, return readyToSend=false and explain the blocker.
Use one verified commercial asset and one precise digital gap.
Present the prototype as a tailored demonstration prepared from public information, not as the prospect's finished or commissioned website.
Do not insult or criticize the prospect's current site.
Do not invent prices, clients, results, certifications or urgency.
Do not include or promote the Magic Script public website until the runtime explicitly provides a verified live website URL.
Do not imply that magicscript.fr is already publicly finished or commercially live.
Do not append a sender signature; the email transport adds the configured signature and logo.

Commercial writing rules:
- Write 90 to 140 words before the transport signature, in 2 to 4 short paragraphs.
- Use a subject of 4 to 8 concrete words, with no emoji, ALL CAPS, clickbait, fake RE/FWD prefixes, false urgency or spammy promises.
- Open with one specific, verified observation tied to the prospect's business or prototype; never use generic praise, fake familiarity or a guessed pain point.
- Connect that observation to one plausible conversion opportunity without claiming lost revenue, rankings, traffic or customer behavior that is not verified.
- Mention the exact prototype link once and make it clear that it is a tailored demonstration.
- Use one low-friction CTA only: ask the recipient to look at the demonstration and reply if it is worth discussing.
- Use natural French and formal address; avoid jargon, pressure, guilt, manipulative scarcity and phrases such as "question rapide" or "je me permets".
- Do not add extra links, attachments, calendar invitations or multiple calls to action.
- End with one simple sentence allowing the recipient to request no further messages.

Required schema:
{
  "subject": "string",
  "body": "string",
  "factsUsed": ["string"],
  "sourceRefs": ["https://source-used.example"],
  "confidence": 0,
  "readyToSend": true,
  "blockingReasons": []
}

${JSON_ONLY}
`;
    }

    case 'FACT_CHECK_OUTREACH': {
      if (!prospect) throw new Error('Fact-check job missing prospect context');

      return `
You are the Magic Script Outreach Fact Checker.

Prospect:
${JSON.stringify(prospect, null, 2)}

Contacts:
${JSON.stringify(contacts, null, 2)}

Draft:
${JSON.stringify(outreachDraft ?? null, null, 2)}

Verified research context:
${JSON.stringify(researchContext ?? null, null, 2)}

Verified deployed prototype context:
${JSON.stringify(prototypeContext ?? null, null, 2)}

Check whether every factual claim in the email is supported by the prospect data and whether the message is appropriate for a professional B2B first contact.
For an INITIAL outreach draft, approval requires the exact verified prototype deployment_url to appear in the email.
Reject the draft if it invents a fact, overstates a weakness, implies a relationship that does not exist, contains an unsupported promise, omits the deployed prototype link, presents the demo as a commissioned/finished customer website, uses manipulative urgency, or contains multiple CTAs or unrelated links.
Check that the subject is concrete and non-clickbait, the opening is based on one verified observation, the message is concise, and it contains a simple way to request no further messages.
A minor wording issue that does not create a false factual claim should be reported as a reason but should not by itself force approved=false.

Required schema:
{
  "approved": true,
  "confidence": 0,
  "reasons": ["string"]
}

${JSON_ONLY}
`;
    }

    case 'CLASSIFY_REPLY': {
      if (!prospect) throw new Error('Reply classification job missing prospect context');
      if (!latestReply) throw new Error('Reply classification job missing reply context');

      return `
You are the Magic Script B2B Response Classifier.

Prospect:
${JSON.stringify(prospect, null, 2)}

Latest reply:
${JSON.stringify(latestReply, null, 2)}

Classify the reply conservatively.

Allowed classifications:
- NO_INTEREST
- AUTO_REPLY
- INFORMATION_REQUEST
- POSITIVE_INTEREST
- PRICING_REQUESTED
- MEETING_REQUESTED
- CUSTOM_REQUEST
- COMPLAINT_OR_LEGAL

Rules:
- do not treat ambiguity as positive interest;
- a direct request to stop future contact must set doNotContact=true;
- a polite refusal is NO_INTEREST;
- a request to see the demo or know more is POSITIVE_INTEREST;
- a price question is PRICING_REQUESTED;
- a calendar/call request is MEETING_REQUESTED;
- a substantive requested change is CUSTOM_REQUEST;
- threats, legal objections, privacy complaints or reputational complaints are COMPLAINT_OR_LEGAL.

Required schema:
{
  "classification": "NO_INTEREST|AUTO_REPLY|INFORMATION_REQUEST|POSITIVE_INTEREST|PRICING_REQUESTED|MEETING_REQUESTED|CUSTOM_REQUEST|COMPLAINT_OR_LEGAL",
  "confidence": 0,
  "summary": "short factual summary",
  "doNotContact": false
}

${JSON_ONLY}
`;
    }

    case 'GENERATE_PROTOTYPE_STRATEGY': {
      if (!prospect) throw new Error('Prototype strategy job missing prospect context');

      return `
You are the Magic Script Prototype Strategy Agent.

Prospect:
${JSON.stringify(prospect, null, 2)}

Verified research:
${JSON.stringify(researchContext ?? null, null, 2)}

Previous prototype / QA context:
${JSON.stringify(prototypeContext ?? null, null, 2)}

Deterministically selected Magic Script Design Direction:
${JSON.stringify(designDirection, null, 2)}

${DESIGN_COMPOSITION_GATE}

Design a strict commercial prototype strategy BEFORE any code is written.
If Previous prototype / QA context contains a failed QA finding, the new strategy MUST explicitly avoid the rejected claim and MUST NOT replace it with a different unsupported metric or identifier.

Rules:
- use only verified prospect/research facts;
- identify the strongest real commercial asset;
- identify the main digital friction the prototype must solve;
- define one primary CTA;
- when a verified source website exists, preserve its observed information architecture as sourceNavigationBlocks. Include every visible primary navigation, major content block and prominent conversion block; these are structural references, not a request to copy the source site;
- separate verified facts from unverified/forbidden claims;
- mobile-first around 390px;
- follow the selected Design Direction when present; it is an internal visual constraint, not a source of prospect facts;
- reject its listed antiPatterns and never create fake proof to satisfy the direction;
- do not invent prices, services, certifications, opening hours, guarantees, addresses, integrations, inventory, booking/payment capabilities or customer claims;
- NEVER invent or infer social-proof metrics: review ratings, review counts, rankings, awards, popularity claims, customer counts, percentages, certificate/license numbers or similar numeric credibility signals. They are allowed only when the exact value is explicitly present in verified research;
- if a review platform, certification or award is verified but its exact rating/count/identifier is not, mention only the verified existence and omit the number entirely;
- missing non-essential publication details such as exact street address, opening hours, menu items, prices, testimonials, phone/email, booking, payment or integrations are NOT by themselves blockers for a prototype; put them in factsForbiddenOrUnverified and design around them without inventing anything;
- set humanRequired=true ONLY when the verified information is so contradictory or insufficient that no honest, useful prototype can be designed at all;
- blockingReasons must contain only true blockers that make an honest prototype impossible, not details that can simply be omitted from the demo;
- a prototype may use a generic non-connected CTA such as "Nous contacter" or "Nous rendre visite" without claiming a working contact channel, provided it is clearly treated as a demonstration.

Required schema:
{
  "objective": "string",
  "targetCustomer": "string",
  "primaryAsset": "string",
  "primaryFriction": "string",
  "valueProposition": "string",
  "brandAsset": {
    "status": "OFFICIAL_LOGO_FOUND|PUBLIC_LOGO_CANDIDATE|NOT_FOUND|UNKNOWN",
    "sourceUrl": "https://source-that-shows-the-asset.example optional",
    "assetUrl": "https://public-asset-url.example optional",
    "reuseDecision": "REUSE_IF_RIGHTS_CLEAR|DO_NOT_REUSE|CREATE_ONLY_IF_NO_USABLE_IDENTITY|UNKNOWN",
    "note": "how the existing asset will be reused or why a restrained identity is needed"
  },
  "hero": {
    "headlineDirection": "string",
    "supportingMessage": "string",
    "primaryCta": "string"
  },
  "sections": ["string"],
  "sourceNavigationBlocks": [
    {"label": "exact observed source label", "kind": "navigation|content_block|conversion_cta"}
  ],
  "sourceNavigationNote": "how the source navigation will be represented in the prototype",
  "commercialProof": ["string"],
  "factsAllowed": ["verified fact"],
  "factsForbiddenOrUnverified": ["unverified or forbidden claim"],
  "mobilePriorities": ["string"],
  "conversionStrategy": "string",
  "confidence": 0,
  "humanRequired": false,
  "blockingReasons": []
}

${JSON_ONLY}
`;
    }

    case 'BUILD_PROTOTYPE': {
      if (!prospect) throw new Error('Prototype build job missing prospect context');

      const qaFindings = prototypeContext?.qa_findings_json
        ? (() => {
            try {
              return JSON.parse(prototypeContext.qa_findings_json);
            } catch {
              return prototypeContext.qa_findings_json;
            }
          })()
        : null;

      const buildProspect = compactRecord(prospect, [
        'id',
        'companyName',
        'activity',
        'location',
        'websiteUrl',
        'opportunity',
        'score',
        'primaryFriction',
        'primaryAsset',
        'primaryCta',
      ]);
      const buildResearch = compactRecord(researchContext, [
        'activity',
        'location',
        'websiteUrl',
        'opportunity',
        'primaryAsset',
        'primaryFriction',
        'primaryCta',
        'brandAsset',
        'sourceNavigationBlocks',
        'sourceNavigationNote',
        'factsAllowed',
        'factsForbiddenOrUnverified',
        'confidence',
        'sourceRefs',
        'contactPlan',
      ]);
      const buildPrototypeContext = compactRecord(prototypeContext, [
        'id',
        'status',
        'qa_status',
        'repo_path',
        'deployment_url',
      ]);
      const buildPrototypeConversion = compactRecord(
        prototypeConversion,
        [
          'salesRoomUrl',
          'salesRoomSlug',
          'ctaTarget',
        ],
      );
      const buildStrategy = compactRecord(prototypeStrategy, [
        'objective',
        'targetCustomer',
        'primaryAsset',
        'primaryFriction',
        'valueProposition',
        'brandAsset',
        'hero',
        'sections',
        'sourceNavigationBlocks',
        'sourceNavigationNote',
        'commercialProof',
        'factsAllowed',
        'factsForbiddenOrUnverified',
        'mobilePriorities',
        'conversionStrategy',
        'confidence',
        'humanRequired',
        'blockingReasons',
      ]);

      return `
You are the Magic Script Prototype Coding Agent.

You are working directly inside the prototype working directory.
Your job is to CREATE or CORRECT the actual website files in the current directory.

Prospect:
${JSON.stringify(buildProspect, null, 2)}

Verified research:
${JSON.stringify(buildResearch, null, 2)}

Existing prototype context:
${JSON.stringify(buildPrototypeContext, null, 2)}

Previous QA findings to correct:
${JSON.stringify(qaFindings, null, 2)}

Verified prototype strategy:
${JSON.stringify(prototypeStrategy ?? null, null, 2)}

Deterministically selected Magic Script Design Direction:
${JSON.stringify(designDirection, null, 2)}

${DESIGN_COMPOSITION_GATE}

Magic Script prototype conversion destination:
${JSON.stringify(buildPrototypeConversion ?? null, null, 2)}

Prototype Cost Gate authorization:
${JSON.stringify(job.payload.prototypeAuthorization ?? null)}

Prototype scope rules:
- when prototypeAuthorization is LIGHT, build a deliberately lean single-page prototype using the existing pipeline: prioritize the strongest verified asset, the main digital friction, the prospect-specific primary CTA and only the minimum supporting content needed for a credible demonstration;
- LIGHT must not add non-essential interactive features, secondary conversion flows, decorative complexity, speculative content or expensive enrichment;
- LIGHT must still preserve factual accuracy, mobile usability, the canonical Sales Room CTA contract and all security/fail-closed rules;
- when prototypeAuthorization is FULL, preserve the normal prototype scope defined by the verified strategy;
- never silently upgrade LIGHT to FULL.

Mandatory rules:
- read the existing files first if the directory is not empty;
- if this is a correction cycle, improve the existing prototype instead of rebuilding randomly;
- use only prospect facts supported by the verified research;
- if brandAsset.status is OFFICIAL_LOGO_FOUND and the asset is usable, reuse the prospect's existing logo rather than creating a replacement identity; if no usable logo is confirmed, use a restrained identity and do not invent a mark;
- do not hotlink or copy a logo from an unverified source; a public candidate remains a candidate until its provenance and reuse conditions are clear;
- NEVER invent services, prices, certifications, addresses, opening hours, guarantees or customer claims;
- NEVER invent or infer review ratings, review counts, rankings, awards, popularity claims, customer counts, percentages, certificate/license numbers or any other numeric social proof;
- numeric credibility claims may appear ONLY when the exact value is explicitly present in Verified research AND is included in factsAllowed; otherwise omit the number/card/badge entirely;
- when correcting a QA failure, remove the unsupported claim from the actual source files; do not replace it with another unsupported metric;
- NEVER present factsForbiddenOrUnverified as verified facts;
- every section must solve a commercial or credibility problem;
- when the verified strategy contains sourceNavigationBlocks, reproduce every listed block in the relevant navigation or information architecture, using an original layout and copy treatment;
- treat sourceNavigationBlocks as structural reference evidence: integrate each navigation, content_block and conversion_cta according to its kind; never append a disconnected generic grid or card wall merely to make parity pass;
- source-navigation labels may use anchors, clearly marked inactive demo links or placeholder states. They do not need live functionality, but they must remain visible and understandable;
- do not copy the source site's HTML, CSS, images or full text, and do not turn the source website into the primary CTA or only meaningful destination;
- make the main commercial asset obvious in the hero;
- use one clear primary CTA;
- when Magic Script prototype conversion destination contains a non-null salesRoomUrl, the primary CTA MUST link exactly to that salesRoomUrl while keeping the strategy's commercial CTA label;
- the prototype MUST NOT implement its own lead/contact form, booking flow or direct commercial API submission; message capture and meeting booking belong to the Magic Script Sales Room;
- do not POST directly from the prototype to Sales Room message or booking endpoints;
- if salesRoomUrl is null, do not fake connected conversion: render the CTA as clearly demonstrative/inactive or omit it, and never claim that a message or booking was submitted;
- create a genuinely new, prospect-specific prototype: the existing website is research context, not the deliverable;
- never make the existing source website the primary CTA or the only meaningful destination;
- replace generic filler and placeholder copy with concrete, verified prospect-specific content; a non-commissioned prototype must be clearly labelled as a demonstration, but verified prospect facts must not be falsely described as fictitious;
- mobile-first, with particular attention to approximately 390px width;
- no fake booking, payment, form submission or other connected functionality;
- if a demonstration feature is not connected, present it clearly as a demo;
- prefer Next.js + React + TypeScript;
- the prototype must be compatible with static export and npm run build must produce an out/ directory for Cloudflare Pages;
- configure Next.js with static export and avoid server-only routes/features unless absolutely necessary;
- keep dependencies minimal;
- prioritize conversion, credibility, accessibility and performance over decorative animation;
- create a package.json with a working build script;
- do not touch files outside the current working directory;
- EXPLICITLY FOLLOW THE VERIFIED PROTOTYPE STRATEGY PROVIDED ABOVE;
- FOLLOW THE SELECTED DESIGN DIRECTION WHEN PRESENT WITHOUT USING IT AS PROSPECT EVIDENCE;
- USE ONLY factsAllowed FROM THE STRATEGY AS VERIFIED FACTS;
- DO NOT INVENT OR PRESENT factsForbiddenOrUnVERIFIED AS FACTS;

You may use parallel sub-agents for analysis or review, but only ONE coding agent may modify the prototype files.

Before finishing, inspect your own work and fix obvious TypeScript, routing, mobile, CTA and factual issues.

Final response schema:
{
  "summary": "short description of what was created or corrected",
  "filesTouched": ["relative/path"],
  "factsUsed": ["verified fact"],
  "qaIssuesAddressed": ["issue"],
  "readyForDeterministicBuild": true
}

The source files you create are the primary output.
${JSON_ONLY}
`;
    }

    case 'RUN_PROTOTYPE_QA': {
      if (!prospect) throw new Error('Prototype QA job missing prospect context');
      if (!prototypeContext) throw new Error('Prototype QA job missing prototype context');

      const qaPrototypeContext = compactRecord(prototypeContext, [
        'id',
        'status',
        'qa_status',
        'repo_path',
        'deployment_url',
      ]);

      const qaPrototypeConversion = compactRecord(
        prototypeConversion,
        [
          'salesRoomUrl',
          'salesRoomSlug',
          'ctaTarget',
        ],
      );

      return `
You are the Magic Script Prototype QA Swarm.

The prototype already exists in the CURRENT WORKING DIRECTORY.
DO NOT modify any file.
Inspect only.

Prospect:
${JSON.stringify(prospect, null, 2)}

Verified research:
${JSON.stringify(researchContext ?? null, null, 2)}

Prototype context:
${JSON.stringify(qaPrototypeContext, null, 2)}

Expected Magic Script prototype conversion destination:
${JSON.stringify(qaPrototypeConversion ?? null, null, 2)}

Verified prototype strategy:
${JSON.stringify(prototypeStrategy ?? null, null, 2)}

${DESIGN_COMPOSITION_GATE}

The factsAllowed list in the verified prototype strategy is an approved factual source for this prototype. A missing researchContext is not by itself a blocker when the strategy contains factsAllowed that support the visible claims.

Review in parallel when the configured provider supports sub-agents; otherwise perform all six checks yourself:

1. FACT CHECKER
Compare every concrete business claim in the prototype with the verified research and the factsAllowed list in the verified prototype strategy.
Any invented service, price, address, certification, opening hour, result or promise is BLOCKING.

2. MOBILE / UX CHECKER
Review the source and responsive rules with approximately 390px mobile width as the primary reference.
Look for overflow, illegible hierarchy, unusable CTA placement and broken navigation.

3. WEB DESIGN COMPOSITION CHECKER
Compare the implementation with the selected Design Direction and the Magic Script Design Composition Gate above. Any listed anti-pattern or composition defect without an explicit sector justification from that direction is BLOCKING; do not downgrade it to a note.

4. SOURCE NAVIGATION PARITY CHECKER
When a verified source website exists and the strategy contains sourceNavigationBlocks, compare every listed label/block and its semantic kind with the prototype source snapshot. Omission of any listed source navigation, major content block or prominent conversion block is BLOCKING. A purpose-built navigation, section, anchor or clearly marked inactive demo link may preserve parity; a generic grid or repeated card wall is neither required nor sufficient by itself. If the strategy has no sourceNavigationBlocks, confirm that sourceNavigationNote explains that no source navigation was verifiable or no source website exists.

5. CONVERSION CHECKER
Verify that:
- the prospect's strongest real asset is visible;
- the primary digital friction is actually addressed;
- the primary CTA is clear;
- when the expected conversion destination contains a non-null salesRoomUrl, the prototype primary CTA href must match that exact salesRoomUrl; a missing or different href is BLOCKING;
- a prototype-local lead/contact form, booking submission or direct call to Sales Room commercial write endpoints is BLOCKING; those interactions belong to the Sales Room;
- when salesRoomUrl is null, the prototype must not pretend that its CTA, form or booking flow is connected;
- the page is commercially coherent rather than generic filler;
- the prototype is a distinct prospect-specific experience, not merely a wrapper around or a link to the existing source website;
- the existing source website is not the primary CTA or the only meaningful destination.

6. TECHNICAL CHECKER
Inspect routes, links, forms, demo behavior, TypeScript and build configuration.
You may run read-only checks and build commands.
Do not edit files.

Be strict. Warnings are allowed, but factual invention, broken build, misleading demo behavior, generic placeholder content for a real prospect, a prototype that is only a wrapper/link to the source website, unusable mobile layout or missing core CTA are blockers.

Inspect the current prototype source and the supplied strategy, not the official website response. Return ONLY the QA object below. Never return schema.org, OpenGraph, page metadata, scraped HTML, or fields such as @context, @type, headline, description, url, or image. Set pass to true only when the current prototype passes every mandatory rule. If pass is false, include at least one concrete blockingFindings entry explaining the exact source-level defect.

Required schema:
{
  "pass": true,
  "safeForOutreach": true,
  "blockingFindings": [],
  "warnings": ["string"],
  "recommendedFixes": ["string"]
}

${JSON_ONLY}
`;
    }

    default:
      throw new Error(`Runner does not support job kind yet: ${job.kind}`);
  }
}
