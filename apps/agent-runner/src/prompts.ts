import type { ClaimedJob } from './api';

const JSON_ONLY = `
Return ONLY valid JSON matching the requested schema.
Do not wrap the final answer in prose.
Do not invent facts.
If a fact cannot be verified, omit it or lower confidence.
`;

export function buildPrompt(claim: ClaimedJob): string {
  const {
    job,
    prospect,
    contacts,
    outreachDraft,
    researchContext,
    latestReply,
    prototypeContext,
  } = claim;

  switch (job.kind) {
    case 'DISCOVER_PROSPECTS': {
      const location = String(job.payload.location ?? 'Martinique');
      const limit = Number(job.payload.limit ?? 20);

      return `
You are the Magic Script Discovery Swarm.

Goal: find up to ${limit} real local businesses in ${location} that could credibly benefit from a better website or digital conversion path.

Use AgentSwarm to parallelize research across several business categories.
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
      "activity": "string optional",
      "location": "string optional",
      "websiteUrl": "string optional",
      "sourceUrl": "public source proving the business exists"
    }
  ]
}

${JSON_ONLY}
`;
    }

    case 'RUN_RESEARCH_SWARM': {
      if (!prospect) throw new Error('Research job missing prospect context');

      return `
You are the Magic Script Research Swarm.

Prospect:
${JSON.stringify(prospect, null, 2)}

Use AgentSwarm to investigate in parallel:
1. business facts and official identity;
2. current website and mobile/conversion friction;
3. public reputation and commercial assets;
4. official social presence;
5. local competitor digital standards;
6. public professional contactability.

Cross-check important facts across multiple sources where possible.
The most important output is ONE credible primary digital friction, not a list of artificial weaknesses.

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
  "opportunity": "A|B|C|D",
  "primaryAsset": "string",
  "primaryFriction": "string",
  "primaryCta": "string",
  "scoreInputs": {
    "digitalGap": 0,
    "commercialStrength": 0,
    "contactability": 0,
    "localFit": 0,
    "prototypeLeverage": 0,
    "confidence": 0
  },
  "sources": [
    {"url": "https://...", "note": "what this source verifies"}
  ]
}

${JSON_ONLY}
`;
    }

    case 'DISCOVER_CONTACT': {
      if (!prospect) throw new Error('Contact job missing prospect context');

      return `
You are the Magic Script Contact Discovery Agent.

Prospect:
${JSON.stringify(prospect, null, 2)}

Find public PROFESSIONAL email addresses that are genuinely associated with this business.
Prioritize:
1. official website contact pages;
2. official legal/contact pages;
3. reliable professional directories;
4. official business social profiles.

Never invent an email from a guessed naming pattern.
If an address is only inferred, set verified=false and confidence below 60.
Avoid private personal addresses unless the business itself publicly presents that address for professional contact.

Required schema:
{
  "contacts": [
    {
      "email": "string",
      "sourceUrl": "https://...",
      "sourceType": "official_site|directory|social|other_public_source",
      "confidence": 0,
      "verified": true
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

Prospect:
${JSON.stringify(prospect, null, 2)}

Validated contacts:
${JSON.stringify(contacts, null, 2)}

Verified research context:
${JSON.stringify(researchContext ?? null, null, 2)}

Write a concise first-contact B2B email in French.
Use one verified commercial asset and one precise digital gap.
Do not insult or criticize the prospect's current site.
Do not claim a prototype exists unless the prospect context explicitly says one exists.
Do not invent prices, clients, results, certifications or urgency.
Do not include or promote the Magic Script public website until the runtime explicitly provides a verified live website URL.
Do not imply that magicscript.fr is already publicly finished or commercially live.
Use one simple CTA.
Include a simple sentence allowing the recipient to say they do not want further messages.

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

Check whether every factual claim in the email is supported by the prospect data and whether the message is appropriate for a professional B2B first contact.
Reject the draft if it invents a fact, overstates a weakness, implies a relationship that does not exist, or contains an unsupported promise.

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

      return `
You are the Magic Script Prototype Coding Agent.

You are working directly inside the prototype working directory.
Your job is to CREATE or CORRECT the actual website files in the current directory.

Prospect:
${JSON.stringify(prospect, null, 2)}

Verified research:
${JSON.stringify(researchContext ?? null, null, 2)}

Existing prototype context:
${JSON.stringify(prototypeContext ?? null, null, 2)}

Previous QA findings to correct:
${JSON.stringify(qaFindings, null, 2)}

Mandatory rules:
- read the existing files first if the directory is not empty;
- if this is a correction cycle, improve the existing prototype instead of rebuilding randomly;
- use only prospect facts supported by the verified research;
- never invent services, prices, certifications, addresses, opening hours, guarantees or customer claims;
- every section must solve a commercial or credibility problem;
- make the main commercial asset obvious in the hero;
- use one clear primary CTA;
- mobile-first, with particular attention to approximately 390px width;
- no fake booking, payment, form submission or other connected functionality;
- if a demonstration feature is not connected, present it clearly as a demo;
- prefer Next.js + React + TypeScript;
- the prototype must be compatible with static export and npm run build must produce an out/ directory for Cloudflare Pages;
- configure Next.js with static export and avoid server-only routes/features unless absolutely necessary;
- keep dependencies minimal;
- prioritize conversion, credibility, accessibility and performance over decorative animation;
- create a package.json with a working build script;
- do not touch files outside the current working directory.

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
${JSON.stringify(prototypeContext, null, 2)}

Use AgentSwarm to review in parallel:

1. FACT CHECKER
Compare every concrete business claim in the prototype with the verified research.
Any invented service, price, address, certification, opening hour, result or promise is BLOCKING.

2. MOBILE / UX CHECKER
Review the source and responsive rules with approximately 390px mobile width as the primary reference.
Look for overflow, illegible hierarchy, unusable CTA placement and broken navigation.

3. CONVERSION CHECKER
Verify that:
- the prospect's strongest real asset is visible;
- the primary digital friction is actually addressed;
- the primary CTA is clear;
- the page is commercially coherent rather than generic filler.

4. TECHNICAL CHECKER
Inspect routes, links, forms, demo behavior, TypeScript and build configuration.
You may run read-only checks and build commands.
Do not edit files.

Be strict. Warnings are allowed, but factual invention, broken build, misleading demo behavior, unusable mobile layout or missing core CTA are blockers.

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
