export interface ProposalDeckItemV1 {
  prospectId: string;
  businessName: string;
  location: string | null;
  vertical: string | null;
  opportunity: string | null;
  friction: string | null;
  contactability: { label: 'Email' | 'Mobile' | 'Email + Mobile' | 'None'; email: string | null; mobile: string | null };
  proposal: { id: string; entryPath: string; readyAt: string };
  engagement: { viewed: boolean; returned: boolean; shared: boolean; meetingBooked: boolean; meetingAt: string | null };
  proposalUrl?: string;
  outreach?: { status: 'NOT_PREPARED' | 'READY_FOR_OPERATOR' | 'APPROVED' | 'CONTACTED'; channel: 'EMAIL' | 'MOBILE' | null; contactedAt: string | null };
}

const isProduction = process.env.NODE_ENV === 'production';
const apiBase = (process.env.MAGICSCRIPT_API_BASE_URL || (isProduction ? '' : 'http://127.0.0.1:8787')).replace(/\/$/, '');

export async function getProposalDeck(): Promise<{ items: ProposalDeckItemV1[]; error?: string }> {
  if (!apiBase) return { items: [], error: 'Deck API non configurée.' };
  try {
    const headers = new Headers();
    const token = process.env.MAGICSCRIPT_API_TOKEN || (isProduction ? undefined : 'dev-api-token');
    if (token) headers.set('authorization', `Bearer ${token}`);
    const response = await fetch(`${apiBase}/api/v2/deck`, { cache: 'no-store', headers });
    if (!response.ok) return { items: [], error: 'Le Deck est momentanément indisponible.' };
    const payload = await response.json() as { items?: ProposalDeckItemV1[] };
    const items = Array.isArray(payload.items) ? payload.items : [];
    return { items: items.map((item) => ({ ...item, proposalUrl: `${apiBase}${item.proposal.entryPath}` })) };
  } catch {
    return { items: [], error: 'Le Deck est momentanément indisponible.' };
  }
}
