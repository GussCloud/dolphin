/** Env names the guest launcher accepts from `agent-teams-wsl-env` as `export NAME='value'` lines. */
export const WSL_AGENT_TEAMS_GUEST_ENV_KEYS = [
  'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
  'TMUX',
  'TMUX_PANE',
  'TERM',
  'COLORTERM',
  'DOLPHIN_AGENT_TEAMS_TEAM_ID',
  'DOLPHIN_AGENT_TEAMS_TOKEN',
  'DOLPHIN_AGENT_TEAMS_LEADER_PANE'
] as const

/** Hidden CLI verb the guest launcher calls to mint a team for its pane. */
export const WSL_AGENT_TEAMS_ENV_COMMAND = 'agent-teams-wsl-env'

/** Renders the team env as guest `export` lines; refuses values the guest filter would drop or misread. */
export function formatClaudeAgentTeamsWslGuestEnv(env: Record<string, string | undefined>): string {
  const lines: string[] = []
  for (const key of WSL_AGENT_TEAMS_GUEST_ENV_KEYS) {
    const value = env[key]
    if (value === undefined) {
      continue
    }
    if (/['\r\n]/.test(value)) {
      throw new Error(`Agent Teams env ${key} cannot cross into WSL.`)
    }
    lines.push(`export ${key}='${value}'`)
  }
  return lines.map((line) => `${line}\n`).join('')
}
