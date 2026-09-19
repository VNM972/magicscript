import type { D1DatabaseLike } from './d1-types';
import type { DesignRequestStore, DesignRequestV1 } from '../design/design-request';

export class D1DesignRequestStore implements DesignRequestStore {
  constructor(private readonly db: D1DatabaseLike) {}
  async get(prospectId: string, version: DesignRequestV1['version']): Promise<DesignRequestV1 | null> {
    const row = await this.db.prepare('SELECT request_json FROM v2_design_requests WHERE prospect_id = ? AND version = ? LIMIT 1').bind(prospectId, version).first<{ request_json: string }>();
    return row ? JSON.parse(row.request_json) as DesignRequestV1 : null;
  }
  async save(request: DesignRequestV1): Promise<void> {
    await this.db.prepare(`INSERT INTO v2_design_requests (id, prospect_id, version, pack_id, request_json, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(prospect_id, version) DO UPDATE SET request_json = excluded.request_json`).bind(request.id, request.prospectId, request.version, request.admission.packId, JSON.stringify(request), request.createdAt).run();
  }
}
