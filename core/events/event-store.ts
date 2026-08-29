import type { MagicScriptEvent } from '../types/events';

export interface EventStore {
  append<TPayload>(event: MagicScriptEvent<TPayload>): Promise<void>;
  listByProspect(prospectId: string): Promise<MagicScriptEvent[]>;
  listRecent(limit?: number): Promise<MagicScriptEvent[]>;
}

export class InMemoryEventStore implements EventStore {
  private readonly events: MagicScriptEvent[] = [];

  async append<TPayload>(event: MagicScriptEvent<TPayload>): Promise<void> {
    this.events.push(event as MagicScriptEvent);
  }

  async listByProspect(prospectId: string): Promise<MagicScriptEvent[]> {
    return this.events.filter((event) => event.prospectId === prospectId);
  }

  async listRecent(limit = 100): Promise<MagicScriptEvent[]> {
    return this.events.slice(-limit).reverse();
  }
}
