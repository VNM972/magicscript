import type { ProspectSummary } from './api';

export type DeckCommercialStage = 'A_CONTACTER' | 'ENVOYES' | 'EN_ATTENTE' | 'RDV' | 'DEVIS' | 'RELANCES' | 'GAGNES' | 'PERDUS' | 'ARCHIVES';
export interface ProposalDeckItemV1 {
  prospectId: string;
  entry_source: 'V2_PIPELINE' | 'MANUAL';
  demo_url: string | null;
  demo_ready: boolean;
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

export type ProspectInventoryItem = Omit<ProposalDeckItemV1, 'engagement'> & { engagement?: ProposalDeckItemV1['engagement'] };
type InventoryProspect = ProspectSummary & {
  city?: string;
  primaryAsset?: string;
  primaryFriction?: string;
  entry_source: ProposalDeckItemV1['entry_source'];
  demo_url: string | null;
  demo_ready: boolean;
  commercialPipeline: Pick<ProposalDeckItemV1, 'commercialStage' | 'currentMeaningfulState' | 'activeSlot' | 'productionEligible' | 'latestMeaningfulAction' | 'nextMeaningfulOperatorAction'>;
};

const isProduction = process.env.NODE_ENV === 'production';
const apiBase = (process.env.MAGICSCRIPT_API_BASE_URL || (isProduction ? '' : 'http://127.0.0.1:8787')).replace(/\/$/, '');

export async function getProspectInventory(): Promise<{ items: ProspectInventoryItem[]; error?: string }> {
  try {
    if (!apiBase) throw new Error('API non configurée');
    const headers = new Headers();
    const token = process.env.MAGICSCRIPT_API_TOKEN || (isProduction ? undefined : 'dev-api-token');
    if (token) headers.set('authorization', `Bearer ${token}`);
    const response = await fetch(`${apiBase}/api/prospects`, { cache: 'no-store', headers });
    if (!response.ok) throw new Error('Inventaire indisponible');
    const payload = await response.json() as { prospects: InventoryProspect[] };
    if (!Array.isArray(payload.prospects)) throw new Error('Inventaire invalide');
    return { items: payload.prospects.map((prospect) => {
      const channels = prospect.contactability?.status === 'PUBLISHED_VERIFIED' ? prospect.contactability.channels : [];
      const email = channels.find((channel) => channel.type === 'EMAIL')?.value ?? null;
      const mobile = channels.find((channel) => channel.type === 'PHONE')?.value ?? null;
      return {
        prospectId: prospect.id, businessName: prospect.companyName,
        entry_source: prospect.entry_source, demo_url: prospect.demo_url, demo_ready: prospect.demo_ready,
        location: prospect.city ?? prospect.location ?? null, vertical: prospect.activity ?? null,
        opportunity: prospect.primaryAsset ?? null, friction: prospect.primaryFriction ?? null,
        ...prospect.commercialPipeline,
        contactability: { label: email && mobile ? 'Email + Mobile' : email ? 'Email' : mobile ? 'Mobile' : 'None', email, mobile },
      };
    }) };
  } catch {
    return { items: [], error: 'L’inventaire des prospects est momentanément indisponible.' };
  }
}

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
