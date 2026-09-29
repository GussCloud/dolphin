import { ipcMain } from 'electron'
import type { z } from 'zod'
import type { AzureBoardsResult } from '../../shared/azure-boards-types'
import {
  AzureBoardsAddComment,
  AzureBoardsCreate,
  AzureBoardsGet,
  AzureBoardsList,
  AzureBoardsProject,
  AzureBoardsUpdateState
} from '../../shared/rpc-contract/azure-boards-params'
import { azureBoardsCommands } from '../azure-boards/azure-boards-commands'

function handleParsed<S extends z.ZodType, T>(
  channel: string,
  schema: S,
  run: (args: z.infer<S>) => Promise<AzureBoardsResult<T>>
): void {
  ipcMain.handle(channel, async (_event, args: unknown): Promise<AzureBoardsResult<T>> => {
    const parsed = schema.safeParse(args)
    return parsed.success ? run(parsed.data) : { ok: false, error: 'Invalid Azure Boards request' }
  })
}

export function registerAzureBoardsHandlers(): void {
  ipcMain.handle('azureBoards:scope', () => azureBoardsCommands.scope())
  handleParsed('azureBoards:list', AzureBoardsList, azureBoardsCommands.list)
  handleParsed('azureBoards:get', AzureBoardsGet, azureBoardsCommands.get)
  handleParsed('azureBoards:types', AzureBoardsProject, azureBoardsCommands.types)
  handleParsed('azureBoards:create', AzureBoardsCreate, azureBoardsCommands.create)
  handleParsed('azureBoards:updateState', AzureBoardsUpdateState, azureBoardsCommands.updateState)
  handleParsed('azureBoards:addComment', AzureBoardsAddComment, azureBoardsCommands.addComment)
}
