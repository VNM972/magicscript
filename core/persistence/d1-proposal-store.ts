import type { D1DatabaseLike } from './d1-types';
import type { ProposalStore, ProposalV1 } from '../proposal/contracts';

export class D1ProposalStore implements ProposalStore {
  constructor(private readonly db: D1DatabaseLike) {}
  async get(id: string) { const row = await this.db.prepare('SELECT proposal_json FROM v2_proposals WHERE id = ? LIMIT 1').bind(id).first<{ proposal_json: string }>(); return row ? JSON.parse(row.proposal_json) as ProposalV1 : null; }
  async getByToken(token: string) { const row = await this.db.prepare('SELECT proposal_json FROM v2_proposals WHERE token = ? LIMIT 1').bind(token).first<{ proposal_json: string }>(); return row ? JSON.parse(row.proposal_json) as ProposalV1 : null; }
  async getByCanonicalKey(key: string) { const row = await this.db.prepare('SELECT proposal_json FROM v2_proposals WHERE canonical_key = ? LIMIT 1').bind(key).first<{ proposal_json: string }>(); return row ? JSON.parse(row.proposal_json) as ProposalV1 : null; }
  async save(proposal: ProposalV1) { await this.db.prepare(`INSERT INTO v2_proposals (id, canonical_key, prospect_id, build_artifact_id, token, status, proposal_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(canonical_key) DO NOTHING`).bind(proposal.id, `${proposal.buildArtifactId}:${proposal.version}`, proposal.prospectId, proposal.buildArtifactId, proposal.token, proposal.status, JSON.stringify(proposal), proposal.createdAt).run(); }
  async list() { const result = await this.db.prepare('SELECT proposal_json FROM v2_proposals ORDER BY created_at DESC').all<{ proposal_json: string }>(); return (result.results ?? []).map((row) => JSON.parse(row.proposal_json) as ProposalV1); }
}
