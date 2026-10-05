"use client";
import { useEffect, useMemo, useState } from "react";
import type { ProposalDeckItemV1 } from "../lib/deck";
import { approveOutreachDraft, confirmManualMobile, editOutreachDraft, getOutreachStateByProposal, sendOutreachEmail, type OutreachState } from "../lib/outreach";

type Channel = "EMAIL" | "MOBILE";
type OutreachReviewItem = Omit<ProposalDeckItemV1, "proposal"> & {
  proposal: NonNullable<ProposalDeckItemV1["proposal"]>;
};

function isCurrentApproval(draft: OutreachState["draft"]): boolean {
  return draft.status === "APPROVED" && draft.approved_revision === draft.revision && draft.approved_hash === draft.content_hash;
}

function statusFor(draft: OutreachState["draft"], contacted: OutreachState["contacted"]): string {
  if (contacted || draft.status === "SENT" || draft.status === "MOBILE_CONFIRMED") return "ENVOYÉ";
  if (isCurrentApproval(draft)) return "APPROUVÉ POUR CETTE VERSION";
  if (draft.approved_revision !== undefined && (draft.approved_revision !== draft.revision || draft.approved_hash !== draft.content_hash)) return "VERSION MODIFIÉE — NOUVELLE APPROBATION NÉCESSAIRE";
  if (draft.quality?.status === "NEEDS_CORRECTION") return "CORRECTION NÉCESSAIRE";
  if (draft.quality?.status === "BLOCKED") return "BLOQUÉ";
  if (draft.quality?.status === "ABSTAIN") return "ABSTENTION";
  return "MESSAGE PRÊT";
}

export default function OutreachReview({ item }: { item: OutreachReviewItem }) {
  const defaultChannel: Channel | null = item.contactability.email ? "EMAIL" : item.contactability.mobile ? "MOBILE" : null;
  const [channel, setChannel] = useState<Channel | null>(defaultChannel);
  const [state, setState] = useState<OutreachState | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const draft = state?.draft ?? null;
  const contacted = state?.contacted ?? null;
  const recipient = channel === "EMAIL" ? item.contactability.email : item.contactability.mobile;
  const editable = draft?.status === "DRAFT" || draft?.status === "READY_FOR_OPERATOR";
  const qualityReady = draft?.quality?.status === "READY" && draft.quality.revision === draft.revision && draft.quality.fingerprint === draft.content_hash;
  const approvedForCurrentVersion = draft ? isCurrentApproval(draft) : false;
  const sent = Boolean(contacted || draft?.status === "SENT" || draft?.status === "MOBILE_CONFIRMED");
  const sendAvailable = Boolean(draft && approvedForCurrentVersion && qualityReady && !sent);
  const mailto = useMemo(() => recipient && channel === "EMAIL" ? `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : undefined, [body, channel, recipient, subject]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!defaultChannel) return;
      setLoading(true);
      try {
        const existing = await getOutreachStateByProposal(item.proposal.id, defaultChannel);
        if (!existing) throw new Error("Aucune préparation commerciale n’est disponible pour ce prospect.");
        if (!cancelled) {
          setState(existing);
          setSubject(existing.draft.subject || "");
          setBody(existing.draft.body);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Chargement impossible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [defaultChannel, item]);

  async function mutate(action: () => Promise<OutreachState>) {
    setLoading(true);
    setError(null);
    try {
      const next = await action();
      setState(next);
      setSubject(next.draft.subject || "");
      setBody(next.draft.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function changeChannel(next: Channel) {
    if (next === channel) return;
    setChannel(next);
    setState(null);
    setSubject("");
    setBody("");
    setError(null);
  }

  const status = draft ? statusFor(draft, contacted) : "CHARGEMENT";
  const qualityIssue = draft?.quality?.status && draft.quality.status !== "READY";
  const approvalMessage = approvedForCurrentVersion
    ? "Cette version précise a été validée."
    : draft?.approved_revision !== undefined && draft.approved_revision !== draft.revision
      ? "Le message a changé depuis la dernière validation. Une nouvelle validation est nécessaire."
      : "La validation humaine porte sur la version actuellement affichée.";

  return <section className="outreach-review" aria-label={`Revue du message de ${item.businessName}`}>
    <div className="outreach-review-heading">
      <div><p className="card-kicker">MESSAGE COMMERCIAL</p><h3>Revoir le message</h3></div>
      <span className={approvedForCurrentVersion ? "review-status approved" : sent ? "review-status sent" : "review-status"}>{status}</span>
    </div>
    {!defaultChannel ? <p className="outreach-empty">Aucun canal public préparé.</p> : <>
      {loading && !draft ? <p role="status">Chargement du message…</p> : null}
      {error ? <p className="state-panel error" role="alert">{error}</p> : null}
      {sent ? <p className="contacted-status">Ce message a déjà été envoyé ou confirmé.</p> : null}
      <div className="outreach-channel" role="group" aria-label="Canal du message"><span className="outreach-section-label">CANAL</span><button type="button" className={channel === "EMAIL" ? "selected" : ""} disabled={!item.contactability.email || loading} onClick={() => changeChannel("EMAIL")}>Email</button><button type="button" className={channel === "MOBILE" ? "selected" : ""} disabled={!item.contactability.mobile || loading} onClick={() => changeChannel("MOBILE")}>Mobile</button></div>
      <p className="outreach-recipient"><strong>Destinataire</strong> {recipient || "Non disponible"}</p>
      <div className="message-section"><span className="outreach-section-label">MESSAGE ACTUEL</span>{channel === "EMAIL" ? <label className="outreach-field"><span>Objet</span><input value={subject} disabled={!editable || loading} onChange={e => setSubject(e.target.value)} /></label> : null}<label className="outreach-field"><span>{channel === "EMAIL" ? "Message" : "Message à lire / copier"}</span><textarea value={body} disabled={!editable || loading} onChange={e => setBody(e.target.value)} rows={7} /></label></div>
      <div className="approval-boundary"><strong>{approvalMessage}</strong><span>{approvedForCurrentVersion ? "Elle peut être envoyée si le canal le permet." : "Toute modification demande une nouvelle validation."}</span></div>
      {qualityIssue ? <div className="quality-projection"><strong>{draft?.quality?.status === "ABSTAIN" ? "Le contrôle ne permet pas de valider ce message." : draft?.quality?.status === "BLOCKED" ? "Le message ne peut pas être envoyé dans son état actuel." : "Le message doit être corrigé avant validation."}</strong></div> : null}
      <div className="outreach-actions">
        {channel === "MOBILE" ? <><button type="button" data-outreach-action="copy-message" className="copy-button" disabled={loading} onClick={() => void copy(body)}>Copier le message</button><button type="button" data-outreach-action="copy-number" className="copy-button" disabled={loading} onClick={() => void copy(recipient || "")}>Copier le numéro</button></> : null}
        {editable ? <button type="button" data-outreach-action="edit" className="approve-button" disabled={loading || !draft} onClick={() => { if (draft) void mutate(() => editOutreachDraft(draft.id, { subject, body })); }}>Enregistrer les modifications</button> : null}
        {!sent && !approvedForCurrentVersion && editable ? <button type="button" data-outreach-action="approve" className="approve-button" disabled={loading || !draft || !qualityReady} onClick={() => { if (draft) void mutate(() => approveOutreachDraft(draft.id, draft.revision, draft.content_hash)); }}>Valider ce message</button> : null}
        {channel === "EMAIL" ? <>{!sent && <button type="button" data-outreach-action="send-email" className="send-button" disabled={!sendAvailable || loading} onClick={() => { if (draft) void mutate(() => sendOutreachEmail(draft.id)); }}>Envoyer l’email</button>}{mailto ? <a className="copy-button" href={mailto}>Ouvrir un aperçu</a> : null}</> : <>{!sent && <button type="button" data-outreach-action="confirm-mobile" className="send-button" disabled={!approvedForCurrentVersion || loading} onClick={() => { if (window.confirm("Confirmer l’action mobile manuelle ? Aucun SMS ou WhatsApp ne sera envoyé.")) { if (draft) void mutate(() => confirmManualMobile(draft.id, draft.revision, draft.content_hash)); } }}>{"Confirmer l’action mobile"}</button>}</>}
      </div>
      {copied ? <p className="mobile-copy">Copié.</p> : null}
    </>}
  </section>;
}
