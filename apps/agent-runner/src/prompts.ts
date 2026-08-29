import type { ClaimedJob } from './api';

const JSON_ONLY = `
Return ONLY valid JSON matching the requested schema.
Do not wrap the final answer in prose.
Do not invent facts.
If a fact cannot be verified, omit it or lower confidence.
`;

export function buildPrompt(claim: ClaimedJob): string {
  const { job, prospect, contacts, outreachDraft } = claim;

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

Write a concise first-contact B2B email in French.
Use one verified commercial asset and one precise digital gap.
Do not insult or criticize the prospect's current site.
Do not claim a prototype exists unless the prospect context explicitly says one exists.
Do not invent prices, clients, results, certifications or urgency.
Use one simple CTA.
Include a simple sentence allowing the recipient to say they do not want further messages.

Required schema:
{
  "subject": "string",
  "body": "string",
  "factsUsed": ["string"],
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

    default:
      throw new Error(`Runner does not support job kind yet: ${job.kind}`);
  }
}
