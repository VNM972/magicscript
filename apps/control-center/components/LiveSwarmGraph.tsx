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

interface SwarmPosition {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPosition extends SwarmPosition {
  px: number;
  py: number;
  scale: number;
  opacity: number;
}

const positions: Record<string, SwarmPosition> = {
  'discovery-scout': { x: 132, y: 112, z: 0.52 },
  'research-analyst': { x: 302, y: 70, z: 0.06 },
  'contact-hunter': { x: 482, y: 54, z: -0.24 },
  'outreach-writer': { x: 690, y: 91, z: 0.12 },
  'fact-checker': { x: 850, y: 160, z: 0.48 },
  'prototype-strategist': { x: 832, y: 332, z: 0.18 },
  'prototype-builder': { x: 672, y: 406, z: 0.58 },
  'mobile-ux': { x: 482, y: 438, z: -0.18 },
  'conversion-checker': { x: 292, y: 398, z: 0.34 },
  'technical-checker': { x: 132, y: 332, z: 0.44 },
  'reply-classifier': { x: 82, y: 232, z: -0.08 },
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

function project(position: SwarmPosition): ProjectedPosition {
  const depth = (position.z + 0.3) / 1.0;
  const scale = 0.82 + Math.max(0, Math.min(1, depth)) * 0.34;
  const perspectiveX = 480 + (position.x - 480) * scale;
  const perspectiveY = 245 + (position.y - 245) * (0.86 + scale * 0.12) - position.z * 18;

  return {
    ...position,
    px: perspectiveX,
    py: perspectiveY,
    scale,
    opacity: 0.58 + Math.max(0, Math.min(1, depth)) * 0.42,
  };
}

function curvedPath(
  from: ProjectedPosition,
  to: ProjectedPosition,
  index: number,
): string {
  const mx = (from.px + to.px) / 2;
  const my = (from.py + to.py) / 2;
  const dx = to.px - from.px;
  const dy = to.py - from.py;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const bend = ((index % 5) - 2) * 6;
  const cx = mx + (-dy / distance) * bend;
  const cy = my + (dx / distance) * bend;
  return `M ${from.px} ${from.py} Q ${cx} ${cy} ${to.px} ${to.py}`;
}

export default function LiveSwarmGraph({
  agents,
  connected,
  runningJobCount,
}: LiveSwarmGraphProps) {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const primaryEdges = agents.map((agent) => ['orchestrator', agent.id] as const);
  const edges = [...primaryEdges, ...secondaryEdges];
  const orchestratorActive = runningJobCount > 0;

  const orchestratorPosition = project({ x: 480, y: 245, z: 0.86 });

  const projected = new Map<string, ProjectedPosition>(
    agents.map((agent) => [
      agent.id,
      project(positions[agent.id] ?? { x: 480, y: 245, z: 0 }),
    ]),
  );

  const point = (id: string): ProjectedPosition =>
    id === 'orchestrator'
      ? orchestratorPosition
      : projected.get(id) ?? project({ x: 480, y: 245, z: 0 });

  return (
    <div className="liveSwarm3dWrap">
      <div className="liveSwarmCornerStatus">
        <span className={`swarmLiveDot ${orchestratorActive ? 'swarmLiveDotActive' : ''}`} />
        {connected
          ? orchestratorActive
            ? 'LIVE TRAFFIC'
            : 'NETWORK IDLE'
          : 'OFFLINE'}
      </div>

      <svg
        className="liveSwarm3dSvg"
        viewBox="0 0 960 500"
        role="img"
        aria-label="Live Magic Script 3D swarm graph"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="swarm3d-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="swarm3d-soft-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <radialGradient id="swarm3d-core" cx="34%" cy="28%">
            <stop offset="0%" stopColor="#effff7" />
            <stop offset="19%" stopColor="#b9ffe0" />
            <stop offset="52%" stopColor="#71ffb7" />
            <stop offset="100%" stopColor="#16885d" />
          </radialGradient>
          <radialGradient id="swarm3d-node" cx="32%" cy="26%">
            <stop offset="0%" stopColor="#93d9b8" />
            <stop offset="30%" stopColor="#39775b" />
            <stop offset="100%" stopColor="#0c2b20" />
          </radialGradient>
          <radialGradient id="swarm3d-node-active" cx="30%" cy="24%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="18%" stopColor="#c9ffe8" />
            <stop offset="54%" stopColor="#71ffb7" />
            <stop offset="100%" stopColor="#11835a" />
          </radialGradient>
          <linearGradient id="swarm3d-flow" x1="0%" x2="100%">
            <stop offset="0%" stopColor="rgba(113,255,183,0.08)" />
            <stop offset="50%" stopColor="rgba(174,255,220,0.9)" />
            <stop offset="100%" stopColor="rgba(113,255,183,0.08)" />
          </linearGradient>
        </defs>

        <g className="swarm3dDepthGrid">
          <ellipse cx="480" cy="265" rx="355" ry="116" />
          <ellipse cx="480" cy="265" rx="270" ry="88" />
          <ellipse cx="480" cy="265" rx="185" ry="61" />
          <path d="M 480 34 Q 370 245 480 468" />
          <path d="M 480 34 Q 590 245 480 468" />
        </g>

        <ellipse
          className="swarm3dCoreShadow"
          cx={orchestratorPosition.px}
          cy={orchestratorPosition.py + 28}
          rx="44"
          ry="13"
        />
        <circle
          className="swarm3dCoreAura"
          cx={orchestratorPosition.px}
          cy={orchestratorPosition.py}
          r={orchestratorActive ? 92 : 76}
        />

        <g className="swarm3dEdges">
          {edges.map(([fromId, toId], index) => {
            if (fromId !== 'orchestrator' && !byId.has(fromId)) return null;
            if (!byId.has(toId)) return null;

            const from = point(fromId);
            const to = point(toId);
            const fromActive =
              fromId === 'orchestrator' ? orchestratorActive : Boolean(byId.get(fromId)?.active);
            const toActive = Boolean(byId.get(toId)?.active);

            const hot =
              fromId === 'orchestrator'
                ? toActive
                : fromActive || toActive;

            const d = curvedPath(from, to, index);
            const duration = hot
              ? 1.05 + (index % 4) * 0.16
              : 4.2 + (index % 5) * 0.42;

            return (
              <g key={`${fromId}-${toId}`}>
                <path
                  className={`swarm3dEdgeGlow ${hot ? 'swarm3dEdgeGlowActive' : ''}`}
                  d={d}
                />
                <path
                  className={`swarm3dEdge ${hot ? 'swarm3dEdgeActive' : ''}`}
                  d={d}
                />
                <circle
                  className={`swarm3dParticle ${hot ? 'swarm3dParticleActive' : ''}`}
                  r={hot ? 3.2 : 1.5}
                >
                  <animateMotion
                    dur={`${duration}s`}
                    path={d}
                    repeatCount="indefinite"
                  />
                </circle>
                {hot ? (
                  <circle className="swarm3dParticleTrail" r="1.6">
                    <animateMotion
                      begin="0.34s"
                      dur={`${duration}s`}
                      path={d}
                      repeatCount="indefinite"
                    />
                  </circle>
                ) : null}
              </g>
            );
          })}
        </g>

        <g
          className={`swarm3dNode swarm3dCoreNode ${orchestratorActive ? 'swarm3dNodeActive' : ''}`}
        >
          <circle
            className="swarm3dCoreOuter"
            cx={orchestratorPosition.px}
            cy={orchestratorPosition.py}
            r="33"
          />
          <circle
            className="swarm3dCoreSphere"
            cx={orchestratorPosition.px}
            cy={orchestratorPosition.py}
            r="22"
          />
          <circle
            className="swarm3dSpecular"
            cx={orchestratorPosition.px - 7}
            cy={orchestratorPosition.py - 7}
            r="4.6"
          />
          <ellipse
            className="swarm3dCoreOrbit"
            cx={orchestratorPosition.px}
            cy={orchestratorPosition.py}
            rx="42"
            ry="15"
          />
          <text
            className="swarm3dNodeLabel swarm3dCoreLabel"
            x={orchestratorPosition.px}
            y={orchestratorPosition.py + 48}
          >
            ORCHESTRATOR
          </text>
          <text
            className="swarm3dNodeState"
            x={orchestratorPosition.px}
            y={orchestratorPosition.py + 64}
          >
            {orchestratorActive
              ? `${runningJobCount} JOB${runningJobCount > 1 ? 'S' : ''} ACTIVE`
              : 'READY'}
          </text>
        </g>

        {agents
          .map((agent, index) => ({
            agent,
            index,
            position: point(agent.id),
          }))
          .sort((a, b) => a.position.z - b.position.z)
          .map(({ agent, index, position }) => {
            const radius = (agent.active ? 12.5 : 9.5) * position.scale;
            const shadowRx = radius * 1.2;
            const shadowRy = radius * 0.32;

            return (
              <g
                className={`swarm3dNode swarm3dAgentNode ${agent.active ? 'swarm3dNodeActive' : ''}`}
                key={agent.id}
                opacity={position.opacity}
                style={{ animationDelay: `${-(index % 7) * 0.47}s` }}
              >
                <title>{`${agent.label} — ${agent.group} — ${agent.detail}`}</title>
                <ellipse
                  className="swarm3dNodeShadow"
                  cx={position.px}
                  cy={position.py + radius + 9}
                  rx={shadowRx}
                  ry={shadowRy}
                />
                <circle
                  className={`swarm3dNodeHalo ${agent.active ? 'swarm3dNodeHaloActive' : ''}`}
                  cx={position.px}
                  cy={position.py}
                  r={radius * (agent.active ? 2.4 : 1.9)}
                />
                <circle
                  className={`swarm3dNodeSphere ${agent.active ? 'swarm3dNodeSphereActive' : ''}`}
                  cx={position.px}
                  cy={position.py}
                  r={radius}
                />
                <circle
                  className="swarm3dSpecular swarm3dAgentSpecular"
                  cx={position.px - radius * 0.28}
                  cy={position.py - radius * 0.32}
                  r={Math.max(1.7, radius * 0.18)}
                />
                <ellipse
                  className="swarm3dNodeOrbit"
                  cx={position.px}
                  cy={position.py}
                  rx={radius * 1.85}
                  ry={radius * 0.7}
                />
                <text
                  className="swarm3dNodeLabel"
                  x={position.px}
                  y={position.py + radius + 18}
                >
                  {agent.label}
                </text>
                <text
                  className="swarm3dNodeState"
                  x={position.px}
                  y={position.py + radius + 32}
                >
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
