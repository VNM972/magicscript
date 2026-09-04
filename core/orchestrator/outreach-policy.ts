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
export function shouldAcceptFactCheckWithVerifiedDeploymentLink(
  modelApproved: boolean,
  reasons: readonly string[],
  persistedBody: string,
  deploymentUrl: string,
): boolean {
  if (!persistedBody.includes(deploymentUrl)) return false;
  if (modelApproved) return true;

  const meaningfulReasons = reasons.map((reason) => reason.trim()).filter(Boolean);
  return (
    meaningfulReasons.length > 0 &&
    meaningfulReasons.every(isDeploymentLinkFactCheckReason)
  );
}
