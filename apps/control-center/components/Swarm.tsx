'use client';

import { memo, useEffect, useId, useRef, useState } from 'react';
import type { SwarmSnapshot } from '../lib/api';
import styles from './Swarm.module.css';

// Adapted from the standalone Swarm's seeded organic particle field.
// Stable seeds avoid hydration differences and jumps on LiveRefresh.
const Dust = memo(function Dust({ seed }: { seed: string }) {
  let n = [...seed].reduce((value, char) => Math.imul(value, 31) + char.charCodeAt(0) | 0, 7);
  const random = () => { n = Math.imul(n, 1664525) + 1013904223 | 0; return (n >>> 0) / 4294967296; };
  return <g className={styles.dust} aria-hidden="true">{Array.from({ length: 110 }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const radius = (43 + random() * 24) * (1 + .075 * Math.sin(angle * 3));
    return <circle key={index} cx={Math.cos(angle) * radius} cy={Math.sin(angle) * radius * .91}
      r={.5 + random()} opacity={.15 + random() * .5} fill="currentColor" />;
  })}</g>;
});

export default function Swarm({ snapshot }: { snapshot: SwarmSnapshot }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [columns, setColumns] = useState(5);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = snapshot.units.find((unit) => unit.key === selectedId) ?? snapshot.units[0];
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    const observer = new ResizeObserver(([entry]) => setColumns(entry.contentRect.width >= 600 ? 5 : 2));
    if (root.current) observer.observe(root.current);
    return () => { document.removeEventListener('visibilitychange', update); observer.disconnect(); };
  }, []);

  const rows = Math.ceil(snapshot.units.length / columns);
  const status = !snapshot.connected ? 'État indisponible' : snapshot.runningJobCount ? 'En activité' : 'En veille';
  return <div ref={root} className={styles.swarm} data-swarm="native" data-paused={paused || hidden} data-connected={snapshot.connected}>
    <div className={styles.summary} role="status">
      <span className={styles.state}>{status}</span>
      <span>{snapshot.runningJobCount ?? '—'} jobs actifs · {snapshot.units.filter((unit) => unit.known).length} BUs configurées</span>
    </div>
    <svg className={styles.map} viewBox={`0 0 ${columns * 220} ${rows * 205 + 12}`} aria-labelledby={`${id}-title ${id}-description`}>
      <title id={`${id}-title`}>Champ d’activité de la ruche</title>
      <desc id={`${id}-description`}>Business units configurées. Les particules sont décoratives ; les compteurs proviennent des jobs en cours. Sélectionnez une unité pour l’inspecter.</desc>
      {snapshot.units.map((unit, index) => {
        const x = 110 + index % columns * 220;
        const y = 78 + Math.floor(index / columns) * 205;
        const active = snapshot.connected && unit.activeJobCount > 0;
        return <g key={unit.key} transform={`translate(${x} ${y})`}>
          <g className={styles.entity} data-active={active} data-known={snapshot.connected}
            role="button" tabIndex={0} aria-pressed={selected?.key === unit.key}
            aria-label={`${unit.label}, ${snapshot.connected ? `${unit.activeJobCount} jobs actifs` : 'état indisponible'}`}
            onClick={() => setSelectedId(unit.key)} onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(unit.key); }
            }}>
            <circle r="74" fill="transparent" />
            <circle r="69" className={styles.orbit} />
            <ellipse rx="76" ry="62" transform="rotate(-25)" className={styles.orbit} />
            <Dust seed={unit.key} />
            <circle r="24" className={styles.selection} />
            <circle r="18" className={styles.core} />
            <circle r="22" className={styles.spin} />
            <circle r="3" fill="currentColor" />
            <text y="96" textAnchor="middle" className={styles.unitName}>{unit.label.length > 25 ? `${unit.label.slice(0, 24)}…` : unit.label}</text>
            <text y="113" textAnchor="middle" className={styles.unitMeta}>{snapshot.connected ? `${unit.activeJobCount} JOB${unit.activeJobCount === 1 ? '' : 'S'} EN COURS` : 'NON DOCUMENTÉ'}</text>
          </g>
        </g>;
      })}
    </svg>
    <div className={styles.inspector}>
      <label className={styles.picker} htmlFor={`${id}-unit`}>Observer une business unit
        <select id={`${id}-unit`} value={selected?.key ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
          {snapshot.units.map((unit) => <option key={unit.key} value={unit.key}>{unit.label}</option>)}
        </select>
      </label>
      <dl className={styles.details}>
        <div><dt>Responsable configuré</dt><dd>{selected?.masterOfWork === 'UNKNOWN' ? 'Non documenté' : selected?.masterOfWork ?? '—'}</dd></div>
        <div><dt>Prospects</dt><dd>{snapshot.connected ? selected?.prospectCount ?? 0 : 'Non documenté'}</dd></div>
        <div><dt>Jobs actifs</dt><dd>{snapshot.connected ? selected?.activeJobCount ?? 0 : 'Non documenté'}</dd></div>
      </dl>
    </div>
    <div className={styles.footer}>
      <p>{snapshot.connected ? 'Instantané API · actualisation toutes les 5 s.' : 'API indisponible · activité non documentée.'}<br />Animation d’ambiance · aucun transfert simulé.</p>
      <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Reprendre' : 'Pause'}</button>
    </div>
  </div>;
}
