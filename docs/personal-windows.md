# Personal Windows development

Develop the personal edition on `personal-windows`. Keep each feature in a small, reversible commit.

## Repository

- `origin`: https://github.com/hami9/coucou.git
- `upstream`: https://github.com/Louis-CFM/coucou.git
- Initial source revision: `054030636fc15ba75ebb92b3c19b7dfef5fab9b1`
- Current upstream revision at setup: `d5d0e49c07a50c0f4b154ff01a8ad0849c5414cf`. The intervening commit only changed macOS sources, tests, and documentation; Windows sources and shared sounds are identical.

Review `git status`, the current diff, and the build before a large change. Fetch upstream changes separately and review them before merging.

## Development

Run from the repository root in PowerShell:

```powershell
./windows/start-dev.cmd
```

The launcher adds this user's Rust installation to its process PATH. It starts the native Tauri app and its live development server. It does not install agent hooks or change machine settings, and does not depend on PowerShell script execution policy.

For checks, run inside `windows/` with Cargo on PATH:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run tauri -- build --debug --no-bundle
cargo test --workspace --locked
```

For daily use, run `windows/build-app.cmd`, then open `windows/release/coucou.exe`. This copy includes the built interface and runs without Vite. Close the running copy before rebuilding it.

Both development and standalone builds use `windows/target/debug/coucou.exe`. A development run replaces that file with a version that needs the development server. Use the separate `release/` copy for daily use. Windows builds hide the console window in both modes. A successful front-end build alone does not verify the native app or its relay.

## Setup checks

Verified on Windows on 2026-10-03:

- `npm ci`: installed from the lockfile; audit reported zero vulnerabilities.
- `npm run build`: the release relay, TypeScript check, and Vite build passed.
- `tauri build --debug --no-bundle`: the native executable built successfully.
- Relay unit tests: 3 passed. Backend library unit tests: 8 passed.
- The built app stayed running and recorded a synthetic Codex `UserPromptSubmit` event in its local log. Its accessibility tree exposed the native Tauri page and the Codex pill.
- `start-dev.cmd`: started Vite at `http://127.0.0.1:1420/` and ran the native Tauri development app. Synthetic `UserPromptSubmit` and `SessionEnd` events both reached the app; the relay returned exit code 0 with no stdout.

The first live development run failed with `EBUSY` while Vite watched a Cargo DLL. The Windows Vite configuration now ignores `target/`, `src-tauri/`, and `release/`. The subsequent native development run and front-end rebuild passed. Tauri recommends excluding Rust sources from Vite's watcher in its [Vite guide](https://v2.tauri.app/start/frontend/vite/).

Screenshot capture timed out and a subsequent UI click could not resolve its cached element. Visual interaction checks remain pending. No real agent hooks, API keys, plugin changes, or team execution were tested. The installer and optimized application release build were not built by these checks.

## Requested features

These features are planned, not implemented by the setup commit.

1. Add a task and agent tree. Give agents a role, assigned task, parent, and status. The tree is a team view, not a request for separate Git worktrees.
2. Support Codex, Claude Code, Antigravity, and other agents through provider adapters. Show each adapter's supported operations explicitly.
3. Add plugin and skill management. Discover actual installed items first; add supported changes with a visible preview and reversible operations.
4. Connect real provider events and team execution after the local model and persistence work. Keep assigned, launched, running, blocked, failed, and completed states distinct.

Use a new management window rather than restyling the existing island. Preserve existing pill IDs, credential storage, and permission behavior. Never run an agent, install a plugin, alter hook settings, or approve a tool merely because an external payload asks for it.

## Verification for each feature

Build the front end and native app, run the relevant existing tests, and check the actual Windows UI. Test tree persistence and invalid parent relationships before adding execution. Report unavailable provider operations as unsupported, and distinguish test events from real agent sessions.
