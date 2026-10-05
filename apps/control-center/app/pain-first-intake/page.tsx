'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { MAX_HOMEPAGE_FETCHES_PER_QUERY, MAX_RESULTS_PER_QUERY, painFirstQueryPlans } from '../../../../core/research/pain-first-staging';
import { mapManualPainFirstSubmission } from './submission';
import type { PainFirstSearchCandidate } from '../../../../core/research/pain-first-staging';
import { inspectPainFirstCandidate } from './actions';
import type { PainFirstInspectDiagnostic } from './actions';

const plans = painFirstQueryPlans();

function CandidateInspection({ candidate }: { candidate: PainFirstSearchCandidate }) {
  const started = useRef(false);
  const [pending, setPending] = useState(false);
  const [diagnostic, setDiagnostic] = useState<PainFirstInspectDiagnostic | null>(null);
  async function inspect() {
    if (started.current) return;
    started.current = true;
    setPending(true);
    try { setDiagnostic(await inspectPainFirstCandidate(candidate)); }
    catch { setDiagnostic({ state: 'INSPECTION_FAILED' }); }
    finally { setPending(false); }
  }
  return <li>
    {candidate.conditionClass} · {candidate.resultPosition} · {candidate.resultUrl}
    {' '}<button type="button" disabled={pending || diagnostic !== null} onClick={inspect}>Inspect</button>
    <div aria-live="polite" aria-label="Résultat d’inspection">
      {pending && <p>Inspection en cours…</p>}
      {diagnostic && (diagnostic.state === 'INSPECTED' ? <dl>
        <dt>Transport</dt><dd>{diagnostic.observation.httpResultClass}</dd>
        <dt>Page</dt><dd>{diagnostic.pageState}</dd>
        <dt>Staging</dt><dd>{diagnostic.staging.state}</dd>
        <dt>Autorité</dt><dd>{diagnostic.staging.authority}</dd>
        {diagnostic.staging.queryConditionClass && <><dt>Condition recherchée</dt><dd>{diagnostic.staging.queryConditionClass}</dd></>}
        {diagnostic.staging.observedConditionClass && <><dt>Condition observée</dt><dd>{diagnostic.staging.observedConditionClass}</dd></>}
        {diagnostic.staging.conditionConsistency && <><dt>Cohérence</dt><dd>{diagnostic.staging.conditionConsistency}</dd></>}
        {diagnostic.observation.boundedTitle !== undefined && <><dt>Titre</dt><dd>{diagnostic.observation.boundedTitle}</dd></>}
        {diagnostic.observation.boundedH1?.map((heading, index) => <div key={index}><dt>H1</dt><dd>{heading}</dd></div>)}
        {diagnostic.identity && <>
          <dt>Identité initiale</dt><dd>{diagnostic.identity.initialIdentityState}</dd>
          <dt>Enrichissement de l’identité</dt><dd>{diagnostic.identity.enrichmentOutcome}</dd>
          {diagnostic.identity.identityPageTransportClass && <><dt>Transport page d’identité</dt><dd>{diagnostic.identity.identityPageTransportClass}</dd></>}
          {diagnostic.identity.identityPage && <><dt>Page d’identité</dt><dd>{diagnostic.identity.identityPage}</dd></>}
          <dt>Identité finale</dt><dd>{diagnostic.identity.identityState}</dd>
          <dt>Portée de l’identité</dt><dd>NON_CANONICAL · CANDIDATE FACTS</dd>
          {diagnostic.identity.siren && <><dt>SIREN</dt><dd>{diagnostic.identity.siren}</dd></>}
          {diagnostic.identity.siret && <><dt>SIRET</dt><dd>{diagnostic.identity.siret}</dd></>}
          {diagnostic.identity.operatorName && <><dt>Nom de l’entreprise</dt><dd>{diagnostic.identity.operatorName}</dd></>}
          {diagnostic.identity.municipality && <><dt>Commune</dt><dd>{diagnostic.identity.municipality}</dd></>}
          {diagnostic.identity.postcode && <><dt>Code postal</dt><dd>{diagnostic.identity.postcode}</dd></>}
          {diagnostic.identity.street && <><dt>Rue</dt><dd>{diagnostic.identity.street}</dd></>}
          {diagnostic.identity.streetNumber && <><dt>Numéro</dt><dd>{diagnostic.identity.streetNumber}</dd></>}
        </>}
      </dl> : <p>{diagnostic.state}{diagnostic.state === 'INVALID' ? ' · URL_REJECTED' : ''}</p>)}
    </div>
  </li>;
}

export default function ManualPainFirstIntakePage() {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReturnType<typeof mapManualPainFirstSubmission> | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(mapManualPainFirstSubmission(urls, new Date().toISOString()));
  }
  return <main className="deck-shell" style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
    <a href="/">Retour au Control Center</a>
    <h1>Intake manuel · Pain-first</h1>
    <p>Recherchez ces deux requêtes dans votre navigateur, puis collez les URL candidates ci-dessous, une par ligne.</p>
    <p>La validation est locale. Après un clic explicite, Inspect consulte l’accueil choisi et peut consulter une seule page d’identité explicitement liée sur le même site si une douleur est confirmée et l’identité incomplète. Aucun prospect créé.</p>
    <p>Une URL saisie ne prouve ni identité, ni propriété du site, ni douleur digitale, ni admission.</p>
    <form onSubmit={submit}>
      {plans.map((plan) => <section className="operator-panel" key={plan.planId} style={{ margin: '20px 0', padding: 20 }}>
        <h2>{plan.conditionClass === 'SITE_UNDER_CONSTRUCTION' ? 'Site en construction' : 'Site en cours de refonte'}</h2>
        <p><strong>{plan.query}</strong></p>
        <label htmlFor={plan.conditionClass}>URL candidates · maximum {MAX_RESULTS_PER_QUERY}</label>
        <textarea id={plan.conditionClass} value={urls[plan.conditionClass] ?? ''} rows={8}
          style={{ display: 'block', width: '100%', marginTop: 8 }}
          onChange={(event) => { setUrls({ ...urls, [plan.conditionClass]: event.target.value }); setResult(null); }} />
      </section>)}
      <button type="submit">Valider et normaliser les URL</button>
    </form>
    <p>Les rejets et doublons comptent dans la limite de dix. Aucun remplacement automatique.</p>
    <p>Inspect : une page d’accueil par clic, sans relance ni candidat suivant automatique. Limite du parcours : {MAX_HOMEPAGE_FETCHES_PER_QUERY} par condition.</p>
    {result && <section aria-live="polite" aria-label="Résultat de validation">
      <h2>ACCEPTED : {result.acceptedCount} · REJECTED : {result.rejectedCount}</h2>
      {plans.map((plan) => <p key={plan.planId}>{plan.query} — ACCEPTED : {result.candidates.filter((item) => item.conditionClass === plan.conditionClass).length}
        {' · REJECTED : '}{result.rejections.filter((item) => item.conditionClass === plan.conditionClass).length}</p>)}
      <ul>{result.candidates.map((candidate) => <CandidateInspection
        key={`${candidate.providerRunId}:${candidate.resultUrl}`} candidate={candidate} />)}</ul>
      <ul>{result.rejections.map((rejection) => <li key={`${rejection.conditionClass}:${rejection.resultPosition}`}>
        {rejection.conditionClass} · {rejection.resultPosition} · {rejection.reason}
      </li>)}</ul>
      <p>Candidats conservés uniquement dans cette page. Une nouvelle validation remplace le résultat courant.</p>
      <details><summary>Objets candidats · autorité NONE</summary>
        <pre style={{ overflowX: 'auto' }}>{JSON.stringify(result.candidates, null, 2)}</pre>
      </details>
    </section>}
  </main>;
}
