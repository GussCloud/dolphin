import { ipcRenderer } from 'electron'
import { createUsageProviderApi } from '../usage-provider-api'
import type { PreloadApi } from '../api-types'

export const claudeApiUsageApi = createUsageProviderApi(
  ipcRenderer,
  'claudeApiUsage'
) satisfies PreloadApi['claudeApiUsage']
