import DeckHeader from '../../../components/DeckHeader';
import { getProposalDeck, getProspectInventory } from '../../../lib/deck';
import { displayStage, displayValue, whatsappUrl } from '../../../lib/deck-display';

export const dynamic = 'force-dynamic';

function displayParisDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(date)
    : null;
}

export default async function ProspectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inventory = await getProspectInventory();
  const prospect = inventory.items.find((candidate) => candidate.prospectId === id);
  const deck = prospect ? await getProposalDeck() : null;
  const item = prospect ? { ...prospect, ...deck?.items.find((candidate) => candidate.prospectId === id) } : undefined;
  const email = item?.contactability?.email;
  const mobile = item?.contactability?.mobile;
  const whatsapp = whatsappUrl(mobile ?? null);
  const demoUrl = item?.entry_source === 'MANUAL' && item.demo_ready ? item.demo_url : item?.proposalUrl;
  const fields: Array<[string, string | boolean | null | undefined]> = item ? [
    ['Identifiant', item.prospectId], ['Nom', item.businessName], ['Activité', item.vertical], ['Ville', item.location],
    ['Source', item.entry_source],
    ['Statut commercial', displayStage(item.commercialStage)], ['Code du statut', item.commercialStage],
    ['État actuel', item.currentMeaningfulState], ['Opportunité', item.opportunity], ['Friction', item.friction],
    ['Dernière action', item.latestMeaningfulAction], ['Prochaine action opérateur', item.nextMeaningfulOperatorAction],
    ['Place de production active', item.activeSlot], ['Éligible à la production', item.productionEligible],
    ['Canaux', item.contactability?.label], ['Email', email], ['Mobile', mobile],
    ['Instagram', item.instagram], ['Prochaine relance', displayParisDate(item.nextFollowUpDueAt)],
    ['Identifiant de la Proposal', item.proposal?.id], ['Chemin de la Proposal', item.proposal?.entryPath],
    ['URL de la démo', demoUrl], ['Proposal prête le', item.proposal?.readyAt],
    ['Proposal consultée', item.engagement?.viewed], ['Retour sur la Proposal', item.engagement?.returned],
    ['Partage', item.engagement?.shared], ['Rendez-vous réservé', item.engagement?.meetingBooked],
    ['Date du rendez-vous', item.engagement?.meetingAt], ['Statut du contact commercial', item.outreach?.status],
    ['Canal du contact commercial', item.outreach?.channel], ['Contacté le', displayParisDate(item.outreach?.contactedAt)],
  ] : [];
  const missing = [
    'Historique chronologique des événements',
    'Date du dernier événement commercial',
    'URL de réservation Cal.com',
    ...(!item?.latestMeaningfulAction ? ['Dernière action commerciale'] : []),
    ...(!item?.nextMeaningfulOperatorAction ? ['Prochaine action opérateur'] : []),
    ...(!item?.outreach ? ['Détails du contact commercial et date d’envoi'] : []),
    ...(!email ? ['Adresse email'] : []),
    ...(!mobile ? ['Numéro mobile pour WhatsApp'] : []),
    ...(!item?.proposal && !demoUrl ? ['Proposal prête et lien de démonstration'] : []),
  ];
  return <main className="deck-shell">
    <DeckHeader />
    <section className="pipeline-section prospect-sheet">
      <a className="back-link" href="/prospects">← Tous les prospects</a>
      {inventory.error ? <div className="state-panel error" role="alert"><h1>Inventaire indisponible</h1><p>{inventory.error}</p></div>
        : !item ? <div className="state-panel"><h1>Prospect non disponible</h1><p>Aucun prospect non exclu ne correspond à cet identifiant.</p></div>
        : <>
          <p className="overline">Fiche prospect · Lecture seule</p><h1>{displayValue(item.businessName)} {item.entry_source === 'MANUAL' && <span className="source-badge">MANUAL</span>}</h1>
          <p className="identity">{displayStage(item.commercialStage)} · {displayValue(item.location)}</p>
          <div className="prospect-actions">
            <a className="open-action" href={`/copilot/${encodeURIComponent(id)}`}>Préparer l’appel</a>
            {(demoUrl || item.proposal) && <a className="open-action" href={demoUrl || item.proposal?.entryPath} target="_blank" rel="noopener noreferrer">Ouvrir la démo</a>}
            {email && <a className="open-action" href={`mailto:${encodeURIComponent(email)}`}>Envoyer email</a>}
            {whatsapp && <a className="open-action" href={whatsapp} target="_blank" rel="noopener noreferrer">Envoyer WhatsApp</a>}
          </div>
          {mobile && !whatsapp && <p className="identity">Lien WhatsApp non disponible : numéro international requis.</p>}
          <dl className="prospect-facts">{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{label === 'Instagram' && typeof value === 'string' && value
            ? <a href={value} target="_blank" rel="noopener noreferrer">{value}</a> : displayValue(value)}</dd></div>)}</dl>
          <section className="operator-panel missing-data"><h2>Rapport Codex : données manquantes</h2>
            <p>Non disponibles dans cet item :</p><ul>{missing.map((label) => <li key={label}>{label}</li>)}</ul>
          </section>
        </>}
    </section>
  </main>;
}
