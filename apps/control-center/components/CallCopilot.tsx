'use client';

import { useEffect, useMemo, useState } from 'react';
import type { QuoteDossier, QuoteDossierConflictField } from '@magicscript/core';
import { applyCallCopilotAction, createQuoteDossier, getCallCopilotReview, startCallCopilot, updateQuoteDossier, validateQuoteDossierAction } from '../app/call-copilot-actions';

type ProspectOption = { id: string; companyName: string; state: string };
type MeetingOption = { meetingId: string; prospectId: string; status: string; startAtUtc: string };
type Props = { prospects: ProspectOption[]; meetings: MeetingOption[] };
const resolvableFields: QuoteDossierConflictField[] = ['commercialNeed', 'requestedScope', 'timing', 'decisionContext'];
type Snapshot = {
  session_id: string;
  company_name: string;
  conversation_mode: string;
  active_objections: string[];
  unknowns: string[];
  multi_signal_buffer: Array<{ type: string; qualitative_confidence: string }>;
  next_best_action: { action: string; why: string };
  stop_discovery: boolean;
  predictions: Array<{ id: string; text: string }>;
  alerts: string[];
  offer_suggestions: { basic: string; premium: string };
};

function requestId(prefix: string) { return `${prefix}-${Date.now()}`; }

export default function CallCopilot({ prospects, meetings }: Props) {
  const [prospectId, setProspectId] = useState(prospects[0]?.id ?? '');
  const [meetingId, setMeetingId] = useState('');
  const [session, setSession] = useState<Snapshot | null>(null);
  const [responseText, setResponseText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [factKey, setFactKey] = useState('');
  const [factValue, setFactValue] = useState('');
  const [feedback, setFeedback] = useState('');
  const [review, setReview] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<QuoteDossier | null>(null);
  const [dossierEdits, setDossierEdits] = useState({ commercialNeed: '', requestedScope: '', timing: '', decisionContext: '', openQuestions: '' });
  const [conflictField, setConflictField] = useState<QuoteDossierConflictField | null>(null);
  const [conflictValue, setConflictValue] = useState('');
  const meetingsForProspect = useMemo(() => meetings.filter((meeting) => meeting.status === 'CONFIRMED' && meeting.prospectId === prospectId), [meetings, prospectId]);
  const unresolvedConflictFields = dossier
    ? resolvableFields.filter((field) => dossier.conflicts.some((conflict) => conflict.startsWith(`${field}:`)))
    : [];

  useEffect(() => {
    setDossier(null);
    setDossierEdits({ commercialNeed: '', requestedScope: '', timing: '', decisionContext: '', openQuestions: '' });
    setConflictField(null);
    setConflictValue('');
  }, [prospectId, meetingId]);

  useEffect(() => {
    setConflictField((current) => current && unresolvedConflictFields.includes(current) ? current : unresolvedConflictFields[0] ?? null);
    setConflictValue('');
  }, [dossier, unresolvedConflictFields.join('|')]);

  async function start() {
    setBusy(true); setError(null);
    try { const result = await startCallCopilot(prospectId, meetingId || undefined) as { session: Snapshot }; setSession(result.session); setReview(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Copilot indisponible'); }
    finally { setBusy(false); }
  }
  async function send(actionPayload: Record<string, unknown>) {
    if (!session) return;
    setBusy(true); setError(null);
    try { const result = await applyCallCopilotAction(session.session_id, actionPayload) as { session: Snapshot }; setSession(result.session); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Action refusée'); }
    finally { setBusy(false); }
  }
  async function loadReview() {
    if (!session) return;
    setBusy(true); setError(null);
    try { const result = await getCallCopilotReview(session.session_id) as { review: unknown }; setReview(result.review); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Revue indisponible'); }
    finally { setBusy(false); }
  }
  async function prepareDossier() {
    setBusy(true); setError(null);
    try {
      const result = await createQuoteDossier(prospectId, meetingId || undefined, session?.session_id);
      setDossier(result.dossier);
      setDossierEdits({
        commercialNeed: result.dossier.commercialNeed.value ?? '',
        requestedScope: result.dossier.requestedScope.value ?? '',
        timing: result.dossier.timing.value ?? '',
        decisionContext: result.dossier.decisionContext.value ?? '',
        openQuestions: result.dossier.openQuestions.join('\n'),
      });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Dossier indisponible'); }
    finally { setBusy(false); }
  }
  async function saveDossier() {
    if (!dossier) return;
    setBusy(true); setError(null);
    try {
      const result = await updateQuoteDossier(dossier.id, {
        commercialNeed: dossierEdits.commercialNeed || null,
        requestedScope: dossierEdits.requestedScope || null,
        timing: dossierEdits.timing || null,
        decisionContext: dossierEdits.decisionContext || null,
        openQuestions: dossierEdits.openQuestions.split('\n').map((value) => value.trim()).filter(Boolean),
      });
      setDossier(result.dossier);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Dossier indisponible'); }
    finally { setBusy(false); }
  }
  async function resolveDossierConflict() {
    if (!dossier || !conflictField || !conflictValue.trim()) return;
    setBusy(true); setError(null);
    try {
      const result = await updateQuoteDossier(dossier.id, {}, { field: conflictField, value: conflictValue });
      setDossier(result.dossier);
      setConflictValue('');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Résolution refusée'); }
    finally { setBusy(false); }
  }
  async function validateDossier() {
    if (!dossier) return;
    setBusy(true); setError(null);
    try {
      const result = await validateQuoteDossierAction(dossier.id);
      setDossier(result.dossier);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Validation refusée'); }
    finally { setBusy(false); }
  }

  return <section className="panel callCopilotPanel" id="call-copilot" aria-labelledby="call-copilot-title">
    <div className="panelTitle"><div><p className="eyebrow">CALL COPILOT · INTERNE</p><h2 id="call-copilot-title">Aide de rendez-vous</h2></div><span className="badge waiting">TEXTE + CLICS · SANS AUDIO</span></div>
    <p className="muted">Les suggestions restent une aide opérateur. Elles ne sont ni des faits, ni des citations, ni une modification du lifecycle.</p>
    {!session ? <div className="copilotStartGrid">
      <label>Prospect<select value={prospectId} onChange={(event) => { setProspectId(event.target.value); setMeetingId(''); }} disabled={busy}>{prospects.length ? prospects.map((prospect) => <option key={prospect.id} value={prospect.id}>{prospect.companyName} · {prospect.state}</option>) : <option value="">Aucun prospect disponible</option>}</select></label>
      <label>Rendez-vous confirmé (facultatif)<select value={meetingId} onChange={(event) => setMeetingId(event.target.value)} disabled={busy || meetingsForProspect.length === 0}><option value="">Contexte prospect seulement</option>{meetingsForProspect.map((meeting) => <option key={meeting.meetingId} value={meeting.meetingId}>{new Date(meeting.startAtUtc).toLocaleString('fr-FR')}</option>)}</select></label>
      <button type="button" className="primaryButton" onClick={start} disabled={busy || !prospectId}>{busy ? 'Ouverture…' : 'Ouvrir le Copilot'}</button>
      <button type="button" className="secondaryButton" onClick={prepareDossier} disabled={busy || !prospectId}>Créer / ouvrir le dossier</button>
    </div> : <>
      <div className="copilotLiveHeader"><div><span className="eyebrow">PROSPECT</span><strong>{session.company_name}</strong><small>{session.conversation_mode}</small></div><div className="copilotActionCallout"><span>PROCHAINE ACTION</span><strong>{session.next_best_action.action}</strong><small>{session.next_best_action.why}</small></div></div>
      {session.alerts.length ? <div className="copilotAlerts" role="status">{session.alerts.map((alert) => <span key={alert} className="badge alertBadge">{alert}</span>)}</div> : null}
      <div className="copilotColumns"><div className="copilotPrimary">
        <div className="copilotBlock"><span className="eyebrow">RÉPONSES PLAUSIBLES · AIDE UNIQUEMENT</span><div className="predictionList">{session.predictions.map((prediction) => <button type="button" className="predictionButton" key={prediction.id} onClick={() => send({ type: 'SELECT_PREDICTION', predictionId: prediction.id })} disabled={busy}>{prediction.text}</button>)}<span className="predictionOther">AUTRE / CE QU’IL A RÉELLEMENT DIT</span></div></div>
        <div className="copilotBlock"><label>Réponse réellement rapportée par l’opérateur<textarea value={responseText} onChange={(event) => setResponseText(event.target.value)} placeholder="Saisir une paraphrase, sans transcription automatique." rows={3} /><button type="button" className="primaryButton" onClick={() => { send({ type: 'PROSPECT_RESPONSE', text: responseText }); setResponseText(''); }} disabled={busy || !responseText.trim()}>Analyser la réponse</button></label></div>
        <div className="copilotBlock copilotDual"><label>Note interne<textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} rows={2} /><button type="button" onClick={() => { send({ type: 'OPERATOR_NOTE', text: noteText }); setNoteText(''); }} disabled={busy || !noteText.trim()}>Enregistrer</button></label><label>Feedback suggestion<textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={2} /><button type="button" onClick={() => { send({ type: 'FEEDBACK', value: feedback }); setFeedback(''); }} disabled={busy || !feedback.trim()}>Signaler l’écart</button></label></div>
        <div className="copilotBlock copilotDual"><label>Fait à confirmer · clé<input value={factKey} onChange={(event) => setFactKey(event.target.value)} placeholder="ex. besoin" /></label><label>Valeur validée<input value={factValue} onChange={(event) => setFactValue(event.target.value)} placeholder="confirmation explicite" /></label><button type="button" onClick={() => { send({ type: 'VALIDATE_KNOWLEDGE', key: factKey, value: factValue }); setFactKey(''); setFactValue(''); }} disabled={busy || !factKey.trim() || !factValue.trim()}>Confirmer le fait</button></div>
      </div><aside className="copilotAside"><div className="copilotBlock"><span className="eyebrow">RECOMMANDATION</span><p className="copilotRecommendation">{session.stop_discovery ? 'NE PAS REQUALIFIER · passer à l’étape suivante.' : session.next_best_action.why}</p><p className="muted">{session.stop_discovery ? 'MOVE_TO_QUOTE recommandé sur signal explicite.' : 'Les blockers et contradictions restent prioritaires.'}</p></div><div className="copilotBlock"><span className="eyebrow">BASIC</span><p>{session.offer_suggestions.basic}</p><span className="eyebrow">PREMIUM</span><p>{session.offer_suggestions.premium}</p></div><div className="copilotBlock"><span className="eyebrow">SIGNAUX · UNKNOWN</span><p>{session.multi_signal_buffer.map((item) => `${item.type} · ${item.qualitative_confidence}`).join(' · ') || 'Aucun signal capturé'}</p><p>{session.unknowns.join(' · ') || 'Aucun UNKNOWN critique'}</p></div><button type="button" onClick={loadReview} disabled={busy}>Préparer la validation de fin d’appel</button></aside></div>
      {review ? <details className="copilotReview" open><summary>Validation humaine avant conservation</summary><pre>{JSON.stringify(review, null, 2)}</pre></details> : null}<button type="button" className="secondaryButton" onClick={() => setSession(null)} disabled={busy}>Changer de dossier</button>
    </>}
    {dossier ? <div className="copilotBlock quoteDossierBlock">
      <div className="panelTitle"><div><span className="eyebrow">PRÉPARATION COMMERCIALE</span><h3>Dossier de devis prérempli</h3></div><span className={`badge ${dossier.status === 'HUMAN_VALIDATED' ? 'running' : 'waiting'}`}>{dossier.status}</span></div>
      <p><strong>Besoin :</strong> {dossier.commercialNeed.value ?? 'UNKNOWN'} · <small>{dossier.commercialNeed.evidenceStatus} · {dossier.commercialNeed.provenance}</small></p>
      <p><strong>Périmètre :</strong> {dossier.requestedScope.value ?? 'UNKNOWN'} · <small>{dossier.requestedScope.evidenceStatus} · {dossier.requestedScope.provenance}</small></p>
      <p><strong>Timing :</strong> {dossier.timing.value ?? 'UNKNOWN'} · <small>{dossier.timing.evidenceStatus} · {dossier.timing.provenance}</small></p>
      <p><strong>Décision :</strong> {dossier.decisionContext.value ?? 'UNKNOWN'} · <small>{dossier.decisionContext.evidenceStatus} · {dossier.decisionContext.provenance}</small></p>
      <p><strong>Prix :</strong> {dossier.pricing.value ?? 'TO DEFINE'} · <small>{dossier.pricing.evidenceStatus} · {dossier.pricing.provenance}</small></p>
      <p><strong>Questions ouvertes :</strong> {dossier.openQuestions.join(' · ') || 'Aucune connue'}</p>
      {dossier.status === 'DRAFT' ? <>
        <label>Besoin éditable<input value={dossierEdits.commercialNeed} onChange={(event) => setDossierEdits({ ...dossierEdits, commercialNeed: event.target.value })} /></label>
        <label>Périmètre éditable<input value={dossierEdits.requestedScope} onChange={(event) => setDossierEdits({ ...dossierEdits, requestedScope: event.target.value })} /></label>
        <label>Timing éditable<input value={dossierEdits.timing} onChange={(event) => setDossierEdits({ ...dossierEdits, timing: event.target.value })} /></label>
        <label>Contexte de décision éditable<input value={dossierEdits.decisionContext} onChange={(event) => setDossierEdits({ ...dossierEdits, decisionContext: event.target.value })} /></label>
        <label>Questions ouvertes éditables<textarea value={dossierEdits.openQuestions} onChange={(event) => setDossierEdits({ ...dossierEdits, openQuestions: event.target.value })} rows={3} /></label>
        <button type="button" onClick={saveDossier} disabled={busy}>Enregistrer les modifications</button>
        {dossier.conflicts.length ? <>
          <p className="errorText">Conflits à résoudre : {dossier.conflicts.join(' · ')}</p>
          {unresolvedConflictFields.length ? <>
            <label>Champ du conflit<select value={conflictField ?? ''} onChange={(event) => { setConflictField(event.target.value as QuoteDossierConflictField); setConflictValue(''); }}>
              {unresolvedConflictFields.map((field) => <option key={field} value={field}>{field}</option>)}
            </select></label>
            <label>Valeur retenue après revue humaine<input value={conflictValue} onChange={(event) => setConflictValue(event.target.value)} /></label>
            <button type="button" onClick={resolveDossierConflict} disabled={busy || !conflictField || !conflictValue.trim()}>Résoudre explicitement ce conflit</button>
          </> : null}
        </> : null}
        <button type="button" onClick={validateDossier} disabled={busy || dossier.conflicts.length > 0}>Valider pour préparation de devis</button>
      </> : <p className="muted">Validation humaine enregistrée. Aucun prix n’est généré automatiquement.</p>}
    </div> : null}
    {error ? <p className="errorText" role="alert">{error}</p> : null}
  </section>;
}
