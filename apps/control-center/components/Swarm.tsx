'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { fetchSwarmState, type SwarmState, type SwarmSnapshot } from '../lib/api';
import styles from './Swarm.module.css';

type Status = 'idle' | 'processing' | 'waiting_gatekeeper' | 'success' | 'error';
type Point = { x: number; y: number };
type Entity = { id: string; name: string; bu: number; dx: number; dy: number; gate?: boolean; initial: Status };
type State = { status: Status; since: number; revision: number };
type Curve = { a: Point; b: Point; c: Point; d: Point };
const TAU = Math.PI * 2;
const LABELS: Record<Status, string> = { idle: 'En veille', processing: 'En cours', waiting_gatekeeper: 'Validation requise', success: 'Terminé', error: 'Perturbation' };
const COLORS: Record<Status, string> = { idle: '#39393F', processing: '#D9A441', waiting_gatekeeper: '#8065FF', success: '#45C98B', error: '#E5484D' };

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
  // Decorative fibres are batched on Canvas. Every semantic route remains interactive SVG.
  const bundles = centers.map((a, i) => {
    const d = centers[(i + 1) % centers.length], fibres = new Path2D();
    for (let j = 0; j < 230; j++) {
      const spread = (random() - .5) * radius * 1.5, bend = (random() - .5) * 95;
      const arrival = spread * .7 + (random() - .5) * radius * .6;
      fibres.moveTo(a.x + (random() - .5) * radius, a.y + spread);
      fibres.bezierCurveTo(a.x + (d.x - a.x) * .3, a.y + spread + bend,
        a.x + (d.x - a.x) * .7, d.y + arrival + bend * .6, d.x + (random() - .5) * radius, d.y + arrival);
    }
    return fibres;
  });
  const ambient = Array.from({ length: 400 }, () => ({ x: random() * width, y: random() * height, phase: random() * TAU, speed: 1 + random() * 2 }));
  return { clusters, bundles, ambient };
}

export default function Swarm(_props: { snapshot: SwarmSnapshot }) {
  // The parent prop remains compatible; this scene reads the versioned local snapshot.
  const [data, setData] = useState<SwarmState | null>(null);
  const [connection, setConnection] = useState<'loading' | 'ready' | 'error'>('loading');
  const [states, setStates] = useState<Record<string, State>>({});
  const transitions = useRef(new Map<string, string>());
  const [size, setSize] = useState({ width: 800, height: 610 });
  const [paused, setPaused] = useState(false), [reduced, setReduced] = useState(false), [visible, setVisible] = useState(true);
  const [zoom, setZoom] = useState<number | null>(null);
  const [selection, setSelection] = useState<string | null>(null), [trace, setTrace] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const trigger = useRef<SVGElement | null>(null), pulses = useRef(new Map<string, SVGCircleElement>());
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
  const JOBS = data?.jobs ?? [];
  const geometry = useMemo(() => layout(size.width, size.height, ENTITIES, topology.edges, topology.units), [size, ENTITIES, topology]);
  const tracedEdges = useMemo(() => new Set(data?.edges.filter(e => trace && e.activeJobIds.includes(trace)).map(e => e.id)), [data, trace]);
  const tracedEntities = useMemo(() => new Set([
    ...(data?.edges.filter(e => trace && e.activeJobIds.includes(trace)).flatMap(e => [e.source, e.target]) ?? []),
    ...(data?.agents.filter(a => trace && a.currentJobId === trace).map(a => a.id) ?? []),
  ]), [data, trace]);
  const tracedUnits = useMemo(() => new Set(topology.units.flatMap((unit, i) =>
    data?.jobs.find(job => job.id === trace)?.route.includes(unit.id) ? [i] : [])), [data, trace, topology]);
  const live = useRef({ states, trace, tracedUnits, tracedEdges, edges: data?.edges, connected: connection === 'ready' });
  useEffect(() => { live.current = { states, trace, tracedUnits, tracedEdges, edges: data?.edges, connected: connection === 'ready' }; }, [states, trace, tracedUnits, tracedEdges, data, connection]);
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
        setSelection(previous => previous && !incoming.some(a => a.id === previous) && !next.edges.some(e => e.id === previous) ? null : previous);
        setTrace(previous => previous && !next.jobs.some(j => j.id === previous) ? null : previous);
      } catch {
        if (!disposed) setConnection('error');
      } finally { clearTimeout(timeout); controller = null; }
    }
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 5000);
    return () => { disposed = true; clearInterval(interval); controller?.abort(); };
  }, []);
  function closeInspector() { setSelection(null); trigger.current?.focus(); }
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
    if (!selection) return;
    closeButton.current?.focus();
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { setSelection(null); trigger.current?.focus(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [selection]);
  useEffect(() => {
    const element = canvas.current, ctx = element?.getContext('2d', { alpha: false });
    if (!element || !ctx) return;
    const { width, height } = size, dpr = Math.min(window.devicePixelRatio || 1, 2);
    element.width = Math.round(width * dpr); element.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const field = makeField(width, height, geometry.centers, geometry.radius);
    let raf = 0, last = 0;
    const canAnimate = !paused && !reduced && visible;
    function draw(now: number) {
      if (!ctx || !element) return;
      if (last && canAnimate) clock.current += Math.min((now - last) / 1000, .05);
      last = now;
      const t = clock.current, current = live.current;
      ctx.fillStyle = '#080808'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(217,164,65,.25)';
      for (const p of field.ambient) ctx.fillRect((p.x + t * p.speed) % width, p.y + Math.sin(t * .09 + p.phase) * 12, .8, .8);
      field.bundles.forEach((bundle, i) => {
        ctx.save(); ctx.translate(Math.sin(t * .17 + i) * 2, Math.cos(t * .13 + i) * 2);
        ctx.globalAlpha = current.trace && !(current.tracedUnits.has(i) && current.tracedUnits.has((i + 1) % 4)) ? .15 : 1;
        ctx.strokeStyle = 'rgba(217,164,65,.105)'; ctx.lineWidth = .45; ctx.stroke(bundle); ctx.restore();
      });
      field.clusters.forEach((cluster, index) => {
        const { center, points, projected, links } = cluster;
        ctx.globalAlpha = current.trace && !current.tracedUnits.has(index) ? .15 : 1;
        const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, geometry.radius * 1.3);
        glow.addColorStop(0, 'rgba(217,164,65,.13)'); glow.addColorStop(1, 'rgba(217,164,65,0)');
        ctx.fillStyle = glow; ctx.fillRect(center.x - 180, center.y - 180, 360, 360);
        const rotation = t * .038 + index * .7, co = Math.cos(rotation), si = Math.sin(rotation);
        for (let i = 0; i < points.length; i++) {
          const p = points[i], z = p.z * co - p.x * si, depth = 1 + z / 550;
          projected[i * 3] = center.x + (p.x * co + p.z * si) * depth + Math.sin(t * .24 + p.phase) * 3;
          projected[i * 3 + 1] = center.y + p.y * depth + Math.cos(t * .19 + p.phase) * 3;
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
        ctx.globalAlpha = current.trace && !current.tracedUnits.has(entity.bu) ? .15 : 1;
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
          pulse.style.opacity = enabled ? String(current.trace && !current.tracedEdges.has(edge.id) ? .15 : .95) : '0';
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
  }, [size, geometry, paused, reduced, visible, trace, ENTITIES, EDGES]);
  const selectedAgent = data?.agents.find(a => a.id === selection);
  const selectedGate = data?.gatekeepers.find(g => g.id === selection);
  const selected = ENTITIES.find(e => e.id === selection), selectedEdge = EDGES.find(e => e.id === selection);
  const zoomPoint = zoom === null ? null : geometry.centers[zoom];
  const activate = (event: KeyboardEvent<SVGElement>, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
  };
  function inspect(entityId: string, element: SVGElement) { trigger.current = element; setSelection(entityId); }

  return <div className={styles.swarm} data-swarm="organic" data-connection={connection} data-snapshot={data?.metadata.timestamp} data-paused={paused || !visible} data-reduced-motion={reduced}>
    <div className={styles.edition}>NEURAL FIELD <span>02 / 04</span></div>
    <div className={styles.toolbar}><span className={styles.simulation} role="status"><i /> {connection === 'loading' ? 'Connexion au moteur...' : connection === 'error' ? 'Moteur indisponible' : 'SQLite · ' + data?.swarm.activeJobs + ' jobs actifs'}</span>
      <div><button type="button" onClick={() => { setZoom(null); setTrace(null); }} disabled={zoom === null && trace === null}>Vue globale</button>
        <button type="button" aria-pressed={paused} onClick={() => setPaused(p => !p)}>{paused ? 'Reprendre' : 'Pause'}</button></div></div>
    <div className={styles.stage} ref={stage}>
      <div className={styles.coordinates} aria-hidden="true">MS / OBSERVATORY<br />{UNITS.length} BUs · {data?.agents.length ?? 0} AGENTS · {data?.gatekeepers.length ?? 0} GATES</div>
      <div className={styles.world} style={{ transform: zoomPoint ? 'scale(1.18)' : 'scale(1)', transformOrigin: zoomPoint ? zoomPoint.x + 'px ' + zoomPoint.y + 'px' : '50% 50%' }}>
        <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
        <svg className={styles.svg} viewBox={'0 0 ' + size.width + ' ' + size.height} aria-labelledby={id + '-title ' + id + '-desc'}>
          <title id={id + '-title'}>Ruche organique Magic Script</title>
          <desc id={id + '-desc'}>État local de la ruche. Galaxies dorées décoratives et agents connectés à SQLite. Sélectionnez un agent pour l’inspecter, une business unit pour zoomer, un job pour tracer son parcours.</desc>
          {geometry.centers.slice(0, UNITS.length).map((center, index) => <g key={UNITS[index]} className={styles.bu} data-dimmed={!!trace && !tracedUnits.has(index)}
            role="button" tabIndex={0} aria-label={'Zoom ' + UNITS[index]} aria-pressed={zoom === index}
            onClick={() => setZoom(previous => previous === index ? null : index)}
            onKeyDown={event => activate(event, () => setZoom(previous => previous === index ? null : index))}>
            <ellipse cx={center.x} cy={center.y} rx={geometry.radius} ry={geometry.radius * .84} className={styles.buHit} />
            <text x={center.x} y={center.y - geometry.radius - 16} textAnchor="middle" className={styles.buLabel}>{UNITS[index]} <tspan>· {topology.units[index].agentIds.length} AGENTS</tspan></text>
            <path d={'M' + (center.x - 12) + ',' + (center.y - geometry.radius - 7) + 'h24'} className={styles.buMarker} />
          </g>)}
          <g className={styles.routes}>{EDGES.map((edge, i) => <g key={edge.id} className={styles.edge} data-dimmed={!!trace && !tracedEdges.has(edge.id)}
            role="button" tabIndex={0} aria-label={'Connexion ' + edge.from + ' vers ' + edge.to}
            onClick={event => { setTrace(data?.edges.find(e => e.id === edge.id)?.activeJobIds[0] ?? null); inspect(edge.id, event.currentTarget); }}
            onKeyDown={event => activate(event, () => { setTrace(data?.edges.find(e => e.id === edge.id)?.activeJobIds[0] ?? null); inspect(edge.id, event.currentTarget); })}>
            <path d={path(geometry.curves[i])} className={styles.edgeLine} data-traced={tracedEdges.has(edge.id)} />
            <path d={path(geometry.curves[i])} className={styles.edgeHit} />
          </g>)}</g>
          <g aria-hidden="true" className={styles.pulses}>{EDGES.flatMap(edge => [0, 1, 2].map(n =>
            <circle key={edge.id + '-' + n} r={n === 0 ? 2.3 : 1.5} ref={node => { const key = edge.id + '-' + n; if (node) pulses.current.set(key, node); else pulses.current.delete(key); }} />))}</g>
          {ENTITIES.map(entity => {
            const p = geometry.points[entity.id], state = states[entity.id] ?? { status: 'idle' as Status, since: 0, revision: 0 };
            return <g key={entity.id} transform={'translate(' + p.x + ' ' + p.y + ')'} className={styles.organism}
              data-entity={entity.id} data-dimmed={!!trace && !tracedEntities.has(entity.id)} role="button" tabIndex={0}
              aria-label={entity.name + ', ' + (entity.gate ? 'Gatekeeper, ' : '') + LABELS[state.status]}
              aria-pressed={selection === entity.id} onClick={event => inspect(entity.id, event.currentTarget)}
              onKeyDown={event => activate(event, () => inspect(entity.id, event.currentTarget))}>
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
      <div className={styles.sceneNote} aria-hidden="true">ORGANIC COMPUTATIONAL MINIMALISM <span>∞</span></div>
      {selection && <aside className={styles.inspector} role="dialog" aria-modal="false" aria-labelledby={id + '-inspector'}>
        <div className={styles.inspectorTop}><span>INSPECTOR / SQLITE</span><button type="button" ref={closeButton} onClick={closeInspector} aria-label="Fermer l’inspecteur">×</button></div>
        <div className={styles.inspectorSymbol} style={{ color: selected ? COLORS[states[selected.id]?.status ?? 'idle'] : '#D9A441' }}>{selected?.gate ? '◇' : '◎'}</div>
        <h3 id={id + '-inspector'}>{selected?.name ?? 'Connexion ' + selectedEdge?.id}</h3>
        <p>{selected ? UNITS[selected.bu] : selectedEdge ? selectedEdge.from + ' → ' + selectedEdge.to : ''}</p>
        <dl><div><dt>Type</dt><dd>{selected ? selected.gate ? 'Gatekeeper' : 'Agent' : 'Connexion'}</dd></div>
          <div><dt>État</dt><dd>{selected ? LABELS[states[selected.id]?.status ?? 'idle'] : data?.edges.find(e => e.id === selectedEdge?.id)?.status}</dd></div><div><dt>Source</dt><dd>{connection === 'ready' ? 'SQLite local' : 'Dernier instantané'}</dd></div></dl>
        {selected && <dl>
          <div><dt>Job</dt><dd style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{selectedAgent?.currentJobId ?? selectedGate?.currentJobId ?? 'Aucun'}</dd></div>
          <div><dt>Progression</dt><dd>{selectedAgent?.progress == null ? 'Non documentée' : Math.round(selectedAgent.progress * 100) + ' %'}</dd></div>
          <div><dt>Démarrage</dt><dd>{selectedAgent?.startedAt ? new Date(selectedAgent.startedAt).toLocaleTimeString('fr-FR') : 'Non documenté'}</dd></div>
          {selectedGate && <div><dt>Décision</dt><dd>{selectedGate.decision ?? 'Non documentée'}</dd></div>}
        </dl>}
        <p className={styles.disclaimer}>Lecture seule · {connection === 'ready' ? 'instantané actualisé toutes les 5 s' : 'source indisponible, données éventuellement anciennes'}.</p>
      </aside>}
    </div>
    <div className={styles.jobs}><div className={styles.stripTitle}>TRACE / JOBS <span>{data?.swarm.activeJobs ?? 0} actifs · {data?.swarm.activeAgents ?? 0} agents en cours</span></div>
      <label className={styles.disclaimer} htmlFor={id + '-job'}>Parcours observé </label>
      <select id={id + '-job'} aria-label="Tracer un job" value={trace ?? ''} onChange={event => setTrace(event.target.value || null)}
        style={{ maxWidth: '100%', background: '#121214', color: '#F3F0E9', minHeight: 44 }}>
        <option value="">Choisir un job ({JOBS.length})</option>
        {JOBS.map(job => <option key={job.id} value={job.id}>{job.id} · {job.status}</option>)}
      </select>
      <div className={styles.jobList}>{JOBS.slice(0, 4).map(job => <button key={job.id} type="button" aria-pressed={trace === job.id}
        title={job.id} onClick={() => setTrace(previous => previous === job.id ? null : job.id)}>
        <span>{job.id.slice(-6)}</span>{job.status}<i>↗</i></button>)}</div>
      {trace && <p className={styles.disclaimer}>Étapes attestées : {JOBS.find(job => job.id === trace)?.route.map(unit => topology.units.find(b => b.id === unit)?.name ?? unit).join(' → ') || 'Non documentées'}</p>}
    </div>
    <footer className={styles.telemetry}><div className={styles.stripTitle}>TÉLÉMÉTRIE <span>{connection === 'ready' ? 'SQLITE / 5 S' : 'HORS CONNEXION'}</span></div>
      <ol aria-label="Derniers événements SQLite">{data?.events.length ? data.events.slice(0, 3).map(event =>
        <li key={event.id} title={event.timestamp + ' · ' + event.severity + ' · ' + event.message}><span>{new Date(event.timestamp).toLocaleTimeString('fr-FR')}</span>{event.message}</li>)
        : <li>Aucun événement disponible</li>}</ol>
      <div className={styles.telemetryBottom}><span><i /> 4 200 particules · Canvas + SVG</span><span>{reduced ? 'Mouvement réduit' : paused ? 'Animation en pause' : 'Champ continu'}</span></div>
    </footer>
  </div>;
}
