import LiveRefresh from '../components/LiveRefresh';
import LiveSwarmGraph from '../components/LiveSwarmGraph';
import HubControlPlane from '../components/HubControlPlane';
import CallCopilot from '../components/CallCopilot';
import { getControlCenterData } from '../lib/api';

export const dynamic = 'force-dynamic';

function valueOrDash(value: number | undefined): string {
  return typeof value === 'number' ? String(value) : '—';
}

function jobFamily(kind: string): string {
  if (kind.includes('DISCOVER')) return 'DISCOVERY';
  if (kind.includes('RESEARCH')) return 'RESEARCH';
  if (kind.includes('CONTACT')) return 'CONTACT';
  if (kind.includes('SCORE')) return 'SCORING';
  if (kind.includes('OUTREACH') || kind.includes('SEND_')) return 'OUTREACH';
  if (kind.includes('REPLY') || kind.includes('CLASSIFY')) return 'REPLIES';
  if (kind.includes('PROTOTYPE') || kind.includes('DEPLOY')) return 'PROTOTYPE';
  return 'ORCHESTRATOR';
}

function shortEvent(type: string): string {
  return type.replaceAll('.', ' ”º ').replaceAll('_', ' ').toUpperCase();
}

function engagementSignalLabel(signal: string): string {
  const labels: Record<string, string> = {
    PROTOTYPE_VIEWED: 'prototype vu',
    SALES_ROOM_VIEWED: 'Sales Room vue',
    RETURN_VISIT: 'retour récent',
    DEMO_OPENED: 'démo ouverte',
    SHARE_CLICKED: 'partage activé',
    CONTACT_CLICKED: 'contact activé',
    MESSAGE_SENT: 'message envoyé par le prospect',
    MEETING_REQUESTED: 'échange demandé',
    MEETING_BOOKED: 'rendez-vous confirmé',
  };
  return labels[signal] ?? signal;
}

function salesRoomEventLabel(type: string): string {
  if (type === 'sales_room.message_received') return 'MESSAGE REÇU · PRIORITÉ HAUTE';
  if (type === 'commercial.meeting_requested') return 'DEMANDE D’ÉCHANGE · PRIORITÉ HAUTE';
  if (type === 'sales_room.share_clicked') return 'PARTAGE CLIQUÉ';
  return 'RÉSOLUTION SALES ROOM ÉCHOUÉE';
}

function formatMeetingTime(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return 'Heure indisponible';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

type ProcessStage = {
  label: string;
  detail: string;
  state: string;
  href: string;
};

export default async function Page() {
  const data = await getControlCenterData();
  const overview = data.overview;
  const now = Date.now();
  const onlineRunners = data.runners.filter(
    (runner) => now - new Date(runner.last_seen_at).getTime() < 60_000,
  );

  const stats = [
    ['Prospects découverts', valueOrDash(overview?.prospects)],
    ['Qualifiés', valueOrDash(overview?.qualified)],
    ['Emails envoyés', valueOrDash(overview?.emailsSent)],
    ['Réponses', valueOrDash(overview?.replies)],
    ['Intérêts explicites', valueOrDash(overview?.interested)],
    ['Rendez-vous réservés', valueOrDash(overview?.meetingsBooked)],
    ['Prototypes', valueOrDash(overview?.prototypes)],
  ];

  const activeFamilies = new Set(
    data.runningJobs.map((job) => jobFamily(job.kind)),
  );
  const stateCounts = data.prospects.reduce<Record<string, number>>(
    (acc, prospect) => {
      acc[prospect.state] = (acc[prospect.state] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const countState = (state: string) => stateCounts[state] ?? 0;
  const rankedProspects = [...data.prospects].sort(
    (left, right) =>
      (right.engagement?.score_total ?? 0) - (left.engagement?.score_total ?? 0),
  );
  const personalizedLinksReady = data.prototypes.filter(
    (prototype) => prototype.personalized_entry_enabled,
  ).length;
  const demosReadyForLinks = data.prototypes.filter(
    (prototype) => Boolean(prototype.prototype_url),
  ).length;
  const backendDataReady = Boolean(
    data.connected && data.health?.databaseConfigured,
  );
  const webDesignReady = data.prototypes.filter(
    (prototype) => prototype.web_design_ready,
  ).length;
  const qaReviewed = data.prototypes.filter(
    (prototype) => Boolean(prototype.qa_status),
  ).length;
  const salesRoomAlerts = data.recentEvents.filter((event) =>
    new Set([
      'sales_room.resolution_failed',
      'sales_room.message_received',
      'commercial.meeting_requested',
      'sales_room.share_clicked',
    ]).has(event.type),
  ).slice(0, 6);

  const processStages: ProcessStage[] = [
    {
      label: 'Prospection',
      detail: backendDataReady ? `${data.prospects.length} fiches visibles` : 'Données indisponibles',
      state: backendDataReady ? 'ACTIF' : 'EN ATTENTE',
      href: '#prospection',
    },
    {
      label: 'Qualification',
      detail: overview ? `${overview.qualified} qualifiés` : 'À vérifier',
      state: overview ? 'SUIVI' : 'EN ATTENTE',
      href: '#prospection',
    },
    {
      label: 'Enrichissement',
      detail: backendDataReady ? 'Sources et fiches' : 'Connexion requise',
      state: backendDataReady ? 'PRÊT' : 'EN ATTENTE',
      href: '#prospection',
    },
    {
      label: 'Prototype',
      detail: data.prototypes.length ? `${data.prototypes.length} suivis` : 'Aucun suivi',
      state: data.prototypes.length ? 'EN COURS' : 'EN ATTENTE',
      href: '#prototypes',
    },
    {
      label: 'Web Design',
      detail: data.prototypes.length ? `${webDesignReady}/${data.prototypes.length} validés` : 'Gate obligatoire',
      state: data.prototypes.length ? 'GATE' : 'À PRÉVOIR',
      href: '#prototypes',
    },
    {
      label: 'QA',
      detail: data.prototypes.length ? `${qaReviewed}/${data.prototypes.length} revus` : 'Revue à planifier',
      state: data.prototypes.length ? 'CONTRÔLE' : 'À PRÉVOIR',
      href: '#prototypes',
    },
    {
      label: 'Intérêt explicite',
      detail: `${countState('INTERESTED')} à traiter par Stéphane`,
      state: countState('INTERESTED') ? 'PRIORITAIRE' : 'EN ATTENTE',
      href: '#commercial',
    },
    {
      label: 'Rendez-vous',
      detail: `${countState('MEETING_BOOKED')} briefing(s) à préparer`,
      state: countState('MEETING_BOOKED') ? 'PRIORITAIRE' : 'EN ATTENTE',
      href: '#commercial',
    },
    {
      label: 'Proposition',
      detail: `${countState('QUOTE_PENDING')} devis à préparer · ${countState('COMMITTED')} engagé(s)`,
      state: countState('QUOTE_PENDING') || countState('COMMITTED') ? 'HUMAIN' : 'À PRÉPARER',
      href: '#commercial',
    },
    {
      label: 'Draft',
      detail: 'Brouillons uniquement',
      state: 'SÉCURISÉ',
      href: '#outreach',
    },
    {
      label: 'Signature',
      detail: 'Bon pour accord dans la Sales Room',
      state: 'RELIÉ',
      href: '#sales-rooms',
    },
    {
      label: 'Facturation',
      detail: 'Paiement provider non connecté',
      state: 'HORS MISSION',
      href: '#documents',
    },
    {
      label: 'Delivery',
      detail: 'Après validation',
      state: 'À PRÉPARER',
      href: '#documents',
    },
  ];

  const statusLabel = !data.connected
    ? 'BACKEND OFFLINE'
    : data.health?.autopilotEnabled
      ? 'AUTOPILOT RUNNING'
      : 'AUTOPILOT SAFE MODE';

  const agentDefinitions = [
    {
      id: 'discovery-scout',
      label: 'DISCOVERY SCOUT',
      group: 'PROSPECTION',
      kinds: ['DISCOVER_PROSPECTS'],
      idle: 'Ready to discover local businesses',
    },
    {
      id: 'research-analyst',
      label: 'RESEARCH ANALYST',
      group: 'RESEARCH',
      kinds: ['RUN_RESEARCH_SWARM'],
      idle: 'Ready to verify company facts',
    },
    {
      id: 'contact-hunter',
      label: 'CONTACT HUNTER',
      group: 'CONTACT',
      kinds: ['DISCOVER_CONTACT'],
      idle: 'Ready to find validated contacts',
    },
    {
      id: 'outreach-writer',
      label: 'OUTREACH WRITER',
      group: 'COMMERCIAL',
      kinds: ['GENERATE_OUTREACH', 'GENERATE_INFORMATION_RESPONSE'],
      idle: 'Ready to draft grounded outreach',
    },
    {
      id: 'fact-checker',
      label: 'FACT CHECKER',
      group: 'GUARDRAIL',
      kinds: [
        'FACT_CHECK_OUTREACH',
        'FACT_CHECK_INFORMATION_RESPONSE',
        'RUN_PROTOTYPE_QA',
      ],
      idle: 'Ready to challenge unsupported claims',
    },
    {
      id: 'prototype-strategist',
      label: 'PROTOTYPE STRATEGIST',
      group: 'PROTOTYPE',
      kinds: ['GENERATE_PROTOTYPE_STRATEGY'],
      idle: 'Ready to translate research into strategy',
    },
    {
      id: 'prototype-builder',
      label: 'PROTOTYPE BUILDER',
      group: 'PROTOTYPE',
      kinds: ['BUILD_PROTOTYPE'],
      idle: 'Ready to generate and compile the site',
    },
    {
      id: 'mobile-ux',
      label: 'MOBILE / UX',
      group: 'QA SWARM',
      kinds: ['RUN_PROTOTYPE_QA'],
      idle: 'Ready for 390px mobile review',
    },
    {
      id: 'conversion-checker',
      label: 'CONVERSION',
      group: 'QA SWARM',
      kinds: ['RUN_PROTOTYPE_QA'],
      idle: 'Ready to validate CTA and commercial flow',
    },
    {
      id: 'technical-checker',
      label: 'TECHNICAL QA',
      group: 'QA SWARM',
      kinds: ['RUN_PROTOTYPE_QA'],
      idle: 'Ready to inspect routes, build and demo safety',
    },
    {
      id: 'reply-classifier',
      label: 'REPLY CLASSIFIER',
      group: 'COMMERCIAL',
      kinds: ['CLASSIFY_REPLY'],
      idle: 'Ready to classify inbound responses',
    },
  ];

  const liveAgents = agentDefinitions.map((definition) => {
    const job = data.runningJobs.find((candidate) =>
      definition.kinds.includes(candidate.kind),
    );

    return {
      ...definition,
      active: Boolean(job),
      detail: job
        ? `${job.kind}${job.prospectId ? ` · ${job.prospectId}` : ''}`
        : definition.idle,
    };
  });

  const activeAgentCount = liveAgents.filter((agent) => agent.active).length;

  return (
    <main className="shell">
      <LiveRefresh intervalMs={5000} />
      <header className="topbar">
        <div>
          <p className="eyebrow">MAGIC SCRIPT V2</p>
          <h1>Control Center</h1>
        </div>
        <div className="autopilot">
          <span className="pulse" />
          {statusLabel}
        </div>
      </header>

      {data.readiness ? (
        <section className="panel readinessPanel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">V1 READINESS</p>
              <h2>{data.readiness.dryRunReady ? 'Dry-run ready' : 'Bring-up in progress'}</h2>
            </div>
            <span className={`badge ${data.readiness.dryRunReady ? 'running' : 'waiting'}`}>
              {data.readiness.dryRunReady ? 'READY' : 'CHECKS'}
            </span>
          </div>
          <div className="readinessGrid">
            {Object.entries(data.readiness.checks).map(([name, ok]) => (
              <div className="readinessItem" key={name}>
                <span>{name}</span>
                <strong>{ok ? 'PASS' : 'WAIT'}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {data.error ? (
        <section className="panel" style={{ marginBottom: 12 }}>
          <p className="eyebrow">SYSTEM STATUS</p>
          <p className="muted" style={{ marginBottom: 0 }}>
            {data.error}
          </p>
        </section>
      ) : null}

      <section className="panel processPanel" aria-labelledby="process-title">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">PROCESS COMMERCIAL</p>
            <h2 id="process-title">Du premier signal à la livraison</h2>
          </div>
          <span className="muted">Opérationnel · détails techniques repliables</span>
        </div>
        <nav className="processNav" aria-label="Étapes du processus commercial">
          {processStages.map((stage, index) => (
            <a className="processStep" href={stage.href} key={stage.label}>
              <span className="processStepNumber">{String(index + 1).padStart(2, '0')}</span>
              <strong>{stage.label}</strong>
              <span className="processStepDetail">{stage.detail}</span>
              <span className="processStepState">{stage.state}</span>
            </a>
          ))}
        </nav>
      </section>

      <section className="panel documentPanel" id="documents" aria-labelledby="documents-title">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">DOCUMENTS & PREUVES</p>
            <h2 id="documents-title">Accès depuis l’étape utile</h2>
          </div>
          <span className="muted">Disponible = relié · à préparer = explicite</span>
        </div>
        <div className="documentGrid">
          <a className="documentCard" href="#prospection">
            <strong>Fiches & sources prospect</strong>
            <span>{backendDataReady ? `${data.prospects.length} fiche(s) visibles` : 'Connexion backend requise'}</span>
            <small>Prospection · qualification · enrichissement</small>
          </a>
          <a className="documentCard" href="#prototypes">
            <strong>Prototype & QA</strong>
            <span>{data.prototypes.length ? `${demosReadyForLinks} démo(s) avec lien` : 'Aucun prototype visible'}</span>
            <small>Web Design gate · QA · liens vérifiés</small>
          </a>
          <a className="documentCard" href="#sales-rooms">
            <strong>Devis & proposition</strong>
            <span>Publication canonique reliée</span>
            <small>Validation humaine avant publication</small>
          </a>
          <a className="documentCard" href="#sales-rooms">
            <strong>Bon pour accord</strong>
            <span>Acceptation et preuve reliées</span>
            <small>Aucun paiement déclenché dans cette mission</small>
          </a>
        </div>
      </section>

      <section className="stats">
        {stats.map(([label, value]) => (
          <article className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel liveSwarmPanel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">LIVE SWARM</p>
            <h2>Agent cockpit</h2>
          </div>
          <div className="swarmLiveStatus">
            <span className={`swarmLiveDot ${activeAgentCount > 0 ? 'swarmLiveDotActive' : ''}`} />
            <span>
              {activeAgentCount > 0
                ? `${activeAgentCount} AGENTS ACTIVE`
                : data.connected
                  ? 'SWARM READY'
                  : 'SWARM OFFLINE'}
            </span>
          </div>
        </div>

        <LiveSwarmGraph
          agents={liveAgents}
          prospects={data.prospects}
          recentEvents={data.recentEvents}
          connected={data.connected}
          runningJobCount={data.runningJobs.length}
        />
      </section>

      <HubControlPlane
        prospects={data.prospects}
        runningJobs={data.runningJobs}
      />

      <details className="diagnosticsPanel">
        <summary>
          <span>
            <span className="eyebrow">DIAGNOSTICS</span>
            <strong>État détaillé du runtime et de la swarm</strong>
          </span>
          <span className="muted">Ouvrir pour inspecter</span>
        </summary>
      <section className="grid">
        <article className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">SWARM</p>
              <h2>Operations map</h2>
            </div>
            <span className="muted">
              {data.connected && data.health?.databaseConfigured
                ? 'Live backend connected'
                : 'Waiting for backend data'}
            </span>
          </div>

          <div className="swarmMap">
            <div className={`node coreNode ${activeFamilies.size ? 'nodeActive' : ''}`}>
              <span>ORCHESTRATOR</span>
              <small>{data.runningJobs.length} jobs</small>
            </div>
            <div className="line vertical one" />
            <div className="lane">
              <div className={`node ${activeFamilies.has('DISCOVERY') ? 'nodeActive' : ''}`}>
                <span>DISCOVERY</span>
                <small>{stateCounts.DISCOVERED ?? 0} queued</small>
              </div>
              <div className={`node ${activeFamilies.has('RESEARCH') ? 'nodeActive' : ''}`}>
                <span>RESEARCH</span>
                <small>{stateCounts.RESEARCHING ?? 0} active</small>
              </div>
              <div className={`node ${activeFamilies.has('CONTACT') ? 'nodeActive' : ''}`}>
                <span>CONTACT</span>
                <small>{stateCounts.CONTACT_DISCOVERY ?? 0} searching</small>
              </div>
            </div>
            <div className="line vertical two" />
            <div className={`node scoreNode ${activeFamilies.has('SCORING') ? 'nodeActive' : ''}`}>
              <span>SCORING</span>
              <small>{stateCounts.RESEARCH_COMPLETE ?? 0} ready</small>
            </div>
            <div className="line vertical three" />
            <div className="lane">
              <div className={`node ${activeFamilies.has('OUTREACH') ? 'nodeActive' : ''}`}>
                <span>OUTREACH</span>
                <small>{stateCounts.OUTREACH_READY ?? 0} ready</small>
              </div>
              <div className={`node ${activeFamilies.has('REPLIES') ? 'nodeActive' : ''}`}>
                <span>REPLIES</span>
                <small>{data.outreachStatus?.waitingReply ?? 0} waiting</small>
              </div>
              <div className={`node ${activeFamilies.has('PROTOTYPE') ? 'nodeActive' : ''}`}>
                <span>PROTOTYPE</span>
                <small>{data.prototypes.length} tracked</small>
              </div>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">WORKERS</p>
              <h2>Active jobs</h2>
            </div>
            <span className="count">{onlineRunners.length}</span>
          </div>

          <div className="agentList">
            {data.runners.length === 0 ? (
              <div className="agentRow">
                <span>Aucun runner enregistré</span>
                <span className="badge waiting">OFFLINE</span>
              </div>
            ) : (
              data.runners.slice(0, 4).map((runner) => {
                const online =
                  now - new Date(runner.last_seen_at).getTime() < 60_000;
                return (
                  <div className="agentRow" key={runner.runner_id}>
                    <span>
                      {runner.hostname || runner.runner_id}
                      {runner.current_job_id ? ` · ${runner.current_job_id}` : ''}
                    </span>
                    <span className={`badge ${online ? 'running' : 'waiting'}`}>
                      {online ? runner.status : 'OFFLINE'}
                    </span>
                  </div>
                );
              })
            )}

            <div className="agentRow">
              <span>Jobs actifs</span>
              <span className="badge running">{data.runningJobs.length}</span>
            </div>
            {data.runningJobs.length === 0 ? (
              <div className="agentRow">
                <span>Aucun job actif</span>
                <span className="badge waiting">WAITING</span>
              </div>
            ) : (
              data.runningJobs.map((job) => (
                <div className="agentRow" key={job.id}>
                  <span>
                    {job.kind}
                    {job.prospectId ? ` · ${job.prospectId}` : ''}
                  </span>
                  <span className="badge running">RUNNING</span>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="panel" id="prospection">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">PIPELINE BOARD</p>
            <h2>Prospects in motion</h2>
          </div>
          <span className="count">{data.prospects.length}</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Priorité analytique par engagement · les états métier restent inchangés.
        </p>

        <div className="pipelineList">
          {data.prospects.length === 0 ? (
            <div className="pipelineRow">
              <span className="muted">No prospect data yet.</span>
            </div>
          ) : (
            rankedProspects.slice(0, 12).map((prospect) => (
              <div className="pipelineRow" key={prospect.id}>
                <div>
                  <strong>{prospect.companyName}</strong>
                  <p>
                    {prospect.activity || 'Activity pending'}
                    {prospect.location ? ` · ${prospect.location}` : ''}
                  </p>
                </div>
                <div className="pipelineMeta">
                  <div className="engagementSummary">
                    {prospect.engagement ? (
                      <>
                        <strong>{prospect.engagement.score_total}/100</strong>
                        <span>
                          Activité {prospect.engagement.activity_score} · Intention {prospect.engagement.intent_score} · {prospect.engagement.trend}
                        </span>
                        <small>
                          Pourquoi : {prospect.engagement.top_contributors.slice(0, 2).map((contributor) => engagementSignalLabel(contributor.signal)).join(' · ') || 'aucun événement capturé'}
                        </small>
                        <small>Score dossier : {prospect.score ?? '—'}</small>
                      </>
                    ) : (
                      <span className="muted">Score indisponible</span>
                    )}
                  </div>
                  <div className="engagementSummary">
                    {prospect.prototypeCostGate ? (
                      <>
                        <span
                          className={`badge ${
                            prospect.prototypeCostGate.decision === 'GO'
                              ? 'running'
                              : 'waiting'
                          }`}
                        >
                          PROTO {prospect.prototypeCostGate.decision}
                        </span>
                        <details>
                          <summary>Voir le détail du Cost Gate</summary>
                          <small>
                            Autorisation : {prospect.prototypeCostGate.authorization}
                          </small>
                          <small>
                            Score politique : {prospect.prototypeCostGate.policyScore}/100
                          </small>
                          <small>
                            Charge : {prospect.prototypeCostGate.computeClass}
                          </small>
                          <small>
                            Coût externe :{' '}
                            {prospect.prototypeCostGate.estimatedExternalCost.kind === 'KNOWN'
                              ? `${prospect.prototypeCostGate.estimatedExternalCost.amountEur ?? 'UNKNOWN'} € · ${prospect.prototypeCostGate.estimatedExternalCost.source ?? 'source inconnue'}`
                              : `UNKNOWN · ${prospect.prototypeCostGate.estimatedExternalCost.reason ?? 'raison non disponible'}`}
                          </small>
                          <small>
                            Raisons :{' '}
                            {prospect.prototypeCostGate.reasonCodes.join(' · ') || 'aucune'}
                          </small>
                          {prospect.prototypeCostGate.reevaluateAt ? (
                            <small>
                              Réévaluation : {prospect.prototypeCostGate.reevaluateAt.slice(0, 10)}
                            </small>
                          ) : null}
                        </details>
                      </>
                    ) : (
                      <span className="muted">Cost Gate non évalué</span>
                    )}
                  </div>
                  <span className="badge waiting">{prospect.state}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="panel liveFeed">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">LIVE EVENT STREAM</p>
            <h2>What the swarm is doing</h2>
          </div>
          <span className="count">{data.recentEvents.length}</span>
        </div>

        <div className="eventList">
          {data.recentEvents.length === 0 ? (
            <div className="eventRow">
              <span className="eventDot" />
              <div>
                <strong>Waiting for runtime events</strong>
                <p>No swarm activity recorded yet.</p>
              </div>
            </div>
          ) : (
            data.recentEvents.slice(0, 10).map((event) => (
              <div className="eventRow" key={event.id}>
                <span className="eventDot" />
                <div>
                  <strong>{shortEvent(event.type)}</strong>
                  <p>
                    {event.actor}
                    {event.prospectId ? ` · ${event.prospectId}` : ''}
                    {' · '}
                    {new Date(event.createdAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      </details>

      <section className="panel actions" id="commercial">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">ACTION REQUIRED</p>
            <h2>Seulement quand ça mord</h2>
          </div>
          <span className="count">
            {overview ? overview.actionsRequired : data.escalations.length}
          </span>
        </div>

        {data.escalations.length === 0 ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Aucune intervention humaine requise.
          </p>
        ) : (
          <div className="actionGrid">
            {data.escalations.map((action) => (
              <article className="leadCard" key={action.id}>
                <span className="leadType">
                  {action.priority ? `${action.priority} · ` : ''}{action.category}
                </span>
                <h3>{action.prospect_id}</h3>
                <p>{action.summary}</p>
                <button type="button">Ouvrir le lead</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel" id="schedule" style={{ marginTop: 12 }}>
        <div className="panelTitle">
          <div>
            <p className="eyebrow">SCHEDULE · EUROPE/PARIS</p>
            <h2>Rendez-vous confirmés</h2>
          </div>
          <span className="count">{data.meetings.filter((meeting) => meeting.status === 'CONFIRMED').length}</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Les heures sont calculées depuis UTC et affichées dans les fuseaux IANA du prospect et de Stéphane.
        </p>
        <div className="agentList">
          {data.meetings.filter((meeting) => meeting.status === 'CONFIRMED').length === 0 ? (
            <div className="agentRow">
              <span>Aucun rendez-vous confirmé cette semaine</span>
              <span className="badge waiting">EMPTY</span>
            </div>
          ) : (
            data.meetings
              .filter((meeting) => meeting.status === 'CONFIRMED')
              .map((meeting) => (
                <div className="agentRow" key={meeting.meetingId}>
                  <span>
                    <strong>{meeting.companyName || meeting.prospectId}</strong>
                    <small className="muted" style={{ display: 'block' }}>
                      Paris : {formatMeetingTime(meeting.startAtUtc, 'Europe/Paris')} · Prospect : {formatMeetingTime(meeting.startAtUtc, meeting.prospectTimezone)} · {meeting.phone}
                    </small>
                  </span>
                  <span className="badge running">
                    {meeting.communicationMode === 'phone' ? 'TÉLÉPHONE' : 'EMAIL'} · {meeting.briefingAvailable ? 'BRIEFING PRÊT' : 'BRIEFING À VÉRIFIER'}
                  </span>
                </div>
              ))
          )}
        </div>
        {data.meetings.some((meeting) => meeting.status !== 'CONFIRMED') ? (
          <p className="muted" style={{ marginBottom: 0 }}>
            Historique : {data.meetings.filter((meeting) => meeting.status !== 'CONFIRMED').length} rendez-vous annulé(s) ou déplacé(s), conservé(s) pour traçabilité.
          </p>
        ) : null}
      </section>

      <CallCopilot
        prospects={data.prospects.map((prospect) => ({
          id: prospect.id,
          companyName: prospect.companyName,
          state: prospect.state,
        }))}
        meetings={data.meetings.map((meeting) => ({
          meetingId: meeting.meetingId,
          prospectId: meeting.prospectId,
          status: meeting.status,
          startAtUtc: meeting.startAtUtc,
        }))}
      />

      <section className="panel" id="prototypes" style={{ marginTop: 12 }}>
        <div className="panelTitle">
          <div>
            <p className="eyebrow">PROTOTYPES</p>
            <h2>Build & QA pipeline</h2>
          </div>
          <span className="count">{data.prototypes.length}</span>
        </div>

        <div className="agentList">
          {data.prototypes.length === 0 ? (
            <div className="agentRow">
              <span>Aucun prototype actif</span>
              <span className="badge waiting">WAITING</span>
            </div>
          ) : (
            data.prototypes.slice(0, 6).map((prototype) => {
              const active =
                prototype.status === 'BUILT' ||
                prototype.status === 'READY' ||
                prototype.status === 'DEPLOYING';

              return (
                <div className="agentRow" key={prototype.id}>
                  <span>
                    {prototype.company_name}
                    {prototype.deployment_url ? ' · deployed' : ''}
                  </span>
                  <span className={`badge ${active ? 'running' : 'waiting'}`}>
                    {prototype.qa_status
                      ? `${prototype.status} · QA ${prototype.qa_status}`
                      : prototype.status}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="panel" id="commercial-entry" style={{ marginTop: 12 }}>
        <div className="panelTitle">
          <div>
            <p className="eyebrow">COMMERCIAL ENTRY</p>
            <h2>Deux liens, état vérifiable</h2>
          </div>
          <span className="count">{personalizedLinksReady}</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          {demosReadyForLinks} démo(s) vérifiée(s) · {personalizedLinksReady} lien(s)
          personnalisé(s) prêt(s)
        </p>
        <div className="agentList">
          {data.prototypes.length === 0 ? (
            <div className="agentRow">
              <span>Aucun prototype à relier</span>
              <span className="badge waiting">WAITING</span>
            </div>
          ) : (
            data.prototypes.slice(0, 6).map((prototype) => {
              const linkState = prototype.personalized_entry_enabled
                ? 'PERSONALIZED LINK READY'
                : prototype.prototype_url
                  ? 'DEMO READY · PUBLIC BASE WAITING'
                  : 'WAITING FOR VERIFIED DEMO';

              return (
                <div className="agentRow" key={'commercial-' + prototype.id}>
                  <span>{prototype.company_name}</span>
                  <span
                    className={
                      prototype.personalized_entry_enabled
                        ? 'badge running'
                        : 'badge waiting'
                    }
                  >
                    {linkState}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="panel" id="sales-rooms" style={{ marginTop: 12 }}>
        <div className="panelTitle">
          <div>
            <p className="eyebrow">PROSPECT SALES ROOMS</p>
            <h2>Accès et rappels</h2>
          </div>
          <span className="count">{data.salesRooms.length}</span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Les liens suivent le parcours prototype â†’ Sales Room. Une revue ancienne reste un rappel humain, jamais une désactivation automatique.
        </p>
        <div className="agentList">
          {data.salesRooms.length === 0 ? (
            <div className="agentRow">
              <span>Aucune Sales Room issue d’un prototype validé</span>
              <span className="badge waiting">WAITING</span>
            </div>
          ) : (
            data.salesRooms.slice(0, 12).map((room) => (
              <div className="agentRow" key={room.prospectId}>
                <span>
                  {room.companyName} · /p/{room.slug}
                  <small className="muted" style={{ display: 'block' }}>
                    {room.shareClicks} partage(s) · activité {new Date(room.lastActivityAt).toLocaleDateString('fr-FR')}
                  </small>
                </span>
                <span className={`badge ${room.status === 'ACTIVE' && !room.reviewDue ? 'running' : 'waiting'}`}>
                  {room.status}{room.reviewDue ? ' · REVIEW DUE' : ''}
                </span>
              </div>
            ))
          )}
        </div>
        {salesRoomAlerts.length > 0 ? (
          <div className="agentList" style={{ marginTop: 12 }}>
            <p className="eyebrow">SIGNAUX SALES ROOM</p>
            {salesRoomAlerts.map((event) => (
              <div className="agentRow" key={event.id}>
                <span>
                  {typeof event.payload.slug === 'string' ? `/p/${event.payload.slug}` : 'Sales Room'}
                  <small className="muted" style={{ display: 'block' }}>
                    {event.createdAt}{event.prospectId ? ` · ${event.prospectId}` : ''}
                  </small>
                </span>
                <span className={`badge ${event.type === 'sales_room.resolution_failed' ? 'waiting' : 'running'}`}>
                  {salesRoomEventLabel(event.type)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel" id="outreach" style={{ marginTop: 12 }}>
        <div className="panelTitle">
          <div>
            <p className="eyebrow">OUTREACH</p>
            <h2>Autonomous follow-ups</h2>
          </div>
          <span className="muted">
            {data.outreachStatus
              ? `${data.outreachStatus.daily.sent}/${data.outreachStatus.daily.limit} sent today · ${data.outreachStatus.daily.available} slots left`
              : 'Status unavailable'}
          </span>
        </div>
        <div className="agentList">
          <div className="agentRow">
            <span>Waiting for reply</span>
            <span className="badge waiting">
              {data.outreachStatus?.waitingReply ?? 0}
            </span>
          </div>
          <div className="agentRow">
            <span>Follow-ups due</span>
            <span className="badge waiting">
              {data.outreachStatus?.followupDue ?? 0}
            </span>
          </div>
          <div className="agentRow">
            <span>Follow-up policy</span>
            <span className="muted">
              {data.outreachStatus
                ? `D+${data.outreachStatus.followup1Days} / D+${data.outreachStatus.followup2Days} · max ${data.outreachStatus.maxFollowups}`
                : '—'}
            </span>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panelTitle" style={{ marginBottom: 0 }}>
          <div>
            <p className="eyebrow">FREE PROVIDERS</p>
            <h2>Open directory + SIRENE + Hunter</h2>
          </div>
          <span className="muted">
            {data.providerUsage
              ? `Directory FREE / NO KEY · SIRENE ${data.providerUsage.sirene.configured ? 'READY' : 'OPTIONAL'} · Hunter ${data.providerUsage.hunter.used}/${data.providerUsage.hunter.budget} · ${data.providerUsage.hunter.remainingInternalBudget} credits reserved`
              : 'Usage unavailable'}
          </span>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panelTitle" style={{ marginBottom: 0 }}>
          <div>
            <p className="eyebrow">SAFETY</p>
            <h2>Outbound switches</h2>
          </div>
          <span className="muted">
            Email transport:{' '}
            {data.health?.testEmailMode
              ? data.health.testRecipientConfigured
                ? 'TEST SINK ONLY'
                : 'TEST SINK MISCONFIGURED'
              : data.health?.sendingEnabled
                ? data.health.emailProvider === 'dry-run'
                  ? 'DRY RUN ONLY'
                  : `ENABLED · ${data.health.emailProvider}`
                : 'DISABLED'}{' '}
            · Prototype deploy:{' '}
            {data.health?.prototypeDeployEnabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
      </section>
    </main>
  );
}
