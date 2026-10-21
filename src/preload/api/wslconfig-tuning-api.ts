import type {
  WslConfigAnalysis,
  WslConfigApplyResult,
  WslConfigSuggestionId
} from '../../shared/wslconfig-tuning-types'

export type WslConfigTuningApi = {
  analyze: () => Promise<WslConfigAnalysis>
  apply: (ids: WslConfigSuggestionId[]) => Promise<WslConfigApplyResult>
}
