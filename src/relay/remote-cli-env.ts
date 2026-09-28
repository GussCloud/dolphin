export function pickRemoteCliEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const picked: Record<string, string> = {}
  for (const key of [
    'DOLPHIN_TERMINAL_HANDLE',
    'DOLPHIN_WORKTREE_ID',
    'DOLPHIN_PANE_KEY',
    'DOLPHIN_AGENT_LAUNCH_TOKEN',
    'DOLPHIN_WORKSPACE_ID',
    'DOLPHIN_USER_DATA_PATH',
    'PATH',
    'Path'
  ]) {
    const value = env[key]
    if (typeof value === 'string') {
      picked[key] = value
    }
  }
  return picked
}
