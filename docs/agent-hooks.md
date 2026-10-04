# Windows agent hooks

Connect Codex, Claude Code, Antigravity, and Antigravity IDE to the existing Windows relay.

## Install

Start Coucou, then run from the repository root:

```powershell
node windows/scripts/install-hooks.mjs
node windows/scripts/install-hooks.mjs --apply
```

The first command previews paths, events, and the bridge command without printing unrelated settings. The second preserves existing JSON settings, saves dated backups beside changed files, installs the bridge under `%LOCALAPPDATA%/Coucou/bin/`, and atomically replaces each configuration file. Repeating it does not duplicate hook entries.

| Provider | User configuration | Events |
|---|---|---|
| Claude Code | `%USERPROFILE%/.claude/settings.json` | 12 lifecycle, tool, notification, and permission events |
| Codex | `$CODEX_HOME/hooks.json`, or `%USERPROFILE%/.codex/hooks.json` | 9 lifecycle and tool events; no permission decisions |
| Antigravity and IDE | `%USERPROFILE%/.gemini/config/hooks.json` | 5 invocation, tool, and stop events |

Both Antigravity applications use the same global hook configuration. The bridge identifies the IDE from the documented `transcriptPath` metadata; it does not open that file. Normal Antigravity receives `antigravity`, and IDE receives `antigravity-ide`. An ambiguous payload uses the general Antigravity label. Background work with `fullyIdle: false` stays working rather than being reported as finished.

Codex requires review and trust of the exact hook definitions. Open `/hooks` in Codex CLI and trust the Coucou entries before expecting live events. Hooks were recognized with no parser errors on this laptop, but were still `untrusted` at setup. No trust bypass or approval-policy change was made.

Existing Claude sessions may need a new session to pick up settings. Check Customizations > Hooks in both Antigravity applications; reload the application if it has not picked up the global file. Direct relay tests do not verify that a provider has reloaded its hooks.

## Behavior

The Node bridge depends on `node` being on the agent's PATH. It forwards only selected display metadata to the local native relay, emits no stdout, and exits successfully on malformed input or relay failure. It never approves, denies, or continues an agent workflow. The native Claude permission relay still requires an explicit button click and falls back to the terminal without a decision when unanswered.

On Windows, Antigravity commands use a verified 8.3 path to the bridge, without quotes or spaces. A quoted long path failed when the host split its arguments at the space in the user directory. The installer checks the directory file identity before using its short alias and refuses to write settings if that alias is unavailable. It upgrades only its exact previous Antigravity definition; unrelated or customized definitions remain protected. Claude and Codex keep their existing command syntax.

## Verify

```powershell
node --test windows/scripts/agent-hook.test.mjs
```

Five tests cover event translation, provider identity, background completion, silent failure, backup preservation, and repeated installation. At setup, the tests and front-end build passed. Installed bridge commands for three provider labels and the native Claude command in Git Bash all returned exit code 0 with empty stdout; synthetic events appeared in Coucou's local log. End-to-end provider-generated events remain unverified pending hook trust and provider reload.

The Windows regression test uses user and runtime directories with spaces. It reproduces the old module lookup failure, migrates the existing configuration, and checks all five Antigravity commands with whitespace argument splitting from the configuration directory. The installed commands also passed this path check on 2026-10-04. Claude's installed PreToolUse command passed a separate Git Bash path check. These checks use empty or malformed payloads so they do not create fake agent activity or permission requests.

## Restore

Use the dated backup beside a changed configuration file to review the previous contents. If restoring manually, preserve edits made since installation. For newly created hook files, remove only Coucou's entries and keep other hooks. The installer intentionally refuses to replace a different existing Antigravity hook named `coucou`.

## References

- [Codex hooks and trust](https://learn.chatgpt.com/docs/hooks)
- [Antigravity hooks, shared paths, and payloads](https://antigravity.google/docs/hooks)
- [Claude Code hook contract](https://code.claude.com/docs/en/hooks)
