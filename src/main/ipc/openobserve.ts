import { ipcMain } from 'electron'
import type { OpenObserveCliStatus, OpenObserveCommandResult } from '../../shared/openobserve-cli'
import {
  OpenObserveActivateContext,
  OpenObserveSaveContext
} from '../../shared/rpc-contract/openobserve-params'
import {
  activateOpenObserveContext,
  saveOpenObserveContext
} from '../openobserve/openobserve-cli-context'
import { getOpenObserveCliStatus } from '../openobserve/openobserve-cli-status'

export function registerOpenObserveHandlers(): void {
  ipcMain.handle('openObserve:status', (): Promise<OpenObserveCliStatus> =>
    getOpenObserveCliStatus()
  )

  ipcMain.handle(
    'openObserve:saveContext',
    async (_event, args: unknown): Promise<OpenObserveCommandResult> => {
      const input = OpenObserveSaveContext.safeParse(args)
      return input.success
        ? saveOpenObserveContext(input.data)
        : { ok: false, error: 'Invalid OpenObserve context' }
    }
  )

  ipcMain.handle(
    'openObserve:activateContext',
    async (_event, name: unknown): Promise<OpenObserveCommandResult> => {
      const input = OpenObserveActivateContext.safeParse({ name })
      return input.success
        ? activateOpenObserveContext(input.data.name)
        : { ok: false, error: 'Invalid OpenObserve context name' }
    }
  )
}
