# Magic Script V2 — Free API Strategy

## Objective

Keep the first commercially usable Magic Script V2 at zero external API cost whenever technically reasonable.

## Business discovery

### 1. API Recherche d’entreprises — primary

Service:
`https://recherche-entreprises.api.gouv.fr`

Role:
- discover real French businesses;
- filter Martinique through department 972;
- filter relevant activity sections;
- provide company identity, SIREN, activity and establishment data.

Properties:
- open access;
- no API key;
- no account;
- zero monetary API cost;
- documented maximum of 7 requests/second per IP;
- Magic Script uses one paginated request per discovery cycle.

This is now the default structured discovery source.

### 2. INSEE SIRENE — optional secondary

Role:
- additional structured discovery if configured.

Properties:
- free;
- requires an INSEE API key/account;
- no longer required to start Magic Script discovery.

### 3. Kimi Discovery Swarm — fallback

Role:
- unstructured public-web discovery;
- diversification by business category;
- fallback if structured discovery yields nothing useful.

## Contact discovery

Order:

1. Kimi searches public professional contact information;
2. a second public-source pass is attempted;
3. Hunter Free is used only as fallback.

Hunter remains scarce quota rather than the primary contact database.

## Sending

The existing Amen mailbox is the transport layer through SMTP/IMAP.

No paid email-sending API is required by the architecture.

Real outbound email remains disabled until the production safety gate is explicitly approved.

## Rule

Any future external provider must stay behind an adapter.

No paid API may become a mandatory dependency without explicit approval.
