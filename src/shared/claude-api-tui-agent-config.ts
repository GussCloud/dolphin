import type { TuiAgentDetectionRuntime } from './tui-agent-config'

type DetectionRuntimes = {
  detectProvidedRuntimes?: readonly TuiAgentDetectionRuntime[]
  detectUnsupportedRuntimes?: readonly TuiAgentDetectionRuntime[]
}

/**
 * Launch configs of the API-key agents: the Claude Code CLI (and its Agent Teams mode) on an API
 * account's profile and key, which PTY spawn injects. Not detected in WSL, where launches are refused.
 */
export function claudeApiTuiAgentConfigSources<T extends DetectionRuntimes>(
  claude: T,
  claudeAgentTeams: T
): { 'claude-api': T; 'claude-api-agent-teams': Omit<T, 'detectProvidedRuntimes'> } {
  // Why drop the provided WSL runtime: Agent Teams counts every WSL terminal as able to launch it.
  const { detectProvidedRuntimes: _wslProvided, ...teams } = claudeAgentTeams
  return {
    'claude-api': { ...claude, detectUnsupportedRuntimes: ['wsl'] },
    'claude-api-agent-teams': { ...teams, detectUnsupportedRuntimes: ['wsl'] }
  }
}
