'use client';

import { useState } from 'react';

export interface LiveSwarmAgent {
  id: string;
  label: string;
  group: string;
  active: boolean;
  detail: string;
}

export interface LiveSwarmProspect {
  id: string;
  companyName: string;
  state: string;
  score?: number;
  updatedAt: string;
}

export interface LiveSwarmEvent {
  id: string;
  prospectId?: string;
  actor: string;
  type: string;
  createdAt: string;
}

interface LiveSwarmGraphProps {
  agents: LiveSwarmAgent[];
  prospects: LiveSwarmProspect[];
  recentEvents: LiveSwarmEvent[];
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


const prospectStateAgent: Record<string, string> = {
  DISCOVERED: 'discovery-scout',
  RESEARCHING: 'research-analyst',
  RESEARCH_COMPLETE: 'research-analyst',
  QUALIFIED: 'contact-hunter',
  CONTACT_DISCOVERY: 'contact-hunter',
  CONTACT_FOUND: 'contact-hunter',
  CONTACT_INVALID: 'contact-hunter',
  BOUNCED: 'contact-hunter',
  OUTREACH_READY: 'outreach-writer',
  OUTREACH_DRAFTED: 'outreach-writer',
  OUTREACH_VERIFIED: 'fact-checker',
  EMAIL_SENT: 'reply-classifier',
  WAITING_REPLY: 'reply-classifier',
  FOLLOW_UP_DUE: 'outreach-writer',
  FOLLOW_UP_SENT: 'reply-classifier',
  REPLY_RECEIVED: 'reply-classifier',
  POSITIVE_REPLY: 'reply-classifier',
  NEGATIVE_REPLY: 'reply-classifier',
  INFORMATION_REQUEST_RECEIVED: 'reply-classifier',
  INFORMATION_RESPONSE_DRAFTED: 'outreach-writer',
  INFORMATION_RESPONSE_VERIFIED: 'fact-checker',
  PROTOTYPE_REQUIRED: 'prototype-strategist',
  PROTOTYPE_STRATEGY_GENERATED: 'prototype-strategist',
  PROTOTYPE_BUILDING: 'prototype-builder',
  PROTOTYPE_QA: 'technical-checker',
  PROTOTYPE_READY: 'prototype-builder',
  PROTOTYPE_DEPLOYING: 'prototype-builder',
  PROTOTYPE_DEPLOYED: 'prototype-builder',
  DEMO_REPLY_READY: 'outreach-writer',
  DEMO_REPLY_SENT: 'reply-classifier',
  HOT_LEAD: 'orchestrator',
  MEETING_REQUESTED: 'orchestrator',
  PRICING_REQUESTED: 'orchestrator',
  CUSTOM_REQUEST: 'orchestrator',
  INTERESTED: 'orchestrator',
  MEETING_BOOKED: 'orchestrator',
  QUOTE_PENDING: 'orchestrator',
  COMMITTED: 'orchestrator',
  WON: 'orchestrator',
  DORMANT: 'orchestrator',
  HUMAN_ACTION_REQUIRED: 'orchestrator',
  DISQUALIFIED: 'orchestrator',
  DO_NOT_CONTACT: 'orchestrator',
  CLOSED_WON: 'orchestrator',
  CLOSED_LOST: 'orchestrator',
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

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

function eventAgentId(actor: string): string {
  const normalized = actor.toLowerCase().replaceAll('_', '-');
  if (normalized.includes('discovery')) return 'discovery-scout';
  if (normalized.includes('research')) return 'research-analyst';
  if (normalized.includes('contact')) return 'contact-hunter';
  if (normalized.includes('outreach') || normalized.includes('send')) return 'outreach-writer';
  if (normalized.includes('reply') || normalized.includes('classif')) return 'reply-classifier';
  if (normalized.includes('prototype') || normalized.includes('deploy')) return 'prototype-builder';
  if (normalized.includes('qa') || normalized.includes('fact')) return 'fact-checker';
  if (normalized.includes('mobile') || normalized.includes('ux')) return 'mobile-ux';
  if (normalized.includes('conversion')) return 'conversion-checker';
  if (normalized.includes('technical')) return 'technical-checker';
  return 'orchestrator';
}

function eventAgeMs(createdAt: string, now: number): number {
  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, now - timestamp) : Number.POSITIVE_INFINITY;
}

export default function LiveSwarmGraph({
  agents,
  prospects,
  recentEvents,
  connected,
  runningJobCount,
}: LiveSwarmGraphProps) {
  const [replayEnabled, setReplayEnabled] = useState(false);
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const primaryEdges = agents.map((agent) => ['orchestrator', agent.id] as const);
  const edges = [...primaryEdges, ...secondaryEdges];
  const now = Date.now();
  const liveEvents = recentEvents
    .filter((event) => eventAgeMs(event.createdAt, now) <= 15 * 60 * 1000)
    .slice(0, 12);
  const replayEvents = recentEvents
    .filter((event) => eventAgeMs(event.createdAt, now) <= 30 * 60 * 1000)
    .slice(0, 12);
  const activityEvents = replayEnabled ? replayEvents : liveEvents;
  const eventAgentIds = new Set(activityEvents.map((event) => eventAgentId(event.actor)));
  const eventLoad = activityEvents.reduce<Record<string, number>>((counts, event) => {
    const agentId = eventAgentId(event.actor);
    counts[agentId] = (counts[agentId] ?? 0) + 1;
    return counts;
  }, {});
  const orchestratorActive = runningJobCount > 0 || eventAgentIds.has('orchestrator');

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

  const visibleProspects = [...prospects]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 48);

  const hiddenProspectCount = Math.max(0, prospects.length - visibleProspects.length);

  const prospectSatellites = visibleProspects.map((prospect, index) => {
    const hostId = prospectStateAgent[prospect.state] ?? 'orchestrator';
    const host = point(hostId);
    const hash = stableHash(prospect.id);
    const ring = 24 + (hash % 4) * 9 + Math.floor(index / 16) * 3;
    const angle = ((hash % 360) * Math.PI) / 180;
    const depth = ((hash % 101) / 100 - 0.5) * 0.5;
    const localScale = 0.78 + ((hash >> 8) % 23) / 100;
    const x = host.px + Math.cos(angle) * ring * localScale;
    const y = host.py + Math.sin(angle) * ring * 0.56;
    const terminal = [
      'DISQUALIFIED',
      'DO_NOT_CONTACT',
      'CLOSED_WON',
      'CLOSED_LOST',
      'WON',
      'DORMANT',
    ].includes(prospect.state);
    const priority = typeof prospect.score === 'number' && prospect.score >= 85;
    const engaged = [
      'POSITIVE_REPLY',
      'INTERESTED',
      'MEETING_BOOKED',
      'QUOTE_PENDING',
      'COMMITTED',
      'HOT_LEAD',
      'MEETING_REQUESTED',
      'PRICING_REQUESTED',
      'CUSTOM_REQUEST',
      'PROTOTYPE_REQUIRED',
      'PROTOTYPE_STRATEGY_GENERATED',
      'PROTOTYPE_BUILDING',
      'PROTOTYPE_QA',
      'PROTOTYPE_READY',
      'PROTOTYPE_DEPLOYING',
      'PROTOTYPE_DEPLOYED',
    ].includes(prospect.state);

    return {
      prospect,
      hostId,
      host,
      x,
      y,
      depth,
      radius: terminal
        ? 2.4
        : priority
          ? 4.2 + ((hash >> 5) % 3) * 0.25
          : 3.2 + ((hash >> 5) % 3) * 0.3,
      terminal,
      priority,
      engaged,
      delay: -((hash % 37) / 10),
    };
  });

  const prospectHostById = new Map(
    prospectSatellites.map((satellite) => [satellite.prospect.id, satellite.hostId]),
  );
  const eventFlows = activityEvents.flatMap((event, index) => {
    const actorId = eventAgentId(event.actor);
    const targetId = event.prospectId
      ? prospectHostById.get(event.prospectId) ?? 'orchestrator'
      : 'orchestrator';
    const sourceId = actorId === targetId ? 'orchestrator' : actorId;
    if (sourceId !== 'orchestrator' && !byId.has(sourceId)) return [];
    if (targetId !== 'orchestrator' && !byId.has(targetId)) return [];

    const from = point(sourceId);
    const to = point(targetId);
    return [{
      event,
      from,
      to,
      path: curvedPath(from, to, index + 17),
      sourceId,
      targetId,
      ageSeconds: Math.floor(eventAgeMs(event.createdAt, now) / 1000),
    }];
  });
  const liveActivity = !replayEnabled && (runningJobCount > 0 || eventFlows.length > 0);

  return (
    <div className="liveSwarm3dWrap">
      <div className="liveSwarmCornerStatus">
        <span className={`swarmLiveDot ${orchestratorActive ? 'swarmLiveDotActive' : ''}`} />
        {connected
          ? replayEnabled
            ? 'REPLAY WINDOW'
            : liveActivity
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
          className={`swarm3dCoreAura ${orchestratorActive ? 'swarm3dCoreAuraActive' : ''}`}
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
                {hot ? (
                  <circle className="swarm3dParticle swarm3dParticleActive" r="3.2">
                    <animateMotion
                      dur={`${duration}s`}
                      path={d}
                      repeatCount="indefinite"
                    />
                  </circle>
                ) : null}
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

        <g className="swarm3dEventFlows" aria-label="Recent data-driven handoffs">
          {eventFlows.map((flow, index) => (
            <g className="swarm3dEventFlow" key={`${flow.event.id}-${flow.sourceId}-${flow.targetId}`}>
              <path className="swarm3dEventFlowGlow" d={flow.path} />
              <path className="swarm3dEventFlowPath" d={flow.path} />
              <circle className="swarm3dEventParticle" r={index % 2 === 0 ? 4 : 3}>
                <animateMotion
                  begin={replayEnabled ? `-${Math.min(flow.ageSeconds, 8)}s` : undefined}
                  dur={`${1.15 + (index % 3) * 0.18}s`}
                  path={flow.path}
                  repeatCount="indefinite"
                />
              </circle>
              <title>{`${flow.event.type} · ${flow.event.actor}${flow.event.prospectId ? ` · ${flow.event.prospectId}` : ''}`}</title>
            </g>
          ))}
        </g>

        <g className="swarm3dProspectLayer" aria-label="Prospect satellites">
          {prospectSatellites.map((satellite) => (
            <g
              className={`swarm3dProspect ${satellite.terminal ? 'swarm3dProspectTerminal' : ''} ${satellite.priority ? 'swarm3dProspectPriority' : ''} ${satellite.engaged ? 'swarm3dProspectEngaged' : ''}`}
              key={satellite.prospect.id}
              style={{ animationDelay: `${satellite.delay}s` }}
            >
              <title>{`${satellite.prospect.companyName} — ${satellite.prospect.state}${typeof satellite.prospect.score === 'number' ? ` — score ${satellite.prospect.score}` : ''} — handled by ${satellite.hostId}`}</title>
              <line
                className="swarm3dProspectTether"
                x1={satellite.host.px}
                y1={satellite.host.py}
                x2={satellite.x}
                y2={satellite.y}
              />
              <circle
                className="swarm3dProspectGlow"
                cx={satellite.x}
                cy={satellite.y}
                r={satellite.radius * 3.2}
              />
              <circle
                className="swarm3dProspectDot"
                cx={satellite.x}
                cy={satellite.y}
                r={satellite.radius}
              />
            </g>
          ))}
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
            const eventActive = eventAgentIds.has(agent.id);
            const load = eventLoad[agent.id] ?? 0;
            const radius =
              (agent.active ? 12.5 : 9.5) * position.scale +
              (eventActive ? 1.5 : 0) +
              Math.min(load, 3) * 0.7;
            const shadowRx = radius * 1.2;
            const shadowRy = radius * 0.32;

            return (
              <g
                className={`swarm3dNode swarm3dAgentNode ${agent.active || eventActive ? 'swarm3dNodeActive' : ''} ${eventActive ? 'swarm3dNodeEvent' : ''}`}
                key={agent.id}
                opacity={position.opacity}
                style={{ animationDelay: `${-(index % 7) * 0.47}s` }}
              >
                <title>{`${agent.label} — ${agent.group} — ${agent.detail}${load ? ` — ${load} recent event${load > 1 ? 's' : ''}` : ''}`}</title>
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
                  {agent.active ? 'WORKING' : eventActive ? `EVENT ${load}` : 'READY'}
                </text>
              </g>
            );
          })}
      </svg>

      <div className="swarmReplayBar">
        <div>
          <span className="swarmReplayKicker">REPLAY WINDOW</span>
          <strong>
            {replayEvents.length
              ? `${replayEvents.length} événement${replayEvents.length > 1 ? 's' : ''} · 30 min`
              : 'Aucun événement récent à rejouer'}
          </strong>
        </div>
        <button
          type="button"
          className="swarmReplayButton"
          disabled={!replayEvents.length}
          onClick={() => setReplayEnabled((enabled) => !enabled)}
          aria-pressed={replayEnabled}
        >
          {replayEnabled ? 'REVENIR AU LIVE' : 'REJOUER LES ÉVÉNEMENTS'}
        </button>
      </div>

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
        <span>{eventFlows.length} LIVE EVENT{eventFlows.length === 1 ? '' : 'S'}</span>
        <span>
          {prospects.length} PROSPECT{prospects.length > 1 ? 'S' : ''}
          {hiddenProspectCount > 0 ? ` · +${hiddenProspectCount} CLUSTERED` : ''}
        </span>
      </div>
    </div>
  );
}
