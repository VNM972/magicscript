import type { Prospect, ProspectContact, ProspectOpportunity, ProspectState } from '../types/prospect';
import { assertTransition } from '../state/prospect-state-machine';
import type { ProspectRepository } from '../state/repository';
import type { D1DatabaseLike } from './d1-types';

interface ProspectRow {
  id: string;
  company_name: string;
  legal_name: string | null;
  activity: string | null;
  location: string | null;
  website_url: string | null;
  opportunity: ProspectOpportunity | null;
  state: ProspectState;
  score: number | null;
  primary_friction: string | null;
  primary_asset: string | null;
  primary_cta: string | null;
  created_at: string;
  updated_at: string;
}

interface ContactRow {
  id: string;
  prospect_id: string;
  email: string;
  source_url: string | null;
  source_type: ProspectContact['sourceType'] | null;
  confidence: number | null;
  is_validated: number;
  is_suppressed: number;
  created_at: string;
  updated_at: string;
}

function prospectFromRow(row: ProspectRow): Prospect {
  return {
    id: row.id,
    companyName: row.company_name,
    legalName: row.legal_name ?? undefined,
    activity: row.activity ?? undefined,
    location: row.location ?? undefined,
    websiteUrl: row.website_url ?? undefined,
    opportunity: row.opportunity ?? undefined,
    state: row.state,
    score: row.score ?? undefined,
    primaryFriction: row.primary_friction ?? undefined,
    primaryAsset: row.primary_asset ?? undefined,
    primaryCta: row.primary_cta ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contactFromRow(row: ContactRow): ProspectContact {
  return {
    id: row.id,
    prospectId: row.prospect_id,
    email: row.email,
    sourceUrl: row.source_url ?? undefined,
    sourceType: row.source_type ?? undefined,
    confidence: row.confidence ?? undefined,
    isValidated: row.is_validated === 1,
    isSuppressed: row.is_suppressed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class D1ProspectRepository implements ProspectRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async getProspect(id: string): Promise<Prospect | null> {
    const row = await this.db
      .prepare('SELECT * FROM prospects WHERE id = ? LIMIT 1')
      .bind(id)
      .first<ProspectRow>();

    return row ? prospectFromRow(row) : null;
  }

  async listProspects(): Promise<Prospect[]> {
    const result = await this.db
      .prepare('SELECT * FROM prospects ORDER BY updated_at DESC')
      .all<ProspectRow>();

    return (result.results ?? []).map(prospectFromRow);
  }

  async saveProspect(prospect: Prospect): Promise<void> {
    await this.db.prepare(
      `INSERT INTO prospects (
        id, company_name, legal_name, activity, location, website_url,
        opportunity, state, score, primary_friction, primary_asset,
        primary_cta, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        company_name = excluded.company_name,
        legal_name = excluded.legal_name,
        activity = excluded.activity,
        location = excluded.location,
        website_url = excluded.website_url,
        opportunity = excluded.opportunity,
        state = excluded.state,
        score = excluded.score,
        primary_friction = excluded.primary_friction,
        primary_asset = excluded.primary_asset,
        primary_cta = excluded.primary_cta,
        updated_at = excluded.updated_at`,
    ).bind(
      prospect.id,
      prospect.companyName,
      prospect.legalName ?? null,
      prospect.activity ?? null,
      prospect.location ?? null,
      prospect.websiteUrl ?? null,
      prospect.opportunity ?? null,
      prospect.state,
      prospect.score ?? null,
      prospect.primaryFriction ?? null,
      prospect.primaryAsset ?? null,
      prospect.primaryCta ?? null,
      prospect.createdAt,
      prospect.updatedAt,
    ).run();
  }

  async transitionProspect(
    id: string,
    to: ProspectState,
    _reason?: string,
  ): Promise<Prospect> {
    const current = await this.getProspect(id);
    if (!current) throw new Error(`Prospect not found: ${id}`);

    assertTransition(current.state, to);

    const updated: Prospect = {
      ...current,
      state: to,
      updatedAt: new Date().toISOString(),
    };

    await this.saveProspect(updated);
    return updated;
  }

  async saveContact(contact: ProspectContact): Promise<void> {
    await this.db.prepare(
      `INSERT INTO contacts (
        id, prospect_id, email, source_url, source_type, confidence,
        is_validated, is_suppressed, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(prospect_id, email) DO UPDATE SET
        source_url = excluded.source_url,
        source_type = excluded.source_type,
        confidence = excluded.confidence,
        is_validated = excluded.is_validated,
        is_suppressed = excluded.is_suppressed,
        updated_at = excluded.updated_at`,
    ).bind(
      contact.id,
      contact.prospectId,
      contact.email,
      contact.sourceUrl ?? null,
      contact.sourceType ?? null,
      contact.confidence ?? null,
      contact.isValidated ? 1 : 0,
      contact.isSuppressed ? 1 : 0,
      contact.createdAt,
      contact.updatedAt,
    ).run();
  }

  async listContacts(prospectId: string): Promise<ProspectContact[]> {
    const result = await this.db
      .prepare('SELECT * FROM contacts WHERE prospect_id = ? ORDER BY confidence DESC')
      .bind(prospectId)
      .all<ContactRow>();

    return (result.results ?? []).map(contactFromRow);
  }
}
