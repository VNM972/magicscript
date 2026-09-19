import LiveRefresh from '../components/LiveRefresh';
import OutreachReview from '../components/OutreachReview';
import { getProposalDeck, type ProposalDeckItemV1 } from '../lib/deck';

export const dynamic = 'force-dynamic';

function signal(label: string, active: boolean): string {
  return active ? label : '';
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '';
}

function ProspectCard({ item }: { item: ProposalDeckItemV1 }) {
  const signals = [
    signal('Viewed', item.engagement.viewed),
    signal('Returned', item.engagement.returned),
    signal('Shared', item.engagement.shared),
    signal(item.engagement.meetingBooked ? `Meeting booked${item.engagement.meetingAt ? ` · ${formatDate(item.engagement.meetingAt)}` : ''}` : 'No meeting', item.engagement.meetingBooked || !item.engagement.meetingBooked),
  ].filter(Boolean);
  return (
    <article className="prospect-card" data-prospect-id={item.prospectId}>
      <div className="card-heading">
        <div>
          <p className="card-kicker">Proposal ready</p>
          <h2>{item.businessName}</h2>
          <p className="identity">{[item.vertical, item.location].filter(Boolean).join(' · ') || 'Local business'}</p>
        </div>
        <span className="ready-mark">READY</span>
      </div>
      <div className="card-grid">
        <section><h3>Opportunity</h3><p>{item.opportunity || 'Opportunity identified by Agent 1.'}</p><p className="friction">{item.friction || 'Digital context available in the prepared Proposal.'}</p></section>
        <section><h3>Contactability</h3><p className="contact-label">{item.contactability.label}</p>{item.contactability.email && <p className="contact-value">{item.contactability.email}</p>}{item.contactability.mobile && <p className="contact-value">{item.contactability.mobile}</p>}</section>
      </div>
      <div className="card-footer">
        <div className="signals" aria-label="Engagement signals">{signals.map((value) => <span key={value} className={value === 'No meeting' ? 'signal quiet' : 'signal'}>{value}</span>)}</div>
        <a className="proposal-link" href={item.proposalUrl || item.proposal.entryPath} target="_blank" rel="noreferrer">Open Proposal <span aria-hidden="true">↗</span></a>
      </div>
      <p className="proposal-meta">{item.proposal.id} · ready {formatDate(item.proposal.readyAt)}</p>
      <OutreachReview item={item} />
    </article>
  );
}

export default async function Page() {
  const deck = await getProposalDeck();
  return <main className="shell">
    <LiveRefresh intervalMs={5000} />
    <header className="topbar">
      <div><p className="eyebrow">MAGIC SCRIPT · COMMERCIAL OPERATIONS</p><h1>Operator Deck</h1><p className="lede">The prospects with a Proposal ready for human action.</p></div>
      <div className="status"><span className="pulse" /> LIVE REFRESH</div>
    </header>
    <section className="deck-summary" aria-label="Deck summary"><div><strong>{deck.items.length}</strong><span>Proposal-ready prospects</span></div><p>Only canonical PROPOSAL_READY packages appear here. No outreach is sent from this surface.</p></section>
    {deck.error ? <section className="state-panel error" role="alert"><h2>Deck unavailable</h2><p>{deck.error}</p><p>Try again in a moment. Internal diagnostics stay out of the operator view.</p></section> : deck.items.length === 0 ? <section className="state-panel"><div className="empty-icon">—</div><h2>No Proposal-ready prospects yet</h2><p>When a Proposal passes packaging, it will appear here with its commercial context and engagement signals.</p></section> : <section className="deck-list" aria-label="Proposal-ready prospects">{deck.items.map((item) => <ProspectCard key={item.proposal.id} item={item} />)}</section>}
    <footer className="footer-note">Proposal preview is tracked through the existing public route. Sending and outreach remain deliberately outside M009.</footer>
  </main>;
}
