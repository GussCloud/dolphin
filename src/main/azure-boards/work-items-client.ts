import type {
  AzureBoardsComment,
  AzureBoardsListFilter,
  AzureBoardsWorkItem,
  AzureBoardsWorkItemDetail
} from '../../shared/azure-boards-types'
import { sendAzureDevOpsRequest } from '../azure-devops/azure-devops-mutation-request'
import { getAzureBoardsOrganizationUrl } from './azure-boards-scope'

const LIST_LIMIT = 100
const SUMMARY_FIELDS = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.WorkItemType',
  'System.AssignedTo',
  'System.ChangedDate',
  'System.Tags'
]
const JSON_PATCH = 'application/json-patch+json'
// The work item comments API is still versioned as preview.
const COMMENTS_API_VERSION = '7.1-preview.4'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : null
}

function listOf(payload: unknown, key: string): unknown[] {
  const value = asRecord(payload)?.[key]
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function identityName(value: unknown): string | null {
  const identity = asRecord(value)
  const name = identity?.displayName ?? identity?.uniqueName
  return typeof name === 'string' && name ? name : null
}

async function projectBase(project: string): Promise<string> {
  const organizationUrl = await getAzureBoardsOrganizationUrl()
  if (!organizationUrl) {
    throw new Error(
      'Set a default Azure DevOps organization in Settings > Integrations to use Azure Boards.'
    )
  }
  if (!project.trim()) {
    throw new Error('Choose an Azure DevOps project.')
  }
  return `${organizationUrl}/${encodeURIComponent(project.trim())}`
}

/** WIQL string literals escape a single quote by doubling it. */
export function wiqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

export function buildWorkItemsQuery(filter: AzureBoardsListFilter): string {
  const clauses = ['[System.TeamProject] = @project']
  if (!filter.includeClosed) {
    clauses.push("[System.State] NOT IN ('Closed', 'Done', 'Removed', 'Resolved')")
  }
  if (filter.assignedToMe) {
    clauses.push('[System.AssignedTo] = @me')
  }
  const search = filter.search?.trim()
  if (search) {
    clauses.push(
      /^\d+$/.test(search)
        ? `[System.Id] = ${search}`
        : `[System.Title] CONTAINS ${wiqlString(search)}`
    )
  }
  return `SELECT [System.Id] FROM WorkItems WHERE ${clauses.join(' AND ')} ORDER BY [System.ChangedDate] DESC`
}

export function mapWorkItem(raw: unknown, webBase: string): AzureBoardsWorkItem | null {
  const item = asRecord(raw)
  const fields = asRecord(item?.fields)
  const id = item?.id
  if (typeof id !== 'number' || !fields) {
    return null
  }
  return {
    id,
    title: text(fields['System.Title']),
    state: text(fields['System.State']),
    workItemType: text(fields['System.WorkItemType']),
    assignedTo: identityName(fields['System.AssignedTo']),
    url: `${webBase}/_workitems/edit/${id}`,
    changedAt: text(fields['System.ChangedDate']) || null,
    tags: text(fields['System.Tags'])
      .split(';')
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
}

export async function listAzureBoardsWorkItems(
  project: string,
  filter: AzureBoardsListFilter
): Promise<AzureBoardsWorkItem[]> {
  const base = await projectBase(project)
  const result = await sendAzureDevOpsRequest(base, '/_apis/wit/wiql', {
    method: 'POST',
    searchParams: { $top: LIST_LIMIT },
    body: { query: buildWorkItemsQuery(filter) }
  })
  const ids = listOf(result, 'workItems').flatMap((ref) => {
    const id = asRecord(ref)?.id
    return typeof id === 'number' ? [id] : []
  })
  if (ids.length === 0) {
    return []
  }
  const batch = await sendAzureDevOpsRequest(base, '/_apis/wit/workitemsbatch', {
    method: 'POST',
    body: { ids: ids.slice(0, LIST_LIMIT), fields: SUMMARY_FIELDS }
  })
  const byId = new Map(
    listOf(batch, 'value').flatMap((raw) => {
      const item = mapWorkItem(raw, base)
      return item ? [[item.id, item] as const] : []
    })
  )
  // Why: the batch endpoint does not preserve the WIQL ordering.
  return ids.flatMap((id) => byId.get(id) ?? [])
}

function mapComment(raw: unknown): AzureBoardsComment | null {
  const comment = asRecord(raw)
  if (!comment || typeof comment.id !== 'number' || comment.isDeleted === true) {
    return null
  }
  return {
    id: comment.id,
    author: identityName(comment.createdBy) ?? '',
    text: text(comment.text),
    createdAt: text(comment.createdDate)
  }
}

async function workItemStates(base: string, workItemType: string): Promise<string[]> {
  const payload = await sendAzureDevOpsRequest(
    base,
    `/_apis/wit/workitemtypes/${encodeURIComponent(workItemType)}/states`,
    { method: 'GET' }
  ).catch(() => null)
  return listOf(payload, 'value').flatMap((state) => {
    const name = asRecord(state)?.name
    return typeof name === 'string' ? [name] : []
  })
}

export async function getAzureBoardsWorkItem(
  project: string,
  id: number
): Promise<AzureBoardsWorkItemDetail | null> {
  const base = await projectBase(project)
  const raw = await sendAzureDevOpsRequest(base, `/_apis/wit/workitems/${id}`, { method: 'GET' })
  const item = mapWorkItem(raw, base)
  if (!item) {
    return null
  }
  const [comments, states] = await Promise.all([
    sendAzureDevOpsRequest(base, `/_apis/wit/workItems/${id}/comments`, {
      method: 'GET',
      apiVersion: COMMENTS_API_VERSION
    }),
    workItemStates(base, item.workItemType)
  ])
  return {
    ...item,
    description: text(asRecord(asRecord(raw)?.fields)?.['System.Description']),
    comments: listOf(comments, 'comments').flatMap((comment) => mapComment(comment) ?? []),
    states
  }
}

export async function listAzureBoardsWorkItemTypes(project: string): Promise<string[]> {
  const base = await projectBase(project)
  const payload = await sendAzureDevOpsRequest(base, '/_apis/wit/workitemtypes', { method: 'GET' })
  return listOf(payload, 'value').flatMap((type) => {
    const record = asRecord(type)
    // Hidden types (e.g. Code Review Request) cannot be created from the UI.
    return typeof record?.name === 'string' && record.isDisabled !== true ? [record.name] : []
  })
}

export async function createAzureBoardsWorkItem(
  project: string,
  input: { workItemType: string; title: string; description?: string }
): Promise<AzureBoardsWorkItem> {
  const title = input.title.trim()
  if (!title) {
    throw new Error('Title cannot be empty.')
  }
  const base = await projectBase(project)
  const raw = await sendAzureDevOpsRequest(
    base,
    `/_apis/wit/workitems/$${encodeURIComponent(input.workItemType)}`,
    {
      method: 'POST',
      contentType: JSON_PATCH,
      body: [
        { op: 'add', path: '/fields/System.Title', value: title },
        ...(input.description?.trim()
          ? [{ op: 'add', path: '/fields/System.Description', value: input.description.trim() }]
          : [])
      ]
    }
  )
  const created = mapWorkItem(raw, base)
  if (!created) {
    throw new Error('Azure DevOps did not return the created work item.')
  }
  return created
}

export async function updateAzureBoardsWorkItemState(
  project: string,
  id: number,
  state: string
): Promise<void> {
  const base = await projectBase(project)
  await sendAzureDevOpsRequest(base, `/_apis/wit/workitems/${id}`, {
    method: 'PATCH',
    contentType: JSON_PATCH,
    body: [{ op: 'add', path: '/fields/System.State', value: state }]
  })
}

export async function addAzureBoardsComment(
  project: string,
  id: number,
  commentText: string
): Promise<void> {
  const body = commentText.trim()
  if (!body) {
    throw new Error('Comment cannot be empty.')
  }
  const base = await projectBase(project)
  await sendAzureDevOpsRequest(base, `/_apis/wit/workItems/${id}/comments`, {
    method: 'POST',
    apiVersion: COMMENTS_API_VERSION,
    body: { text: body }
  })
}
