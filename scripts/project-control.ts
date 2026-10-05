import process from 'node:process';

import {
  CANONICAL_PROJECT_STATE_PATH,
  captureMissionImplementationBinding,
  checkpointMission,
  completeMission,
  getCurrentMission,
  getNextAuthorizedMission,
  loadProjectState,
  missionAuthorizationReasons,
  recordReviewerPass,
  startMission,
  validateProjectState,
  writeProjectState,
} from '../core/project';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredFlag(name: string): string {
  const value = flag(name);
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function listFlag(name: string): string[] {
  return (flag(name) ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const state = await loadProjectState();

  if (command === 'validate') {
    const errors = validateProjectState(state);
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(`VALID ${CANONICAL_PROJECT_STATE_PATH} revision=${state.project.revision}`);
    return;
  }

  if (command === 'status') {
    console.log(`${state.project.name} ${state.project.version} revision=${state.project.revision}`);
    console.log(`phase=${state.project.phase}`);
    console.log(`current=${getCurrentMission(state)?.id ?? 'NONE'}`);
    console.log(`next=${getNextAuthorizedMission(state)?.id ?? 'NONE'}`);
    for (const mission of state.workPackages) {
      console.log(`${mission.id}\t${mission.status}\t${mission.classification}\t${mission.title}`);
    }
    return;
  }

  if (command === 'next') {
    const next = getNextAuthorizedMission(state);
    if (next) {
      console.log(`${next.id}\t${next.title}`);
      return;
    }
    console.log('NO_AUTHORIZED_MISSION');
    for (const mission of state.workPackages.filter((item) => item.status === 'READY')) {
      console.log(`${mission.id}: ${missionAuthorizationReasons(state, mission.id).join('; ')}`);
    }
    return;
  }

  if (command === 'review-pass') {
    const missionId = requiredFlag('mission');
    const currentImplementation = await captureMissionImplementationBinding(state, missionId);
    const updated = recordReviewerPass(state, {
      missionId,
      authority: requiredFlag('authority'),
      decision: requiredFlag('decision'),
      result: requiredFlag('result'),
      reviewedRevision: Number(requiredFlag('reviewed-revision')),
      reviewedCheckpointId: requiredFlag('reviewed-checkpoint'),
      reviewedImplementationFingerprint: requiredFlag('reviewed-implementation'),
      currentImplementation,
      at: requiredFlag('at'),
    });
    await writeProjectState(updated);
    console.log(
      `REVIEW_PASS ${missionId} checkpoint=${updated.checkpoints.at(-1)?.id} ` +
      `revision=${updated.project.revision} implementation=${currentImplementation.digest}`,
    );
    return;
  }

  if (command === 'checkpoint') {
    const missionId = flag('mission') ?? state.currentMissionId;
    if (!missionId) throw new Error('--mission is required when no mission is ACTIVE');
    const updated = checkpointMission(state, {
      missionId,
      stage: requiredFlag('stage'),
      at: requiredFlag('at'),
      summary: requiredFlag('summary'),
      filesChanged: listFlag('files'),
      tests: listFlag('tests'),
      unresolved: listFlag('unresolved'),
      nextAction: requiredFlag('next-action'),
    });
    await writeProjectState(updated);
    console.log(`CHECKPOINT ${updated.checkpoints.at(-1)?.id} revision=${updated.project.revision}`);
    return;
  }

  if (command === 'start') {
    const missionId = requiredFlag('mission');
    const updated = startMission(state, missionId, { at: requiredFlag('at') });
    await writeProjectState(updated);
    console.log(`START ${missionId} revision=${updated.project.revision}`);
    return;
  }

  if (command === 'complete') {
    const missionId = flag('mission') ?? state.currentMissionId;
    if (!missionId) throw new Error('--mission is required when no mission is ACTIVE');
    const updated = completeMission(state, missionId, { at: requiredFlag('at') });
    await writeProjectState(updated);
    console.log(`COMPLETE ${missionId} revision=${updated.project.revision}`);
    return;
  }

  throw new Error('Usage: project-control.ts <status|validate|next|review-pass|start|checkpoint|complete>');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
