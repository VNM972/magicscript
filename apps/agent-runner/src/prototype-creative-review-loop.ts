export type SyntheticCreativeFindingSeverity = 'BLOCKER' | 'NOTE';

export interface SyntheticCreativeFinding {
  code: string;
  severity: SyntheticCreativeFindingSeverity;
  message: string;
}

export interface SyntheticCreativeReviewContract<TArtifact> {
  contractVersion: 'synthetic-creative-review-v1';
  mode: 'LOCAL_SYNTHETIC';
  status: 'PASS' | 'PASS_WITH_NOTES' | 'BLOCKED' | 'EXHAUSTED';
  iterations: number;
  maxIterations: number;
  artifact: TArtifact;
  findings: readonly SyntheticCreativeFinding[];
  compliance: {
    passed: boolean;
    blockers: readonly string[];
  };
  factsFingerprint: string;
  externalActions: readonly [];
}

export interface SyntheticCreativeReviewLoopInput<TArtifact> {
  artifact: TArtifact;
  facts: readonly string[];
  maxIterations?: number;
  compliance: {
    passed: boolean;
    blockers?: readonly string[];
  };
  review: (artifact: TArtifact, iteration: number) => readonly SyntheticCreativeFinding[];
  rework: (
    artifact: TArtifact,
    findings: readonly SyntheticCreativeFinding[],
    iteration: number,
  ) => TArtifact;
}

function fingerprintFacts(facts: readonly string[]): string {
  // A stable, local-only fingerprint makes accidental fact mutation observable
  // without introducing a provider, network call, or invented source data.
  return JSON.stringify([...facts]);
}

export function runSyntheticCreativeReviewLoop<TArtifact>(
  input: SyntheticCreativeReviewLoopInput<TArtifact>,
): SyntheticCreativeReviewContract<TArtifact> {
  const maxIterations = Math.max(1, Math.min(3, Math.trunc(input.maxIterations ?? 2)));
  const factsFingerprint = fingerprintFacts(input.facts);
  const complianceBlockers = [...(input.compliance.blockers ?? [])];

  if (!input.compliance.passed || complianceBlockers.length > 0) {
    return {
      contractVersion: 'synthetic-creative-review-v1',
      mode: 'LOCAL_SYNTHETIC',
      status: 'BLOCKED',
      iterations: 0,
      maxIterations,
      artifact: input.artifact,
      findings: [],
      compliance: { passed: false, blockers: complianceBlockers },
      factsFingerprint,
      externalActions: [],
    };
  }

  let artifact = input.artifact;
  let findings: readonly SyntheticCreativeFinding[] = [];
  let iterations = 0;

  while (iterations < maxIterations) {
    findings = [...input.review(artifact, iterations + 1)];
    iterations += 1;
    const blockers = findings.filter((finding) => finding.severity === 'BLOCKER');
    if (blockers.length === 0) {
      return {
        contractVersion: 'synthetic-creative-review-v1',
        mode: 'LOCAL_SYNTHETIC',
        status: findings.length > 0 ? 'PASS_WITH_NOTES' : 'PASS',
        iterations,
        maxIterations,
        artifact,
        findings,
        compliance: { passed: true, blockers: [] },
        factsFingerprint,
        externalActions: [],
      };
    }
    if (iterations < maxIterations) {
      artifact = input.rework(artifact, blockers, iterations);
      if (fingerprintFacts(input.facts) !== factsFingerprint) {
        throw new Error('Synthetic creative rework changed protected facts.');
      }
    }
  }

  return {
    contractVersion: 'synthetic-creative-review-v1',
    mode: 'LOCAL_SYNTHETIC',
    status: 'EXHAUSTED',
    iterations,
    maxIterations,
    artifact,
    findings,
    compliance: { passed: true, blockers: [] },
    factsFingerprint,
    externalActions: [],
  };
}
