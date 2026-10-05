import DeckHeader from '../../../components/DeckHeader';
import CopilotSheet, { type CopilotContext } from '../../../components/CopilotSheet';
import { getProposalDeck, getProspectInventory } from '../../../lib/deck';

export const dynamic = 'force-dynamic';

async function getBusinessContext(id: string): Promise<{ context: CopilotContext; sourceUrl: string | null; error?: string }> {
  const context: CopilotContext = { primaryFriction: '', primaryAsset: '', opportunity: '', primaryCta: '' };
  const production = process.env.NODE_ENV === 'production';
  const base = (process.env.MAGICSCRIPT_API_BASE_URL || (production ? '' : 'http://127.0.0.1:8787')).replace(/\/$/, '');
  try {
    if (!base) throw new Error('API non configurée');
    const headers = new Headers();
    const token = process.env.MAGICSCRIPT_API_TOKEN || (production ? undefined : 'dev-api-token');
    if (token) headers.set('authorization', `Bearer ${token}`);
    const response = await fetch(`${base}/api/prospects/${encodeURIComponent(id)}`, { headers, cache: 'no-store' });
    if (!response.ok) throw new Error('Contexte indisponible');
    const { prospect } = await response.json() as { prospect?: Record<string, unknown> };
    if (!prospect || prospect.id !== id) throw new Error('Prospect invalide');
    for (const key of Object.keys(context) as Array<keyof CopilotContext>) {
      context[key] = typeof prospect[key] === 'string' ? prospect[key] : '';
    }
    return { context, sourceUrl: typeof prospect.sourceUrl === 'string' ? prospect.sourceUrl : null };
  } catch {
    return { context, sourceUrl: null, error: 'Le contexte D1 est momentanément indisponible. Vos saisies locales restent accessibles.' };
  }
}

export default async function CopilotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inventory = await getProspectInventory();
  const prospect = inventory.items.find((candidate) => candidate.prospectId === id);
  const [deck, business] = prospect
    ? await Promise.all([getProposalDeck(), getBusinessContext(id)])
    : [null, null];
  const item = prospect ? { ...prospect, ...deck?.items.find((candidate) => candidate.prospectId === id) } : null;

  return <main className="deck-shell">
    <DeckHeader />
    {inventory.error ? <div className="state-panel error" role="alert"><h1>Inventaire indisponible</h1><p>{inventory.error}</p></div>
      : !item || !business ? <div className="state-panel"><h1>Prospect non disponible</h1><p>Aucun prospect non exclu ne correspond à cet identifiant.</p><a href="/prospects">Tous les prospects</a></div>
      : <CopilotSheet key={id} prospect={item} initialContext={business.context} sourceUrl={business.sourceUrl} dataError={business.error || deck?.error} />}
  </main>;
}
