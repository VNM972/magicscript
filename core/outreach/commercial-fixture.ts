import { claimIssues, contextIssues, decideCommercialPrerequisites, type CommercialClaim, type CommercialContext, type CommercialOutcome } from './commercial-contract';
import { ABSTENTION_DECISIONS, COMMERCIAL_PLAYBOOK_VERSION } from './commercial-policy';
import { COMMERCIAL_DECISIONS, COMMERCIAL_ORACLE_IDS, type CommercialOracleId } from './commercial-oracles';

export interface CommercialFixture {
  id: string;
  title: string;
  synthetic: true;
  context: CommercialContext;
  rejectedClaims: CommercialClaim[];
  allowedAssertions: string[];
  forbiddenAssertions: string[];
  qualitativeExpectations: string[];
  cases: { name: string; channel: 'EMAIL' | 'MOBILE'; expected: CommercialOutcome }[];
  objectiveChecks: CommercialOracleId[];
}

/** Small, portable declarative schema; every object is closed (no additional properties). */
type Schema = 'string' | 'boolean' | 'number' | { enum: readonly unknown[] }
  | { nullable: Schema } | { array: Schema } | { object: Record<string, Schema>; optional?: readonly string[] };
const enumeration = (...values: unknown[]): Schema => ({ enum: values });
const nullable = (schema: Schema): Schema => ({ nullable: schema });
const array = (schema: Schema): Schema => ({ array: schema });
const object = (fields: Record<string, Schema>, optional?: readonly string[]): Schema => ({ object: fields, optional });
const strings = array('string');
const channel = enumeration('EMAIL', 'MOBILE');
const sourceSchema = object({ id: 'string', prospectId: 'string', version: 'string', kind: enumeration('OBSERVATION', 'OPPORTUNITY', 'OPERATOR_CONFIRMATION', 'ARTIFACT'), fact: 'string', observedAt: nullable('string'), verifiedAt: nullable('string'), trust: enumeration('DATA_ONLY') });
export const COMMERCIAL_CLAIM_SCHEMA = object({
  id: 'string', text: 'string', supportType: enumeration('OBSERVED', 'DERIVED_WITH_RULE', 'OPERATOR_CONFIRMED'),
  sourceRefs: strings, evidenceExcerptOrFact: 'string', observedAt: nullable('string'), verifiedAt: nullable('string'),
  scope: object({ prospectId: 'string', subject: 'string' }), limits: strings,
  status: enumeration('SUPPORTED', 'QUALIFIED', 'UNSUPPORTED', 'CONFLICTED'), qualification: nullable('string'),
  freshness: nullable(object({ policyId: 'string', validUntil: 'string' })), timeSensitive: 'boolean',
  capability: nullable(object({ id: 'string', use: enumeration('DEMONSTRATIVE', 'LIVE') })),
  rule: nullable(object({ id: 'string', version: 'string', premiseClaimIds: strings })),
  confirmation: nullable(object({ actor: 'string', confirmedAt: 'string', sourceRef: 'string' })),
});
const artifactSchema = object({
  id: 'string', version: 'string', prospectId: 'string', type: enumeration('PROPOSAL', 'PROTOTYPE'),
  status: enumeration('READY', 'NOT_READY'), canonicalLink: 'string',
  capabilities: array(object({ id: 'string', status: enumeration('DEMONSTRATIVE', 'LIVE'), sourceRef: 'string' })),
});
const catalogSchema = object({ offerId: enumeration('STARTER', 'ESSENTIEL', 'BUSINESS', 'PREMIUM', 'CUSTOM'), name: 'string', priceMode: enumeration('FIXED', 'FROM', 'QUOTE'), amountCents: nullable('number'), currency: enumeration('EUR'), authorizedCapabilities: strings, limits: strings, source: 'string', version: 'string' });
export const COMMERCIAL_CONTEXT_SCHEMA = object({
  playbookVersion: enumeration(COMMERCIAL_PLAYBOOK_VERSION),
  prospect: object({ id: 'string', name: 'string', contactName: nullable('string'), vertical: 'string' }),
  agent1: object({ sourceRef: 'string', version: 'string', decision: enumeration('ADMITTED', 'NOT_ADMITTED', 'UNKNOWN'), opportunity: nullable(object({ text: 'string', supportingClaimIds: strings })) }),
  channel, authorizedChannels: array(object({ channel, contactRef: 'string', sourceRef: 'string', verifiedAt: 'string' })),
  whatsAppAvailability: enumeration('CONFIRMED', 'UNKNOWN', 'UNAVAILABLE'),
  contactState: object({ suppression: enumeration('CLEAR', 'SUPPRESSED', 'OPPOSED', 'UNKNOWN'), firstContact: enumeration('NOT_CONTACTED', 'CONTACTED', 'DUPLICATE', 'UNKNOWN'), sourceRef: 'string', verifiedAt: 'string' }),
  artifact: nullable(artifactSchema), sources: array(sourceSchema), claims: array(COMMERCIAL_CLAIM_SCHEMA), requiredClaimIds: strings,
  derivationRules: array(object({ id: 'string', version: 'string', description: 'string' })), catalog: array(catalogSchema),
  priceAuthorization: nullable(object({ actor: 'string', at: 'string', offerIds: strings })), scopeConfirmed: 'boolean', evaluatedAt: 'string',
});
export const COMMERCIAL_FIXTURE_SCHEMA = object({
  id: 'string', title: 'string', synthetic: enumeration(true), context: COMMERCIAL_CONTEXT_SCHEMA,
  rejectedClaims: array(COMMERCIAL_CLAIM_SCHEMA), allowedAssertions: strings, forbiddenAssertions: strings,
  qualitativeExpectations: strings,
  cases: array(object({ name: 'string', channel, expected: object({ decision: enumeration(...COMMERCIAL_DECISIONS), reason: nullable(enumeration(...Object.keys(ABSTENTION_DECISIONS))) }) })),
  objectiveChecks: array(enumeration(...COMMERCIAL_ORACLE_IDS)),
});

function schemaIssues(schema: Schema, input: unknown, path: string, issues: string[]): void {
  if (typeof schema === 'string') {
    if (typeof input !== schema || (schema === 'number' && !Number.isFinite(input))) issues.push(`${path}: expected ${schema}`);
  } else if ('enum' in schema) {
    if (!schema.enum.includes(input)) issues.push(`${path}: invalid enum`);
  } else if ('nullable' in schema) {
    if (input !== null) schemaIssues(schema.nullable, input, path, issues);
  } else if ('array' in schema) {
    if (!Array.isArray(input)) issues.push(`${path}: expected array`);
    else input.forEach((value, i) => schemaIssues(schema.array, value, `${path}[${i}]`, issues));
  } else {
    if (!input || typeof input !== 'object' || Array.isArray(input)) { issues.push(`${path}: expected object`); return; }
    const record = input as Record<string, unknown>;
    for (const key of Object.keys(record)) if (!(key in schema.object)) issues.push(`${path}.${key}: unexpected property`);
    for (const [key, definition] of Object.entries(schema.object)) {
      if (!(key in record) && schema.optional?.includes(key)) continue;
      schemaIssues(definition, record[key], `${path}.${key}`, issues);
    }
  }
}

export function validateCommercialContext(input: unknown): string[] {
  const errors: string[] = [];
  schemaIssues(COMMERCIAL_CONTEXT_SCHEMA, input, 'context', errors);
  return errors.length ? errors : contextIssues(input as CommercialContext);
}

export function validateCommercialFixture(input: unknown): string[] {
  const errors: string[] = [];
  schemaIssues(COMMERCIAL_FIXTURE_SCHEMA, input, 'fixture', errors);
  if (errors.length) return errors;
  const f = input as CommercialFixture;
  errors.push(...contextIssues(f.context));
  if (!/^F(?:0[1-9]|1\d|2[0-8])$/.test(f.id) || !f.title.trim()) errors.push('FIXTURE_ID_OR_TITLE');
  if (!f.context.prospect.id.startsWith('synthetic:')) errors.push('SYNTHETIC_ID_REQUIRED');
  // All URL tokens anywhere in fixture content must use the reserved .test namespace.
  for (const token of JSON.stringify(f).match(/https?:\/\/[^\s"\\<>]+/gu) ?? []) {
    try { if (!new URL(token).hostname.endsWith('.test')) errors.push('REAL_URL_FORBIDDEN'); } catch { errors.push('INVALID_SYNTHETIC_URL'); }
  }
  if (!f.cases.length || !f.qualitativeExpectations.length || !f.forbiddenAssertions.length
    || COMMERCIAL_ORACLE_IDS.some(id => !f.objectiveChecks.includes(id))) errors.push('EVALUATION_EXPECTATIONS_REQUIRED');
  if (new Set(f.cases.map(c => c.name)).size !== f.cases.length) errors.push('DUPLICATE_CASE');
  for (const c of f.cases) {
    if (!c.name.trim()) errors.push('CASE_NAME_REQUIRED');
    if (c.expected.decision === 'GENERATE' ? c.expected.reason !== null : !c.expected.reason || ABSTENTION_DECISIONS[c.expected.reason] !== c.expected.decision) errors.push('INCOHERENT_ABSTENTION');
    const actual = decideCommercialPrerequisites({ ...f.context, channel: c.channel });
    if (actual.decision !== c.expected.decision || actual.reason !== c.expected.reason) errors.push(`INCOHERENT_EXPECTED_DECISION:${c.name}`);
  }
  for (const text of f.allowedAssertions) if (!f.context.claims.some(c => c.text === text && !claimIssues(c, f.context).length)) errors.push('ORPHAN_ALLOWED_ASSERTION');
  for (const claim of f.rejectedClaims) {
    if (!claimIssues(claim, f.context).length) errors.push('REJECTED_CLAIM_IS_USABLE');
  }
  if (f.allowedAssertions.some(a => f.forbiddenAssertions.includes(a))) errors.push('CONTRADICTORY_ASSERTION_EXPECTATION');
  return errors;
}
export function assertCommercialFixture(input: unknown): asserts input is CommercialFixture {
  const issues = validateCommercialFixture(input);
  if (issues.length) throw new Error(issues.join('; '));
}
