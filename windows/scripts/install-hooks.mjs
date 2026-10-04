import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, renameSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

if (process.platform !== 'win32') throw new Error('This installer supports Windows only.');
const apply = process.argv.includes('--apply');
const home = process.env.USERPROFILE;
const local = process.env.LOCALAPPDATA;
if (!home || !local) throw new Error('User directories are unavailable.');
const runtime = join(local, 'Coucou', 'bin');
const relay = join(runtime, 'coucou-hook.exe');
if (!existsSync(relay)) throw new Error('Start Coucou once to install its relay.');
const bridge = join(runtime, 'agent-hook.mjs');
const quote = path => `"${path.replaceAll('\\', '/')}"`;
const command = (provider, event) => `node ${quote(bridge)} ${provider} ${event}`;
// Antigravity splits command arguments without shell quote handling on Windows.
// Use the verified 8.3 directory alias so the script is a single argument.
const shortRuntime = execFileSync(process.env.ComSpec || 'cmd.exe',
  ['/d', '/s', '/c', 'for %I in ("%COUCOU_HOOK_DIRECTORY%") do @echo %~sI'], {
    env: { ...process.env, COUCOU_HOOK_DIRECTORY: runtime },
    encoding: 'utf8', windowsHide: true, windowsVerbatimArguments: true,
  }).trim();
const shortInfo = statSync(shortRuntime, { bigint: true });
const runtimeInfo = statSync(runtime, { bigint: true });
if (/\s/.test(shortRuntime) || shortInfo.ino === 0n ||
    shortInfo.ino !== runtimeInfo.ino || shortInfo.dev !== runtimeInfo.dev) {
  throw new Error('Antigravity needs a verified hook directory without spaces. Settings were not changed.');
}
const googleCommand = event => `node ${join(shortRuntime, 'agent-hook.mjs').replaceAll('\\', '/')} antigravity ${event}`;
const stamp = new Date().toISOString().replaceAll(':', '-');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const record = value => value && typeof value === 'object' && !Array.isArray(value);

function read(path) {
  const bytes = existsSync(path) ? readFileSync(path) : null;
  const value = bytes ? JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')) : {};
  if (!record(value)) throw new Error(`Expected a JSON object: ${path}`);
  return { path, bytes, value };
}

function mergeEvents(config, events, provider) {
  if (config.hooks === undefined) config.hooks = {};
  if (!record(config.hooks)) throw new Error('Existing hooks must be an object.');
  for (const event of events) {
    if (config.hooks[event] === undefined) config.hooks[event] = [];
    const groups = config.hooks[event];
    if (!Array.isArray(groups)) throw new Error(`Invalid existing event: ${event}`);
    const cmd = provider === 'claude' ? `${quote(relay)} ${event}` : command(provider, event);
    if (groups.some(group => group.hooks?.some(handler => handler.command === cmd))) continue;
    // Avoid duplicating a previous native Coucou installation for Claude.
    if (provider === 'claude' && groups.some(group => group.hooks?.some(handler =>
      typeof handler.command === 'string' && handler.command.includes('coucou-hook')))) continue;
    groups.push({ hooks: [{ type: 'command', command: cmd,
      timeout: event === 'PermissionRequest' ? 120 : event === 'SessionEnd' ? 3 : 5 }] });
  }
}

const claudeEvents = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse',
  'PostToolUse', 'PostToolUseFailure', 'PermissionRequest', 'Notification', 'Stop',
  'StopFailure', 'SubagentStart', 'SubagentStop'];
const codexEvents = ['SessionStart', 'SessionEnd', 'UserPromptSubmit', 'PreToolUse',
  'PostToolUse', 'Stop', 'SubagentStart', 'SubagentStop', 'Interrupt'];
const claude = read(join(home, '.claude', 'settings.json'));
const codex = read(join(process.env.CODEX_HOME || join(home, '.codex'), 'hooks.json'));
const google = read(join(home, '.gemini', 'config', 'hooks.json'));
mergeEvents(claude.value, claudeEvents, 'claude');
mergeEvents(codex.value, codexEvents, 'codex');
const antigravity = { enabled: google.value.coucou?.enabled ?? true };
const legacyAntigravity = { enabled: antigravity.enabled };
for (const event of ['PreInvocation', 'PostInvocation', 'PreToolUse', 'PostToolUse', 'Stop']) {
  const handler = { type: 'command', command: googleCommand(event), timeout: 5 };
  antigravity[event] = ['PreToolUse', 'PostToolUse'].includes(event)
    ? [{ matcher: '*', hooks: [handler] }] : [handler];
  const legacy = { ...handler, command: command('antigravity', event) };
  legacyAntigravity[event] = ['PreToolUse', 'PostToolUse'].includes(event)
    ? [{ matcher: '*', hooks: [legacy] }] : [legacy];
}
if (google.value.coucou && JSON.stringify(google.value.coucou) !== JSON.stringify(antigravity) &&
    JSON.stringify(google.value.coucou) !== JSON.stringify(legacyAntigravity)) {
  throw new Error('An existing coucou hook differs. Review it before replacing it.');
}
google.value.coucou = antigravity;
const plans = [claude, codex, google].map(item => ({ ...item,
  next: Buffer.from(JSON.stringify(item.value, null, 2) + '\n') }));

// Preview prints only Coucou commands, never unrelated settings or credentials.
for (const plan of plans) {
  console.log(JSON.stringify({ path: plan.path, mode: apply ? 'apply' : 'preview',
    changed: !plan.bytes || !plan.bytes.equals(plan.next),
    backup: plan.bytes ? `${plan.path}.coucou-backup-${stamp}` : null }));
}
console.log(JSON.stringify({ claudeEvents, codexEvents,
  antigravityEvents: Object.keys(antigravity).filter(key => key !== 'enabled'),
  bridge, relay, sampleCommand: command('codex', 'UserPromptSubmit') }));
if (!apply) process.exit(0);

// Check all sources for intervening edits before changing any of them.
for (const plan of plans) {
  const now = existsSync(plan.path) ? readFileSync(plan.path) : null;
  if ((now === null) !== (plan.bytes === null) || (now && hash(now) !== hash(plan.bytes))) {
    throw new Error('A settings file changed after the preview. Retry from current settings.');
  }
}
mkdirSync(runtime, { recursive: true });
const bridgeSource = fileURLToPath(new URL('./agent-hook.mjs', import.meta.url));
if (existsSync(bridge)) copyFileSync(bridge, `${bridge}.backup-${stamp}`);
copyFileSync(bridgeSource, bridge);
for (const plan of plans) {
  if (plan.bytes && plan.bytes.equals(plan.next)) continue;
  mkdirSync(dirname(plan.path), { recursive: true });
  if (plan.bytes) copyFileSync(plan.path, `${plan.path}.coucou-backup-${stamp}`);
  const temporary = `${plan.path}.coucou-${process.pid}.tmp`;
  writeFileSync(temporary, plan.next, { flag: 'wx' });
  renameSync(temporary, plan.path);
}
console.log('Saved Coucou hooks. Codex hook trust must be reviewed in /hooks.');
