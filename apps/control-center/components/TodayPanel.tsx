'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { DeckResponse } from '../lib/deck';
import styles from './Swarm.module.css';

const STALE_WINDOW_MS = 30_000;

export default function TodayPanel({ deck, hive, upcoming }: { deck: DeckResponse; hive: ReactNode; upcoming: ReactNode }) {
  // Survives router.refresh: the counter and pipeline retain the same snapshot.
  const [received, setReceived] = useState(deck);
  const [lastValid, setLastValid] = useState<{ deck: DeckResponse; at: number } | null>(deck.error ? null : { deck, at: Date.now() });
  const [expired, setExpired] = useState(false);
  if (received !== deck) {
    setReceived(deck);
    if (!deck.error) {
      setLastValid({ deck, at: Date.now() });
      setExpired(false);
    }
  }
  useEffect(() => {
    if (!deck.error || !lastValid) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, lastValid.at + STALE_WINDOW_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [deck, lastValid]);
  const current = deck.error && lastValid && !expired ? lastValid.deck : deck;

  return <>
    <section className="cockpit-grid" aria-label="Cockpit opérateur">
      <section className={`operator-panel today-panel ${styles.todayPanel}`} aria-labelledby="today-title"><div className="section-heading"><p className="overline">Opérateur</p><h2 id="today-title">Aujourd'hui</h2></div><div className="attention-list"><div><strong>{current.error ? '0' : current.items.length} / 20</strong><span>À contacter</span></div><div><strong>0</strong><span>Relances dues</span></div><div><strong>0</strong><span>RDV aujourd'hui</span></div><div><strong>0</strong><span>Devis à valider</span></div></div></section>
      {hive}{upcoming}
    </section>
  </>;
}
