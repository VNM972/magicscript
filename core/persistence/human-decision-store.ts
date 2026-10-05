import type { D1DatabaseLike } from './d1-types';
import {
  assertHumanDecision,
  deserializeHumanDecision,
  serializeHumanDecision,
  type PlaybookChangeHumanDecision,
} from '../feedback/human-decision-contract';

export interface HumanDecisionStore {
  save(decision: PlaybookChangeHumanDecision): Promise<void>;
  get(decisionId: string): Promise<PlaybookChangeHumanDecision | null>;
  listByProposal(proposalId: string): Promise<PlaybookChangeHumanDecision[]>;
}

interface DecisionRow { decision_json: string }

export class InMemoryHumanDecisionStore implements HumanDecisionStore {
  private readonly values = new Map<string, string>();

  async save(decision: PlaybookChangeHumanDecision): Promise<void> {
    assertHumanDecision(decision);
    const serialized = serializeHumanDecision(decision);
    const existing = this.values.get(decision.decisionId);
    if (existing && existing !== serialized) throw new Error('IMMUTABLE_HUMAN_DECISION_CONFLICT');
    const proposalDecisions = [...this.values.values()].map(deserializeHumanDecision)
      .filter(value => value.proposalId === decision.proposalId);
    if (proposalDecisions.some(value => value.decisionId !== decision.decisionId)) throw new Error('HUMAN_DECISION_ALREADY_RECORDED');
    this.values.set(decision.decisionId, serialized);
  }

  async get(decisionId: string): Promise<PlaybookChangeHumanDecision | null> {
    const value = this.values.get(decisionId);
    return value ? deserializeHumanDecision(value) : null;
  }

  async listByProposal(proposalId: string): Promise<PlaybookChangeHumanDecision[]> {
    return [...this.values.values()].map(deserializeHumanDecision)
      .filter(value => value.proposalId === proposalId)
      .sort((a, b) => a.decidedAt.localeCompare(b.decidedAt) || a.decisionId.localeCompare(b.decisionId));
  }
}

export class D1HumanDecisionStore implements HumanDecisionStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async save(decision: PlaybookChangeHumanDecision): Promise<void> {
    assertHumanDecision(decision);
    const serialized = serializeHumanDecision(decision);
    await this.db.prepare(`INSERT INTO v2_playbook_human_decisions
      (decision_id, proposal_id, proposal_version, proposal_fingerprint, decided_at, decision_json)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(decision_id) DO NOTHING`)
      .bind(decision.decisionId, decision.proposalId, decision.proposalVersion, decision.proposalFingerprint, decision.decidedAt, serialized).run();
    const stored = await this.get(decision.decisionId);
    if (!stored) throw new Error('HUMAN_DECISION_NOT_PERSISTED');
    if (serializeHumanDecision(stored) !== serialized) throw new Error('IMMUTABLE_HUMAN_DECISION_CONFLICT');
    const allForProposal = await this.db.prepare('SELECT decision_id FROM v2_playbook_human_decisions WHERE proposal_id = ?').bind(decision.proposalId).all<{ decision_id: string }>();
    if ((allForProposal.results ?? []).some(row => row.decision_id !== decision.decisionId)) throw new Error('HUMAN_DECISION_ALREADY_RECORDED');
  }

  async get(decisionId: string): Promise<PlaybookChangeHumanDecision | null> {
    const row = await this.db.prepare('SELECT decision_json FROM v2_playbook_human_decisions WHERE decision_id = ? LIMIT 1').bind(decisionId).first<DecisionRow>();
    return row ? deserializeHumanDecision(row.decision_json) : null;
  }

  async listByProposal(proposalId: string): Promise<PlaybookChangeHumanDecision[]> {
    const rows = await this.db.prepare('SELECT decision_json FROM v2_playbook_human_decisions WHERE proposal_id = ? ORDER BY decided_at ASC, decision_id ASC').bind(proposalId).all<DecisionRow>();
    return (rows.results ?? []).map(row => deserializeHumanDecision(row.decision_json));
  }
}
