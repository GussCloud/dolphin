# Claude API agent

The `claude-api` agent runs the user's installed Claude Code CLI (`claude`) billed to an Anthropic
API key instead of a Claude subscription; `claude-api-agent-teams` is its Agent Teams mode. The key belongs to a Claude **API account**
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
`envToDelete`, and deletions never remove the key or config dir the launch set. On Windows the
deletion ignores case (`deletePlatformEnvKeys`), so an inherited `Anthropic_Base_Url` goes too;
POSIX keeps exact-case names.

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
  Captured on Claude Code 2.1.332 (macOS):
  `src/main/runtime/__fixtures__/claude-api-key-detected-prompt.txt` (dialog) and
  `claude-api-key-preapproved-ready.txt` (pre-approved: no dialog, ready prompt);
  `claude-api-key-approval.test.ts` pins the dialog text against them.
- The per-folder trust dialog still appears (default "No, exit"), as for DeepSeek outside
  autonomous goals; Dolphin does not auto-trust.

## Where it runs

- Local host: supported.
- WSL: refused in v1 (`wsl.exe` forwards env only through `WSLENV`, and the profile is a host path).
- SSH: refused. The key would cross the relay into an unmanaged remote home.
- Paired runtime hosts: allowed only when the host advertises `CLAUDE_API_AGENT_RUNTIME_CAPABILITY`,
  and for `claude-api-agent-teams` also `CLAUDE_API_AGENT_TEAMS_RUNTIME_CAPABILITY` (a host that has
  only the first drops the unknown teams agent and runs plain `claude`); otherwise refused before
  the call is sent (`src/shared/own-credentials-claude-runtime-launch-gate.ts`,
  shared with DeepSeek) and for federated workers. Mobile hides the agent when host agent detection
  is unknown.

## Agent Teams

`claude-api-agent-teams` registers a team like `claude-agent-teams`. The team env carries only the
non-secret `DOLPHIN_CLAUDE_PROVIDER=anthropic-api` marker and `DOLPHIN_CLAUDE_API_ACCOUNT=<leader's
account>` (`buildClaudeApiTeamEnv`); the key never enters the team env or the persisted leader
registry. A teammate pane spawns as `claude-api` (`teammateLaunchAgent`), so its spawn resolves the
account from the team env (the "pane env" step) and reads that account's key fresh. If the account
was removed or has no key, that teammate is refused; it never falls back to the plan.

Teammates get the key only from Dolphin's fresh spawn resolution. Claude Code itself does not
inline it: the env it forwards on a teammate command (`CLAUDECODE=1`,
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, `ANTHROPIC_BASE_URL`, `CLAUDE_CONFIG_DIR`, proxy and CA
variables) has neither `ANTHROPIC_API_KEY` nor `ANTHROPIC_AUTH_TOKEN`. This was checked on Claude
Code 2.1.332 by reading the CLI's teammate env forward list, not from a captured transcript. The
forwarded `ANTHROPIC_BASE_URL` is empty for these panes, because the API-key spawn strips it.

The leader's account is taken from its pane env (desktop and CLI launches, after its own spawn
resolved it) or, for runtime-created leaders, resolved up front with the same order as the
leader's spawn, so a resumed transcript's owner outranks the pane account
(`resolveClaudeApiTeamAccountId`). Only the pane's own env classifies a leader as API-key, never
main's: Dolphin started from an API-key pane must not turn a plain Claude team into one. The team stays in-process (teammates share the leader's process
and env) when it routes to a remote runtime (`DOLPHIN_PAIRING_CODE`, `DOLPHIN_ENVIRONMENT`) or when
the leader's account cannot be decided there (`resolveAgentTeamLaunchProvider`). In-process
teammates share the leader's process env, key included; they bill the same account, as DeepSeek's
in-process teammates do. Detection offers
the agent with `claude-agent-teams` on the host, never from WSL.

## Status, session history and usage

API profiles have no fixed folder name (`<userData>/claude-accounts/<id>/config`), so every rule
below asks the host's account list which profiles bill an API key
(`src/main/claude-accounts/profile/claude-profile-roots.ts`: `listClaudePlanProfileConfigDirs`,
`listClaudeApiProfileConfigDirs`, `isClaudeApiProfilePath`). Readers that attribute a session to
an agent use that split; trust revocation, worktree retirement and native chat keep reading every
profile. `claude-api-agent-teams` leaders and teammates write to the same API profile, so they
follow every rule below as `claude-api`: status label, AI Vault agent, and resume from the vault as
a `claude-api` launch (as DeepSeek Agent Teams sessions are `deepseek`). A profile whose account is
no longer in settings (a remove that left the folder) belongs to neither agent and drops out of
history and stats.

Builds before this split stored API transcripts as `claude` in the AI Vault parse cache and the
search index. Both re-read a transcript whose stored agent differs from the one discovery now
assigns (`sessionParseCacheEntryMatchesAgent`, `sessionSearchReadDecision`), so the upgrade
re-labels those rows without waiting for the file to change.

- **Status.** Hooks reach the hook server as `claude` and keep every Claude status rule. The hook
  host stamps `displayAgentType: 'claude-api'` when the event's transcript is under an API profile
  (`withHostDisplayAgentType`, rule `resolveClaudeDisplayAgentType` in
  `src/shared/claude-status-display-identity.ts`, shared with DeepSeek). The event's own stamp is
  never trusted. Readers (renderer, `worktree ps`, mobile rows and session tabs, work presence) show
  `claude-api`. The renderer fallback for hosts that send no stamp cannot see the account list, so it
  only keeps an existing `claude-api` row; that is harmless because only a host of this build runs
  the agent. Old readers normalize the unknown value to absent and keep showing Claude (rule 1 of
  [`remote-wire-compatibility.md`](./remote-wire-compatibility.md)); old mobile builds show the raw
  id with the generic "CL" badge.
- **AI Vault.** `claude-api` is its own AI Vault agent, scanning only API profiles' `projects/` on the
  local host (no WSL, no SSH: the agent never runs there). Claude's source scans only plan profiles,
  so a transcript belongs to exactly one agent; subagent listing, scoped discovery, delete and the
  search index use the same roots. Resume goes through the startup plan as a `claude-api` launch,
  which bills the account whose profile holds the transcript; there is no copyable resume line
  and `dolphin search` prints none. A paired host is asked to resume only when it advertises
  `agent-session.claude-api-resume.v1`. Remote clients that do not advertise
  `ai-vault.claude-api-sessions.v1` get no `claude-api` rows or hits.
- **Usage.** Settings > Stats has its own "Claude (API)" provider (`ClaudeApiUsageStore`, cache
  `dolphin-claude-api-usage.json`), scanning only API profiles; the subscription Claude scan skips
  them. Unlike DeepSeek, cost is computed with Claude's pricing table, labelled as estimated from
  list prices (the invoice can differ: discounts, batch pricing). The Overview adds its tokens and
  cost as a separate provider line. Usage is summed across API accounts and covers the local host
  only.

## Known limits

- Hook events that reach the hook server before the account service registers the profile roots
  (`registerClaudeProfileRootSourcesFromStore`, early in startup) are not stamped `claude-api`; the
  next event that carries a transcript path re-labels the row.
- The key is in the pane's env, so the shell the pane runs keeps it after `claude` exits: a plain
  `claude` typed later in that pane bills the same API account, and child processes can read it.
  DeepSeek has the same property.
- Resume routing needs the account service: in a process without it (no registered launch source
  or no settings), a plain `claude --resume` of a session stored in an API account's profile runs
  in the plan's profile, which lacks the transcript. The CLI answers "No conversation found" and
  nothing is billed.
- An old desktop client paired to a new host may drop the unknown `claude-api` id and relaunch a
  pane as plain `claude`, which the host runs on its plan. A resume still routes by transcript,
  because the host decides that at spawn.

## Not yet

- Source Control AI has no `claude-api` spec, so a `claude-api` or `claude-api-agent-teams` default
  resolves to "unavailable", never to plain `claude`.
- Usage and cost are summed across API accounts, not split per account.
