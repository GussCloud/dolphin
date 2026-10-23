import { ipcRenderer } from 'electron'
import { createUsageProviderApi } from '../usage-provider-api'
import type { PreloadApi } from '../api-types'

export const deepSeekUsageApi = createUsageProviderApi(
  ipcRenderer,
  'deepSeekUsage'
) satisfies PreloadApi['deepSeekUsage']
