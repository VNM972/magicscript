import type { DeckCommercialStage, ProspectInventoryItem } from '../lib/deck';
import { deckStageLabels, displayStage, displayValue } from '../lib/deck-display';

export default function ProspectsList({ items, stage }: { items: ProspectInventoryItem[]; stage: DeckCommercialStage | null }) {
  const visible = stage === null ? items : items.filter((item) => item.commercialStage === stage);
  return <>
    <div className="pipeline-filters" role="group" aria-label="Filtrer par statut commercial">
      {(Object.entries(deckStageLabels) as Array<[DeckCommercialStage, string]>).map(([key, label]) =>
        <a className={`pipeline-filter${stage === key ? ' active' : ''}`} aria-current={stage === key ? 'true' : undefined}
          key={key} href={stage === key ? '/prospects' : `/prospects?stage=${key}`}>
          {label} <span>{items.filter((item) => item.commercialStage === key).length}</span>
        </a>)}
    </div>
    <div className="prospects-summary">
      <p aria-live="polite">{visible.length} prospect{visible.length > 1 ? 's' : ''} · {stage ? displayStage(stage) : 'Tous les statuts'}</p>
      {stage && <a className="pipeline-filter" href="/prospects">Afficher tous les prospects</a>}
    </div>
    <div className="prospects-rows">
      {visible.map((item) => <article className="prospect-row prospect-link" key={item.prospectId}>
        <div className="prospect-identity"><h2><a href={`/prospects/${encodeURIComponent(item.prospectId)}`}>{displayValue(item.businessName)}</a> <span className="source-badge">{item.entry_source}</span></h2><p className="identity">{displayValue(item.vertical)}</p></div>
        <div className="prospect-detail"><span className="detail-label">Ville</span><span>{displayValue(item.location)}</span></div>
        <div className="prospect-detail"><span className="detail-label">Statut</span><span>{displayStage(item.commercialStage)}</span></div>
        <div className="prospect-detail"><span className="detail-label">Canaux</span><span>{displayValue(item.contactability?.label)}</span>
          <span>{item.contactability?.email || '—'}</span><span>{item.contactability?.mobile || '—'}</span></div>
        <div className="prospect-detail"><a className="open-action" href={`/prospects/${encodeURIComponent(item.prospectId)}`}>Ouvrir la fiche ↗</a>
          {item.entry_source === 'MANUAL' && item.demo_ready && item.demo_url && <a className="open-action" href={item.demo_url} target="_blank" rel="noopener noreferrer">Ouvrir la démo ↗</a>}</div>
      </article>)}
      {!visible.length && <section className="state-panel"><h2>Aucun prospect à afficher</h2><p>{stage ? 'Aucun item retourné pour ce statut.' : 'L’inventaire ne retourne aucun prospect.'}</p></section>}
    </div>
  </>;
}
