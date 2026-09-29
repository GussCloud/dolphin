import type {
  AzureBoardsListFilter,
  AzureBoardsResult,
  AzureBoardsScopeInfo,
  AzureBoardsWorkItem,
  AzureBoardsWorkItemDetail
} from '../../shared/azure-boards-types'

type ProjectArgs = { project: string }

export type AzureBoardsApi = {
  scope: () => Promise<AzureBoardsResult<AzureBoardsScopeInfo>>
  list: (
    args: ProjectArgs & AzureBoardsListFilter
  ) => Promise<AzureBoardsResult<AzureBoardsWorkItem[]>>
  get: (
    args: ProjectArgs & { id: number }
  ) => Promise<AzureBoardsResult<AzureBoardsWorkItemDetail | null>>
  types: (args: ProjectArgs) => Promise<AzureBoardsResult<string[]>>
  create: (
    args: ProjectArgs & { workItemType: string; title: string; description?: string }
  ) => Promise<AzureBoardsResult<AzureBoardsWorkItem>>
  updateState: (
    args: ProjectArgs & { id: number; state: string }
  ) => Promise<AzureBoardsResult<null>>
  addComment: (args: ProjectArgs & { id: number; text: string }) => Promise<AzureBoardsResult<null>>
}
