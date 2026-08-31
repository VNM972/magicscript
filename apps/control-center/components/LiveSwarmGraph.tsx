'use client';

import { useEffect, useRef, useState } from 'react';

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

interface GraphNode {
  id: string;
  label: string;
  group: string;
  active: boolean;
  detail: string;
  x: number;
  y: number;
  phase: number;
  radius: number;
}

interface Particle {
  from: string;
  to: string;
  progress: number;
  speed: number;
  offset: number;
}

const positions: Record<string, [number, number]> = {
  'discovery-scout': [0.14, 0.25],
  'research-analyst': [0.31, 0.14],
  'contact-hunter': [0.49, 0.11],
  'outreach-writer': [0.70, 0.16],
  'fact-checker': [0.86, 0.28],
  'prototype-strategist': [0.82, 0.68],
  'prototype-builder': [0.66, 0.84],
  'mobile-ux': [0.47, 0.89],
  'conversion-checker': [0.28, 0.82],
  'technical-checker': [0.13, 0.67],
  'reply-classifier': [0.08, 0.46],
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<LiveSwarmAgent | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let animationFrame = 0;
    let pointerX = -1;
    let pointerY = -1;

    const nodes: GraphNode[] = [
      {
        id: 'orchestrator',
        label: 'ORCHESTRATOR',
        group: 'CORE',
        active: runningJobCount > 0,
        detail:
          runningJobCount > 0
            ? `${runningJobCount} runtime job${runningJobCount > 1 ? 's' : ''}`
            : 'Waiting for the next action',
        x: 0.5,
        y: 0.49,
        phase: 0,
        radius: 16,
      },
      ...agents.map((agent, index) => {
        const [x, y] = positions[agent.id] ?? [
          0.5 + Math.cos((index / Math.max(agents.length, 1)) * Math.PI * 2) * 0.38,
          0.5 + Math.sin((index / Math.max(agents.length, 1)) * Math.PI * 2) * 0.38,
        ];
        return {
          ...agent,
          x,
          y,
          phase: index * 0.73,
          radius: agent.active ? 12 : 9,
        };
      }),
    ];

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const primaryEdges: Array<[string, string]> = agents.map((agent) => [
      'orchestrator',
      agent.id,
    ]);
    const edges = [...primaryEdges, ...secondaryEdges].filter(
      ([from, to]) => nodeById.has(from) && nodeById.has(to),
    );

    const particles: Particle[] = [];
    for (const [from, to] of edges) {
      const target = nodeById.get(to);
      const source = nodeById.get(from);
      const hot = Boolean(target?.active || source?.active);
      const count = hot ? 4 : 1;
      for (let i = 0; i < count; i += 1) {
        particles.push({
          from,
          to,
          progress: i / count,
          speed: hot ? 0.004 + i * 0.0008 : 0.0014,
          offset: i * 0.17,
        });
      }
    }

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    const nodePoint = (node: GraphNode, time: number) => {
      const activeBoost = node.active ? 1.8 : 1;
      const driftX = Math.sin(time * 0.00055 + node.phase) * 4 * activeBoost;
      const driftY = Math.cos(time * 0.00048 + node.phase * 1.3) * 4 * activeBoost;
      return {
        x: node.x * width + driftX,
        y: node.y * height + driftY,
      };
    };

    const drawGlowLine = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      active: boolean,
    ) => {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = active
        ? 'rgba(113,255,183,0.34)'
        : 'rgba(113,255,183,0.085)';
      ctx.lineWidth = active ? 1.5 : 0.8;
      ctx.shadowColor = active
        ? 'rgba(113,255,183,0.7)'
        : 'rgba(113,255,183,0.15)';
      ctx.shadowBlur = active ? 10 : 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };

    const drawNode = (node: GraphNode, time: number) => {
      const point = nodePoint(node, time);
      const isCore = node.id === 'orchestrator';
      const hoveredNode =
        Math.hypot(pointerX - point.x, pointerY - point.y) < node.radius + 14;
      const pulse = 1 + Math.sin(time * 0.004 + node.phase) * (node.active ? 0.18 : 0.06);
      const radius = node.radius * pulse + (hoveredNode ? 2 : 0);

      const gradient = ctx.createRadialGradient(
        point.x,
        point.y,
        0,
        point.x,
        point.y,
        radius * (node.active ? 3.6 : 2.5),
      );
      gradient.addColorStop(
        0,
        node.active || isCore
          ? 'rgba(113,255,183,0.34)'
          : 'rgba(113,255,183,0.15)',
      );
      gradient.addColorStop(1, 'rgba(113,255,183,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * (node.active ? 3.6 : 2.5), 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.fillStyle = node.active
        ? '#8fffc9'
        : isCore
          ? '#71ffb7'
          : '#405b4d';
      ctx.shadowColor = node.active || isCore
        ? 'rgba(113,255,183,0.95)'
        : 'rgba(113,255,183,0.25)';
      ctx.shadowBlur = node.active || isCore ? 18 : 5;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = node.active || isCore ? '#eafff3' : '#87a596';
      ctx.font = `${isCore ? 700 : 600} ${isCore ? 11 : 9}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.label, point.x, point.y + radius + 8);

      if (node.active) {
        ctx.fillStyle = '#71ffb7';
        ctx.font = '700 8px Inter, system-ui, sans-serif';
        ctx.fillText('WORKING', point.x, point.y + radius + 22);
      }

      return { point, hoveredNode };
    };

    const draw = (time: number) => {
      frame += 1;
      ctx.clearRect(0, 0, width, height);

      for (const [fromId, toId] of edges) {
        const from = nodeById.get(fromId);
        const to = nodeById.get(toId);
        if (!from || !to) continue;
        const p1 = nodePoint(from, time);
        const p2 = nodePoint(to, time);
        drawGlowLine(
          p1.x,
          p1.y,
          p2.x,
          p2.y,
          Boolean(from.active || to.active),
        );
      }

      for (const particle of particles) {
        const from = nodeById.get(particle.from);
        const to = nodeById.get(particle.to);
        if (!from || !to) continue;

        const hot = from.active || to.active;
        particle.progress =
          (particle.progress + particle.speed * (hot ? 1.6 : 1)) % 1;

        const p1 = nodePoint(from, time);
        const p2 = nodePoint(to, time);
        const t = (particle.progress + particle.offset) % 1;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;

        ctx.save();
        ctx.fillStyle = hot
          ? 'rgba(143,255,201,0.95)'
          : 'rgba(113,255,183,0.28)';
        ctx.shadowColor = 'rgba(113,255,183,0.9)';
        ctx.shadowBlur = hot ? 12 : 5;
        ctx.beginPath();
        ctx.arc(x, y, hot ? 2.4 : 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      let hoveredAgent: LiveSwarmAgent | null = null;
      for (const node of nodes) {
        const result = drawNode(node, time);
        if (result.hoveredNode && node.id !== 'orchestrator') {
          hoveredAgent =
            agents.find((agent) => agent.id === node.id) ?? null;
        }
      }

      if (frame % 4 === 0) {
        setHovered((current) =>
          current?.id === hoveredAgent?.id ? current : hoveredAgent,
        );
      }

      animationFrame = requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerX = event.clientX - rect.left;
      pointerY = event.clientY - rect.top;
    };

    const onPointerLeave = () => {
      pointerX = -1;
      pointerY = -1;
      setHovered(null);
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    animationFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [agents, runningJobCount]);

  return (
    <div className="liveSwarmCanvasWrap" ref={wrapRef}>
      <canvas
        aria-label="Live Magic Script swarm graph"
        className="liveSwarmCanvas"
        ref={canvasRef}
      />
      <div className="liveSwarmCornerStatus">
        <span className={`swarmLiveDot ${runningJobCount > 0 ? 'swarmLiveDotActive' : ''}`} />
        {connected
          ? runningJobCount > 0
            ? 'LIVE TRAFFIC'
            : 'NETWORK IDLE'
          : 'OFFLINE'}
      </div>
      {hovered ? (
        <div className="liveSwarmTooltip">
          <strong>{hovered.label}</strong>
          <span>{hovered.group}</span>
          <p>{hovered.detail}</p>
        </div>
      ) : null}
      <div className="srOnly" aria-live="polite">
        {agents
          .filter((agent) => agent.active)
          .map((agent) => `${agent.label}: ${agent.detail}`)
          .join('. ')}
      </div>
    </div>
  );
}
