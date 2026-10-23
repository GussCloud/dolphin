# DeepSeek agent

DeepSeek has no harness of its own. The `deepseek` and `deepseek-agent-teams` agents run the
user's installed Claude Code CLI (`claude`) against DeepSeek's Anthropic-compatible API
(`https://api.deepseek.com/anthropic`). The contract lives in
`src/shared/deepseek-claude-provider.ts`.

## Isolation from Claude

DeepSeek launches set `CLAUDE_CONFIG_DIR` to `~/.claude-deepseek` (the Linux home inside WSL).
Nothing is shared with `~/.claude`: settings, `CLAUDE.md`, skills, agents, commands, plugins,
hooks, sessions and history all stay separate. This is a product decision, so DeepSeek sessions
never mix into Claude's AI Vault, usage or resume, and a Claude edit never changes DeepSeek.
The settings block says so to the user.

The managed Claude account gate (`isManagedClaudeAuthLaunch`) skips DeepSeek launches and any
pane carrying the `DOLPHIN_CLAUDE_PROVIDER=deepseek` marker. DeepSeek therefore never receives a
managed account's `CLAUDE_CONFIG_DIR`, and its `ANTHROPIC_AUTH_TOKEN` is not stripped. Real Claude
launches go through the gate exactly as before; `managed-claude-auth-launch.test.ts` pins that.

## Key and models

The API key lives only in `~/.dolphin/deepseek-api-key.enc`, encrypted with Electron safeStorage.
Saving is refused when OS encryption is unavailable, and a plaintext envelope is rejected on read.
The renderer only sees `{ apiKeyConfigured, encryptionAvailable }`. Main injects the key at PTY
spawn; it never enters settings, `agentDefaultEnv`, paired clients or the Agent Teams registry.

`GlobalSettings.deepseekModelSlots` maps DeepSeek models onto Claude Code's slots
(`ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL`).
The pickers list `GET https://api.deepseek.com/models`. That endpoint reports no context window,
so a `<id>[1m]` variant is offered whenever the window is unknown.

## Where it runs

- Local and WSL: supported. WSL forwards the DeepSeek keys through `WSLENV` only for marked panes.
- SSH: refused. The key would cross the relay into an unmanaged remote home.
- Paired runtime hosts: allowed only when the host advertises
  `AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY`. Otherwise the call is refused before it is
  sent (`src/shared/deepseek-runtime-launch-gate.ts`). An older host drops an unknown
  `createdWithAgent` and would run plain `claude` on the host's Anthropic login, so a DeepSeek
  launch must never degrade to a plain Claude launch. Mobile hides DeepSeek when host agent
  detection is unknown.

## Agent Teams

Teammate panes do not inherit the leader env, and Claude Code does not forward
`ANTHROPIC_AUTH_TOKEN` or the model slot variables to teammates (checked on 2.1.309). The team env
carries only the non-secret marker; each teammate spawn resolves the DeepSeek env fresh from the key
store. Teams whose env routes to another runtime (`DOLPHIN_PAIRING_CODE`, `DOLPHIN_ENVIRONMENT`) run
in-process for DeepSeek, so teammates inherit the leader's env.

## Status and hooks

Hooks are installed into `~/.claude-deepseek/settings.json` on the first DeepSeek launch per main
process and host or WSL distro, not through `AGENT_HOOK_TARGETS`: detection keys on `claude` and
would create the folder for every Claude user. A failed install is logged and retried on the next
launch; the launch proceeds without status. DeepSeek gets the claude-version-gated events
(`SessionEnd`) but not Claude's usage statusline.

Hooks reach the hook server as `claude` and keep every Claude status rule. The desktop renderer
re-labels a row `deepseek` when its transcript path contains `.claude-deepseek`. Mobile and
`worktree ps` still show those rows as Claude.

The first launch seeds `.claude.json` with `hasCompletedOnboarding: true` when the file is absent:
a fresh config dir opens Claude Code's theme picker, which would swallow Dolphin's prompt injection.
The per-folder trust prompt still appears once per project.

## Claude Code updates

DeepSeek always runs the same `claude` binary as Claude, so CLI updates apply immediately. New
Dolphin features keyed on `=== 'claude'` do not reach DeepSeek automatically;
`claude-identity-check-ratchet.test.ts` fails on a new comparison so the author decides explicitly
(use `isClaudeHookAgentType` / `toHookHostAgentType` when DeepSeek should behave like Claude). A
Claude Code release that depends on an Anthropic-only API feature can break DeepSeek sessions; that
is outside Dolphin's control.
