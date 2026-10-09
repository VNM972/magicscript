import DeckHeader from '../../components/DeckHeader';
import { getPoolInventory } from '../../lib/deck';
import { displayValue } from '../../lib/deck-display';

export const dynamic = 'force-dynamic';

export default async function PoolPage() {
  const inventory = await getPoolInventory();
  return <main className="deck-shell">
    <DeckHeader />
    <section className="pipeline-section">
      <div className="section-heading inline-heading">
        <div>
          <p className="overline">Vue commerciale - Pool</p>
          <h1>Pool</h1>
        </div>
        <span className="placeholder-note">Prospects non retenus pour la preparation de demo</span>
      </div>
      {inventory.error
        ? <section className="state-panel error" role="alert"><h2>Pool indisponible</h2><p>{inventory.error}</p></section>
        : <div className="prospects-rows">
            {inventory.items.length === 0 && <section className="state-panel"><h2>Pool vide</h2><p>Aucun prospect en pool pour le moment.</p></section>}
            {inventory.items.map((item) => <article className="prospect-row" key={item.prospectId}>
              <div className="prospect-identity">
                <h2><a href={`/prospects/${encodeURIComponent(item.prospectId)}`}>{displayValue(item.businessName)}</a> <span className="source-badge">{item.entry_source}</span></h2>
                <p className="identity">{displayValue(item.vertical)}</p>
              </div>
              <div className="prospect-detail"><span className="detail-label">Ville</span><span>{displayValue(item.location)}</span></div>
              <div className="prospect-detail"><span className="detail-label">Opportunite</span><span>{displayValue(item.opportunity)}</span></div>
              <div className="prospect-detail"><span className="detail-label">Canaux</span><span>{displayValue(item.contactability?.label)}</span></div>
              <div className="prospect-detail"><a className="open-action" href={`/prospects/${encodeURIComponent(item.prospectId)}`}>Ouvrir la fiche</a></div>
            </article>)}
          </div>
      }
    </section>
  </main>;
}
