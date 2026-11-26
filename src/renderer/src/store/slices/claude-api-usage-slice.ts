import type {
  ClaudeUsageRange,
  ClaudeUsageScope,
  ClaudeUsageSnapshot
} from '../../../../shared/claude-usage-types'
import {
  createUsageProviderSlice,
  type ProviderUsageSlice,
  type UsageProviderTypes
} from './usage-provider-slices'

// API-key accounts run Claude Code, so their report reuses Claude's shape under its own state keys.
type ClaudeApiUsageTypes = UsageProviderTypes<
  ClaudeUsageScope,
  ClaudeUsageRange,
  ClaudeUsageSnapshot
>

export type ClaudeApiUsageSlice = ProviderUsageSlice<'claudeApi', 'ClaudeApi', ClaudeApiUsageTypes>

export const createClaudeApiUsageSlice = createUsageProviderSlice<
  'claudeApi',
  'ClaudeApi',
  ClaudeApiUsageTypes
>({
  prefix: 'claudeApi',
  name: 'ClaudeApi',
  initialScope: 'dolphin',
  initialRange: '30d',
  getApi: () => window.api.claudeApiUsage,
  hasCachedData: (state) => state.hasAnyClaudeData
})
