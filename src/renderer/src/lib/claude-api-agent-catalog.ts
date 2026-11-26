import { translate } from '@/i18n/i18n'
import { getTuiAgentLaunchCommand, TUI_AGENT_CONFIG } from '../../../shared/tui-agent-config'
import type { AgentCatalogEntry } from './agent-catalog'

/** Catalog rows of the agents billed to a Claude API account; `cmd` is the binary detection uses. */
export function getClaudeApiAgentCatalogEntries(platform: NodeJS.Platform): AgentCatalogEntry[] {
  return [
    {
      id: 'claude-api',
      label: translate('auto.lib.agent.catalog.claude_api_label', 'Claude (API key)'),
      cmd: 'claude',
      homepageUrl: 'https://code.claude.com/docs/en/iam'
    },
    {
      id: 'claude-api-agent-teams',
      label: translate(
        'auto.lib.agent.catalog.claude_api_agent_teams_label',
        'Claude Agent Teams (API key)'
      ),
      cmd: getTuiAgentLaunchCommand(TUI_AGENT_CONFIG['claude-api-agent-teams'], platform),
      homepageUrl: 'https://code.claude.com/docs/en/agent-teams'
    }
  ]
}
