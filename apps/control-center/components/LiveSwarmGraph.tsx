export interface LiveSwarmAgent {
  id: string;
  label: string;
  group: string;
  active: boolean;
  detail: string;
}

interface LiveSwarmGraphProps {
  agents: LiveSwarmAgent[];
  connected: boolean;
  runningJobCount: number;
}

const positions: Record<string, [number, number]> = {
  'discovery-scout': [130, 105],
  'research-analyst': [300, 72],
  'contact-hunter': [480, 62],
  'outreach-writer': [690, 88],
  'fact-checker': [850, 155],
  'prototype-strategist': [835, 330],
  'prototype-builder': [670, 405],
  'mobile-ux': [480, 432],
  'conversion-checker': [290, 398],
  'technical-checker': [135, 330],
  'reply-classifier': [82, 230],
};

const secondaryEdges: Array<[string, string]> = [
  ['discovery-scout', 'research-analyst'],
  ['research-analyst', 'contact-hunter'],
  ['contact-hunter', 'outreach-writer'],
  ['outreach-writer', 'fact-checker'],
  ['fact-checker', 'prototype-strategist'],
  ['prototype-strategist', 'prototype-builder'],
  ['prototype-builder', 'technical-checker'],
  ['prototype-builder', 'mobile-ux'],
  ['prototype-builder', 'conversion-checker'],
  ['mobile-ux', 'conversion-checker'],
  ['conversion-checker', 'technical-checker'],
  ['reply-classifier', 'outreach-writer'],
];

export default function LiveSwarmGraph({
  agents,
  connected,
  runningJobCount,
}: LiveSwarmGraphProps) {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const primaryEdges = agents.map((agent) => ['orchestrator', agent.id] as const);
  const edges = [...primaryEdges, ...secondaryEdges];
  const orchestratorActive = runningJobCount > 0;

  const point = (id: string): [number, number] =>
    id === 'orchestrator' ? [480, 245] : positions[id] ?? [480, 245];

  return (
    <div className="liveSwarmSvgWrap">
      <div className="liveSwarmCornerStatus">
        <span className={`swarmLiveDot ${orchestratorActive ? 'swarmLiveDotActive' : ''}`} />
        {connected
          ? orchestratorActive
            ? 'LIVE TRAFFIC'
            : 'NETWORK IDLE'
          : 'OFFLINE'}
      </div>

      <svg
        className="liveSwarmSvg"
        viewBox="0 0 960 500"
        role="img"
        aria-label="Live Magic Script swarm graph"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="swarm-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="core-halo">
            <stop offset="0%" stopColor="rgba(113,255,183,0.22)" />
            <stop offset="100%" stopColor="rgba(113,255,183,0)" />
          </radialGradient>
        </defs>

        <circle className="swarmCoreHalo" cx="480" cy="245" r="105" />

        <g className="swarmEdges">
          {edges.map(([fromId, toId], index) => {
            if (fromId !== 'orchestrator' && !byId.has(fromId)) return null;
            if (!byId.has(toId)) return null;
            const [x1, y1] = point(fromId);
            const [x2, y2] = point(toId);
            const fromActive =
              fromId === 'orchestrator' ? orchestratorActive : Boolean(byId.get(fromId)?.active);
            const toActive = Boolean(byId.get(toId)?.active);
            const hot = fromActive || toActive;

            return (
              <g key={`${fromId}-${toId}`}>
                <line
                  className={`swarmEdge ${hot ? 'swarmEdgeActive' : ''}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                />
                <circle
                  className={`swarmParticle ${hot ? 'swarmParticleActive' : ''}`}
                  r={hot ? 3.2 : 2}
                >
                  <animate
                    attributeName="cx"
                    values={`${x1};${x2}`}
                    dur={hot ? `${1.2 + (index % 4) * 0.18}s` : `${4 + (index % 5) * 0.45}s`}
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="cy"
                    values={`${y1};${y2}`}
                    dur={hot ? `${1.2 + (index % 4) * 0.18}s` : `${4 + (index % 5) * 0.45}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            );
          })}
        </g>

        <g className={`swarmNode swarmCoreNode ${orchestratorActive ? 'swarmNodeActive' : ''}`}>
          <circle cx="480" cy="245" r="20" />
          <circle className="swarmNodeRing" cx="480" cy="245" r="31" />
          <text className="swarmNodeLabel swarmCoreLabel" x="480" y="282">
            ORCHESTRATOR
          </text>
          <text className="swarmNodeState" x="480" y="299">
            {orchestratorActive
              ? `${runningJobCount} JOB${runningJobCount > 1 ? 'S' : ''} ACTIVE`
              : 'READY'}
          </text>
        </g>

        {agents.map((agent, index) => {
          const [x, y] = point(agent.id);
          return (
            <g
              className={`swarmNode swarmAgentNode ${agent.active ? 'swarmNodeActive' : ''}`}
              key={agent.id}
              style={{ animationDelay: `${-(index % 6) * 0.45}s` }}
            >
              <title>{`${agent.label} — ${agent.group} — ${agent.detail}`}</title>
              <circle cx={x} cy={y} r={agent.active ? 13 : 10} />
              <circle className="swarmNodeRing" cx={x} cy={y} r={agent.active ? 22 : 17} />
              <text className="swarmNodeLabel" x={x} y={y + 27}>
                {agent.label}
              </text>
              <text className="swarmNodeState" x={x} y={y + 42}>
                {agent.active ? 'WORKING' : 'READY'}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="liveSwarmLegend">
        <span>
          <i className="legendDot legendReady" />
          READY
        </span>
        <span>
          <i className="legendDot legendWorking" />
          WORKING
        </span>
        <span>{agents.filter((agent) => agent.active).length} AGENT(S) ACTIVE</span>
      </div>
    </div>
  );
}
