import type { Prospect, ProspectContact, ProspectState } from '../types/prospect';
import { assertTransition } from './prospect-state-machine';

export interface ProspectRepository {
  getProspect(id: string): Promise<Prospect | null>;
  listProspects(): Promise<Prospect[]>;
  saveProspect(prospect: Prospect): Promise<void>;
  transitionProspect(id: string, to: ProspectState, reason?: string): Promise<Prospect>;
  saveContact(contact: ProspectContact): Promise<void>;
  listContacts(prospectId: string): Promise<ProspectContact[]>;
}

export class InMemoryProspectRepository implements ProspectRepository {
  private readonly prospects = new Map<string, Prospect>();
  private readonly contacts = new Map<string, ProspectContact[]>();

  async getProspect(id: string): Promise<Prospect | null> {
    return this.prospects.get(id) ?? null;
  }

  async listProspects(): Promise<Prospect[]> {
    return [...this.prospects.values()];
  }

  async saveProspect(prospect: Prospect): Promise<void> {
    this.prospects.set(prospect.id, prospect);
  }

  async transitionProspect(
    id: string,
    to: ProspectState,
    _reason?: string,
  ): Promise<Prospect> {
    const current = this.prospects.get(id);
    if (!current) throw new Error(`Prospect not found: ${id}`);

    assertTransition(current.state, to);

    const updated: Prospect = {
      ...current,
      state: to,
      updatedAt: new Date().toISOString(),
    };

    this.prospects.set(id, updated);
    return updated;
  }

  async saveContact(contact: ProspectContact): Promise<void> {
    const existing = this.contacts.get(contact.prospectId) ?? [];
    const deduped = existing.filter((item) => item.id !== contact.id && item.email !== contact.email);
    this.contacts.set(contact.prospectId, [...deduped, contact]);
  }

  async listContacts(prospectId: string): Promise<ProspectContact[]> {
    return this.contacts.get(prospectId) ?? [];
  }
}
