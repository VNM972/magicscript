export interface FounderEscalationPresentation {
  title: string;
  summary: string;
  technicalDetails: string;
}

function escalationReason(summary: string): string | undefined {
  return summary
    .match(/\| Reason: ([\s\S]*?)(?: \| Recommended action:|$)/)?.[1]
    ?.trim();
}

export function founderEscalationPresentation(
  rawSummary: string,
): FounderEscalationPresentation {
  const reason = escalationReason(rawSummary);
  if (!reason) {
    return {
      title: 'Traitement interrompu',
      summary: "Le traitement technique n'a pas abouti.",
      technicalDetails: rawSummary,
    };
  }

  if (reason.includes('Web Design review is missing or malformed')) {
    return {
      title: 'Prototype bloqué',
      summary: 'La validation Web Design doit être reprise avant de poursuivre.',
      technicalDetails: rawSummary,
    };
  }
  if (reason.includes('primary CTA') && reason.includes('is not visible')) {
    return {
      title: 'Prototype bloqué',
      summary: 'Le CTA principal doit être corrigé avant de poursuivre.',
      technicalDetails: rawSummary,
    };
  }
  if (
    reason.includes('Automation job BUILD_PROTOTYPE') ||
    reason.includes('Prototype build failed') ||
    reason.includes('Aider timed out') ||
    reason.includes('Aider exited with code') ||
    reason.includes('Runner shutdown requested')
  ) {
    return {
      title: 'Prototype bloqué',
      summary: 'Le build ou la génération du prototype doit être repris.',
      technicalDetails: rawSummary,
    };
  }

  return {
    title: 'Action à examiner',
    summary: "Le traitement technique n'a pas abouti.",
    technicalDetails: rawSummary,
  };
}
