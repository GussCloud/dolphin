import {
  WSL_AGENT_TEAMS_ENV_COMMAND,
  WSL_AGENT_TEAMS_GUEST_ENV_KEYS
} from '../../shared/claude-agent-teams-wsl-guest-env'

/** Dir beside the managed launcher holding the guest `tmux` shim; never on PATH outside Agent Teams panes. */
export const WSL_AGENT_TEAMS_BIN_DIR_NAME = 'agent-teams-bin'
const AGENT_TEAMS_TMUX_SHIM_MARKER = '# Dolphin managed Claude Agent Teams tmux shim'
// Keys the Windows CLI reads on each tmux call; the pane forwards them host->guest only.
const AGENT_TEAMS_WINWARD_ENV = [
  'DOLPHIN_AGENT_TEAMS_TEAM_ID',
  'DOLPHIN_AGENT_TEAMS_TOKEN',
  'TMUX_PANE'
]

/**
 * POSIX sh that rewrites WSLENV so `names` cross guest->Windows (/w) exactly once.
 * Why rewrite, not append: an inherited `NAME/u` entry would otherwise keep them from crossing.
 */
function buildWinwardWslenv(names: readonly string[]): string {
  const cases = ["''", ...names].join('|')
  return `dolphin_wslenv=
dolphin_rest=\${WSLENV:-}
while [ -n "$dolphin_rest" ]; do
  dolphin_entry=\${dolphin_rest%%:*}
  case $dolphin_rest in
    *:*) dolphin_rest=\${dolphin_rest#*:} ;;
    *) dolphin_rest= ;;
  esac
  case \${dolphin_entry%%/*} in
    ${cases}) ;;
    *) dolphin_wslenv=\${dolphin_wslenv:+$dolphin_wslenv:}$dolphin_entry ;;
  esac
done
WSLENV=\${dolphin_wslenv:+$dolphin_wslenv:}${names.map((name) => `${name}/w`).join(':')}
export WSLENV`
}

/** Guest `tmux` that Claude's tmux backend runs; each call reaches the Windows CLI through the launcher. */
export function buildWslAgentTeamsTmuxShim(launcherCommandName: string): string {
  return `#!/bin/sh
${AGENT_TEAMS_TMUX_SHIM_MARKER}
${buildWinwardWslenv(AGENT_TEAMS_WINWARD_ENV)}
exec "$(dirname -- "$0")/../${launcherCommandName}" agent-teams-tmux "$@"
`
}

// Why in the guest: the distro's Linux claude must own this pane's PTY directly;
// Windows only mints the team env, emitted as `export NAME='value'` lines.
export function buildClaudeTeamsGuestLaunch(): string {
  return `if [ "\${1:-}" = claude-teams ]; then
  shift
  # Why absolute: a relative PATH entry would resolve tmux against whatever cwd claude is in.
  DOLPHIN_TEAMS_BIN="$(cd -- "$(dirname -- "$0")" && pwd -P)/${WSL_AGENT_TEAMS_BIN_DIR_NAME}"
  if [ ! -x "$DOLPHIN_TEAMS_BIN/tmux" ]; then
    echo "Claude Agent Teams needs the Dolphin-managed WSL CLI; run it from a Dolphin WSL terminal." >&2
    exit 1
  fi
  DOLPHIN_TEAMS_DISTRO=()
  if [ -n "\${WSL_DISTRO_NAME:-}" ]; then
    DOLPHIN_TEAMS_DISTRO=(-WslDistro "$WSL_DISTRO_NAME")
  fi
  DOLPHIN_TEAMS_ENV=$(
${indentLines(buildWinwardWslenv(['DOLPHIN_PANE_KEY']), '    ')}
    "$DOLPHIN_POWERSHELL" -NoProfile -ExecutionPolicy Bypass -File "$DOLPHIN_BRIDGE_PS1_WIN" "$DOLPHIN_WIN_LAUNCHER" -WslCwd "$DOLPHIN_WSL_CWD_WIN" \${DOLPHIN_TEAMS_DISTRO[@]+"\${DOLPHIN_TEAMS_DISTRO[@]}"} ${WSL_AGENT_TEAMS_ENV_COMMAND}
  )
  unset DOLPHIN_AGENT_TEAMS_TEAM_ID
  eval "$(printf '%s\\n' "$DOLPHIN_TEAMS_ENV" | tr -d '\\r' | grep -E "^export (${WSL_AGENT_TEAMS_GUEST_ENV_KEYS.join('|')})='[^']*'$" || true)"
  DOLPHIN_TEAMS_MODE=auto
  if [ -z "\${DOLPHIN_AGENT_TEAMS_TEAM_ID:-}" ]; then
    # Why: Windows degrades to in-process (no team minted) rather than failing the launch.
    echo "Dolphin could not open Claude Agent Teams panes here; teammates will run in-process." >&2
    unset TMUX TMUX_PANE
    export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
    DOLPHIN_TEAMS_MODE=in-process
  else
    export PATH="$DOLPHIN_TEAMS_BIN:$PATH"
  fi
  for DOLPHIN_TEAMS_ARG in "$@"; do
    case $DOLPHIN_TEAMS_ARG in
      --teammate-mode|--teammate-mode=*) exec claude "$@" ;;
    esac
  done
  exec claude --teammate-mode "$DOLPHIN_TEAMS_MODE" "$@"
fi`
}

function indentLines(text: string, indent: string): string {
  return text
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n')
}
