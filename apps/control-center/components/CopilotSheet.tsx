'use client';

import { useEffect, useState } from 'react';
import type { ProspectInventoryItem } from '../lib/deck';
import { displayStage } from '../lib/deck-display';
import styles from './CopilotSheet.module.css';

export type CopilotContext = { primaryFriction: string; primaryAsset: string; opportunity: string; primaryCta: string };
type Props = { prospect: ProspectInventoryItem; initialContext: CopilotContext; sourceUrl: string | null; dataError?: string };
const contextFields = [
  ['primaryFriction', 'Friction digitale principale', true],
  ['primaryAsset', 'Actif commercial principal', true],
  ['opportunity', 'Opportunité (A/B/C/D)', false],
  ['primaryCta', 'CTA principal', false],
] as const;

function publicUrl(value: string | null | undefined): string | undefined {
  try { const url = new URL(value || ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}

function parisDate(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Non documenté';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function CopilotSheet({ prospect, initialContext, sourceUrl, dataError }: Props) {
  const [context, setContext] = useState(initialContext);
  const [manualFields, setManualFields] = useState<Partial<CopilotContext>>({});
  const [notes, setNotes] = useState('');
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const contextKey = `copilot-context-${prospect.prospectId}`;
  const notesKey = `copilot-notes-${prospect.prospectId}`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(contextKey);
      if (stored) {
        try {
          const parsed: unknown = JSON.parse(stored);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Contexte invalide');
          const saved: Partial<CopilotContext> = {};
          for (const [key] of contextFields) {
            const value = (parsed as Record<string, unknown>)[key];
            if (typeof value === 'string') saved[key] = value;
          }
          setContext({ ...initialContext, ...saved });
          setManualFields(saved);
        } catch { setStorageError('Le contexte local est illisible. Les valeurs D1 sont affichées ; une nouvelle saisie remplacera le contexte local.'); }
      }
      setNotes(window.localStorage.getItem(notesKey) ?? '');
    } catch { setStorageError('Le stockage local est indisponible. Vos saisies ne seront pas conservées après rechargement.'); }
    setReady(true);
  }, [contextKey, notesKey, initialContext]);

  function updateContext(key: keyof CopilotContext, value: string) {
    setContext((current) => ({ ...current, [key]: value }));
    const saved = { ...manualFields, [key]: value };
    try {
      window.localStorage.setItem(contextKey, JSON.stringify(saved));
      setManualFields(saved);
      setStorageError(null);
    } catch { setStorageError('Contexte non sauvegardé : le stockage local est indisponible ou plein.'); }
  }

  function updateNotes(value: string) {
    setNotes(value);
    try { window.localStorage.setItem(notesKey, value); setStorageError(null); }
    catch { setStorageError('Notes non sauvegardées : le stockage local est indisponible ou plein.'); }
  }

  function clearNotes() {
    if (!window.confirm('Effacer définitivement les notes de cet appel sur ce navigateur ?')) return;
    try { window.localStorage.removeItem(notesKey); setNotes(''); setStorageError(null); }
    catch { setStorageError('Impossible d’effacer les notes sauvegardées.'); }
  }

  const demo = publicUrl(prospect.entry_source === 'MANUAL' && prospect.demo_ready ? prospect.demo_url : prospect.proposalUrl);
  const source = publicUrl(sourceUrl);
  const instagram = publicUrl(prospect.instagram);
  const lastAction = prospect.latestMeaningfulAction || (prospect.outreach?.status === 'CONTACTED'
    ? `Contact enregistré · ${prospect.outreach.channel === 'EMAIL' ? 'Email' : prospect.outreach.channel === 'MOBILE' ? 'Téléphone' : 'Canal non documenté'} · ${parisDate(prospect.outreach.contactedAt)}` : 'Non documenté');

  return <div className={styles.sheet}>
    <a className="back-link" href={`/prospects/${encodeURIComponent(prospect.prospectId)}`}>← Fiche prospect</a>
    <div className={styles.heading}><div><p className="overline">Copilot · Préparation d’appel</p><h1>Votre fiche d’appui</h1></div><span className={styles.badge}>V1 · Saisie locale</span></div>
    {dataError && <p className={styles.warning} role="status">{dataError}</p>}
    {storageError && <p className={styles.warning} role="alert">{storageError}</p>}

    <section className={styles.section} aria-labelledby="copilot-profile">
      <p className={styles.step}>01 · Profil prospect</p>
      <h2 id="copilot-profile">{prospect.businessName || 'Non documenté'}</h2>
      <div className={styles.profile}><span>{prospect.vertical || 'Non documenté'}</span><span>{prospect.location || 'Non documenté'}</span><span className={styles.badge}>{displayStage(prospect.commercialStage)}</span><span className={styles.badge}>{prospect.entry_source === 'MANUAL' ? 'MANUAL' : 'V2'}</span></div>
      <div className={styles.contacts}>
        <span>📞 {prospect.contactability.mobile ? <a href={`tel:${prospect.contactability.mobile}`}>{prospect.contactability.mobile}</a> : 'Non documenté'}</span>
        <span>✉️ {prospect.contactability.email ? <a href={`mailto:${encodeURIComponent(prospect.contactability.email)}`}>{prospect.contactability.email}</a> : 'Non documenté'}</span>
        <span>📸 {instagram ? <a href={instagram} target="_blank" rel="noopener noreferrer">Instagram ↗</a> : 'Non documenté'}</span>
      </div>
      <dl className={styles.status}><div><dt>Statut actuel</dt><dd>{prospect.currentMeaningfulState || 'Non documenté'}</dd></div><div><dt>Dernière action commerciale</dt><dd>{lastAction}</dd></div></dl>
    </section>

    <section className={styles.section} aria-labelledby="copilot-context">
      <p className={styles.step}>02 · Contexte business</p><h2 id="copilot-context">Les points à garder en tête</h2>
      <p className={styles.hint}>Complétez ou ajustez le contexte. Vos modifications sont conservées sur ce navigateur.</p>
      <div className={styles.fields}>{contextFields.map(([key, label, multiline]) => <div className={styles.field} key={key}>
        <label htmlFor={`copilot-${key}`}>{label}{Object.hasOwn(manualFields, key) && <span className={styles.manual}><span aria-hidden="true">●</span> édité manuellement</span>}</label>
        {multiline ? <textarea id={`copilot-${key}`} rows={3} value={context[key]} placeholder="Non documenté" disabled={!ready} onChange={(event) => updateContext(key, event.target.value)} />
          : <input id={`copilot-${key}`} className={key === 'opportunity' ? styles.shortInput : undefined} value={context[key]} placeholder="Non documenté" disabled={!ready} onChange={(event) => updateContext(key, event.target.value)} />}
      </div>)}</div>
      <p className={styles.source}>Source publique : {source ? <a href={source} target="_blank" rel="noopener noreferrer">{source} ↗</a> : 'Non documenté'}</p>
    </section>

    <section className={styles.section} aria-labelledby="copilot-demo">
      <p className={styles.step}>03 · Site démo à présenter</p><h2 id="copilot-demo">Faire découvrir le site</h2>
      {demo ? <a className={`open-action ${styles.demo}`} href={demo} target="_blank" rel="noopener noreferrer">Ouvrir le site démo ↗</a> : <p className={styles.hint}>Non documenté</p>}
      <h3>Éléments à montrer en priorité</h3><ol><li>Le hero avec le slogan réel de l’entreprise</li><li>Le portfolio avec ses vraies photos</li><li>Le bouton de prise de rendez-vous en bas</li></ol>
    </section>

    <section className={styles.section} aria-labelledby="copilot-strategy">
      <p className={styles.step}>04 · Stratégie d’appel</p><h2 id="copilot-strategy">Une proposition claire</h2>
      <p className={styles.hint}>Trame V1 à ajuster par l’opérateur aux prestations et fonctionnalités effectivement proposées.</p>
      <div className={styles.offer}><h3>Offre recommandée · ESSENTIEL</h3><dl><div><dt>Création du site</dt><dd>1 190 € TTC</dd></div><div><dt>Hosting · Pack Sérénité</dt><dd>199 €/an</dd></div><div className={styles.total}><dt>Total année 1</dt><dd>1 389 € TTC</dd></div></dl></div>
      <h3>Arguments clés</h3><ul><li>Le site est déjà prêt, il n’y a qu’à le mettre en ligne</li><li>Récupération de l’audience Instagram comme actif propriétaire</li><li>Prise de rendez-vous intégrée (plus de DM à gérer manuellement)</li></ul>
      <h3>Objections probables + réponses</h3>
      <div className={styles.objections}>
        <div><h4>« C’est trop cher »</h4><p>→ C’est un investissement unique. Une seule nouvelle prestation payée par ce site rembourse l’investissement.</p></div>
        <div><h4>« Je n’ai pas besoin de site, Instagram me suffit »</h4><p>→ Instagram vous enferme dans leurs règles. Un site vous appartient et travaille pour vous 24h/24.</p></div>
        <div><h4>« Je vais réfléchir »</h4><p>→ Bien sûr. Est-ce que c’est le prix, le timing ou autre chose que vous voulez prendre le temps d’évaluer ?</p></div>
      </div>
    </section>

    <section className={styles.section} aria-labelledby="copilot-notes">
      <p className={styles.step}>05 · Notes live</p><h2 id="copilot-notes">Pendant l’appel</h2>
      <label className="sr-only" htmlFor="copilot-notes-input">Notes pendant l’appel</label>
      <textarea className={styles.notes} id="copilot-notes-input" rows={9} placeholder="Notes pendant l’appel…" value={notes} disabled={!ready} onChange={(event) => updateNotes(event.target.value)} />
      <div className={styles.notesFooter}><p className={styles.hint}>Sauvegarde automatique sur ce navigateur.</p><button type="button" disabled={!ready} onClick={clearNotes}>Effacer les notes</button></div>
    </section>
  </div>;
}
