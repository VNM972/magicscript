import { intakeManualPainFirstUrls } from '../../../../core/research/manual-pain-first-intake';
import { painFirstQueryPlans } from '../../../../core/research/pain-first-staging';

/** Fixed form fields bind to the R55 plans; operator text supplies URLs only. */
export function mapManualPainFirstSubmission(urlsByCondition: Readonly<Record<string, string>>, acquiredAt: string) {
  return intakeManualPainFirstUrls(painFirstQueryPlans().map((plan) => ({
    conditionClass: plan.conditionClass, urlsText: urlsByCondition[plan.conditionClass] ?? '',
  })), acquiredAt);
}
