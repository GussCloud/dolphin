import type { RuntimeClient } from '../runtime-client'
import { RuntimeClientError } from '../runtime/types'
import { stripElectronRunAsNode } from '../runtime/launch'
import { getWslAccountTarget } from './account-wsl-location'
import { formatClaudeAgentTeamsWslGuestEnv } from '../../shared/claude-agent-teams-wsl-guest-env'

/**
 * Mints a team for the calling WSL pane and prints its guest env; the guest launcher
 * then execs the distro's own claude on the pane PTY (wsl-agent-teams-guest-scripts.ts).
 */
export async function prepareClaudeAgentTeamsWslGuestEnv(
  client: Pick<RuntimeClient, 'call'>,
  cwd: string
): Promise<string> {
  if (!getWslAccountTarget(cwd)) {
    throw new RuntimeClientError(
      'invalid_environment',
      'agent-teams-wsl-env is only called by the Dolphin WSL launcher.'
    )
  }
  const paneKey = process.env.DOLPHIN_PANE_KEY
  if (!paneKey) {
    throw new RuntimeClientError(
      'invalid_environment',
      'dolphin claude-teams must be run inside a Dolphin terminal.'
    )
  }
  const env = Object.fromEntries(
    Object.entries(stripElectronRunAsNode(process.env)).filter(
      (entry): entry is [string, string] => entry[1] !== undefined
    )
  )
  // Why no prepareAuth: its patch targets the Windows claude's config, not the distro's.
  const response = await client.call<{ launch: { env: Record<string, string> } }>(
    'agentTeams.prepareLaunch',
    { paneKey, env }
  )
  return formatClaudeAgentTeamsWslGuestEnv(response.result.launch.env)
}
