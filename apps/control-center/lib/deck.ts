export type DeckCommercialStage = 'A_CONTACTER' | 'ENVOYES' | 'EN_ATTENTE' | 'RDV' | 'DEVIS' | 'RELANCES' | 'GAGNES' | 'PERDUS' | 'ARCHIVES';
export interface ProposalDeckItemV1 {
  prospectId: string;
  businessName: string;
  location: string | null;
  vertical: string | null;
  opportunity: string | null;
  friction: string | null;
  commercialStage: DeckCommercialStage | null;
  currentMeaningfulState: string | null;
  latestMeaningfulAction?: string;
  nextMeaningfulOperatorAction?: string;
  activeSlot: boolean;
  productionEligible: boolean;
  contactability: { label: 'Email' | 'Mobile' | 'Email + Mobile' | 'None'; email: string | null; mobile: string | null };
  proposal?: { id: string; entryPath: string; readyAt: string };
  engagement: { viewed: boolean; returned: boolean; shared: boolean; meetingBooked: boolean; meetingAt: string | null };
  proposalUrl?: string;
  outreach?: { status: 'NOT_PREPARED' | 'READY_FOR_OPERATOR' | 'APPROVED' | 'CONTACTED'; channel: 'EMAIL' | 'MOBILE' | null; contactedAt: string | null };
}

export interface DeckResponse { items: ProposalDeckItemV1[]; activeSlotCount: number; capacity: 20; error?: string }

const isProduction = process.env.NODE_ENV === 'production';
const apiBase = (process.env.MAGICSCRIPT_API_BASE_URL || (isProduction ? '' : 'http://127.0.0.1:8787')).replace(/\/$/, '');

export async function getProposalDeck(): Promise<DeckResponse> {
  if (!apiBase) return { items: [], activeSlotCount: 0, capacity: 20, error: 'Deck API non configurée.' };
  try {
    const headers = new Headers();
    const token = process.env.MAGICSCRIPT_API_TOKEN || (isProduction ? undefined : 'dev-api-token');
    if (token) headers.set('authorization', `Bearer ${token}`);
    const response = await fetch(`${apiBase}/api/v2/deck`, { cache: 'no-store', headers });
    if (!response.ok) return { items: [], activeSlotCount: 0, capacity: 20, error: 'Le Deck est momentanément indisponible.' };
    const payload = await response.json() as Partial<DeckResponse>;
    const items = Array.isArray(payload.items) ? payload.items : [];
    return { items: items.map((item) => ({ ...item, proposalUrl: item.proposal ? `${apiBase}${item.proposal.entryPath}` : undefined })), activeSlotCount: payload.activeSlotCount ?? 0, capacity: 20 };
  } catch {
    return { items: [], activeSlotCount: 0, capacity: 20, error: 'Le Deck est momentanément indisponible.' };
  }
}
