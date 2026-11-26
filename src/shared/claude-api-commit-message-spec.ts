import type { CommitMessageAgentSpec } from './commit-message-agent-spec'

/**
 * The `claude-api` generation spec: the plain Claude spec's CLI args, models and default (Sonnet,
 * low effort), so an API account is billed at the same model a plan generation would pick.
 * Static models: discovery would run `claude` where an SSH host's plan login answers.
 */
export function claudeApiCommitMessageSpecs(claude: CommitMessageAgentSpec | undefined): {
  'claude-api'?: CommitMessageAgentSpec
} {
  if (!claude) {
    return {}
  }
  const { modelDiscovery: _planDiscovery, ...shared } = claude
  return {
    'claude-api': { ...shared, id: 'claude-api', label: 'Claude (API key)', modelSource: 'static' }
  }
}
