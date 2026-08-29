const stats = [
  ['Prospects découverts', '91'],
  ['Qualifiés', '27'],
  ['Emails envoyés', '18'],
  ['Réponses', '5'],
  ['Leads positifs', '2'],
  ['Prototypes', '1'],
];

const agents = [
  ['Discovery Swarm', 'RUNNING'],
  ['Research Swarm', 'RUNNING'],
  ['Scoring Agent', 'IDLE'],
  ['Contact Discovery', 'RUNNING'],
  ['Outreach Agent', 'RUNNING'],
  ['Fact Check', 'IDLE'],
  ['Response Classifier', 'WAITING'],
  ['Prototype QA', 'WAITING'],
];

const actions = [
  {
    company: 'Martinique Clim',
    type: 'PRICING_REQUESTED',
    message: 'Pouvez-vous m’indiquer vos tarifs ?',
  },
  {
    company: 'ABC Bâtiment',
    type: 'MEETING_REQUESTED',
    message: 'Disponible mardi pour en discuter ?',
  },
];

export default function Page() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">MAGIC SCRIPT V2</p>
          <h1>Control Center</h1>
        </div>
        <div className="autopilot">
          <span className="pulse" />
          AUTOPILOT RUNNING
        </div>
      </header>

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
            <span className="muted">Live event layer à connecter</span>
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
              <p className="eyebrow">AGENTS</p>
              <h2>Workers</h2>
            </div>
          </div>
          <div className="agentList">
            {agents.map(([name, status]) => (
              <div className="agentRow" key={name}>
                <span>{name}</span>
                <span className={`badge ${status.toLowerCase()}`}>{status}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel actions">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">ACTION REQUIRED</p>
            <h2>Seulement quand ça mord</h2>
          </div>
          <span className="count">{actions.length}</span>
        </div>

        <div className="actionGrid">
          {actions.map((action) => (
            <article className="leadCard" key={action.company}>
              <span className="leadType">{action.type}</span>
              <h3>{action.company}</h3>
              <p>“{action.message}”</p>
              <button type="button">Ouvrir le lead</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
