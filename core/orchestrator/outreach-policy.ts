export const MAX_AUTOMATIC_OUTREACH_DRAFT_ATTEMPTS = 2;

export function shouldEscalateOutreachFactCheck(
  rejectedDraftCount: number,
): boolean {
  return rejectedDraftCount >= MAX_AUTOMATIC_OUTREACH_DRAFT_ATTEMPTS;
}

function normalizedReason(reason: string): string {
  return reason.toLocaleLowerCase().replace(/[’]/g, "'");
}

/**
 * Identifies the narrow class of model reasons that can be checked
 * deterministically against the persisted outreach body.
 */
export function isDeploymentLinkFactCheckReason(reason: string): boolean {
  const normalized = normalizedReason(reason);
  const mentionsLink =
    /\b(?:prototype|deployment|deployed|demo|link|url|lien|adresse)\b/.test(normalized);
  const saysMissing =
    /(?:missing|omits?|absent|without|does not contain|doesn't contain|not include|ne contient pas|n'inclut pas|manque|sans)/.test(
      normalized,
    );

  return mentionsLink && saysMissing;
}

/**
 * Accepts a fact-check approval only when the persisted body contains the
 * exact verified deployment URL. It also repairs a local-model false
 * negative when the model's only reason is that this URL is missing.
 */
function hasOnlyDeploymentLinkFalseNegativeReasons(
  reasons: readonly string[],
): boolean {
  const meaningfulReasons = reasons.map((reason) => reason.trim()).filter(Boolean);
  return (
    meaningfulReasons.length > 0 &&
    meaningfulReasons.every(isDeploymentLinkFactCheckReason)
  );
}

export function isVerifiedDeploymentLinkFalseNegative(
  modelApproved: boolean,
  reasons: readonly string[],
  persistedBody: string,
  deploymentUrl: string,
): boolean {
  let normalizedDeploymentUrl: string;
  try {
    normalizedDeploymentUrl = new URL(deploymentUrl).toString();
  } catch {
    return false;
  }

  return (
    !modelApproved &&
    persistedBody.includes(normalizedDeploymentUrl) &&
    hasOnlyDeploymentLinkFalseNegativeReasons(reasons)
  );
}

export function shouldAcceptFactCheckWithVerifiedDeploymentLink(
  modelApproved: boolean,
  reasons: readonly string[],
  persistedBody: string,
  deploymentUrl: string,
): boolean {
  let normalizedDeploymentUrl: string;
  try {
    normalizedDeploymentUrl = new URL(deploymentUrl).toString();
  } catch {
    return false;
  }

  if (!persistedBody.includes(normalizedDeploymentUrl)) return false;
  if (modelApproved) return true;

  return hasOnlyDeploymentLinkFalseNegativeReasons(reasons);
}

/**
 * Keeps the normal confidence gate, except for the deterministic repair above:
 * only confidence attributed to the disproven missing-link assertion is removed.
 */
export function meetsOutreachFactCheckConfidence(
  confidence: number,
  minimumConfidence: number,
  repairedMissingLinkFalseNegative: boolean,
): boolean {
  return repairedMissingLinkFalseNegative || confidence >= minimumConfidence;
}
