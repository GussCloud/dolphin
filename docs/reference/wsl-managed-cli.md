# CLI access in Dolphin-managed WSL shells

A WSL terminal on a Windows host gets this app's CLI (`dolphin-ide` packaged,
`dolphin-dev` in development) on its PATH with nothing installed in the guest:
`~/.local/bin`, shell profiles, and the Windows user PATH are untouched. External
WSL shells still need Settings → General registration.

1. **Host.** `buildPtyHostEnv` calls `getManagedWslCliDir` for WSL panes only. It
   writes a launcher and PowerShell bridge (reusing `wsl-cli-scripts.ts`) under
   `<userData>/wsl-managed-cli/<content hash>` and exports `DOLPHIN_WSL_CLI_DIR`.
   Content addressing follows `shell-wrapper-content-address.ts`: builds sharing
   user data never overwrite each other, and a present file is complete because
   each one lands by rename. Old directories are not collected.
2. **Crossing.** `addDolphinWslInteropEnv` adds `DOLPHIN_WSL_CLI_DIR/p`, so both the
   daemon and in-process spawn paths translate it with the distro's own mounts.
3. **Guest.** `WSL_MANAGED_CLI_PATH_RESTORE` runs after user startup files in the
   bash rcfile and the local zsh first-prompt hook, which run once per Dolphin shell.
   It leads PATH with the directory when `$DOLPHIN_WSL_CLI_DIR/$DOLPHIN_CLI_COMMAND` is
   executable, and otherwise prints one warning. Other login shells get no CLI;
   nothing blocks a shell.

The colocated launcher finds its bridge beside itself and PowerShell by Windows
path, so neither guest PATH nor the automount root matters. The bridge pins this
app's user-data directory and is written with a UTF-8 BOM so Windows PowerShell 5.1
reads non-ASCII paths correctly. It clears `DOLPHIN_WSL_CLI_DIR`, which WSLENV maps
back to Windows, so an app the CLI starts never inherits it. In development it runs
Electron as Node on `out/cli/index.js` directly, with the environment
`buildWindowsDevLauncher` sets (`DOLPHIN_APP_EXECUTABLE`, stashed `NODE_OPTIONS`).
Otherwise it launches its child exactly like the registered bridge.

A missing runtime (logged once) or a failed write (logged per spawn) leaves
`DOLPHIN_WSL_CLI_DIR` unset. A terminal daemon from an older build adds no WSLENV
entry, so its WSL panes lack the CLI until the daemon restarts.

Run the opt-in end-to-end test on Windows with `DOLPHIN_BACKGROUND_LAUNCH=1`,
`DOLPHIN_TEST_MANAGED_WSL=1`, and optionally `DOLPHIN_TEST_WSL_DISTRO=<distro>`. The zsh
case skips when the distro lacks `zsh` or `script`.

## Claude Agent Teams in WSL panes

The managed directory also holds `agent-teams-bin/tmux`, a POSIX shim for Claude Code's
tmux backend. It lives in a subdirectory so it is never on PATH by default: normal WSL
panes keep the distro's real `tmux`.

- **Leader.** `dolphin-ide claude-teams` never reaches Windows as that verb. The guest
  launcher (`wsl-agent-teams-guest-scripts.ts`) calls the hidden Windows verb
  `agent-teams-wsl-env`, which mints the team (`agentTeams.prepareLaunch`, no Windows
  Claude auth) and prints `export NAME='value'` lines. The launcher evals only allowlisted,
  well-formed lines, puts `agent-teams-bin` first on PATH, and `exec`s the distro's own
  `claude --teammate-mode auto` on the pane PTY. No `wsl.exe` re-hop, so resize, signals
  and hooks behave like any guest command. `DOLPHIN_PANE_KEY` is re-registered `/w` for
  that call only.
- **Teammate panes.** `addDolphinWslInteropEnv` forwards the team keys (`TMUX`,
  `TMUX_PANE`, `TERM`, `COLORTERM`, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`,
  `DOLPHIN_AGENT_TEAMS_{TEAM_ID,TOKEN,LEADER_PANE}`) as `/u`, only when a team id is
  present. Windows PATH and the Windows shim dir/bin never cross. The PATH restore adds
  `agent-teams-bin` only when `DOLPHIN_AGENT_TEAMS_TEAM_ID` is set.
- **Each tmux call.** The shim rewrites `WSLENV` so the team id, token and `TMUX_PANE`
  cross guest→Windows (`/w`, replacing any inherited `/u` entry), then runs
  `../dolphin-ide agent-teams-tmux "$@"` through the PowerShell bridge.

Limits:

- The shim dir is added by the bash/zsh startup wrappers only. A distro user whose login
  shell is fish (or another shell) gets no managed CLI and no shim in teammate panes; the
  leader launch is unaffected.
- Latency: every tmux call pays a cold `powershell.exe` plus the Windows CLI start
  (estimated 0.6–1.5 s, unmeasured). Claude 2.1.286's only short timeout is the optional
  session-name `display-message` (1000 ms; returns undefined on failure), so a slow call
  loses that name only. If that changes, skip PowerShell for `agent-teams-tmux` by
  calling the launcher exe directly with a single base64 argv argument.
