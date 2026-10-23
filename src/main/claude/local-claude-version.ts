import type { GlobalSettings } from '../../shared/global-settings-types'
import { getManagedAgentHookTarget } from '../../shared/managed-agent-hook-targets'
import { detectLocalManagedAgentCliPresence } from '../agent-hooks/local-agent-cli-presence'
import { probeClaudeCliVersion } from './claude-session-end-hook-capability'

/** Version of the `claude` this host would launch, or null when it is not found. */
export async function probeLocalClaudeVersion(
  settings: Partial<Pick<GlobalSettings, 'agentCmdOverrides'>> | null | undefined
): Promise<string | null> {
  const target = getManagedAgentHookTarget('claude')
  if (!target) {
    return null
  }
  const presence = await detectLocalManagedAgentCliPresence([target], settings)
  const found = presence.claude
  return found?.state === 'found' && found.executablePath
    ? probeClaudeCliVersion(found.executablePath)
    : null
}
