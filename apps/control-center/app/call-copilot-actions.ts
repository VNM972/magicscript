'use server';

import type { QuoteDossier, QuoteDossierConflictField } from '@magicscript/core';

const upstreamBase = () =>
  (process.env.MAGICSCRIPT_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

type QuoteDossierResponse = {
  ok: true;
  duplicate?: boolean;
  dossier: QuoteDossier;
};

function serverHeaders(withJson = false): HeadersInit {
  return {
    ...(withJson ? { 'content-type': 'application/json' } : {}),
    authorization: `Bearer ${process.env.MAGICSCRIPT_API_TOKEN || 'dev-api-token'}`,
  };
}

async function callApi(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(`${upstreamBase()}${path}`, { ...init, cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw new Error(typeof payload?.error === 'string' ? payload.error : `Copilot API ${response.status}`);
  return payload;
}

export async function startCallCopilot(prospectId: string, meetingId?: string): Promise<unknown> {
  if (!prospectId || prospectId.length > 200) throw new Error('Prospect invalide');
  if (meetingId && meetingId.length > 200) throw new Error('Rendez-vous invalide');
  return callApi('/api/call-copilot', {
    method: 'POST',
    headers: serverHeaders(true),
    body: JSON.stringify({ prospectId, meetingId: meetingId || undefined, idempotencyKey: `cc-ui-${prospectId}-${Date.now()}` }),
  });
}

export async function applyCallCopilotAction(sessionId: string, action: Record<string, unknown>): Promise<unknown> {
  if (!sessionId || sessionId.length > 200 || !action || typeof action.type !== 'string') throw new Error('Action Copilot invalide');
  return callApi(`/api/call-copilot/${encodeURIComponent(sessionId)}/actions`, {
    method: 'POST',
    headers: serverHeaders(true),
    body: JSON.stringify({ action, idempotencyKey: `cc-ui-action-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }),
  });
}

export async function getCallCopilotReview(sessionId: string): Promise<unknown> {
  if (!sessionId || sessionId.length > 200) throw new Error('Session Copilot invalide');
  return callApi(`/api/call-copilot/${encodeURIComponent(sessionId)}/review`, {
    method: 'GET',
    headers: serverHeaders(),
  });
}

export async function createQuoteDossier(
  prospectId: string,
  meetingId?: string,
  sourceCopilotSessionId?: string,
): Promise<QuoteDossierResponse> {
  if (!prospectId || prospectId.length > 200) throw new Error('Prospect invalide');
  if (meetingId && meetingId.length > 200) throw new Error('Rendez-vous invalide');
  if (sourceCopilotSessionId && sourceCopilotSessionId.length > 200) {
    throw new Error('Session Copilot invalide');
  }
  return callApi('/api/quote-dossiers', {
    method: 'POST',
    headers: serverHeaders(true),
    body: JSON.stringify({ prospectId, meetingId, sourceCopilotSessionId }),
  }) as Promise<QuoteDossierResponse>;
}

export async function updateQuoteDossier(
  dossierId: string,
  edits: Record<string, unknown>,
  resolution?: { field: QuoteDossierConflictField; value: string },
): Promise<QuoteDossierResponse> {
  if (!dossierId || dossierId.length > 200) throw new Error('Dossier invalide');
  if (!edits || typeof edits !== 'object' || Array.isArray(edits)) {
    throw new Error('Modifications de dossier invalides');
  }
  if (
    resolution &&
    (!['commercialNeed', 'requestedScope', 'timing', 'decisionContext'].includes(resolution.field) ||
      typeof resolution.value !== 'string' ||
      !resolution.value.trim())
  ) {
    throw new Error('Résolution de conflit invalide');
  }
  return callApi(`/api/quote-dossiers/${encodeURIComponent(dossierId)}`, {
    method: 'PATCH',
    headers: serverHeaders(true),
    body: JSON.stringify({ edits, resolution }),
  }) as Promise<QuoteDossierResponse>;
}

export async function validateQuoteDossierAction(
  dossierId: string,
): Promise<QuoteDossierResponse> {
  if (!dossierId || dossierId.length > 200) throw new Error('Dossier invalide');
  return callApi(`/api/quote-dossiers/${encodeURIComponent(dossierId)}/validate`, {
    method: 'POST',
    headers: serverHeaders(true),
    body: '{}',
  }) as Promise<QuoteDossierResponse>;
}
