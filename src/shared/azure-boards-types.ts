// Azure Boards (Azure DevOps work items) as a task source. The host resolves the
// organization itself (Azure CLI defaults or env config); callers only pick a project,
// so a renderer can never point the bearer token at another origin.

export type AzureBoardsWorkItem = {
  id: number
  title: string
  state: string
  workItemType: string
  assignedTo: string | null
  url: string
  changedAt: string | null
  tags: string[]
}

export type AzureBoardsComment = {
  id: number
  author: string
  /** HTML as stored by Azure DevOps. */
  text: string
  createdAt: string
}

export type AzureBoardsWorkItemDetail = AzureBoardsWorkItem & {
  /** HTML as stored by Azure DevOps. */
  description: string
  comments: AzureBoardsComment[]
  /** States valid for this work item type, in workflow order. */
  states: string[]
}

export type AzureBoardsListFilter = {
  search?: string
  assignedToMe?: boolean
  includeClosed?: boolean
}

export type AzureBoardsScopeInfo = {
  /** Null until an organization is known from the Azure CLI defaults or env config. */
  organizationUrl: string | null
  defaultProject: string | null
  projects: string[]
}

export type AzureBoardsResult<T> = { ok: true; value: T } | { ok: false; error: string }

export function azureBoardsWorkItemIdentifier(id: number): string {
  return `AB#${id}`
}
