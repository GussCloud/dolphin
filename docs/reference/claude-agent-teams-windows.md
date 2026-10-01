# Claude Agent Teams on native Windows

`dolphin claude-teams` gives Claude Code's Agent Teams real Dolphin panes by setting
`TMUX` and putting a Dolphin `tmux` shim first on PATH; every tmux command Claude runs
becomes an `agentTeams.tmuxCompat` RPC. On Windows two facts shape the design. WSL
projects are covered in [`wsl-managed-cli.md`](./wsl-managed-cli.md).

## The Windows leader launches claude directly

On native Windows the agent's launch command is `claude --teammate-mode auto`, not
`dolphin claude-teams`. The Dolphin CLI runs as Electron-as-Node (a GUI-subsystem program),
and a `claude` child that inherits its stdio never draws its TUI or receives input. PTY spawn
sees `--teammate-mode auto` and injects the team env itself (`spawn-env.ts` →
`prepareClaudeAgentTeamsLeaderForHandle`; runtime-created terminals use
`buildRuntimeAgentTeamsLaunchPlan`). `dolphin claude-teams` refuses on Windows and points to
the agent picker. When the launch env is merged over the pane env, differently-cased
duplicate keys are dropped first (`overlayPlatformEnv`), so the pane's `PATH` spelling and
value win over Electron main's `Path`.

## Teammate panes run in Git Bash

Claude builds each teammate as a POSIX sh string (`cd '<cwd>' && env ... '<claude>' ...`)
and sends it with `tmux respawn-pane`. Claude Code on Windows already requires Git for
Windows, so teammate panes use the `git-bash` shell override
(`claude-agent-teams-host-shell.ts`) and run that string unchanged — Dolphin never parses
Claude's command format. The pane env carries no `MSYS2_ARG_CONV_EXCL`/`MSYS_NO_PATHCONV`:
those would leak into every command the teammate's Bash tool runs, and MSYS leaves the
command's `C:\` paths alone.

### Fast teammate start (Git Bash teams only)

Git Bash echoes typed input slowly: a ~400-character teammate command took ~55s to type
(PowerShell ~9s), so teammates started 60–90s after their pane appeared. Two changes in
`claude-agent-teams-tmux-dispatcher.ts`:

- **Pending holding pane.** `split-window ... -- cat` spawns nothing; it records a pending
  pane (fake id, split origin, direction). `respawn-pane` then spawns the one real pane.
  For a pending pane `capture-pane` is empty, `send-keys`/`select-pane` are no-ops, and
  `kill-pane` just forgets it. A pane whose origin is still pending splits from the nearest
  spawned ancestor. A `split-window` with any other command spawns immediately.
- **Script delivery.** The command is written to a user-private one-shot script under
  `~/.dolphin/claude-agent-teams-bin/pane-cmds/` (`claude-agent-teams-pane-command-script.ts`)
  and the pane is typed only `. '/c/.../<uuid>.sh'`. The script deletes itself first (bash
  reads a `.`-sourced file whole before running it), runs the command, then `exit`s, so the
  pane ends when the teammate does. The command can carry secrets: it is never logged, the
  file is removed on `kill-pane`, on a failed spawn, by `releaseTeam`, and by a 15-minute
  stale sweep on each write.
- **Launch-arg delivery.** Typing even the short `.` line costs ~1-1.5s (Git Bash echoes at
  ~13ms/char, superlinear). The split carries `gitBashStartupCommandInArgs`, so the provider
  (local `local-pty-launch-plan.ts` or the daemon's `shell-launch-plan.ts`, both through
  `resolveWindowsShellLaunchArgs`) starts the pane as
  `bash -c 'chcp.com 65001 …; exec "$BASH" --rcfile <shell-ready rcfile> -i -c ". '<script>'"'`
  and types nothing (`--login -i -c` only when no shell-ready wrapper is in use). The rcfile
  sources `/etc/profile` and `~/.bash_profile` like a login shell, so with `-i` Claude sees the
  same PATH/HOME and job control as a typed shell; `-c` makes bash exit after the script,
  which already ends in `exit`. The rcfile then re-leads PATH with
  `DOLPHIN_AGENT_TEAMS_SHIM_PATH_DIRS` (the leader's ordered shim dirs, converted to POSIX
  with `cygpath`), so the teammate's own tmux calls hit `tmux.exe`, not `tmux.cmd`. The flag is
  a new optional field on `createOrAttach`: a daemon that predates it drops it and types the
  same `.` line, so the pane still starts. Ordinary Git Bash startup commands never set it and
  keep their interactive prompt.
- **~5s before each teammate `claude.exe` starts is not Dolphin.** Measured outside Dolphin:
  the same argv started from any process in that tree takes ~5s, most likely AV/EDR
  command-line scanning. Don't chase it in the pane or shim code.

macOS, Linux, WSL and SSH teams keep the placeholder split and type the command as-is.

### Closed panes leave no dead pane

The renderer keeps a local pane whose process exits non-zero as a "Terminal exited" pane,
and a killed process on Windows exits 1. So `closeTerminal` on a PTY-backed split pane with
siblings also sends the renderer a leaf-addressed close (`ui:closeTerminal` with `leafId`);
a pane that already closed itself is ignored rather than falling through to a tab close.
A teammate that exits 0 closes its pane through the normal exit path.

## The shim is a native tmux.exe

Verified in Claude 2.1.286: backend selection has no win32 block (if `TMUX` is set it
uses tmux), and `tmux` is resolved through PATHEXT, so `tmux.exe` beats `tmux.cmd` and
an extensionless script is ignored.

- **Packaged:** `config/scripts/build-windows-cli-launcher.mjs` compiles the CLI launcher
  a second time as `bin/agent-teams/tmux.exe`; named `tmux`, it forwards to
  `DOLPHIN_AGENT_TEAMS_SHIM_BIN agent-teams-tmux <args>`. It is built under that name
  rather than copied at runtime because copying our signed image under another name is
  the MITRE T1036 shape in [`windows-edr-posture.md`](./windows-edr-posture.md).
  Packaging fails if it is missing.
- **Fast path:** every CLI hop costs ~360ms (tmux.exe → dolphin.exe → Electron-as-Node →
  RPC), and a two-teammate spawn makes ~19 sequential calls. So `tmux.exe` first answers
  state-free commands itself (`-V`, `show … extended-keys`, and the no-op `set*`, `has*`,
  `resize-pane`, … list — `AgentTeamsTmuxStaticAnswers.cs` mirrors the dispatcher; keep them
  in step), then sends the rest as one JSON line to `DOLPHIN_AGENT_TEAMS_ENDPOINT`, a
  per-launch pipe `\\.\pipe\dolphin-agent-teams-<pid>-<32 hex>`
  (`claude-agent-teams-pipe-listener.ts`). That pipe serves only
  `{"v":1,id,teamId,token,envPane,cwd,argv}` and authenticates with the team token; the
  master RPC token never enters the team env. The endpoint is injected on win32 only, never
  when `DOLPHIN_PAIRING_CODE`/`DOLPHIN_ENVIRONMENT` route to a remote runtime, and it is not
  in the WSL guest env lists. `tmux.exe` waits up to 30s for the answer: `split-window` and
  `respawn-pane` wait on the terminal daemon, which took 10.4s while busy spawning another
  pane. `tmux.exe` falls back to the CLI only when the endpoint is
  missing, malformed, or refuses the connection — never after writing the request, because
  `split-window`/`respawn-pane` are not idempotent.
- **Dev fallback:** `~/.dolphin/claude-agent-teams-bin/tmux.cmd`. `cmd.exe` expands
  `%NAME%` in the arguments, so values containing `%` can be corrupted; packaged builds put
  `tmux.exe` ahead of it on PATH.

## In-process fallback

Native panes degrade to Claude's in-process teammates (one terminal) instead of failing
when the leader is native Windows and Git Bash does not resolve, or when no absolute
Dolphin CLI can back the shim. WSL and SSH leaders do not need Git Bash, and a WSL leader
does not need the Windows shim CLI either (`canLaunchAgentTeamPanes` `leaderIsWsl`): its guest
tmux shim calls the guest launcher directly. A WSL leader whose team cannot be prepared starts
`claude --teammate-mode in-process` with a one-line notice instead of failing.

## Re-verifying against a new Claude version

1. In the Claude bundle, check backend selection still keys on `TMUX` with no win32 guard.
2. Check how it spawns `tmux` (PATHEXT lookup vs. a shell) and which calls carry short
   timeouts.
3. Capture the `split-window` / `respawn-pane` argv (log them from the shim) and confirm
   the teammate command is still POSIX sh that runs unchanged in Git Bash.
