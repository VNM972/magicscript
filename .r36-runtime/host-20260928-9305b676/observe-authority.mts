import { readFile, writeFile } from 'node:fs/promises';
import { researchScoredAuthority } from '../../core/admission/persisted-agent1-evidence.ts';
const root = process.env.R36_ROOT!;
const state = JSON.parse(await readFile(`${root}/final-d1-reconciliation.json`, 'utf8'));
const observed = state.prospects.map((prospect: any) => {
  const scored = state.events.filter((e: any) => e.prospect_id === prospect.id && e.type === 'research.scored').sort((a: any,b: any) => b.created_at.localeCompare(a.created_at))[0];
  const researchJob = state.jobs.find((j: any) => j.prospect_id === prospect.id && j.kind === 'RUN_RESEARCH_SWARM');
  if (!scored) return { prospectId: prospect.id, business: prospect.company_name, researchStatus: researchJob?.status, scoredPresent: false };
  const payload = JSON.parse(scored.payload_json);
  const authority = researchScoredAuthority(payload);
  return { prospectId: prospect.id, business: prospect.company_name, siren: prospect.siren, siret: prospect.siret, activity: prospect.activity, researchStatus: researchJob?.status, researchAttempts: researchJob?.attempts, scoredPresent: true, evidenceIntegrity: payload.evidenceIntegrity, typedPainPersisted: payload.digitalPainEvidence, authority, qualificationState: prospect.state, score: prospect.score };
});
await writeFile(`${root}/research-authority-observations.json`, JSON.stringify(observed, null, 2));
console.log(JSON.stringify(observed.map((o: any) => ({ business: o.business, scoredPresent: o.scoredPresent, integrityPass: o.authority?.evidenceIntegrityPassed, digitalPain: o.authority?.digitalPainEvidence, operatingEvidence: o.authority?.operatingEvidence, state: o.qualificationState, acceptedSourceCount: o.authority?.acceptedSources?.length })), null, 2));
