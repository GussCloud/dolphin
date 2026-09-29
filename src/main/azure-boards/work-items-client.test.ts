import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addAzureBoardsComment,
  buildWorkItemsQuery,
  createAzureBoardsWorkItem,
  listAzureBoardsWorkItems,
  mapWorkItem,
  updateAzureBoardsWorkItemState,
  wiqlString
} from './work-items-client'
import { readProjectNames } from './azure-boards-scope'
import { _resetAzureDevOpsPreviewApiVersionCache } from '../azure-devops/azure-devops-api-request'

const organizationUrl = vi.hoisted(() => vi.fn())

vi.mock('./azure-boards-scope', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAzureBoardsOrganizationUrl: organizationUrl
}))
vi.mock('../azure-devops/azure-devops-credential', () => ({
  resolveAzureDevOpsAuthHeaders: async () => ({ Authorization: 'Bearer t' })
}))

type Call = { method: string; url: URL; body: unknown; contentType: string | null }

function stubFetch(respond: (call: Call) => unknown): Call[] {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const call = {
        method: init?.method ?? 'GET',
        url: new URL(String(input)),
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
        contentType: new Headers(init?.headers).get('Content-Type')
      }
      calls.push(call)
      return Response.json(respond(call))
    })
  )
  return calls
}

const raw = (id: number, title: string): object => ({
  id,
  fields: {
    'System.Title': title,
    'System.State': 'Active',
    'System.WorkItemType': 'Bug',
    'System.AssignedTo': { displayName: 'Ann' },
    'System.Tags': 'ui; backend',
    'System.ChangedDate': '2026-09-01'
  }
})

describe('WIQL building', () => {
  it('escapes quotes and scopes to open items by default', () => {
    expect(wiqlString("it's")).toBe("'it''s'")
    const query = buildWorkItemsQuery({ search: "O'Brien", assignedToMe: true })
    expect(query).toContain('[System.TeamProject] = @project')
    expect(query).toContain('[System.AssignedTo] = @me')
    expect(query).toContain("[System.Title] CONTAINS 'O''Brien'")
    expect(query).toContain("NOT IN ('Closed', 'Done', 'Removed', 'Resolved')")
  })

  it('searches by id for numeric input and can include closed items', () => {
    const query = buildWorkItemsQuery({ search: '42', includeClosed: true })
    expect(query).toContain('[System.Id] = 42')
    expect(query).not.toContain('NOT IN')
  })
})

describe('mapWorkItem', () => {
  it('maps fields, tags and the web URL', () => {
    expect(mapWorkItem(raw(7, 'Crash'), 'https://dev.azure.com/acme/Web')).toEqual({
      id: 7,
      title: 'Crash',
      state: 'Active',
      workItemType: 'Bug',
      assignedTo: 'Ann',
      url: 'https://dev.azure.com/acme/Web/_workitems/edit/7',
      changedAt: '2026-09-01',
      tags: ['ui', 'backend']
    })
    expect(mapWorkItem({ fields: {} }, '')).toBeNull()
  })
})

describe('Azure Boards REST calls', () => {
  beforeEach(() => {
    _resetAzureDevOpsPreviewApiVersionCache()
    organizationUrl.mockResolvedValue('https://dev.azure.com/acme')
  })
  afterEach(() => vi.unstubAllGlobals())

  it('lists in WIQL order even though the batch endpoint reorders', async () => {
    const calls = stubFetch((call) =>
      call.url.pathname.endsWith('/wiql')
        ? { workItems: [{ id: 2 }, { id: 1 }] }
        : { value: [raw(1, 'one'), raw(2, 'two')] }
    )
    const items = await listAzureBoardsWorkItems('My Project', {})
    expect(items.map((item) => item.id)).toEqual([2, 1])
    expect(calls[0]?.url.pathname).toBe('/acme/My%20Project/_apis/wit/wiql')
    expect(calls[1]?.body).toMatchObject({ ids: [2, 1] })
  })

  it('skips the batch call when nothing matches', async () => {
    const calls = stubFetch(() => ({ workItems: [] }))
    await expect(listAzureBoardsWorkItems('Web', {})).resolves.toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('creates and updates work items with JSON Patch', async () => {
    const calls = stubFetch((call) => (call.method === 'POST' ? raw(9, 'New') : {}))
    await createAzureBoardsWorkItem('Web', { workItemType: 'User Story', title: ' New ' })
    await updateAzureBoardsWorkItemState('Web', 9, 'Resolved')
    expect(calls[0]?.url.pathname).toBe('/acme/Web/_apis/wit/workitems/$User%20Story')
    expect(calls[0]?.contentType).toBe('application/json-patch+json')
    expect(calls[0]?.body).toEqual([{ op: 'add', path: '/fields/System.Title', value: 'New' }])
    expect(calls[1]).toMatchObject({
      method: 'PATCH',
      body: [{ op: 'add', path: '/fields/System.State', value: 'Resolved' }]
    })
  })

  it('posts comments on the preview comments API', async () => {
    const calls = stubFetch(() => ({}))
    await addAzureBoardsComment('Web', 9, 'hello')
    expect(calls[0]?.url.searchParams.get('api-version')).toBe('7.1-preview.4')
  })

  it('refuses to call anything without a configured organization', async () => {
    organizationUrl.mockResolvedValue(null)
    const calls = stubFetch(() => ({}))
    await expect(listAzureBoardsWorkItems('Web', {})).rejects.toThrow(
      'default Azure DevOps organization'
    )
    expect(calls).toHaveLength(0)
  })
})

describe('readProjectNames', () => {
  it('sorts project names and ignores malformed entries', () => {
    expect(readProjectNames({ value: [{ name: 'b' }, { id: 1 }, { name: 'a' }] })).toEqual([
      'a',
      'b'
    ])
  })
})
