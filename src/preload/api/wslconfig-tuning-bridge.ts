import { ipcRenderer } from 'electron'
import type {
  WslConfigAnalysis,
  WslConfigApplyResult,
  WslConfigSuggestionId
} from '../../shared/wslconfig-tuning-types'
import type { PreloadApi } from '../api-types'

export const wslConfigTuningApi = {
  analyze: (): Promise<WslConfigAnalysis> => ipcRenderer.invoke('wslConfigTuning:analyze'),
  apply: (ids: WslConfigSuggestionId[]): Promise<WslConfigApplyResult> =>
    ipcRenderer.invoke('wslConfigTuning:apply', ids)
} satisfies PreloadApi['wslConfigTuning']
