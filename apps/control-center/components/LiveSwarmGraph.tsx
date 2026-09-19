'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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

type RuntimeState = 'ACTIVE' | 'IDLE' | 'BLOCKED' | 'UNKNOWN';

interface Point {
  originX: number;
  originY: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  depth: number;
  phase: number;
}

interface Lobe {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

interface TerritoryLayout {
  label: string;
  cx: number;
  cy: number;
  lobes: Lobe[];
}

interface Territory {
  id: string;
  label: string;
  members: LiveSwarmAgent[];
  points: Point[];
  edges: Array<[number, number]>;
  prospectCount: number;
  blockedCount: number;
  state: RuntimeState;
}

interface SemanticPosition {
  id: string;
  label: string;
  group: string;
  x: number;
  y: number;
  state: RuntimeState;
  detail: string;
  prospectCount: number;
}

const WIDTH = 1280;
const HEIGHT = 720;

const territoryLayouts: Record<string, TerritoryLayout> = {
  PROSPECTION: {
    label: 'PROSPECTION', cx: 150, cy: 185,
    lobes: [
      { x: -46, y: -22, rx: 92, ry: 112 },
      { x: 38, y: -48, rx: 86, ry: 70 },
      { x: 25, y: 58, rx: 112, ry: 82 },
      { x: -78, y: 72, rx: 58, ry: 72 },
    ],
  },
  RESEARCH: {
    label: 'RESEARCH', cx: 405, cy: 108,
    lobes: [
      { x: -68, y: 6, rx: 82, ry: 56 },
      { x: 10, y: -24, rx: 102, ry: 70 },
      { x: 84, y: 20, rx: 58, ry: 84 },
    ],
  },
  CONTACT: {
    label: 'CONTACT', cx: 245, cy: 485,
    lobes: [
      { x: -62, y: -50, rx: 78, ry: 84 },
      { x: 20, y: -4, rx: 116, ry: 92 },
      { x: -18, y: 72, rx: 86, ry: 62 },
      { x: 84, y: 52, rx: 54, ry: 74 },
    ],
  },
  ORCHESTRATION: {
    label: 'ORCHESTRATION', cx: 565, cy: 625,
    lobes: [
      { x: -54, y: -6, rx: 82, ry: 54 },
      { x: 18, y: -26, rx: 88, ry: 64 },
      { x: 72, y: 16, rx: 62, ry: 48 },
    ],
  },
  PROTOTYPE: {
    label: 'PROTOTYPE', cx: 850, cy: 570,
    lobes: [
      { x: -78, y: -26, rx: 82, ry: 84 },
      { x: 6, y: 12, rx: 118, ry: 96 },
      { x: 92, y: -36, rx: 58, ry: 78 },
      { x: 52, y: 70, rx: 78, ry: 52 },
    ],
  },
  'QA SWARM': {
    label: 'QA SWARM', cx: 1090, cy: 400,
    lobes: [
      { x: -58, y: -70, rx: 78, ry: 82 },
      { x: 28, y: -40, rx: 92, ry: 70 },
      { x: -16, y: 42, rx: 124, ry: 92 },
      { x: 72, y: 72, rx: 66, ry: 76 },
    ],
  },
  COMMERCIAL: {
    label: 'COMMERCIAL', cx: 1080, cy: 126,
    lobes: [
      { x: -76, y: 4, rx: 72, ry: 82 },
      { x: 0, y: -24, rx: 104, ry: 72 },
      { x: 78, y: 24, rx: 68, ry: 94 },
      { x: 12, y: 64, rx: 92, ry: 48 },
    ],
  },
  GUARDRAIL: {
    label: 'GUARDRAIL', cx: 770, cy: 88,
    lobes: [
      { x: -54, y: 6, rx: 76, ry: 52 },
      { x: 28, y: -16, rx: 98, ry: 66 },
      { x: 72, y: 34, rx: 54, ry: 68 },
    ],
  },
};

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
};

const semanticHandoffs: Array<[string, string]> = [
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

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTexture(id: string, layout: TerritoryLayout, count: number) {
  const random = seededRandom(stableHash(id));
  const points: Point[] = [];

  for (let index = 0; index < count; index += 1) {
    const lobe = layout.lobes[Math.floor(random() * layout.lobes.length)];
    const angle = random() * Math.PI * 2;
    const radius = Math.pow(random(), 0.68);
    const edgeNoise = 0.76 + random() * 0.42;
    const x = layout.cx + lobe.x + Math.cos(angle) * lobe.rx * radius * edgeNoise;
    const y = layout.cy + lobe.y + Math.sin(angle) * lobe.ry * radius * edgeNoise;
    const depth = random();

    points.push({
      originX: x,
      originY: y,
      x,
      y,
      z: depth,
      vx: 0,
      vy: 0,
      vz: 0,
      depth,
      phase: random() * Math.PI * 2,
    });
  }

  const edges: Array<[number, number]> = [];
  points.forEach((point, index) => {
    if (index === 0) return;
    const candidates = points
      .slice(0, index)
      .map((candidate, candidateIndex) => ({
        candidateIndex,
        distance: Math.hypot(point.x - candidate.x, point.y - candidate.y),
      }))
      .filter((candidate) => candidate.distance < 68)
      .sort((left, right) => left.distance - right.distance)
      .slice(0, index % 5 === 0 ? 3 : 2);
    candidates.forEach((candidate) => edges.push([index, candidate.candidateIndex]));
  });

  return { points, edges };
}

function runtimeState(connected: boolean, members: LiveSwarmAgent[], blockedCount: number): RuntimeState {
  if (!connected) return 'UNKNOWN';
  if (members.some((member) => member.active)) return 'ACTIVE';
  if (blockedCount > 0) return 'BLOCKED';
  return 'IDLE';
}

function stateColor(state: RuntimeState): string {
  if (state === 'ACTIVE') return '#9fffd0';
  if (state === 'BLOCKED') return '#ffc66b';
  if (state === 'UNKNOWN') return '#83938b';
  return '#5c8b74';
}

export default function LiveSwarmGraph({
  agents,
  prospects,
  recentEvents,
  connected,
  runningJobCount,
}: LiveSwarmGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textureCacheRef = useRef(
    new Map<string, { points: Point[]; edges: Array<[number, number]> }>(),
  );
  const [selectedKey, setSelectedKey] = useState('group:ORCHESTRATION');
  const [replayEnabled, setReplayEnabled] = useState(false);

  const agentById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const prospectHost = (prospect: LiveSwarmProspect): string =>
    prospectStateAgent[prospect.state] ?? 'orchestrator';

  const territories = useMemo<Territory[]>(() => {
    return Object.entries(territoryLayouts).map(([id, layout]) => {
      const members = id === 'ORCHESTRATION' ? [] : agents.filter((agent) => agent.group === id);
      const memberIds = new Set(members.map((member) => member.id));
      const assignedProspects = prospects.filter((prospect) => {
        const host = prospectStateAgent[prospect.state] ?? 'orchestrator';
        return id === 'ORCHESTRATION' ? host === 'orchestrator' : memberIds.has(host);
      });
      const blockedCount = assignedProspects.filter(
        (prospect) => prospect.state === 'HUMAN_ACTION_REQUIRED',
      ).length;
      const textureCount =
        230 + members.length * 32 + Math.min(assignedProspects.length * 4, 120);

      const cachedTexture = textureCacheRef.current.get(id);
      const texture =
        cachedTexture && cachedTexture.points.length === textureCount
          ? cachedTexture
          : makeTexture(id, layout, textureCount);

      if (texture !== cachedTexture) {
        textureCacheRef.current.set(id, texture);
      }
      const state = id === 'ORCHESTRATION'
        ? !connected
          ? 'UNKNOWN'
          : runningJobCount > 0
            ? 'ACTIVE'
            : 'IDLE'
        : runtimeState(connected, members, blockedCount);

      return {
        id,
        label: layout.label,
        members,
        points: texture.points,
        edges: texture.edges,
        prospectCount: assignedProspects.length,
        blockedCount,
        state,
      };
    });
  }, [agents, connected, prospects, runningJobCount]);

  const semanticPositions = useMemo<SemanticPosition[]>(() => {
    const positions: SemanticPosition[] = [];
    territories.forEach((territory) => {
      const layout = territoryLayouts[territory.id];
      if (territory.id === 'ORCHESTRATION') {
        positions.push({
          id: 'orchestrator',
          label: 'ORCHESTRATOR',
          group: territory.id,
          x: layout.cx,
          y: layout.cy - 18,
          state: territory.state,
          detail: connected
            ? `${runningJobCount} job${runningJobCount === 1 ? '' : 's'} actif${runningJobCount === 1 ? '' : 's'}`
            : 'Télémétrie runtime indisponible',
          prospectCount: territory.prospectCount,
        });
        return;
      }

      territory.members.forEach((member, index) => {
        const lobe = layout.lobes[index % layout.lobes.length];
        positions.push({
          id: member.id,
          label: member.label,
          group: territory.id,
          x: layout.cx + lobe.x * 0.68,
          y: layout.cy + lobe.y * 0.66,
          state: !connected ? 'UNKNOWN' : member.active ? 'ACTIVE' : 'IDLE',
          detail: member.detail,
          prospectCount: prospects.filter((prospect) => prospectHost(prospect) === member.id).length,
        });
      });
    });
    return positions;
  }, [connected, prospects, runningJobCount, territories]);

  const semanticById = useMemo(
    () => new Map(semanticPositions.map((position) => [position.id, position])),
    [semanticPositions],
  );
  const territoryById = useMemo(
    () => new Map(territories.map((territory) => [territory.id, territory])),
    [territories],
  );

  const groupHandoffs = useMemo(() => {
    const handoffs = new Set<string>();
    semanticHandoffs.forEach(([fromId, toId]) => {
      const from = agentById.get(fromId)?.group;
      const to = agentById.get(toId)?.group;
      if (from && to && from !== to) handoffs.add(`${from}|${to}`);
    });
    ['PROSPECTION', 'COMMERCIAL', 'PROTOTYPE'].forEach((group) =>
      handoffs.add(`ORCHESTRATION|${group}`),
    );
    return [...handoffs].map((handoff) => handoff.split('|') as [string, string]);
  }, [agentById]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let animationFrame = 0;
    let lastFrame = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    };

    const draw = (timestamp: number) => {
      animationFrame = window.requestAnimationFrame(draw);
      if (timestamp - lastFrame < 40) return;
      lastFrame = timestamp;

      context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
      context.clearRect(0, 0, WIDTH, HEIGHT);
      const time = reduceMotion ? 0 : timestamp * 0.00065;

      groupHandoffs.forEach(([fromId, toId], handoffIndex) => {
        const fromLayout = territoryLayouts[fromId];
        const toLayout = territoryLayouts[toId];
        const fromState = territoryById.get(fromId)?.state ?? 'UNKNOWN';
        const toState = territoryById.get(toId)?.state ?? 'UNKNOWN';
        const active = fromState === 'ACTIVE' || toState === 'ACTIVE';
        const selected = selectedKey === `group:${fromId}` || selectedKey === `group:${toId}`;
        const dx = toLayout.cx - fromLayout.cx;
        const dy = toLayout.cy - fromLayout.cy;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const normalX = -dy / distance;
        const normalY = dx / distance;
        const bridgeBreathing = reduceMotion
          ? 1
          : 0.88 + Math.sin(time * 1.15 + handoffIndex * 0.73) * 0.12;

        for (let strand = -1; strand <= 1; strand += 1) {
          const offset = strand * 3.6 + Math.sin(handoffIndex * 1.7 + strand) * 2;

          const bridgeWave = reduceMotion
            ? 0
            : Math.sin(
                time * 0.23
                + handoffIndex * 0.91
                + strand * 0.65
              ) * 6
              + Math.cos(
                  time * 0.097
                  + handoffIndex * 0.47
                  - strand * 0.31
                ) * 4;

          const alongWave = reduceMotion
            ? 0
            : Math.cos(
                time * 0.18
                + handoffIndex * 0.57
                + strand
              ) * 2.2
              + Math.sin(
                  time * 0.073
                  + handoffIndex * 0.29
                  + strand * 0.43
                ) * 1.4;

          const controlX =
            (fromLayout.cx + toLayout.cx) / 2
            + normalX * (18 + offset * 2 + bridgeWave)
            + (dx / distance) * alongWave;
          const controlY =
            (fromLayout.cy + toLayout.cy) / 2
            + normalY * (18 + offset * 2 + bridgeWave)
            + (dy / distance) * alongWave;
          context.beginPath();
          context.moveTo(fromLayout.cx + normalX * offset, fromLayout.cy + normalY * offset);
          context.quadraticCurveTo(controlX, controlY, toLayout.cx + normalX * offset, toLayout.cy + normalY * offset);
          context.strokeStyle = active
            ? `rgba(132, 255, 196, ${(selected ? 0.24 : 0.14) * bridgeBreathing})`
            : `rgba(96, 151, 122, ${(selected ? 0.17 : 0.075) * bridgeBreathing})`;
          context.lineWidth = selected ? 1.15 : 0.62;
          context.stroke();
        }
      });

      territories.forEach((territory) => {
        const isSelected = selectedKey === `group:${territory.id}`;
        const active = territory.state === 'ACTIVE';
        const blocked = territory.state === 'BLOCKED';
        const territoryPhase = stableHash(territory.id) * 0.0001;
        const layout = territoryLayouts[territory.id];

        // Slow coherent territory drift using multiple unrelated periods.
        // This avoids the previous visible synchronized reversal.
        const territoryDriftX = reduceMotion
          ? 0
          : Math.sin(time * 0.21 + territoryPhase) * 5
            + Math.cos(time * 0.083 + territoryPhase * 1.71) * 3;

        const territoryDriftY = reduceMotion
          ? 0
          : Math.cos(time * 0.17 + territoryPhase * 1.29) * 4
            + Math.sin(time * 0.071 + territoryPhase * 0.63) * 2.5;

        const animatedPoints = territory.points.map((point) => {
          if (!reduceMotion) {
            const localX = point.x - layout.cx;
            const localY = point.y - layout.cy;

            // Continuous vector field. Velocity and position persist from
            // one rendered frame to the next.
            const flowX =
              Math.sin(
                point.y * 0.015
                + point.z * 4.7
                + time * 0.72
                + point.phase * 0.61
              )
              + Math.cos(
                point.x * 0.009
                - time * 0.31
                + point.phase * 1.37
              ) * 0.7;

            const flowY =
              Math.cos(
                point.x * 0.013
                - point.z * 3.9
                + time * 0.58
                + point.phase * 0.79
              )
              - Math.sin(
                point.y * 0.008
                + time * 0.27
                + point.phase * 1.11
              ) * 0.65;

            const flowZ =
              Math.sin(
                (point.x + point.y) * 0.008
                + time * 0.49
                + point.phase * 1.23
              )
              + Math.cos(
                (point.x - point.y) * 0.006
                - time * 0.22
                + point.phase * 0.83
              ) * 0.55;

            // Weak spring toward the canonical texture keeps the semantic
            // territory recognizable while still allowing visible roaming.
            const homeX = point.originX - point.x;
            const homeY = point.originY - point.y;
            const homeZ = point.depth - point.z;

            const roam = Math.hypot(homeX, homeY);
            const spring =
              0.0018 + Math.max(0, roam - 16) * 0.00018;

            point.vx =
              point.vx * 0.93
              + flowX * 0.038
              + homeX * spring;

            point.vy =
              point.vy * 0.93
              + flowY * 0.038
              + homeY * spring;

            point.vz =
              point.vz * 0.94
              + flowZ * 0.00145
              + homeZ * 0.008;

            point.x += point.vx;
            point.y += point.vy;
            point.z = Math.max(
              0,
              Math.min(1, point.z + point.vz),
            );
          }

          // Perspective projection of the persistent 3D point.
          // Pinhole-style camera projection.
          // z now changes both apparent size and projected screen position,
          // making front/back travel perceptible instead of merely changing opacity.
          const zWorld = (point.z - 0.5) * 140;
          const cameraDistance = 260;
          const perspective =
            cameraDistance / (cameraDistance - zWorld);
          const depthLift = (point.z - 0.5) * 34;

          return {
            x:
              layout.cx
              + (point.x - layout.cx) * perspective
              + territoryDriftX * (0.7 + point.z * 0.55),
            y:
              layout.cy
              + (point.y - layout.cy) * perspective
              + territoryDriftY * (0.7 + point.z * 0.55)
              - depthLift,
            z: point.z,
            perspective,
          };
        });
        territory.edges.forEach(([fromIndex, toIndex], edgeIndex) => {
          const from = territory.points[fromIndex];
          const to = territory.points[toIndex];
          const animatedFrom = animatedPoints[fromIndex];
          const animatedTo = animatedPoints[toIndex];
          const averageDepth = (animatedFrom.z + animatedTo.z) / 2;
          const breathing = 0.86 + Math.sin(time * 1.7 + edgeIndex * 0.017) * 0.14;
          const alpha = (0.018 + averageDepth * 0.16) * breathing * (isSelected ? 1.4 : 1);

          context.beginPath();
          context.moveTo(animatedFrom.x, animatedFrom.y);
          context.lineTo(animatedTo.x, animatedTo.y);
          context.strokeStyle = blocked
            ? `rgba(231, 177, 94, ${alpha * 0.72})`
            : `rgba(105, 224, 164, ${alpha})`;
          context.lineWidth = 0.28 + averageDepth * 0.72;
          context.stroke();
        });

        const pointRenderOrder = animatedPoints
          .map((animated, index) => ({ animated, index }))
          .sort((left, right) => left.animated.z - right.animated.z);

        pointRenderOrder.forEach(({ animated, index: pointIndex }) => {
          const point = territory.points[pointIndex];
          const microDrift = reduceMotion
            ? 0
            : Math.sin(time * 1.4 + point.phase) * (0.65 + point.depth * 0.95);
          const depthBreathing = reduceMotion
            ? 0
            : Math.sin(time * 1.08 + point.phase) * 0.12;

          const radius = (
            0.42
            + animated.z * 1.35
            + depthBreathing
            + (pointIndex % 29 === 0 ? 0.7 : 0)
          ) * animated.perspective;

          const alpha = Math.min(
            0.94,
            (0.1 + animated.z * 0.78) * (isSelected ? 1.12 : 1),
          );

          context.beginPath();
          context.arc(
            animated.x + microDrift,
            animated.y + microDrift * 0.42,
            radius,
            0,
            Math.PI * 2,
          );
          context.fillStyle = blocked
            ? `rgba(238, 186, 101, ${alpha * 0.78})`
            : `rgba(139, 255, 198, ${alpha})`;
          context.fill();
        });

        if (active) {
          const layout = territoryLayouts[territory.id];
          const pulse = 11 + (reduceMotion ? 0 : Math.sin(timestamp * 0.002) * 2);
          context.beginPath();
          context.arc(layout.cx, layout.cy, pulse, 0, Math.PI * 2);
          context.strokeStyle = 'rgba(159, 255, 208, 0.4)';
          context.lineWidth = 0.9;
          context.stroke();
        }
      });

      semanticHandoffs.forEach(([fromId, toId]) => {
        const from = semanticById.get(fromId);
        const to = semanticById.get(toId);
        if (!from || !to || from.group !== to.group) return;
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.quadraticCurveTo((from.x + to.x) / 2 + 8, (from.y + to.y) / 2 - 7, to.x, to.y);
        context.strokeStyle = 'rgba(151, 255, 207, 0.22)';
        context.lineWidth = 0.75;
        context.stroke();
      });

      prospects.forEach((prospect) => {
        const host = semanticById.get(prospectHost(prospect)) ?? semanticById.get('orchestrator');
        if (!host) return;
        const hash = stableHash(prospect.id);
        const angle = ((hash % 360) * Math.PI) / 180;
        const distance = 17 + ((hash >>> 9) % 38);
        const x = host.x + Math.cos(angle) * distance;
        const y = host.y + Math.sin(angle) * distance * 0.72;
        const blocked = prospect.state === 'HUMAN_ACTION_REQUIRED';
        const priority = typeof prospect.score === 'number' && prospect.score >= 85;
        context.beginPath();
        context.arc(x, y, blocked ? 2.5 : priority ? 2.2 : 1.65, 0, Math.PI * 2);
        context.fillStyle = blocked ? '#ffc66b' : priority ? '#e9fff4' : '#8ee9ba';
        context.fill();
      });

      semanticPositions.forEach((node) => {
        context.beginPath();
        context.arc(node.x, node.y, node.state === 'ACTIVE' ? 4.8 : 3.4, 0, Math.PI * 2);
        context.fillStyle = stateColor(node.state);
        context.fill();
        context.beginPath();
        context.arc(node.x, node.y, node.state === 'ACTIVE' ? 9 : 6.5, 0, Math.PI * 2);
        context.strokeStyle = `${stateColor(node.state)}66`;
        context.lineWidth = 0.8;
        context.stroke();
      });
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [groupHandoffs, prospects, selectedKey, semanticById, semanticPositions, territories, territoryById]);

  const selected = useMemo(() => {
    const [kind, id] = selectedKey.split(':');
    if (kind === 'agent') {
      const agent = semanticById.get(id);
      if (!agent) return null;
      return {
        eyebrow: 'AGENT SÉMANTIQUE RÉEL',
        title: agent.label,
        state: agent.state,
        detail: agent.detail,
        meta: `${agent.group} · ${agent.prospectCount} prospect${agent.prospectCount === 1 ? '' : 's'} rattaché${agent.prospectCount === 1 ? '' : 's'}`,
      };
    }

    const territory = territoryById.get(id);
    if (!territory) return null;
    return {
      eyebrow: 'TERRITOIRE FONCTIONNEL',
      title: territory.label,
      state: territory.state,
      detail: territory.id === 'ORCHESTRATION'
        ? 'Coordination des handoffs et supervision des jobs existants.'
        : `${territory.members.length} rôle${territory.members.length === 1 ? '' : 's'} réel${territory.members.length === 1 ? '' : 's'} dans ce territoire.`,
      meta: `${territory.prospectCount} prospect${territory.prospectCount === 1 ? '' : 's'} · ${territory.blockedCount} blocage${territory.blockedCount === 1 ? '' : 's'} humain${territory.blockedCount === 1 ? '' : 's'}`,
    };
  }, [selectedKey, semanticById, territoryById]);

  return (
    <div className="livingSwarm">
      <div className="livingSwarmField">
        <canvas
          ref={canvasRef}
          className="livingSwarmCanvas"
          role="img"
          aria-label={`Ruche Magic Script : ${territories.length} territoires fonctionnels, ${agents.length + 1} agents sémantiques, ${prospects.length} prospects réels.`}
        />

        <div className="livingSwarmStatus" aria-live="polite">
          <span className={`swarmLiveDot ${runningJobCount > 0 ? 'swarmLiveDotActive' : ''}`} />
          {connected
            ? runningJobCount > 0
              ? `${runningJobCount} JOB${runningJobCount === 1 ? '' : 'S'} ACTIF${runningJobCount === 1 ? '' : 'S'}`
              : 'RUNTIME CONNECTÉ · IDLE'
            : 'RUNTIME UNKNOWN'}
        </div>

        {territories.map((territory) => {
          const layout = territoryLayouts[territory.id];
          return (
            <button
              key={territory.id}
              type="button"
              className={`swarmTerritoryLabel swarmTerritoryLabelHoverOnly ${selectedKey === `group:${territory.id}` ? 'swarmTerritoryLabelSelected' : ''}`}
              style={{ left: `${(layout.cx / WIDTH) * 100}%`, top: `${(layout.cy / HEIGHT) * 100}%` }}
              onClick={() => setSelectedKey(`group:${territory.id}`)}
              title={`Inspecter ${territory.label}`}
            >
              <strong>{territory.label}</strong>
              <span style={{ color: stateColor(territory.state) }}>{territory.state}</span>
            </button>
          );
        })}

        {semanticPositions.map((node) => (
          <button
            key={node.id}
            type="button"
            className={`swarmAgentHotspot ${selectedKey === `agent:${node.id}` ? 'swarmAgentHotspotSelected' : ''}`}
            style={{ left: `${(node.x / WIDTH) * 100}%`, top: `${(node.y / HEIGHT) * 100}%` }}
            onClick={() => setSelectedKey(`agent:${node.id}`)}
            title={`${node.label} · ${node.state} · ${node.detail}`}
          >
            {node.label}
          </button>
        ))}

        <div className="livingSwarmKey" aria-label="Légende du Living Swarm">
          <span><i className="swarmKeySemantic" /> entité réelle</span>
          <span><i className="swarmKeyProspect" /> prospect réel</span>
          <span><i className="swarmKeyTexture" /> texture non sémantique</span>
        </div>
      </div>

      <div className="livingSwarmInspector">
        <div>
          <span className="eyebrow">{selected?.eyebrow ?? 'INSPECTION'}</span>
          <strong>{selected?.title ?? 'Sélectionner un territoire'}</strong>
        </div>
        <span className={`livingSwarmState livingSwarmState${selected?.state ?? 'UNKNOWN'}`}>
          {selected?.state ?? 'UNKNOWN'}
        </span>
        <p>{selected?.detail}</p>
        <small>{selected?.meta}</small>
      </div>

      <div className="livingSwarmFooter">
        <span>{territories.length} TERRITOIRES · {agents.length + 1} AGENTS SÉMANTIQUES · {prospects.length} PROSPECTS</span>
        <span>{recentEvents.length} ÉVÉNEMENT{recentEvents.length === 1 ? '' : 'S'} DISPONIBLE{recentEvents.length === 1 ? '' : 'S'}</span>
        <button
          type="button"
          disabled={!recentEvents.length}
          aria-pressed={replayEnabled}
          onClick={() => setReplayEnabled((enabled) => !enabled)}
        >
          {replayEnabled ? 'MASQUER LE REPLAY' : 'INSPECTER LA FENÊTRE REPLAY'}
        </button>
      </div>

      {replayEnabled ? (
        <div className="livingSwarmReplay" aria-label="Événements réels disponibles en replay">
          {recentEvents.slice(0, 4).map((event) => (
            <div key={event.id}>
              <strong>{event.type.replaceAll('_', ' ').replaceAll('.', ' · ')}</strong>
              <span>{event.actor}{event.prospectId ? ` · ${event.prospectId}` : ''}</span>
              <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('fr-FR')}</time>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
