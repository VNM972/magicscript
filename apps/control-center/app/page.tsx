import { getControlCenterData } from '../lib/api';

export const dynamic = 'force-dynamic';

function valueOrDash(value: number | undefined): string {
  return typeof value === 'number' ? String(value) : '—';
}

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
    ['Leads positifs', valueOrDash(overview?.hotLeads)],
    ['Prototypes', valueOrDash(overview?.prototypes)],
  ];

  const statusLabel = !data.connected
    ? 'BACKEND OFFLINE'
    : data.health?.autopilotEnabled
      ? 'AUTOPILOT RUNNING'
      : 'AUTOPILOT SAFE MODE';

  return (
    <main className="shell">
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

      {data.error ? (
        <section className="panel" style={{ marginBottom: 12 }}>
          <p className="eyebrow">SYSTEM STATUS</p>
          <p className="muted" style={{ marginBottom: 0 }}>
            {data.error}
          </p>
        </section>
      ) : null}

      <section className="stats">
        {stats.map(([label, value]) => (
          <article className="stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

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
            <div className="node coreNode">ORCHESTRATOR</div>
            <div className="line vertical one" />
            <div className="lane">
              <div className="node">DISCOVERY</div>
              <div className="node">RESEARCH</div>
              <div className="node">CONTACT</div>
            </div>
            <div className="line vertical two" />
            <div className="node scoreNode">SCORING</div>
            <div className="line vertical three" />
            <div className="lane">
              <div className="node">OUTREACH</div>
              <div className="node">REPLIES</div>
              <div className="node">PROTOTYPE</div>
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

      <section className="panel actions">
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
                <span className="leadType">{action.category}</span>
                <h3>{action.prospect_id}</h3>
                <p>{action.summary}</p>
                <button type="button">Ouvrir le lead</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <div className="panelTitle" style={{ marginBottom: 0 }}>
          <div>
            <p className="eyebrow">FREE PROVIDERS</p>
            <h2>Hunter fallback</h2>
          </div>
          <span className="muted">
            {data.providerUsage
              ? `${data.providerUsage.hunter.used}/${data.providerUsage.hunter.budget} credits · ${data.providerUsage.hunter.remainingInternalBudget} reserved budget remaining · ${data.providerUsage.hunter.configured ? 'API READY' : 'API KEY MISSING'}`
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
            Email sending: {data.health?.sendingEnabled ? 'ENABLED' : 'DISABLED'} · Prototype deploy:{' '}
            {data.health?.prototypeDeployEnabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
      </section>
    </main>
  );
}
