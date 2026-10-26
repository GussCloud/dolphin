import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const autonomousGoalsApi = {
  onChanged: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('autonomousGoals:changed', listener)
    return () => {
      ipcRenderer.removeListener('autonomousGoals:changed', listener)
    }
  }
} satisfies PreloadApi['autonomousGoals']
