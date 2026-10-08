import LiveRefresh from '../components/LiveRefresh';
import TodayPanel from '../components/TodayPanel';
import DeckHeader from '../components/DeckHeader';
import { getProposalDeck } from '../lib/deck';
import { getSwarmSnapshot, type SwarmSnapshot } from '../lib/api';
import Swarm from '../components/Swarm';
export const dynamic = 'force-dynamic';
async function revalidateDeck() {
  let deck = await getProposalDeck();
  for (let retry = 0; deck.error && retry < 2; retry++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    deck = await getProposalDeck();
  }
  return deck;
}
function LivingHiveFrame({ snapshot }: { snapshot: SwarmSnapshot }) { return <section className="living-hive-frame" aria-labelledby="hive-title"><div className="hive-title"><p className="overline">Espace central</p><h2 id="hive-title">Living Hive</h2></div><Swarm snapshot={snapshot} /></section>; }
function UpcomingPanel() { return <aside className="operator-panel upcoming-panel" aria-label="Contexte opérateur à venir">{[['PROCHAINS RDV', 'Aucun rendez-vous à venir'], ['RELANCES DUES', 'Aucune relance à afficher'], ['SIGNAUX IMPORTANTS', 'Aucun signal important']].map(([title, empty]) => <section className="upcoming-section" key={title}><h2>{title}</h2><p>{empty}</p></section>)}</aside>; }
export default async function Page() { const [deck, swarm] = await Promise.all([revalidateDeck(), getSwarmSnapshot()]); return <main className="deck-shell deck-dashboard" id="top"><LiveRefresh intervalMs={5000} /><DeckHeader /><TodayPanel deck={deck} hive={<LivingHiveFrame snapshot={swarm} />} upcoming={<UpcomingPanel />} /></main>; }
