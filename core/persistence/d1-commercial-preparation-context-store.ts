import type { CommercialPreparationContextV1 } from '../outreach/commercial-preparation-context';
import { deserializeCommercialPreparationContext, serializeCommercialPreparationContext } from '../outreach/commercial-preparation-context';
import type { D1DatabaseLike } from './d1-types';

export interface CommercialPreparationContextStore {
  saveCommercialPreparationContext(context: CommercialPreparationContextV1): Promise<void>;
  getCommercialPreparationContext(contextId: string): Promise<CommercialPreparationContextV1 | null>;
  getLatestCommercialPreparationContextForProposal(proposalId: string): Promise<CommercialPreparationContextV1 | null>;
}

interface ContextRow { context_json: string }

export class D1CommercialPreparationContextStore implements CommercialPreparationContextStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async saveCommercialPreparationContext(context: CommercialPreparationContextV1): Promise<void> {
    const serialized = serializeCommercialPreparationContext(context);
    await this.db.prepare(`
      INSERT INTO v2_commercial_preparation_contexts
        (context_id, schema_version, context_version, prospect_id, proposal_id, context_json, created_at, evaluated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(context_id) DO NOTHING
    `).bind(context.contextId, context.schemaVersion, context.contextVersion, context.prospectId, context.proposalId, serialized, context.createdAt, context.evaluatedAt).run();
    const stored = await this.getCommercialPreparationContext(context.contextId);
    if (!stored) throw new Error('COMMERCIAL_CONTEXT_NOT_PERSISTED');
    if (serializeCommercialPreparationContext(stored) !== serialized) throw new Error('IMMUTABLE_CONTEXT_CONFLICT');
  }

  async getCommercialPreparationContext(contextId: string): Promise<CommercialPreparationContextV1 | null> {
    const row = await this.db.prepare('SELECT context_json FROM v2_commercial_preparation_contexts WHERE context_id = ? LIMIT 1').bind(contextId).first<ContextRow>();
    return row ? deserializeCommercialPreparationContext(row.context_json) : null;
  }

  async getLatestCommercialPreparationContextForProposal(proposalId: string): Promise<CommercialPreparationContextV1 | null> {
    const row = await this.db.prepare('SELECT context_json FROM v2_commercial_preparation_contexts WHERE proposal_id = ? ORDER BY created_at DESC, context_id DESC LIMIT 1').bind(proposalId).first<ContextRow>();
    return row ? deserializeCommercialPreparationContext(row.context_json) : null;
  }
}

export class InMemoryCommercialPreparationContextStore implements CommercialPreparationContextStore {
  private readonly values = new Map<string, string>();
  async saveCommercialPreparationContext(context: CommercialPreparationContextV1): Promise<void> {
    const existing = this.values.get(context.contextId);
    if (existing) {
      let serialized: string;
      try { serialized = serializeCommercialPreparationContext(context); } catch { throw new Error('IMMUTABLE_CONTEXT_CONFLICT'); }
      if (existing !== serialized) throw new Error('IMMUTABLE_CONTEXT_CONFLICT');
      return;
    }
    this.values.set(context.contextId, serializeCommercialPreparationContext(context));
  }
  async getCommercialPreparationContext(contextId: string): Promise<CommercialPreparationContextV1 | null> { const value = this.values.get(contextId); return value ? deserializeCommercialPreparationContext(value) : null; }
  async getLatestCommercialPreparationContextForProposal(proposalId: string): Promise<CommercialPreparationContextV1 | null> { const values = [...this.values.values()].map(deserializeCommercialPreparationContext).filter(c => c.proposalId === proposalId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.contextId.localeCompare(a.contextId)); return values[0] ?? null; }
}
