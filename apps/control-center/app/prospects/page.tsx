import DeckHeader from '../../components/DeckHeader';
import ProspectsList from '../../components/ProspectsList';
import { getProposalDeck } from '../../lib/deck';
import type { DeckCommercialStage } from '../../lib/deck';
import { deckStageLabels } from '../../lib/deck-display';

export const dynamic = 'force-dynamic';

export default async function ProspectsPage({ searchParams }: { searchParams: Promise<{ stage?: string | string[] }> }) {
  const query = await searchParams;
  const stage = typeof query.stage === 'string' && Object.hasOwn(deckStageLabels, query.stage) ? query.stage as DeckCommercialStage : null;
  const deck = await getProposalDeck();
  return <main className="deck-shell">
    <DeckHeader />
    <section className="pipeline-section">
      <div className="section-heading inline-heading"><div><p className="overline">Vue commerciale · Lecture seule</p><h1>Prospects</h1></div>
        <span className="placeholder-note">{deck.error ? 'Capacité non disponible' : `${deck.activeSlotCount} / ${deck.capacity} places de production occupées`}</span></div>
      {deck.error ? <section className="state-panel error" role="alert"><h2>Deck indisponible</h2><p>{deck.error}</p></section> : <ProspectsList items={deck.items} stage={stage} />}
    </section>
  </main>;
}
