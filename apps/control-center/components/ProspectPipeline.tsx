"use client";

import { useMemo, useState } from "react";
import {
  partitionProspectsByCommercialView,
  sortCurrentCommercialProspects,
} from "@magicscript/core";
import type {
  Escalation,
  OperatorProspectQueue,
  ProspectSummary,
  PrototypeSummary,
  SalesRoomSummary,
} from "../lib/api";
import { getActionableContactPreparation } from "../lib/api";
import { founderEscalationPresentation } from "../lib/founder-escalation";
import { reviewPrototype } from "../app/call-copilot-actions";
import ProspectDetailsLink from "./ProspectDetailsLink";

interface ProspectPipelineProps {
  prospects: ProspectSummary[];
  operatorQueue: OperatorProspectQueue;
  prototypes: PrototypeSummary[];
  salesRooms: SalesRoomSummary[];
  escalations: Escalation[];
  prototypeJobs?: Array<{ id: string; prospectId?: string; kind: string; status: string; updatedAt: string; result?: unknown }>;
}

function stateLabel(state: string): string {
  const labels: Record<string, string> = {
    DISCOVERED: "D?couvert",
    RESEARCHING: "Recherche en cours",
    RESEARCH_COMPLETE: "Recherche termin?e",
    QUALIFIED: "Qualifi?",
    DISQUALIFIED: "?cart?",
    CONTACT_DISCOVERY: "Recherche de contact",
    CONTACT_FOUND: "Contact trouv?",
    CONTACT_INVALID: "Contact invalide",
    OUTREACH_READY: "Message ? pr?parer",
    OUTREACH_DRAFTED: "Message r?dig?",
    OUTREACH_VERIFIED: "Message v?rifi?",
    EMAIL_SENT: "Email envoy?",
    WAITING_REPLY: "En attente de r?ponse",
    FOLLOW_UP_DUE: "Relance ? faire",
    FOLLOW_UP_SENT: "Relance envoy?e",
    HUMAN_ACTION_REQUIRED: "Action requise",
    PROTOTYPE_REQUIRED: "Prototype requis",
    PROTOTYPE_STRATEGY_GENERATED: "Strat?gie prototype pr?te",
    PROTOTYPE_BUILDING: "Prototype en construction",
    PROTOTYPE_BUILT: "Prototype construit",
    PROTOTYPE_QA: "Contr?le prototype",
    PROTOTYPE_READY: "Prototype pr?t",
    PROTOTYPE_DEPLOYING: "Mise en ligne en cours",
    PROTOTYPE_DEPLOYED: "Prototype en ligne",
    HOT_LEAD: "Lead chaud",
    INTERESTED: "Int?ress?",
    MEETING_REQUESTED: "Rendez-vous demand?",
    MEETING_BOOKED: "Rendez-vous confirm?",
    PRICING_REQUESTED: "Tarif demand?",
    CUSTOM_REQUEST: "Demande sp?cifique",
    CLOSED_LOST: "Perdu",
    DORMANT: "Dormant",
    DO_NOT_CONTACT: "Ne pas contacter",
  };

  return labels[state] ?? state.replaceAll("_", " ");
}

function prototypeUrl(prototype?: PrototypeSummary): string | null {
  if (!prototype) return null;

  return (
    prototype.prototype_url ??
    prototype.deployment_url ??
    prototype.prototype_entry_url ??
    null
  );
}

function prototypeLabel(url: string): string {
  return url.includes("127.0.0.1")
    ? "VOIR LE PROTOTYPE LOCAL"
    : "VOIR LE PROTOTYPE";
}

function emailWebsiteDomainMismatch(prospect: ProspectSummary): boolean {
  const email = prospect.contactability?.channels.find((channel) => channel.type === "EMAIL")?.value;
  if (!email || !prospect.websiteUrl) return false;
  try {
    const websiteHost = new URL(prospect.websiteUrl).hostname.toLowerCase().replace(/^www\./, "");
    const emailDomain = email.split("@")[1]?.toLowerCase();
    return Boolean(emailDomain && emailDomain !== websiteHost && !emailDomain.endsWith(`.${websiteHost}`));
  } catch {
    return true;
  }
}

function scoreValue(prospect: ProspectSummary): number {
  return typeof prospect.score === "number" ? prospect.score : -1;
}

export default function ProspectPipeline({
  prospects,
  operatorQueue,
  prototypes,
  salesRooms,
  escalations,
  prototypeJobs = [],
}: ProspectPipelineProps) {
  const [viewMode, setViewMode] = useState<"QUEUE" | "CURRENT" | "HISTORY">("QUEUE");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [assetFilter, setAssetFilter] = useState("ALL");
  const [sortMode, setSortMode] = useState("COMMERCIAL");
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [reviewMessages, setReviewMessages] = useState<Record<string, string>>({});

  const commercialPartitions = useMemo(
    () => partitionProspectsByCommercialView(prospects),
    [prospects],
  );

  const baseProspects = useMemo(() => {
    if (viewMode === "QUEUE") {
      return operatorQueue.entries.map((entry) => entry.prospect);
    }

    if (viewMode === "CURRENT") {
      return sortCurrentCommercialProspects(commercialPartitions.current);
    }

    return [
      ...commercialPartitions.legacy,
      ...commercialPartitions.internal,
      ...commercialPartitions.rejected,
    ].sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime(),
    );
  }, [commercialPartitions, operatorQueue, viewMode]);

  const queueEntryByProspect = useMemo(
    () => new Map(operatorQueue.entries.map((entry) => [entry.prospect.id, entry])),
    [operatorQueue],
  );

  const prototypeByProspect = useMemo(() => {
    const map = new Map<string, PrototypeSummary>();

    for (const prototype of prototypes) {
      if (!map.has(prototype.prospect_id)) {
        map.set(prototype.prospect_id, prototype);
      }
    }

    return map;
  }, [prototypes]);

  const salesRoomByProspect = useMemo(
    () => new Map(salesRooms.map((room) => [room.prospectId, room])),
    [salesRooms],
  );

  const escalationByProspect = useMemo(
    () => new Map(escalations.map((item) => [item.prospect_id, item])),
    [escalations],
  );

  const latestPrototypeJobByProspect = useMemo(() => {
    const map = new Map<string, NonNullable<ProspectPipelineProps['prototypeJobs']>[number]>();
    for (const job of prototypeJobs) {
      if (!job.prospectId) continue;
      const previous = map.get(job.prospectId);
      if (!previous || Date.parse(job.updatedAt) >= Date.parse(previous.updatedAt)) map.set(job.prospectId, job);
    }
    return map;
  }, [prototypeJobs]);

  const latestStrategyJobByProspect = useMemo(() => {
    const map = new Map<string, NonNullable<ProspectPipelineProps['prototypeJobs']>[number]>();
    for (const job of prototypeJobs.filter((candidate) => candidate.kind === "GENERATE_PROTOTYPE_STRATEGY")) {
      if (!job.prospectId) continue;
      const previous = map.get(job.prospectId);
      if (!previous || Date.parse(job.updatedAt) >= Date.parse(previous.updatedAt)) map.set(job.prospectId, job);
    }
    return map;
  }, [prototypeJobs]);

  const availableStates = useMemo(
    () => [...new Set(baseProspects.map((prospect) => prospect.state))].sort(),
    [baseProspects],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("fr");

    const result = baseProspects.filter((prospect) => {
      const prototype = prototypeByProspect.get(prospect.id);
      const room = salesRoomByProspect.get(prospect.id);
      const preparedContact = (prospect.state === "PROTOTYPE_REQUIRED" ? null : getActionableContactPreparation(prospect));
      const queueEntry = queueEntryByProspect.get(prospect.id);

      const matchesQuery =
        !normalizedQuery ||
        [
          prospect.companyName,
          prospect.activity,
          prospect.location,
          prospect.state,
          prospect.id,
          prospect.commercialView.category,
          prospect.contactability?.status,
          queueEntry?.nextAction,
          queueEntry?.reason,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLocaleLowerCase("fr").includes(normalizedQuery),
          );

      const matchesState =
        stateFilter === "ALL" ||
        (stateFilter === "ACTION_REQUIRED"
          ? prospect.state === "HUMAN_ACTION_REQUIRED"
          : prospect.state === stateFilter);

      const matchesAsset =
        assetFilter === "ALL" ||
        (assetFilter === "CONTACT" && Boolean(preparedContact)) ||
        (assetFilter === "PROTOTYPE" && Boolean(prototypeUrl(prototype))) ||
        (assetFilter === "SALES_ROOM" &&
          Boolean(room?.salesRoomUrl && room.status === "ACTIVE"));

      return matchesQuery && matchesState && matchesAsset;
    });

    return [...result].sort((left, right) => {
      if (sortMode === "UPDATED_DESC") {
        return (
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime()
        );
      }

      if (sortMode === "NAME_ASC") {
        return left.companyName.localeCompare(right.companyName, "fr");
      }

      if (sortMode === "COMMERCIAL") return 0;

      const scoreDelta = scoreValue(right) - scoreValue(left);
      if (scoreDelta !== 0) return scoreDelta;

      return (
        new Date(right.updatedAt).getTime() -
        new Date(left.updatedAt).getTime()
      );
    });
  }, [
    baseProspects,
    query,
    stateFilter,
    assetFilter,
    sortMode,
    prototypeByProspect,
    salesRoomByProspect,
    queueEntryByProspect,
  ]);

  const historyCount =
    commercialPartitions.legacy.length +
    commercialPartitions.internal.length +
    commercialPartitions.rejected.length;

  return (
    <section className="panel prospectPipelinePanel" id="prospection">
      <div className="panelTitle">
        <div>
          <p className="eyebrow">PROSPECTION</p>
          <h2>Prospects</h2>
        </div>
        <span className="count">
          {filtered.length}/{baseProspects.length}
        </span>
      </div>

      <div className="prospectViewTabs" aria-label="Vue commerciale des prospects">
        <button
          type="button"
          aria-pressed={viewMode === "QUEUE"}
          onClick={() => setViewMode("QUEUE")}
        >
          À TRAITER / DISPONIBLES ({operatorQueue.entries.length})
        </button>
        <button
          type="button"
          aria-pressed={viewMode === "CURRENT"}
          onClick={() => setViewMode("CURRENT")}
        >
          ACTIFS V2.5 ({commercialPartitions.current.length})
        </button>
        <button
          type="button"
          aria-pressed={viewMode === "HISTORY"}
          onClick={() => setViewMode("HISTORY")}
        >
          HISTORIQUE / LEGACY ({historyCount})
        </button>
        <span>
          Legacy {commercialPartitions.legacy.length} · Interne {commercialPartitions.internal.length} · Hors cible {commercialPartitions.rejected.length}
        </span>
      </div>

      <div className="prospectToolbar">
        <label className="prospectSearch">
          <span>Rechercher</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Entreprise, activit?, ville..."
          />
        </label>

        <label>
          <span>Statut</span>
          <select
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value)}
          >
            <option value="ALL">Tous</option>
            <option value="ACTION_REQUIRED">Action requise</option>
            {availableStates.map((state) => (
              <option value={state} key={state}>
                {stateLabel(state)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Disponible</span>
          <select
            value={assetFilter}
            onChange={(event) => setAssetFilter(event.target.value)}
          >
            <option value="ALL">Tout</option>
            <option value="CONTACT">Contact publie et verifie</option>
            <option value="PROTOTYPE">Prototype inspectable</option>
            <option value="SALES_ROOM">Sales Room active</option>
          </select>
        </label>

        <label>
          <span>Tri</span>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
          >
            <option value="COMMERCIAL">Priorité opérateur</option>
            <option value="SCORE_DESC">Score d?croissant</option>
            <option value="UPDATED_DESC">Plus r?cemment modifi?</option>
            <option value="NAME_ASC">Nom A ? Z</option>
          </select>
        </label>
      </div>

      <p className="prospectToolbarSummary">
        {viewMode === "QUEUE"
          ? `File opérateur : ${operatorQueue.currentCount} actif(s) V2.5 et ${operatorQueue.preCurrentCount} prospect(s) pré-current avec une prochaine action prouvée.`
          : viewMode === "CURRENT"
            ? "Vue active : uniquement les opportunités éligibles sous Commercial Eligibility V2.5.1."
            : "Vue historique : preuves pré-gate, fixtures et candidats hors cible, sans fusion d'identité."}
      </p>

      <div className="prospectCardList">
        {filtered.length === 0 ? (
          <div className="prospectEmpty">
            {viewMode === "QUEUE"
              ? "Aucun prospect disponible ne possède actuellement une prochaine action prouvée."
              : viewMode === "CURRENT"
                ? "Aucun prospect V2.5 actif pour le moment."
                : "Aucun prospect historique ne correspond aux filtres."}
          </div>
        ) : (
          filtered.map((prospect) => {
            const prototype = prototypeByProspect.get(prospect.id);
            const room = salesRoomByProspect.get(prospect.id);
            const escalation = escalationByProspect.get(prospect.id);
            const escalationPresentation = escalation
              ? founderEscalationPresentation(escalation.summary)
              : null;
            const contactability = prospect.contactability;
            const preparation = (prospect.state === "PROTOTYPE_REQUIRED" ? null : getActionableContactPreparation(prospect));
            const inspectablePrototype = prototypeUrl(prototype);
            const queueEntry = queueEntryByProspect.get(prospect.id);

            return (
              <details
                className="prospectCard"
                id={`prospect-${prospect.id}`}
                key={prospect.id}
              >
                <summary className="prospectCardSummary">
                  <span className="prospectMain">
                    <strong>{prospect.companyName}</strong>
                    <small>
                      {prospect.activity || "Activit? non renseign?e"}
                      {prospect.location ? ` ? ${prospect.location}` : ""}
                    </small>
                    <small>
                      ID {prospect.id} · {prospect.commercialView.category} · {stateLabel(prospect.state)} · contact {contactability?.status ?? "MISSING"}
                    </small>
                  </span>

                  <span className="prospectScore">
                    <small>{viewMode === "QUEUE" ? "PROCHAINE ACTION" : "SCORE"}</small>
                    <strong>
                      {viewMode === "QUEUE"
                        ? queueEntry?.nextAction ?? "UNKNOWN"
                        : typeof prospect.score === "number"
                          ? `${prospect.score}/100 · ${prospect.scoreType === "CALIBRATED_RESEARCH" ? "recherche calibrée" : prospect.scoreType === "INTAKE_COMMERCIAL_ELIGIBILITY" ? "éligibilité commerciale intake" : prospect.scoreType === "LEGACY_SCALAR" ? "scalaire historique" : "provenance inconnue"}`
                          : "?"}
                    </strong>
                  </span>

                  <span
                    className={`badge ${
                      prospect.state === "HUMAN_ACTION_REQUIRED"
                        ? "waiting"
                        : "running"
                    }`}
                  >
                    {stateLabel(prospect.state)}
                  </span>
                </summary>

                <div className="prospectCardBody">
                  <div className="prospectHistoryIdentity">
                    <strong>{prospect.commercialView.category}</strong>
                    <span>ID : {prospect.id} · lifecycle : {prospect.state} · contactabilité : {contactability?.status ?? "MISSING"}</span>
                  </div>
                  {queueEntry ? (
                    <div className="prospectInfoStrip">
                      Prochaine action : <strong>{queueEntry.nextAction}</strong> · {queueEntry.reason}
                    </div>
                  ) : null}
                  <div className="prospectFacts">
                    <div>
                      <span>SIREN</span>
                      <strong>{prospect.siren || "Non renseigné"}</strong>
                    </div>

                    <div>
                      <span>SIRET</span>
                      <strong>{prospect.siret || "Non renseigné"}</strong>
                    </div>

                    <div>
                      <span>Qualification</span>
                      <strong>
                        {typeof prospect.score === "number"
                          ? `${prospect.score}/100 · ${prospect.scoreType === "CALIBRATED_RESEARCH" ? "recherche calibrée" : prospect.scoreType === "INTAKE_COMMERCIAL_ELIGIBILITY" ? "éligibilité commerciale intake" : prospect.scoreType === "LEGACY_SCALAR" ? "scalaire historique" : "provenance inconnue"}`
                          : "Non disponible"}
                      </strong>
                    </div>

                    <div>
                      <span>Éligibilité commerciale</span>
                      <strong>{prospect.commercialEligibility ?? "UNKNOWN"}</strong>
                    </div>

                    <div>
                      <span>Engagement observ?</span>
                      <strong>
                        {prospect.engagement
                          ? `${prospect.engagement.score_total}/100`
                          : "Aucun signal"}
                      </strong>
                    </div>

                    <div>
                      <span>Téléphone</span>
                      <strong>{preparation?.kind === "PHONE_CALL_PREPARATION" ? preparation.phone : prospect.phone ? "NON VÉRIFIÉ" : "Non renseigné"}</strong>
                    </div>

                    <div>
                      <span>Dernière mise à jour</span>
                      <strong>
                        {new Date(prospect.updatedAt).toLocaleDateString("fr-FR")}
                      </strong>
                    </div>

                    <div>
                      <span>Source prospect</span>
                      <strong>
                        {prospect.sourceUrl ? (
                          <a href={prospect.sourceUrl} target="_blank" rel="noreferrer">
                            VOIR LA SOURCE
                          </a>
                        ) : (
                          "Non disponible"
                        )}
                      </strong>
                    </div>
                  </div>

                  {latestPrototypeJobByProspect.get(prospect.id) ? (() => {
                    const latestJob = latestPrototypeJobByProspect.get(prospect.id)!;
                    const strategyJob = latestStrategyJobByProspect.get(prospect.id);
                    return <div className="prospectInfoStrip">Stratégie : <strong>{strategyJob?.status ?? "AUCUNE"}</strong> · dernière étape : {latestJob.kind} · {latestJob.status}</div>;
                  })() : null}

                  {prospect.prototypeCostGate ? (
                    <div className="prospectInfoStrip">
                      PROTOTYPE BLOQUÉ · Cost Gate :{" "}
                      <strong>{prospect.prototypeCostGate.decision}</strong>
                      {" ? "}
                      autorisation {prospect.prototypeCostGate.authorization} · compute {prospect.prototypeCostGate.computeClass} · coût externe {prospect.prototypeCostGate.estimatedExternalCost.kind === "UNKNOWN" ? "inconnu" : "connu"} · réévaluation {prospect.prototypeCostGate.reevaluateAt ?? "non planifiée"}
                    </div>
                  ) : null}

                  {escalation && escalationPresentation ? (
                    <div className="prospectWarning">
                      <strong>Action requise</strong>
                      <span>
                        {escalationPresentation.title}
                      </span>
                      <small>
                        {escalationPresentation.summary}
                      </small>
                      <details className="prospectTechnicalDisclosure">
                        <summary>Voir le diagnostic technique</summary>
                        <pre>
                          {escalationPresentation.technicalDetails}
                        </pre>
                      </details>
                    </div>
                  ) : null}
                   {prospect.contactPresence ? (
                     <div className="prospectContactability">
                       <div className="prospectContactabilityHeader"><strong>Contact &amp; Presence Enrichment</strong><span className="badge waiting">{prospect.contactPresence.status}</span></div>
                       {(['phone','email','website','instagram','facebook','tiktok','whatsapp','contactForm'] as const).map((key) => {
                         const field = prospect.contactPresence?.[key];
                         return <div className="prospectContactChannel" key={key}><span><strong>{key.toUpperCase()}</strong><small>{field?.status ?? 'UNKNOWN'}{field?.values?.[0] ? ` · ${field.values[0]}` : ''}</small></span></div>;
                       })}
                     </div>
                   ) : null}

                  <div className="prospectContactability">
                    <div className="prospectContactabilityHeader">
                      <strong>Contactabilité</strong>
                      <span
                        className={`badge ${
                          contactability?.status === "PUBLISHED_VERIFIED"
                            ? "running"
                            : "waiting"
                        }`}
                      >
                        {contactability?.status ?? "MISSING"}
                      </span>
                    </div>

                    {contactability?.channels.length ? (
                      contactability.channels.map((channel) => (
                        <div className="prospectContactChannel" key={channel.contactId}>
                          <span>
                            <strong>{channel.type} · {channel.type === "PHONE" && channel.status !== "PUBLISHED_VERIFIED" ? "NON VÉRIFIÉ" : channel.value}</strong>
                            <small>
                              {channel.status} · observe le{" "}
                              {new Date(channel.observedAt).toLocaleDateString("fr-FR")}
                              {typeof channel.confidence === "number"
                                ? ` · confiance ${channel.confidence}/100`
                                : ""}
                              {channel.evidenceEventId
                                ? ` · preuve ${channel.evidenceEventId}`
                                : ""}
                            </small>
                          </span>
                          {channel.sourceUrl ? (
                            <a
                              href={channel.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              VOIR LA SOURCE
                            </a>
                          ) : (
                            <small>Source indisponible</small>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="prospectActionNote">
                        Aucun canal publie exploitable. Aucune action preparee.
                      </span>
                    )}
                  </div>

                  <div className="prospectActions">
                     {prospect.state === "PROTOTYPE_REQUIRED" ? (
                       <>
                        <span className="prospectActionNote">Prototype requis · revue/validation avant toute préparation d’email</span>
                        <button type="button" disabled={reviewBusy === prospect.id} onClick={async () => { setReviewBusy(prospect.id); try { const result = await reviewPrototype(prospect.id, 'START_STRATEGY'); const queuedJobId = typeof result === 'object' && result && 'queuedJobId' in result ? (result as { queuedJobId?: string }).queuedJobId : undefined; setReviewMessages((messages) => ({ ...messages, [prospect.id]: queuedJobId ? `Préparation du prototype en cours · job ${queuedJobId}` : `Préparation du prototype demandée pour ${prospect.companyName}.` })); } catch (error) { setReviewMessages((messages) => ({ ...messages, [prospect.id]: error instanceof Error ? error.message : 'Préparation du prototype impossible' })); } finally { setReviewBusy(null); } }}>PRÉPARER LE PROTOTYPE</button>
                        <button type="button" disabled={reviewBusy === prospect.id} onClick={async () => { setReviewBusy(prospect.id); setReviewMessages((messages) => { const next = { ...messages }; delete next[prospect.id]; return next; }); try { await reviewPrototype(prospect.id, 'DEFER'); setReviewMessages((messages) => ({ ...messages, [prospect.id]: `Préparation différée pour ${prospect.companyName}.` })); } catch (error) { setReviewMessages((messages) => ({ ...messages, [prospect.id]: error instanceof Error ? error.message : 'Report impossible' })); } finally { setReviewBusy(null); } }}>DIFFÉRER</button>
                        {reviewMessages[prospect.id] ? <small className="prospectActionNote" role="status">{reviewMessages[prospect.id]}</small> : null}
                        </>
                     ) : prospect.state === "HUMAN_ACTION_REQUIRED" && escalation?.summary?.toLowerCase().includes("prototype") ? (
                        <>
                          <span className="prospectActionNote">Décision humaine requise · la préparation du prototype est en attente.</span>
                          <button type="button" disabled={reviewBusy === prospect.id} onClick={async () => { setReviewBusy(prospect.id); try { const result = await reviewPrototype(prospect.id, 'RESUME_STRATEGY'); const queuedJobId = typeof result === 'object' && result && 'queuedJobId' in result ? (result as { queuedJobId?: string }).queuedJobId : undefined; setReviewMessages((messages) => ({ ...messages, [prospect.id]: queuedJobId ? `Préparation reprise · job ${queuedJobId}` : 'Préparation du prototype reprise.' })); } catch (error) { setReviewMessages((messages) => ({ ...messages, [prospect.id]: error instanceof Error ? error.message : 'Reprise impossible' })); } finally { setReviewBusy(null); } }}>REPRENDRE LA PRÉPARATION</button>
                          {reviewMessages[prospect.id] ? <small className="prospectActionNote" role="status">{reviewMessages[prospect.id]}</small> : null}
                        </>
                      ) : emailWebsiteDomainMismatch(prospect) ? (
                       <span className="prospectActionNote">Contact bloqué · domaine email différent du site source, vérification manuelle requise</span>
                     ) : null}
                    {preparation?.kind === "EMAIL_DRAFT" ? (
                      <a
                        className="actionLink"
                        href={preparation.mailtoHref}
                      >
                        PREPARER L&apos;EMAIL
                      </a>
                    ) : preparation?.kind === "PHONE_CALL_PREPARATION" ? (
                      <span className="prospectActionNote">
                        <strong>PHONE_CALL_PREPARATION</strong> · composer manuellement le {preparation.phone}
                      </span>
                    ) : (
                      <span className="prospectActionNote">
                        {contactability?.status === "OPPOSED"
                          ? "Contact bloque : opposition / ne pas contacter"
                          : contactability?.status === "UNVERIFIED"
                            ? "Canal visible mais non verifie : aucune preparation"
                            : "Aucun contact pr?parable"}
                      </span>
                    )}

                    {preparation?.kind === "EMAIL_DRAFT" ? (
                      <span className="prospectActionNote">
                        Brouillon uniquement · envoi manuel obligatoire
                      </span>
                    ) : preparation?.kind === "PHONE_CALL_PREPARATION" ? (
                      <span className="prospectActionNote">
                        Appel humain obligatoire · aucune composition automatique
                      </span>
                    ) : null}

                    {prospect.websiteUrl && !emailWebsiteDomainMismatch(prospect) ? (
                      <a
                        className="actionLink"
                        href={prospect.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        SITE
                      </a>
                    ) : null}

                    {inspectablePrototype ? (
                      <a
                        className="actionLink"
                        href={inspectablePrototype}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {prototypeLabel(inspectablePrototype)}
                      </a>
                    ) : prototype?.status === "READY" ? (
                      <span className="prospectActionNote">
                        Prototype pr?t ? aucun lien inspectable
                      </span>
                    ) : null}

                    {room?.salesRoomUrl && room.status === "ACTIVE" ? (
                      <a
                        className="actionLink"
                        href={room.salesRoomUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        OUVRIR LA SALES ROOM
                      </a>
                    ) : null}
                  </div>
                </div>
              </details>
            );
          })
        )}
      </div>
    </section>
  );
}
