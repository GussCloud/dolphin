# Claude API agent

The `claude-api` agent runs the user's installed Claude Code CLI (`claude`) billed to an Anthropic
API key instead of a Claude subscription. The key belongs to a Claude **API account**
(`authMethod: 'api-key'`, see `src/shared/claude-api-account.ts`); each API account has its own
isolated profile dir and its own encrypted key. The contract lives in
`src/shared/claude-api-provider.ts`; the launch lives in `src/main/claude-api/`.

The one rule: a `claude-api` launch never degrades to the subscription. No account, no key, a key
that cannot be read, SSH, WSL, or a paired host that does not know the agent: the launch is refused
with a message, and nothing starts.

## Which account a launch bills

`resolveClaudeApiLaunchAccount` decides, in this order:

1. the API account whose profile holds the transcript a `claude --resume <id>` resumes;
2. `DOLPHIN_CLAUDE_API_ACCOUNT` in the pane env (relaunches, resumes);
3. the launch worktree's `agentAccountId` pin, when it names an API account (a pin naming a plan or
   Codex account belongs to another agent and is skipped);
4. `GlobalSettings.claudeApiDefaultAccountId`, set in Settings > Accounts > API accounts;
5. the only API account, when there is exactly one.

Otherwise the launch is refused. A resume owner, pane account or pin that names no account is
refused too, never replaced by another API account: that would bill a different budget. A pin is
set only when a workspace is created, so the refusal tells the user to create a new workspace with
an API account or start another agent there. The default is a global preference, so one naming a
removed (or non-API) account reads as unset; removing an API account also clears it.

The new-workspace composer offers API accounts in its account picker when the agent is
`claude-api` (local host only; the project's default account is a plan account and does not apply).

## Spawn

Both spawn paths (`ipc/spawn-preflight.ts`, `runtime/spawn-preflight-auth.ts`) call
`prepareOwnCredentialsClaudeLaunch`, which returns DeepSeek's or the API account's env:

- `CLAUDE_CONFIG_DIR`: the account's profile dir;
- `ANTHROPIC_API_KEY`: read from the key store at spawn, never from settings, argv or the renderer;
- `DOLPHIN_CLAUDE_PROVIDER=anthropic-api` and `DOLPHIN_CLAUDE_API_ACCOUNT=<id>` (non-secret).

The managed account gate (`isManagedClaudeAuthLaunch`) skips these launches through
`isOwnCredentialsClaudeLaunchRequest`, the predicate shared with DeepSeek, so the plan's
`stripAuthEnv` never removes the key and a plan account's profile never applies.

Inherited env that would send the CLI elsewhere (`CLAUDE_API_CONFLICTING_ENV_KEYS`: auth tokens,
`ANTHROPIC_BASE_URL`, Bedrock/Vertex/Foundry switches and their keys) is added to the spawn's
`envToDelete`, and deletions never remove the key or config dir the launch set.

A plain `claude --resume <id>` whose transcript lives in an API account's profile is re-marked as
a `claude-api` spawn on that account before the gate runs (`routeClaudeApiResumeEnv`): the CLI finds
the session only there, and resuming it on the plan would fail and bill the wrong login.

## Profile preparation

At each launch, best effort (a failure degrades status or the first prompt, never billing):

- status hooks are installed into the profile by `installClaudeProfileHooks`, like any profile;
- `preapproveClaudeApiKeyInProfile` records the key in the profile's `.claude.json`, also at
  account creation and key replacement. Without it Claude Code asks "Detected a custom API key in
  your environment … Do you want to use this API key?" with **No** as the default, so Dolphin's
  first Enter would reject the key. Answering Yes writes
  `customApiKeyResponses: { approved: [key.slice(-20)], rejected: [] }`; the function writes the
  same, removes the suffix from `rejected`, and on key replacement drops the old key's suffix.
  Captured on Claude Code 2.1.323 (macOS):
  `src/main/runtime/__fixtures__/claude-api-key-detected-prompt.txt` (dialog) and
  `claude-api-key-preapproved-ready.txt` (pre-approved: no dialog, ready prompt);
  `claude-api-key-approval.test.ts` pins the dialog text against them.
- The per-folder trust dialog still appears (default "No, exit"), as for DeepSeek outside
  autonomous goals; Dolphin does not auto-trust.

## Where it runs

- Local host: supported.
- WSL: refused in v1 (`wsl.exe` forwards env only through `WSLENV`, and the profile is a host path).
- SSH: refused. The key would cross the relay into an unmanaged remote home.
- Paired runtime hosts: allowed only when the host advertises `CLAUDE_API_AGENT_RUNTIME_CAPABILITY`;
  otherwise refused before the call is sent (`src/shared/own-credentials-claude-runtime-launch-gate.ts`,
  shared with DeepSeek) and for federated workers. Mobile hides the agent when host agent detection
  is unknown.

## Known limits

- The key is in the pane's env, so the shell the pane runs keeps it after `claude` exits: a plain
  `claude` typed later in that pane bills the same API account, and child processes can read it.
  DeepSeek has the same property.

## Not yet

- Agent Teams: an API-key leader never registers a team (teammates stay in-process), because a
  teammate pane would otherwise spawn through the plan's gate.
- Source Control AI has no `claude-api` spec, so a `claude-api` default resolves to "unavailable",
  never to plain `claude`.
- Status rows are labelled `claude`; usage and cost are not split per API account.
