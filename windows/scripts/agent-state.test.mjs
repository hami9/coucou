import test from 'node:test';
import assert from 'node:assert/strict';
import { State } from '../src/core/state.ts';

test('incoming work replaces idle focus while preserving active work and alerts', () => {
  State.tasks = [];
  State.focusId = null;
  State.loadIntegrationTasks();
  State.view = 'overview';
  State.upsertExternalAgent('agent_codex', 'codex', '#fff');
  State.updateTask('agent_codex', 'thinking');
  State.focusActiveTask('agent_codex');
  assert.equal(State.focusId, 'agent_codex');
  assert.equal(State.effectiveState, 'thinking');

  State.upsertExternalAgent('agent_antigravity', 'antigravity', '#fff');
  State.updateTask('agent_antigravity', 'working');
  State.focusActiveTask('agent_antigravity');
  assert.equal(State.focusId, 'agent_codex');

  State.updateTask('agent_codex', 'finished');
  State.isPinned = true;
  State.focusActiveTask('agent_antigravity');
  assert.equal(State.focusId, 'agent_codex');
  State.isPinned = false;
  State.view = 'approval';
  State.focusActiveTask('agent_antigravity');
  assert.equal(State.focusId, 'agent_codex');

  State.view = 'overview';
  State.focusActiveTask('agent_antigravity');
  assert.equal(State.focusId, 'agent_antigravity');
  assert.equal(State.effectiveState, 'working');
});
