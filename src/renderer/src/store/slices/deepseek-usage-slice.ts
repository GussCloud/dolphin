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

// DeepSeek runs Claude Code, so its report reuses Claude's shape under its own state keys.
type DeepSeekUsageTypes = UsageProviderTypes<
  ClaudeUsageScope,
  ClaudeUsageRange,
  ClaudeUsageSnapshot
>

export type DeepSeekUsageSlice = ProviderUsageSlice<'deepSeek', 'DeepSeek', DeepSeekUsageTypes>

export const createDeepSeekUsageSlice = createUsageProviderSlice<
  'deepSeek',
  'DeepSeek',
  DeepSeekUsageTypes
>({
  prefix: 'deepSeek',
  name: 'DeepSeek',
  initialScope: 'dolphin',
  initialRange: '30d',
  getApi: () => window.api.deepSeekUsage,
  hasCachedData: (state) => state.hasAnyClaudeData
})
