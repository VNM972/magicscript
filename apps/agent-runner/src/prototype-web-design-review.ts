export interface DeterministicWebDesignReview {
  status: 'PASS' | 'PASS_WITH_NOTES' | 'BLOCKED';
  owner: string;
  verifier: string;
  checks: readonly string[];
  blockers?: readonly string[];
  notes?: readonly string[];
  checkedAt: string;
}

export function buildDeterministicWebDesignReview(input: {
  buildPassed: boolean;
  blockingFindings: readonly string[];
  qaSchemaIsValid: boolean;
  checkedAt?: string;
}): DeterministicWebDesignReview {
  const blockers = [...input.blockingFindings];
  if (!input.qaSchemaIsValid) {
    blockers.push(
      'QA agent schema is invalid; the Web Design composition review is unavailable.',
    );
  }

  const status = input.buildPassed && blockers.length === 0 ? 'PASS' : 'BLOCKED';

  return {
    status,
    owner: 'BU Web Design',
    verifier: 'runner-deterministic-web-design-v2',
    checks: [
      'technical-build',
      'canonical-sales-room-conversion',
      'no-local-commercial-form',
      'no-direct-commercial-write-endpoint',
      'verified-source-navigation',
      'no-mailto-contact-path',
      'selected-design-direction-composition',
      'anti-slop-visual-hierarchy-and-rhythm',
    ],
    ...(blockers.length > 0 ? { blockers } : {}),
    checkedAt: input.checkedAt ?? new Date().toISOString(),
  };
}
