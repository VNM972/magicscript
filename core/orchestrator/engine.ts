import type { MagicScriptConfig } from '../config';
import type { EventStore } from '../events/event-store';
import type { JobKind, JobQueue } from '../jobs/types';
import type { ProspectRepository } from '../state/repository';
import type { MagicScriptEvent } from '../types/events';
import type { Prospect } from '../types/prospect';
import { resolveSwarmHub } from '../hubs/registry';
import { resolveBusinessUnitTeam } from '../hubs/team';
import {
  createOrchestratorJobHandoff,
  runBuHandoffPipeline,
  type BuHandoffPipelineResult,
  type BuHandoffRequest,
} from './bu-handoff-pipeline';
import { requiresHuman } from './escalation';
import { getNextAction, type NextAction } from './next-action';

export interface OrchestratorDependencies {
  config: MagicScriptConfig;
  prospects: ProspectRepository;
  events: EventStore;
  jobs: JobQueue;
  prototypeCostGate?: (
    prospectId: string,
  ) => Promise<'FULL' | 'LIGHT' | 'NONE' | null>;
  idFactory?: () => string;
  now?: () => Date;
}

export interface OrchestratorPlan {
  prospectId: string;
  state: Prospect['state'];
  nextAction: NextAction;
  queuedJobId?: string;
  humanRequired: boolean;
  reason?: string;
}

const actionToJob: Partial<Record<NextAction, JobKind>> = {
  RUN_RESEARCH_SWARM: 'RUN_RESEARCH_SWARM',
  RUN_SCORING: 'RUN_SCORING',
  DISCOVER_CONTACT: 'DISCOVER_CONTACT',
  VALIDATE_CONTACT: 'VALIDATE_CONTACT',
  GENERATE_OUTREACH: 'GENERATE_OUTREACH',
  FACT_CHECK_OUTREACH: 'FACT_CHECK_OUTREACH',
  SEND_EMAIL: 'SEND_EMAIL',
  SEND_FOLLOW_UP: 'SEND_FOLLOW_UP',
  CLASSIFY_REPLY: 'CLASSIFY_REPLY',
  BUILD_PROTOTYPE: 'BUILD_PROTOTYPE',
  RUN_PROTOTYPE_QA: 'RUN_PROTOTYPE_QA',
  DEPLOY_PROTOTYPE: 'DEPLOY_PROTOTYPE',
  SEND_DEMO_LINK: 'SEND_DEMO_LINK',
  ESCALATE_TO_HUMAN: 'ESCALATE_TO_HUMAN',
  GENERATE_PROTOTYPE_STRATEGY: 'GENERATE_PROTOTYPE_STRATEGY',
};

export class OrchestratorEngine {
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(private readonly deps: OrchestratorDependencies) {
    this.idFactory = deps.idFactory ?? (() => crypto.randomUUID());
    this.now = deps.now ?? (() => new Date());
  }

  async planProspect(prospectId: string): Promise<OrchestratorPlan> {
    const prospect = await this.deps.prospects.getProspect(prospectId);
    if (!prospect) throw new Error(`Prospect not found: ${prospectId}`);

    const nextAction = getNextAction(prospect.state);
    const humanRequired = requiresHuman(prospect.state);

    if (humanRequired) {
      const jobId = await this.enqueueAction(prospect, 'ESCALATE_TO_HUMAN');
      await this.record('orchestrator.human_escalation_planned', prospect.id, {
        state: prospect.state,
        jobId,
      });

      return {
        prospectId,
        state: prospect.state,
        nextAction: 'ESCALATE_TO_HUMAN',
        queuedJobId: jobId,
        humanRequired: true,
      };
    }

    if (!this.deps.config.autopilotEnabled) {
      return {
        prospectId,
        state: prospect.state,
        nextAction,
        humanRequired: false,
        reason: 'Autopilot disabled',
      };
    }

    if (
      (nextAction === 'SEND_EMAIL' ||
        nextAction === 'SEND_FOLLOW_UP' ||
        nextAction === 'SEND_DEMO_LINK') &&
      !this.deps.config.sendingEnabled
    ) {
      await this.record('orchestrator.send_blocked', prospect.id, {
        reason: 'Sending disabled',
      });

      return {
        prospectId,
        state: prospect.state,
        nextAction,
        humanRequired: false,
        reason: 'Sending disabled',
      };
    }

    if (
      nextAction === 'DEPLOY_PROTOTYPE' &&
      !this.deps.config.prototypeDeployEnabled
    ) {
      await this.record('orchestrator.deploy_blocked', prospect.id, {
        reason: 'Prototype deployment disabled',
      });

      return {
        prospectId,
        state: prospect.state,
        nextAction,
        humanRequired: false,
        reason: 'Prototype deployment disabled',
      };
    }

    let prototypeAuthorization: 'FULL' | 'LIGHT' | undefined;

    if (
      nextAction === 'GENERATE_PROTOTYPE_STRATEGY' ||
      nextAction === 'BUILD_PROTOTYPE'
    ) {
      const authorization =
        (await this.deps.prototypeCostGate?.(prospect.id)) ?? null;

      if (
        authorization !== 'FULL' &&
        authorization !== 'LIGHT'
      ) {
        const reason =
          authorization === 'NONE'
            ? 'Prototype Cost Gate blocked prototype work'
            : 'Prototype Cost Gate evaluation required';

        await this.record(
          'orchestrator.prototype_cost_gate_blocked',
          prospect.id,
          {
            action: nextAction,
            authorization: authorization ?? 'MISSING',
            reason,
          },
        );

        return {
          prospectId,
          state: prospect.state,
          nextAction,
          humanRequired: false,
          reason,
        };
      }

      prototypeAuthorization = authorization;
    }

    const jobKind = actionToJob[nextAction];
    if (!jobKind) {
      return {
        prospectId,
        state: prospect.state,
        nextAction,
        humanRequired: false,
      };
    }

    const jobId = await this.enqueueAction(
      prospect,
      nextAction,
      prototypeAuthorization,
    );

    await this.record('orchestrator.job_queued', prospect.id, {
      action: nextAction,
      jobId,
      jobKind,
    });

    return {
      prospectId,
      state: prospect.state,
      nextAction,
      queuedJobId: jobId,
      humanRequired: false,
    };
  }

  /**
   * Runs the control-plane BU -> master -> specialist -> verifier route.
   * This path is deterministic and has no contact, email, D1 or deployment
   * side effect; external work remains behind the normal job safeguards.
   */
  async runBuHandoff(
    prospectId: string,
    request: Omit<BuHandoffRequest, 'prospect'>,
  ): Promise<BuHandoffPipelineResult> {
    const prospect = await this.deps.prospects.getProspect(prospectId);
    if (!prospect) throw new Error(`Prospect not found: ${prospectId}`);

    const result = runBuHandoffPipeline({ ...request, prospect });
    await this.record(
      result.status === 'VERIFIED'
        ? 'orchestrator.bu_handoff_verified'
        : 'orchestrator.bu_handoff_rejected',
      prospect.id,
      {
        requestId: result.requestId,
        hubId: result.hub.id,
        businessUnit: result.hub.businessUnit,
        masterOfWork: result.hub.masterOfWork,
        specialistId: result.specialist.id,
        status: result.status,
        handoffId: result.handoff?.id ?? null,
      },
    );
    return result;
  }

  private async enqueueAction(
    prospect: Prospect,
    action: NextAction,
    prototypeAuthorization?: 'FULL' | 'LIGHT',
  ): Promise<string> {
    const kind = actionToJob[action];
    if (!kind) throw new Error(`No job mapping for action: ${action}`);

    const existing = (await this.deps.jobs.list()).find(
      (job) =>
        job.prospectId === prospect.id &&
        job.kind === kind &&
        (job.status === 'PENDING' ||
          job.status === 'RUNNING' ||
          (kind === 'ESCALATE_TO_HUMAN' && job.status === 'SUCCEEDED')),
    );

    if (existing) {
      return existing.id;
    }

    const now = this.now();
    const id = this.idFactory();
    const hub = resolveSwarmHub(prospect);
    const team = resolveBusinessUnitTeam(hub);
    const handoff = createOrchestratorJobHandoff({
      id,
      action,
      prospect,
    });

    await this.deps.jobs.enqueue({
      id,
      kind,
      prospectId: prospect.id,
      payload: {
        state: prospect.state,
        hubId: hub.id,
        businessUnit: team.businessUnit,
        masterOfWork: team.masterOfWork,
        specialistId: team.specialists[0]?.id,
        handoff,
        ...(prototypeAuthorization
          ? { prototypeAuthorization }
          : {}),
      },
      maxAttempts: 3,
      runAfter: now.toISOString(),
    });

    return id;
  }

  private async record(
    type: string,
    prospectId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const event: MagicScriptEvent = {
      id: this.idFactory(),
      prospectId,
      actor: 'orchestrator',
      type,
      payload,
      createdAt: this.now().toISOString(),
    };

    await this.deps.events.append(event);
  }
}
