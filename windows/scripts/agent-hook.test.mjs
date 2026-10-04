import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeEvent } from './agent-hook.mjs';

test('Antigravity IDE is identified without reading its transcript', () => {
  const result = normalizeEvent('antigravity', 'PreToolUse', {
    conversationId: 'ide-session',
    transcriptPath: 'C:\\users\\person\\.gemini\\antigravity-ide\\brain\\id\\transcript.jsonl',
    workspacePaths: ['C:/project'],
    toolCall: { name: 'run_command', args: { CommandLine: 'npm test' } },
  });
  assert.equal(result.coucou_agent, 'antigravity-ide');
  assert.equal(result.session_id, 'ide-session');
  assert.equal(result.tool_input.command, 'npm test');
  assert.equal(result.cwd, 'C:/project');
  assert.equal('transcriptPath' in result, false);
});

test('background work is not reported as finished and errors stay distinct', () => {
  const payload = { conversationId: 'regular', fullyIdle: false };
  assert.equal(normalizeEvent('antigravity', 'Stop', payload).hook_event_name, 'PostToolUse');
  assert.equal(normalizeEvent('antigravity', 'Stop', { ...payload, fullyIdle: true }).hook_event_name, 'Stop');
  assert.equal(normalizeEvent('antigravity', 'Stop', { ...payload, error: 'failed' }).hook_event_name, 'StopFailure');
  assert.equal(normalizeEvent('antigravity', 'PreInvocation', payload).coucou_agent, 'antigravity');
});

test('Codex events retain their session, and invalid input is ignored', () => {
  assert.equal(normalizeEvent('codex', 'Interrupt', { session_id: 'codex-session' }).hook_event_name, 'SessionEnd');
  assert.equal(normalizeEvent('codex', 'Stop', { session_id: 'codex-session' }).session_id, 'codex-session');
  assert.equal(normalizeEvent('antigravity', 'unknown', { conversationId: 'session' }), null);
  assert.equal(normalizeEvent('codex', 'Stop', {}), null);
});

test('malformed stdin exits silently without making a decision', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./agent-hook.mjs', import.meta.url)), 'codex', 'Stop'], {
    input: '{invalid', encoding: 'utf8', windowsHide: true, timeout: 3000,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('installer preserves foreign hooks and settings, backs up, and is idempotent', { skip: process.platform !== 'win32' }, () => {
  const base = mkdtempSync(join(process.env.TEMP, 'coucou-hook-check-'));
  const user = join(base, 'user with spaces');
  const local = join(base, 'local with spaces');
  const foreign = { hooks: [{ type: 'command', command: 'existing-tool' }] };
  const originals = [
    [join(user, '.claude', 'settings.json'), { model: 'unchanged', hooks: { PreToolUse: [foreign] } }],
    [join(user, '.codex', 'hooks.json'), { hooks: { Stop: [foreign] } }],
    [join(user, '.gemini', 'config', 'hooks.json'), { existing: { enabled: false, Stop: [{ command: 'existing-tool' }] } }],
  ];
  for (const [path, value] of originals) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value));
  }
  const bin = join(local, 'Coucou', 'bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'coucou-hook.exe'), 'installer existence fixture');
  const installer = fileURLToPath(new URL('./install-hooks.mjs', import.meta.url));
  const env = { ...process.env, USERPROFILE: user, LOCALAPPDATA: local, CODEX_HOME: join(user, '.codex') };
  const run = args => spawnSync(process.execPath, [installer, ...args], { env, encoding: 'utf8', windowsHide: true });
  assert.equal(run([]).status, 0);
  for (const [path, value] of originals) assert.equal(readFileSync(path, 'utf8'), JSON.stringify(value));
  assert.equal(run(['--apply']).status, 0);
  const after = originals.map(([path]) => JSON.parse(readFileSync(path, 'utf8')));
  assert.equal(after[0].model, 'unchanged');
  assert.deepEqual(after[0].hooks.PreToolUse[0], foreign);
  assert.deepEqual(after[1].hooks.Stop[0], foreign);
  assert.deepEqual(after[2].existing, originals[2][1].existing);
  for (const [path, value] of originals) {
    const backup = readdirSync(dirname(path)).find(name => name.startsWith(path.split(/[\\/]/).at(-1) + '.coucou-backup-'));
    assert.ok(backup);
    assert.equal(readFileSync(join(dirname(path), backup), 'utf8'), JSON.stringify(value));
  }
  assert.equal(run(['--apply']).status, 0);
  originals.forEach(([path], i) => assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), after[i]));

  // Reproduce the host's whitespace splitting from its configuration directory.
  const googlePath = originals[2][0];
  const legacy = structuredClone(after[2]);
  for (const event of ['PreInvocation', 'PostInvocation', 'PreToolUse', 'PostToolUse', 'Stop']) {
    const entry = legacy.coucou[event][0];
    const handler = entry.hooks?.[0] ?? entry;
    handler.command = `node "${join(bin, 'agent-hook.mjs').replaceAll('\\', '/')}" antigravity ${event}`;
    const [executable, ...args] = handler.command.split(/\s+/);
    const broken = spawnSync(executable, args, { cwd: dirname(googlePath), input: '{}',
      encoding: 'utf8', windowsHide: true, timeout: 5000 });
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, /Cannot find module/);
  }
  writeFileSync(googlePath, JSON.stringify(legacy));
  assert.equal(run(['--apply']).status, 0);
  const fixed = JSON.parse(readFileSync(googlePath, 'utf8'));
  assert.deepEqual(fixed.existing, legacy.existing);
  for (const event of ['PreInvocation', 'PostInvocation', 'PreToolUse', 'PostToolUse', 'Stop']) {
    const entry = fixed.coucou[event][0];
    const handler = entry.hooks?.[0] ?? entry;
    const [executable, ...args] = handler.command.split(/\s+/);
    assert.equal(args.length, 3);
    const check = spawnSync(executable, args, { cwd: dirname(googlePath), input: '{}',
      encoding: 'utf8', windowsHide: true, timeout: 5000 });
    assert.equal(check.status, 0, check.stderr);
    assert.equal(check.stderr, '');
    assert.equal(check.stdout, '');
  }
  assert.equal(run(['--apply']).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(googlePath, 'utf8')), fixed);
});
