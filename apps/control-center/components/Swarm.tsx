'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { fetchSwarmState, type SwarmState, type SwarmSnapshot } from '../lib/api';
import styles from './Swarm.module.css';

type Status = 'idle' | 'processing' | 'waiting_gatekeeper' | 'success' | 'error';
type Point = { x: number; y: number };
type Entity = { id: string; name: string; bu: number; dx: number; dy: number; gate?: boolean; initial: Status };
type State = { status: Status; since: number; revision: number };
type Curve = { a: Point; b: Point; c: Point; d: Point };
const TAU = Math.PI * 2;

function seeded(seed: number) {
  return () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
}
function curve(a: Point, d: Point, bend: number): Curve {
  return { a, b: { x: a.x + (d.x - a.x) * .28, y: a.y - 42 * bend },
    c: { x: a.x + (d.x - a.x) * .74, y: d.y + 58 * bend }, d };
}
function path(c: Curve) {
  return 'M' + c.a.x + ',' + c.a.y + ' C' + c.b.x + ',' + c.b.y + ' ' + c.c.x + ',' + c.c.y + ' ' + c.d.x + ',' + c.d.y;
}
function onCurve(c: Curve, t: number): Point {
  const s = 1 - t;
  return { x: s ** 3 * c.a.x + 3 * s * s * t * c.b.x + 3 * s * t * t * c.c.x + t ** 3 * c.d.x,
    y: s ** 3 * c.a.y + 3 * s * s * t * c.b.y + 3 * s * t * t * c.c.y + t ** 3 * c.d.y };
}
function layout(width: number, height: number, entities: Entity[], edges: { from: string; to: string }[], units: SwarmState['businessUnits']) {
  const radius = Math.min(120, Math.max(77, width * .135));
  const positions = units.length ? units.map(unit => unit.position) : [{ x: .22, y: .33 }, { x: .76, y: .25 }, { x: .68, y: .73 }, { x: .22, y: .75 }];
  const mobile = [{ x: .27, y: .22 }, { x: .74, y: .42 }, { x: .28, y: .65 }, { x: .73, y: .84 }];
  const centers = positions.map((position, i) => {
    const p = width >= 520 ? position : positions.length === 4 ? mobile[i] : { x: i % 2 ? .73 : .27, y: (i + .8) / (positions.length + .7) };
    return { x: width * p.x, y: height * p.y };
  });
  const points = Object.fromEntries(entities.map(e => [e.id, { x: centers[e.bu].x + e.dx, y: centers[e.bu].y + e.dy }]));
  return { centers, radius, points, curves: edges.map((e, i) => curve(points[e.from], points[e.to], i % 2 ? -1 : 1)) };
}
function makeField(width: number, height: number, centers: Point[], radius: number) {
  const random = seeded(972);
  const clusters = centers.map((center, cluster) => {
    const points = Array.from({ length: Math.floor(3800 / centers.length) }, (_, i) => {
      const angle = random() * TAU, latitude = Math.acos(2 * random() - 1);
      const lobes = 1 + .21 * Math.sin(angle * 3 + cluster) + .14 * Math.cos(latitude * 5 + angle * 2);
      const r = radius * (.35 + .65 * Math.pow(random(), .3)) * lobes;
      return { x: Math.cos(angle) * Math.sin(latitude) * r, y: Math.sin(angle) * Math.sin(latitude) * r * .79,
        z: Math.cos(latitude) * r * .64, phase: random() * TAU, size: i % 13 === 0 ? 1.6 : .65 + random() * .65 };
    });
    // Bounded neighbour search at initialization, never O(n²) inside the frame loop.
    const links: [number, number][] = [];
    for (let i = 0; i < points.length; i++) {
      let best = -1, distance = radius * radius * .2;
      for (let k = 0; k < 14; k++) {
        const j = Math.floor(random() * points.length), a = points[i], b = points[j];
        const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
        if (j !== i && d < distance) { best = j; distance = d; }
      }
      if (best >= 0) links.push([i, best]);
    }
    return { center, points, links, projected: new Float32Array(points.length * 3) };
  });
  // Decorative fibres are batched on Canvas; semantic routes remain SVG.
  const bundles = centers.map((a, i) => {
    const d = centers[(i + 1) % centers.length];
    return Array.from({ length: 230 }, () => {
      const spread = (random() - .5) * radius * 1.5, bend = (random() - .5) * 95;
      const arrival = spread * .7 + (random() - .5) * radius * .6;
      return { a: { x: a.x + (random() - .5) * radius, y: a.y + spread },
        b: { x: a.x + (d.x - a.x) * .3, y: a.y + spread + bend },
        c: { x: a.x + (d.x - a.x) * .7, y: d.y + arrival + bend * .6 },
        d: { x: d.x + (random() - .5) * radius, y: d.y + arrival }, phase: random() * TAU };
    });
  });
  const ambient = Array.from({ length: 400 }, () => ({ x: random() * width, y: random() * height, phase: random() * TAU, speed: 1 + random() * 2 }));
  return { clusters, bundles, ambient };
}

export default function Swarm(_props: { snapshot: SwarmSnapshot }) {
  // The parent prop remains compatible; this scene polls the Worker projection.
  const [data, setData] = useState<SwarmState | null>(null);
  const [connection, setConnection] = useState<'loading' | 'ready' | 'error'>('loading');
  const [states, setStates] = useState<Record<string, State>>({});
  const transitions = useRef(new Map<string, string>());
  const [size, setSize] = useState({ width: 800, height: 610 });
  const [reduced, setReduced] = useState(false), [visible, setVisible] = useState(true);
  const [tooltip, setTooltip] = useState<(Point & { name: string }) | null>(null);
  const stage = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const pulses = useRef(new Map<string, SVGCircleElement>());
  const clock = useRef(0), frameNumber = useRef(0);
  const id = useId();
  // Status-only polls do not regenerate the particle field or restart its animation.
  const topologyKey = JSON.stringify({
    units: data?.businessUnits.map(({ id, name, position, agentIds }) => ({ id, name, position, agentIds, status: 'idle' })) ?? [],
    agents: data?.agents.map(({ id, name, businessUnitId }) => ({ id, name, businessUnitId })) ?? [],
    gates: data?.gatekeepers.map(({ id, name, businessUnitId }) => ({ id, name, businessUnitId })) ?? [],
    edges: data?.edges.map(({ id, source, target }) => ({ id, from: source, to: target })) ?? [],
  });
  const topology = useMemo(() => JSON.parse(topologyKey) as {
    units: SwarmState['businessUnits'];
    agents: { id: string; name: string; businessUnitId: string }[];
    gates: { id: string; name: string; businessUnitId: string }[];
    edges: { id: string; from: string; to: string }[];
  }, [topologyKey]);
  const ENTITIES = useMemo<Entity[]>(() => [...topology.agents, ...topology.gates].map(entity => {
    const gate = topology.gates.some(g => g.id === entity.id);
    const peers = topology.agents.filter(a => a.businessUnitId === entity.businessUnitId);
    const slot = peers.findIndex(a => a.id === entity.id);
    const angle = slot * 2.4;
    return { id: entity.id, name: entity.name, bu: topology.units.findIndex(b => b.id === entity.businessUnitId),
      dx: gate ? 46 : peers.length <= 2 ? slot ? 30 : -24 : Math.cos(angle) * 50,
      dy: gate ? -48 : peers.length <= 2 ? slot ? 30 : -8 : Math.sin(angle) * 50, gate, initial: 'idle' };
  }), [topology]);
  const EDGES = topology.edges;
  const UNITS = topology.units.map(unit => unit.name);
  // One uniform scale keeps the Canvas and SVG aligned as the available height shrinks.
  const scene = useMemo(() => {
    const scale = size.width >= 520 ? Math.min(1, size.height / 610) : 1;
    return { width: size.width / scale, height: size.height / scale, scale };
  }, [size]);
  const geometry = useMemo(() => layout(scene.width, scene.height, ENTITIES, topology.edges, topology.units), [scene, ENTITIES, topology]);
  const live = useRef({ states, edges: data?.edges, connected: connection === 'ready' });
  useEffect(() => { live.current = { states, edges: data?.edges, connected: connection === 'ready' }; }, [states, data, connection]);
  useEffect(() => {
    let disposed = false, controller: AbortController | null = null;
    async function refresh() {
      if (controller) return;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 4000);
      try {
        const next = await fetchSwarmState(controller.signal);
        if (disposed) return;
        setData(next);
        setConnection(next.metadata.sourceStatus === 'ready' ? 'ready' : 'error');
        const incoming = [
          ...next.agents.map(a => ({ id: a.id, status: a.status, key: a.status + ':' + a.currentJobId + ':' + a.startedAt })),
          ...next.gatekeepers.map(g => ({ id: g.id, status: ({ idle: 'idle', waiting: 'waiting_gatekeeper', approved: 'success', rejected: 'error' } as const)[g.status], key: g.status + ':' + g.currentJobId })),
        ];
        const changed = new Set(incoming.filter(a => transitions.current.get(a.id) !== a.key).map(a => a.id));
        transitions.current = new Map(incoming.map(a => [a.id, a.key]));
        setStates(previous => Object.fromEntries(incoming.map(a => [a.id, changed.has(a.id)
          ? { status: a.status, since: Date.now(), revision: (previous[a.id]?.revision ?? 0) + 1 }
          : previous[a.id]])));
      } catch {
        if (!disposed) setConnection('error');
      } finally { clearTimeout(timeout); controller = null; }
    }
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 5000);
    return () => { disposed = true; clearInterval(interval); controller?.abort(); };
  }, []);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReduced(media.matches), updateVisibility = () => setVisible(!document.hidden);
    updateMotion(); updateVisibility();
    const resize = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width), height = Math.round(entry.contentRect.height);
      if (width > 0 && height > 0) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    });
    resize.observe(element);
    media.addEventListener('change', updateMotion); document.addEventListener('visibilitychange', updateVisibility);
    return () => { resize.disconnect(); media.removeEventListener('change', updateMotion); document.removeEventListener('visibilitychange', updateVisibility); };
  }, []);
  // Agent success lasts 1.5 s; a gatekeeper's approval remains visible.
  useEffect(() => {
    const timers = ENTITIES.filter(e => !e.gate && states[e.id]?.status === 'success').map(e => setTimeout(() => {
      setStates(previous => previous[e.id].status !== 'success' ? previous : {
        ...previous, [e.id]: { status: 'idle', since: Date.now(), revision: previous[e.id].revision + 1 },
      });
    }, Math.max(0, 1500 - (Date.now() - states[e.id].since))));
    return () => timers.forEach(clearTimeout);
  }, [states, ENTITIES]);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d', { alpha: false });
    if (!element || !ctx) return;
    const { width, height } = scene, dpr = Math.min(window.devicePixelRatio || 1, 2);
    element.width = Math.round(size.width * dpr); element.height = Math.round(size.height * dpr);
    ctx.setTransform(dpr * scene.scale, 0, 0, dpr * scene.scale, 0, 0);
    const field = makeField(width, height, geometry.centers, geometry.radius);
    let raf = 0, last = 0;
    const canAnimate = !reduced && visible;
    function draw(now: number) {
      if (!ctx || !element) return;
      if (last && canAnimate) clock.current += Math.min((now - last) / 1000, .05);
      last = now;
      const t = clock.current, current = live.current;
      ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(217,164,65,.25)';
      for (const p of field.ambient) ctx.fillRect((p.x + t * p.speed) % width, p.y + Math.sin(t * .09 + p.phase) * 12, .8, .8);
      field.bundles.forEach((bundle, i) => {
        ctx.beginPath();
        for (const fibre of bundle) {
          const dx = Math.sin(t * .8 + fibre.phase + i) * 1.5, dy = Math.cos(t * .65 + fibre.phase) * 1.5;
          ctx.moveTo(fibre.a.x, fibre.a.y);
          ctx.bezierCurveTo(fibre.b.x + dx, fibre.b.y + dy, fibre.c.x - dy, fibre.c.y + dx, fibre.d.x, fibre.d.y);
        }
        ctx.strokeStyle = 'rgba(217,164,65,.105)'; ctx.lineWidth = .45; ctx.stroke();
      });
      field.clusters.forEach((cluster, index) => {
        const { center, points, projected, links } = cluster;
        const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, geometry.radius * 1.3);
        glow.addColorStop(0, 'rgba(217,164,65,.13)'); glow.addColorStop(1, 'rgba(217,164,65,0)');
        ctx.fillStyle = glow; ctx.fillRect(center.x - 180, center.y - 180, 360, 360);
        const rotation = t * .038 + index * .7, co = Math.cos(rotation), si = Math.sin(rotation);
        // Ambient motion is decorative and independent of operational activity.
        const breath = 1 + .01 * (1 - Math.cos(t * TAU / (4 + index % 3) + index));
        for (let i = 0; i < points.length; i++) {
          const p = points[i], z = p.z * co - p.x * si, depth = 1 + z / 550;
          const wanderX = Math.sin(t * .55 + p.phase) * 2 + Math.sin(t * .91 + p.phase * 1.7);
          const wanderY = Math.cos(t * .49 + p.phase) * 2 + Math.sin(t * .83 + p.phase * 2.3);
          projected[i * 3] = center.x + ((p.x * co + p.z * si) * depth + wanderX) * breath;
          projected[i * 3 + 1] = center.y + (p.y * depth + wanderY) * breath;
          projected[i * 3 + 2] = z;
        }
        ctx.beginPath();
        for (const [a, b] of links) {
          const x = projected[a * 3], y = projected[a * 3 + 1], bx = projected[b * 3], by = projected[b * 3 + 1];
          ctx.moveTo(x, y); ctx.quadraticCurveTo((x + bx) / 2 + 2, (y + by) / 2 - 3, bx, by);
        }
        ctx.lineWidth = .55; ctx.strokeStyle = 'rgba(242,198,109,.24)'; ctx.stroke();
        for (let layer = 0; layer < 3; layer++) {
          ctx.fillStyle = ['rgba(174,126,53,.30)', 'rgba(217,164,65,.63)', 'rgba(255,223,155,.92)'][layer];
          for (let i = 0; i < points.length; i++) {
            const z = projected[i * 3 + 2], band = z < -20 ? 0 : z > 20 ? 2 : 1;
            if (band === layer) ctx.fillRect(projected[i * 3], projected[i * 3 + 1], points[i].size, points[i].size);
          }
        }
      });
      ENTITIES.forEach(entity => {
        if (current.states[entity.id]?.status !== 'error') return;
        const p = geometry.points[entity.id];
        const flare = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 60);
        flare.addColorStop(0, 'rgba(229,72,77,.25)'); flare.addColorStop(1, 'rgba(229,72,77,0)');
        ctx.fillStyle = flare; ctx.fillRect(p.x - 60, p.y - 60, 120, 120);
      });
      ctx.globalAlpha = 1;
      EDGES.forEach((edge, i) => {
        for (let n = 0; n < 3; n++) {
          const pulse = pulses.current.get(edge.id + '-' + n);
          if (!pulse) continue;
          const duration = .7 + (i % 6) * .09, cycle = 2.5 + (i % 4) * .39;
          const progress = ((t + i * .31 - n * .24 + cycle * 4) % cycle) / duration;
          const enabled = !reduced && current.connected && current.edges?.some(e => e.id === edge.id && e.status === 'active' && e.activeJobIds.length > 0) && progress <= 1;
          pulse.style.opacity = enabled ? '.95' : '0';
          if (enabled) { const p = onCurve(geometry.curves[i], progress); pulse.setAttribute('transform', 'translate(' + p.x + ' ' + p.y + ')'); }
        }
      });
      frameNumber.current++;
      element.dataset.frame = String(frameNumber.current);
      element.dataset.particles = '4200';
      if (canAnimate) raf = requestAnimationFrame(draw);
    }
    draw(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [size, scene, geometry, reduced, visible, ENTITIES, EDGES]);
  function showTooltip(name: string, point: Point) {
    setTooltip({ name, x: Math.max(90, Math.min(size.width - 90, point.x * scene.scale)),
      y: Math.max(42, point.y * scene.scale - 32) });
  }

  return <div className={styles.swarm} data-swarm="organic" data-connection={connection} data-snapshot={data?.metadata.timestamp} data-paused={!visible} data-reduced-motion={reduced}>
    <div className={styles.stage} ref={stage} onPointerLeave={() => setTooltip(null)}>
      <div className={styles.world}>
        <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
        <svg className={styles.svg} viewBox={'0 0 ' + scene.width + ' ' + scene.height} preserveAspectRatio="xMidYMid meet" aria-labelledby={id + '-title ' + id + '-desc'}>
          <title id={id + '-title'}>Ruche organique Magic Script</title>
          <desc id={id + '-desc'}>Amas dorés décoratifs et état des agents lu depuis le Worker. Survolez une business unit ou un agent pour afficher son nom.</desc>
          {geometry.centers.slice(0, UNITS.length).map((center, index) => <g key={topology.units[index].id} className={styles.bu}
            role="img" tabIndex={0} aria-label={UNITS[index]} data-bu={topology.units[index].id}
            onPointerEnter={() => showTooltip(UNITS[index], center)} onPointerLeave={() => setTooltip(null)}
            onFocus={() => showTooltip(UNITS[index], center)} onBlur={() => setTooltip(null)}
            onKeyDown={event => { if (event.key === 'Escape') setTooltip(null); }}>
            <ellipse cx={center.x} cy={center.y} rx={geometry.radius} ry={geometry.radius * .84} className={styles.buHit} />
          </g>)}
          <g aria-hidden="true" className={styles.routes}>{EDGES.map((edge, i) =>
            <path key={edge.id} d={path(geometry.curves[i])} className={styles.edgeLine} />)}</g>
          <g aria-hidden="true" className={styles.pulses}>{EDGES.flatMap(edge => [0, 1, 2].map(n =>
            <circle key={edge.id + '-' + n} r={n === 0 ? 2.3 : 1.5} ref={node => { const key = edge.id + '-' + n; if (node) pulses.current.set(key, node); else pulses.current.delete(key); }} />))}</g>
          {ENTITIES.map(entity => {
            const p = geometry.points[entity.id], state = states[entity.id] ?? { status: 'idle' as Status, since: 0, revision: 0 };
            return <g key={entity.id} transform={'translate(' + p.x + ' ' + p.y + ')'} className={styles.organism}
              data-entity={entity.id} role="img" tabIndex={0} aria-label={entity.name}
              onPointerEnter={() => showTooltip(entity.name, p)} onPointerLeave={() => setTooltip(null)}
              onFocus={() => showTooltip(entity.name, p)} onBlur={() => setTooltip(null)}
              onKeyDown={event => { if (event.key === 'Escape') setTooltip(null); }}>
              <circle r="24" className={styles.nodeHit} />
              <g key={state.revision} className={styles.node} data-status={state.status} data-gate={!!entity.gate}>
                <circle r="29" className={styles.halo} /><circle r={entity.gate ? 15 : 14} className={styles.core} /><circle r="19" className={styles.ring} />
                {entity.gate ? <><circle r="23" className={styles.gateRing} /><path d="M0,-5L5,0L0,5L-5,0Z" className={styles.glyph} /></> : <circle r="3" className={styles.glyph} />}
                <circle r="18" className={styles.spinner} />
              </g><circle r="26" className={styles.focusRing} />
            </g>;
          })}
        </svg>
      </div>
      {tooltip && <div className={styles.tooltip} role="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>{tooltip.name}</div>}
    </div>
  </div>;
}
