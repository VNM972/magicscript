import type { JobKind } from './types';

export const JOB_KIND_PRIORITY: Record<JobKind, number> = {
  ESCALATE_TO_HUMAN: 0,
  CLASSIFY_REPLY: 10,
  GENERATE_INFORMATION_RESPONSE: 20,
  FACT_CHECK_INFORMATION_RESPONSE: 30,
  SEND_INFORMATION_RESPONSE: 40,
  SEND_DEMO_LINK: 50,
  SEND_FOLLOW_UP: 60,
  SEND_EMAIL: 70,
  FACT_CHECK_OUTREACH: 80,
  GENERATE_OUTREACH: 90,
  DEPLOY_PROTOTYPE: 100,
  RUN_PROTOTYPE_QA: 110,
  BUILD_PROTOTYPE: 120,
  GENERATE_PROTOTYPE_STRATEGY: 130,
  VALIDATE_CONTACT: 140,
  DISCOVER_CONTACT: 150,
  RUN_SCORING: 160,
  RUN_RESEARCH_SWARM: 170,
  DISCOVER_PROSPECTS: 180,
};

export function jobKindPriority(kind: JobKind): number {
  return JOB_KIND_PRIORITY[kind];
}

export function jobKindPrioritySql(column = 'kind'): string {
  const clauses = Object.entries(JOB_KIND_PRIORITY)
    .map(([kind, priority]) => `WHEN '${kind}' THEN ${priority}`)
    .join(' ');

  return `CASE ${column} ${clauses} ELSE 999 END`;
}
