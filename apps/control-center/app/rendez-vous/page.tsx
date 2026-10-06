import DeckHeader from '../../components/DeckHeader';
import Link from 'next/link';
import { getMeetings } from '../../lib/deck';

export const dynamic = 'force-dynamic';

const filters = [
  { value: 'upcoming', label: 'À venir' },
  { value: 'past', label: 'Passés' },
  { value: 'all', label: 'Tous' },
] as const;
const statuses = { CONFIRMED: 'Confirmé', CANCELLED: 'Annulé', RESCHEDULED: 'Reprogrammé' };
const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris',
});
const cellStyle = { padding: '18px 14px', borderBottom: '1px solid var(--ms-border)' };

export default async function RendezVousPage({ searchParams }: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const { filter } = await searchParams;
  const selected = filter === 'past' || filter === 'all' ? filter : 'upcoming';
  const { meetings, error } = await getMeetings();
  const now = Date.now();
  const visible = meetings.filter((meeting) => selected === 'all' ||
    (selected === 'past' ? Date.parse(meeting.startAtUtc) < now : Date.parse(meeting.startAtUtc) >= now))
    .sort((a, b) => Date.parse(a.startAtUtc) - Date.parse(b.startAtUtc));

  return <main className="deck-shell">
    <DeckHeader />
    <section className="pipeline-section">
      <p className="overline">Magic Script</p>
      <h1>Rendez-vous</h1>
      <p style={{ color: 'var(--ms-muted)', fontSize: '.82rem' }}>Les 30 derniers jours et les 90 prochains jours · Heure de Paris</p>
      <nav className="pipeline-filters" aria-label="Filtrer les rendez-vous">
        {filters.map((item) => <Link key={item.value} href={`/rendez-vous?filter=${item.value}`}
          className={`pipeline-filter${selected === item.value ? ' active' : ''}`}
          aria-current={selected === item.value ? 'page' : undefined}>{item.label}</Link>)}
      </nav>
      {error ? <div className="state-panel error" role="alert" style={{ marginTop: 22 }}><h2>Rendez-vous indisponibles</h2><p>{error}</p></div>
        : visible.length === 0 ? <div className="state-panel" style={{ marginTop: 22 }}><h2>Aucun rendez-vous</h2><p>Aucun rendez-vous pour ce filtre sur la période affichée.</p></div>
          : <div style={{ overflowX: 'auto', marginTop: 22 }} tabIndex={0} role="region" aria-label="Liste des rendez-vous">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.82rem' }}>
              <caption className="sr-only">Rendez-vous triés par date croissante, heure de Paris</caption>
              <thead style={{ color: 'var(--ms-muted)', fontSize: '.7rem' }}><tr>
                {['Date', 'Nom', 'Entreprise', 'Téléphone', 'Statut', 'Action'].map((heading) =>
                  <th scope="col" key={heading} style={cellStyle}>{heading}</th>)}
              </tr></thead>
              <tbody>{visible.map((meeting) => <tr key={meeting.id}>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}><time dateTime={meeting.startAtUtc}>{dateFormat.format(new Date(meeting.startAtUtc))}</time></td>
                <td style={cellStyle}><strong>{meeting.prospectName || '—'}</strong>
                  {typeof meeting.metadata?.title === 'string' && meeting.metadata.title &&
                    <div style={{ color: 'var(--ms-muted)', marginTop: 6 }}>{meeting.metadata.title}</div>}</td>
                <td style={cellStyle}>{meeting.prospectCompany || '—'}</td>
                <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>{meeting.phone || '—'}</td>
                <td style={cellStyle}><span className="signal" style={{ whiteSpace: 'nowrap', color: meeting.status === 'CONFIRMED' ? 'var(--ms-success)' : meeting.status === 'RESCHEDULED' ? 'var(--ms-warning)' : 'var(--ms-muted)' }}>{statuses[meeting.status]}</span></td>
                <td style={cellStyle}><Link className="open-action" href={`/copilot/${encodeURIComponent(meeting.prospectId)}`}>Ouvrir le Copilot</Link></td>
              </tr>)}</tbody>
            </table>
          </div>}
    </section>
  </main>;
}
