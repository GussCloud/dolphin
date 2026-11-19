import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const designsApi = {
  onChanged: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('designs:changed', listener)
    return () => {
      ipcRenderer.removeListener('designs:changed', listener)
    }
  }
} satisfies PreloadApi['designs']
