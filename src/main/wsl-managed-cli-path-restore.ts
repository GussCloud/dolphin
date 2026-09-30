import { WSL_AGENT_TEAMS_BIN_DIR_NAME } from './cli/wsl-agent-teams-guest-scripts'

/** Leads PATH with the managed WSL CLI after startup files ran; an unusable CLI only warns. */
export const WSL_MANAGED_CLI_PATH_RESTORE = `if [ -n "\${DOLPHIN_WSL_CLI_DIR:-}" ]; then
  if [ -x "$DOLPHIN_WSL_CLI_DIR/\${DOLPHIN_CLI_COMMAND:-}" ]; then
    export PATH="$DOLPHIN_WSL_CLI_DIR\${PATH:+:$PATH}"
    # Why team-gated: only Agent Teams panes may resolve tmux to Dolphin's shim.
    if [ -n "\${DOLPHIN_AGENT_TEAMS_TEAM_ID:-}" ] && [ -x "$DOLPHIN_WSL_CLI_DIR/${WSL_AGENT_TEAMS_BIN_DIR_NAME}/tmux" ]; then
      export PATH="$DOLPHIN_WSL_CLI_DIR/${WSL_AGENT_TEAMS_BIN_DIR_NAME}:$PATH"
    fi
  else
    printf 'Dolphin CLI unavailable: cannot run %s. Check WSL Windows-drive mount options.\\n' "$DOLPHIN_WSL_CLI_DIR/\${DOLPHIN_CLI_COMMAND:-}" >&2
  fi
fi`
