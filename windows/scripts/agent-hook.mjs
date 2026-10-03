import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function normalizeEvent(provider, event, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (!['codex', 'antigravity'].includes(provider)) return null;
  let agent = provider;
  let name = event;
  if (provider === 'antigravity') {
    const source = String(input.transcriptPath ?? '').replaceAll('\\', '/');
    if (source.includes('/antigravity-ide/')) agent = 'antigravity-ide';
    const mapped = {
      PreInvocation: 'UserPromptSubmit',
      PostInvocation: 'PostToolUse',
      PreToolUse: 'PreToolUse',
      PostToolUse: 'PostToolUse',
      Stop: input.error ? 'StopFailure' : input.fullyIdle === false ? 'PostToolUse' : 'Stop',
    };
    name = mapped[event];
  } else if (event === 'Interrupt') {
    name = 'SessionEnd';
  }
  const session = input.session_id ?? input.conversationId;
  if (!name || typeof session !== 'string' || !session) return null;
  const args = input.tool_input ?? input.toolCall?.args ?? {};
  return {
    hook_event_name: name,
    session_id: session,
    coucou_agent: agent,
    cwd: input.cwd ?? args.Cwd ?? input.workspacePaths?.[0] ?? process.cwd(),
    tool_name: input.tool_name ?? input.toolCall?.name ?? '',
    tool_input: {
      command: args.command ?? args.CommandLine,
      file_path: args.file_path ?? args.TargetFile ?? args.AbsolutePath,
      query: args.query ?? args.Query,
    },
    prompt: input.prompt ?? '',
    message: input.error ? 'Agent reported an error.' : input.message ?? '',
  };
}

async function main() {
  const [provider, event] = process.argv.slice(2);
  // Never consume a transcript, emit a permission decision, or hold up an agent.
  const deadline = setTimeout(() => process.exit(0), 800);
  let bytes = 0;
  const chunks = [];
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 1024 * 1024) return;
    chunks.push(chunk);
  }
  clearTimeout(deadline);
  const input = JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, ''));
  const payload = normalizeEvent(provider, event, input);
  if (!payload || !process.env.LOCALAPPDATA) return;
  spawnSync(join(process.env.LOCALAPPDATA, 'Coucou', 'bin', 'coucou-hook.exe'),
    ['--agent', payload.coucou_agent, payload.hook_event_name], {
      input: JSON.stringify(payload),
      stdio: ['pipe', 'ignore', 'ignore'],
      timeout: 1000,
      windowsHide: true,
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {}).finally(() => process.exit(0));
}
