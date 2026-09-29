import type { z } from 'zod'
import type {
  AzureBoardsResult,
  AzureBoardsScopeInfo,
  AzureBoardsWorkItem,
  AzureBoardsWorkItemDetail
} from '../../shared/azure-boards-types'
import type {
  AzureBoardsAddComment,
  AzureBoardsCreate,
  AzureBoardsGet,
  AzureBoardsList,
  AzureBoardsProject,
  AzureBoardsUpdateState
} from '../../shared/rpc-contract/azure-boards-params'
import { getAzureBoardsScopeInfo } from './azure-boards-scope'
import {
  addAzureBoardsComment,
  createAzureBoardsWorkItem,
  getAzureBoardsWorkItem,
  listAzureBoardsWorkItemTypes,
  listAzureBoardsWorkItems,
  updateAzureBoardsWorkItemState
} from './work-items-client'

// Shared by desktop IPC and runtime RPC; every failure becomes a readable result.
async function attempt<T>(run: () => Promise<T>): Promise<AzureBoardsResult<T>> {
  try {
    return { ok: true, value: await run() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const azureBoardsCommands = {
  scope: (): Promise<AzureBoardsResult<AzureBoardsScopeInfo>> => attempt(getAzureBoardsScopeInfo),
  list: (
    args: z.infer<typeof AzureBoardsList>
  ): Promise<AzureBoardsResult<AzureBoardsWorkItem[]>> =>
    attempt(() => listAzureBoardsWorkItems(args.project, args)),
  get: (
    args: z.infer<typeof AzureBoardsGet>
  ): Promise<AzureBoardsResult<AzureBoardsWorkItemDetail | null>> =>
    attempt(() => getAzureBoardsWorkItem(args.project, args.id)),
  types: (args: z.infer<typeof AzureBoardsProject>): Promise<AzureBoardsResult<string[]>> =>
    attempt(() => listAzureBoardsWorkItemTypes(args.project)),
  create: (
    args: z.infer<typeof AzureBoardsCreate>
  ): Promise<AzureBoardsResult<AzureBoardsWorkItem>> =>
    attempt(() => createAzureBoardsWorkItem(args.project, args)),
  updateState: (args: z.infer<typeof AzureBoardsUpdateState>): Promise<AzureBoardsResult<null>> =>
    attempt(async () => {
      await updateAzureBoardsWorkItemState(args.project, args.id, args.state)
      return null
    }),
  addComment: (args: z.infer<typeof AzureBoardsAddComment>): Promise<AzureBoardsResult<null>> =>
    attempt(async () => {
      await addAzureBoardsComment(args.project, args.id, args.text)
      return null
    })
}
