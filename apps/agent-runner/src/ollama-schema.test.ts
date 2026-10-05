import assert from 'node:assert/strict';
import test from 'node:test';

import { schemaForAgentJob } from './ollama-schema';

test('uses strict local schemas for prototype strategy and QA only', () => {
  const strategy = schemaForAgentJob('GENERATE_PROTOTYPE_STRATEGY');
  const qa = schemaForAgentJob('RUN_PROTOTYPE_QA');

  assert.equal(strategy?.type, 'object');
  assert.equal(strategy?.additionalProperties, false);
  assert.ok((strategy?.required as string[]).includes('factsAllowed'));
  assert.equal(qa?.type, 'object');
  assert.ok((qa?.required as string[]).includes('safeForOutreach'));
  assert.equal(schemaForAgentJob('BUILD_PROTOTYPE'), undefined);
});
