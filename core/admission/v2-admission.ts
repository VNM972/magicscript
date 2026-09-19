import type { D1DatabaseLike } from '../persistence/d1-types';
import type { ProspectRepository } from '../state/repository';
import type { Prospect } from '../types/prospect';
import {
  CONTACT_OPPORTUNITY_PACK_VERSION,
  V2_ADMISSION_STATE,
  normalizePack,
  qualifyingContacts,
  validatePackShape,
  type AdmissionResult,
  type ContactOpportunityPackV2,
  type NormalizedContactOpportunityPack,
} from './contact-opportunity-pack';

export interface V2AdmissionStore {
  findDuplicate(pack: NormalizedContactOpportunityPack): Promise<string | null>;
  create(pack: NormalizedContactOpportunityPack, id: string, now: string): Promise<void>;
  getByProspectId(prospectId: string): Promise<NormalizedContactOpportunityPack | null>;
}

function canonicalId(pack: NormalizedContactOpportunityPack): string {
  const signal = pack.identity.siret || pack.identity.siren || pack.identity.domain || qualifyingContacts(pack)[0]?.normalizedValue || `${pack.identity.businessName}:${pack.identity.city ?? ''}`;
  return `v2-${signal.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96)}`;
}

export async function admitContactOpportunityPack(
  input: unknown,
  store: V2AdmissionStore,
  now = new Date().toISOString(),
): Promise<AdmissionResult> {
  const shapeReasons = validatePackShape(input);
  if (shapeReasons.length) return { admitted: false, reasonCode: 'INVALID_PACK' };
  const normalized = normalizePack(input as ContactOpportunityPackV2);
  const valid = normalized.contacts.filter((contact) => contact.trustStatus === 'DERIVED_VALID');
  const qualifying = qualifyingContacts(normalized);
  if (qualifying.length === 0) {
    return { admitted: false, reasonCode: valid.some((contact) => contact.channel === 'LANDLINE') ? 'FIXED_PHONE_ONLY' : valid.length === 0 ? 'NO_QUALIFYING_CONTACT' : 'INVALID_CONTACT', normalizedPack: normalized };
  }
  const duplicate = await store.findDuplicate(normalized);
  if (duplicate) return { admitted: false, reasonCode: 'DUPLICATE', canonicalProspectId: duplicate, normalizedPack: normalized };
  const id = canonicalId(normalized);
  await store.create(normalized, id, now);
  return { admitted: true, state: V2_ADMISSION_STATE, reasonCode: 'ADMITTED', canonicalProspectId: id, normalizedPack: normalized };
}

export class InMemoryV2AdmissionStore implements V2AdmissionStore {
  private readonly packs = new Map<string, { id: string; pack: NormalizedContactOpportunityPack }>();
  async getByProspectId(prospectId: string): Promise<NormalizedContactOpportunityPack | null> {
    return this.packs.get(prospectId)?.pack ?? null;
  }
  async getPack(prospectId: string): Promise<NormalizedContactOpportunityPack | null> {
    return this.getByProspectId(prospectId);
  }
  constructor(private readonly prospects?: ProspectRepository) {}
  async findDuplicate(pack: NormalizedContactOpportunityPack): Promise<string | null> {
    for (const [key, value] of this.packs) {
      const other = value.pack;
      if (pack.identity.siret && pack.identity.siret === other.identity.siret) return value.id;
      if (pack.identity.siren && pack.identity.siren === other.identity.siren && pack.identity.city && pack.identity.city === other.identity.city) return value.id;
      if (pack.identity.domain && pack.identity.domain === other.identity.domain) return value.id;
      if (qualifyingContacts(pack).some((contact) => qualifyingContacts(other).some((candidate) => contact.channel === candidate.channel && contact.normalizedValue === candidate.normalizedValue))) return value.id;
      void key;
    }
    return null;
  }
  async create(pack: NormalizedContactOpportunityPack, id: string, now: string): Promise<void> {
    this.packs.set(id, { id, pack });
    if (this.prospects) {
      const prospect: Prospect = { id, companyName: pack.identity.businessName, legalName: pack.identity.legalName, siren: pack.identity.siren, siret: pack.identity.siret, city: pack.identity.city, location: pack.identity.location, websiteUrl: pack.identity.websiteUrl, state: 'INGESTED', primaryFriction: pack.opportunity.digitalFriction, primaryAsset: pack.opportunity.businessContext, createdAt: now, updatedAt: now };
      await this.prospects.saveProspect(prospect);
    }
  }
}

export class D1V2AdmissionStore implements V2AdmissionStore {
  constructor(private readonly db: D1DatabaseLike) {}
  async getByProspectId(prospectId: string): Promise<NormalizedContactOpportunityPack | null> {
    const row = await this.db.prepare(`SELECT p.*, a.pack_id, a.schema_version, a.received_at FROM prospects p JOIN v2_admissions a ON a.prospect_id = p.id WHERE p.id = ? AND p.state = 'INGESTED' LIMIT 1`).bind(prospectId).first<Record<string, unknown>>();
    if (!row) return null;
    const contacts = await this.db.prepare('SELECT * FROM v2_admission_contacts WHERE prospect_id = ? ORDER BY id').bind(prospectId).all<Record<string, unknown>>();
    return { schemaVersion: row.schema_version as NormalizedContactOpportunityPack['schemaVersion'], packId: row.pack_id as string, source: { agent: 'AGENT_1', provenance: 'persisted-v2-admission', receivedAt: row.received_at as string }, identity: { businessName: row.company_name as string, legalName: row.legal_name as string | undefined, siren: row.siren as string | undefined, siret: row.siret as string | undefined, websiteUrl: row.website_url as string | undefined, domain: row.v2_domain as string | undefined, city: row.city as string | undefined, location: row.location as string | undefined }, contacts: (contacts.results ?? []).map((c) => ({ channel: c.channel as never, value: c.raw_value as string, normalizedValue: c.normalized_value as string, trustStatus: c.validation_status as never, sourceUrl: c.source_url as string | undefined, sourceType: c.source_type as string | undefined })), opportunity: { digitalFriction: row.primary_friction as string | undefined, businessContext: row.primary_asset as string | undefined } };
  }
  async findDuplicate(pack: NormalizedContactOpportunityPack): Promise<string | null> {
    const qualifying = qualifyingContacts(pack);
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (pack.identity.siret) { clauses.push('siret = ?'); values.push(pack.identity.siret); }
    if (pack.identity.siren && pack.identity.city) { clauses.push('siren = ? AND lower(city) = lower(?)'); values.push(pack.identity.siren, pack.identity.city); }
    if (pack.identity.domain) { clauses.push("lower(v2_domain) = lower(?)"); values.push(pack.identity.domain); }
    for (const contact of qualifying) { clauses.push('id IN (SELECT prospect_id FROM v2_admission_contacts WHERE channel = ? AND normalized_value = ?)'); values.push(contact.channel, contact.normalizedValue); }
    if (!clauses.length) return null;
    return (await this.db.prepare(`SELECT id FROM prospects WHERE state = 'INGESTED' AND (${clauses.join(' OR ')}) LIMIT 1`).bind(...values).first<{ id: string }>())?.id ?? null;
  }
  async create(pack: NormalizedContactOpportunityPack, id: string, now: string): Promise<void> {
    await this.db.prepare(`INSERT INTO prospects (id, company_name, legal_name, siren, siret, city, location, website_url, v2_domain, state, primary_friction, primary_asset, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INGESTED', ?, ?, ?, ?)`).bind(id, pack.identity.businessName, pack.identity.legalName ?? null, pack.identity.siren ?? null, pack.identity.siret ?? null, pack.identity.city ?? null, pack.identity.location ?? null, pack.identity.websiteUrl ?? null, pack.identity.domain ?? null, pack.opportunity.digitalFriction ?? null, pack.opportunity.businessContext ?? null, now, now).run();
    for (const contact of pack.contacts) {
      await this.db.prepare(`INSERT INTO v2_admission_contacts (id, prospect_id, channel, raw_value, normalized_value, validation_status, source_url, source_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(`${id}-${contact.channel}-${contact.normalizedValue}`, id, contact.channel, contact.value, contact.normalizedValue, contact.trustStatus, contact.sourceUrl ?? null, contact.sourceType ?? null, now).run();
    }
    await this.db.prepare(`INSERT INTO v2_admissions (prospect_id, pack_id, schema_version, result, reason_code, received_at) VALUES (?, ?, ?, 'ADMITTED', 'ADMITTED', ?)`).bind(id, pack.packId, CONTACT_OPPORTUNITY_PACK_VERSION, now).run();
  }
}
