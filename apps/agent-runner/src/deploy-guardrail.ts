/**
 * Fixture guardrail Netlify : refuse tout deploiement dont le nom de
 * prospect ressemble a une fixture de test ou un fixture interne.
 *
 * Raison : SNEMM etait une fixture synthetique qui a cause un deploiement
 * accidentel. Le garde-fou empeche que ca recommence pour n'importe quelle
 * fixture (TEST, DEMO, FIXTURE, SYNTHETIC, SAMPLE, MOCK, EXAMPLE).
 */
export const NETLIFY_DEPLOY_FIXTURE_BLOCKLIST = [
  'SNEMM', 'FIXTURE', 'SYNTHETIC', 'DEMO', 'TEST', 'SAMPLE', 'MOCK', 'EXAMPLE',
] as const;

export const isFixtureOrInternalName = (name: string | null | undefined): boolean => {
  const upper = (name ?? '').trim().toUpperCase();
  if (!upper) return true;
  return NETLIFY_DEPLOY_FIXTURE_BLOCKLIST.some((token) => upper.includes(token));
};
