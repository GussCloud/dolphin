import { translate } from '@/i18n/i18n'
import { searchKeywords } from './settings-search-keywords'

export function getClaudeConnectionLossRetryTitle(): string {
  return translate(
    'auto.components.settings.claude-connection-loss-retry-copy.title',
    'Retry Claude after a lost connection'
  )
}

export function getClaudeConnectionLossRetryDescription(): string {
  return translate(
    'auto.components.settings.claude-connection-loss-retry-copy.description',
    'When a Claude turn ends with "Connection lost mid-response", type continue for you up to 3 times. You are notified only if every retry fails.'
  )
}

export function getClaudeConnectionLossRetrySearchKeywords(): string[] {
  return searchKeywords([
    { key: 'auto.components.settings.agents.search.retry', fallback: 'retry' },
    { key: 'auto.components.settings.agents.search.continue', fallback: 'continue' },
    { key: 'auto.components.settings.agents.search.connection', fallback: 'connection' },
    { key: 'auto.components.settings.agents.search.network', fallback: 'network' },
    { key: 'auto.components.settings.agents.search.apiError', fallback: 'api error' },
    { key: 'auto.components.settings.agents.search.claude', fallback: 'claude', englishOnly: true }
  ])
}
