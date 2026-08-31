export const MAX_AUTOMATIC_OUTREACH_DRAFT_ATTEMPTS = 2;

export function shouldEscalateOutreachFactCheck(
  rejectedDraftCount: number,
): boolean {
  return rejectedDraftCount >= MAX_AUTOMATIC_OUTREACH_DRAFT_ATTEMPTS;
}
