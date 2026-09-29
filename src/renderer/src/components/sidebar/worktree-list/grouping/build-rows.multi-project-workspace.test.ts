import { describe, expect, it } from 'vitest'
import { buildRows } from './build-rows'
import { MULTI_PROJECT_WORKSPACES_HEADER_KEY } from './multi-project-workspace-section'
import type { Row, WorktreeGroupBy } from './row-types'
import { repo, worktree } from '../../worktree-list-groups-test-fixtures'
import { getFolderWorkspaceRevealGroupKeys } from '../navigation/folder-reveal'
import type { FolderWorkspace } from '../../../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../../../shared/project-group-types'

const GROUP: ProjectGroup = {
  id: 'group-1',
  name: 'CRM',
  parentPath: '/code/crm',
  parentGroupId: null,
  createdFrom: 'folder-scan',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

const MULTI_PROJECT: FolderWorkspace = {
  id: 'mp-1',
  projectGroupId: null,
  kind: 'multi-project',
  name: 'feature-x',
  folderPath: '/workspaces/feature-x',
  linkedTask: null,
  comment: '',
  isArchived: false,
  isUnread: false,
  isPinned: false,
  sortOrder: 1,
  lastActivityAt: 1,
  createdAt: 1,
  updatedAt: 1,
  workspaceStatus: 'in-progress'
}

function buildSidebarRows(options: {
  groupBy: WorktreeGroupBy
  projectGroups?: readonly ProjectGroup[]
  collapsedGroups?: Set<string>
}): Row[] {
  return buildRows(
    options.groupBy,
    [worktree],
    new Map([[repo.id, repo]]),
    null,
    options.collapsedGroups ?? new Set<string>(),
    undefined,
    undefined,
    'manual',
    {},
    new Map([[worktree.id, worktree]]),
    false,
    undefined,
    options.projectGroups ?? [],
    new Set(),
    new Map(),
    new Map(),
    [],
    undefined,
    [MULTI_PROJECT]
  )
}

function keyOf(row: Row | undefined): string | undefined {
  return row && 'key' in row ? row.key : undefined
}

function folderRowKeys(rows: Row[]): string[] {
  return rows.filter((row) => row.type === 'folder-workspace').map((row) => row.key)
}

describe('groupless multi-project workspaces in the sidebar', () => {
  it.each([
    ['no project groups', []],
    ['unrelated project groups', [GROUP]]
  ])('get their own section under Group by project with %s', (_label, projectGroups) => {
    const rows = buildSidebarRows({ groupBy: 'repo', projectGroups })
    const headerIndex = rows.findIndex((row) => keyOf(row) === MULTI_PROJECT_WORKSPACES_HEADER_KEY)

    expect(headerIndex).toBeGreaterThanOrEqual(0)
    expect(keyOf(rows[headerIndex + 1])).toBe('folder-workspace:mp-1')
    expect(folderRowKeys(rows)).toEqual(['folder-workspace:mp-1'])
  })

  it('keeps the workspace row hidden while its section is collapsed', () => {
    const rows = buildSidebarRows({
      groupBy: 'repo',
      collapsedGroups: new Set([MULTI_PROJECT_WORKSPACES_HEADER_KEY])
    })

    expect(rows.some((row) => keyOf(row) === MULTI_PROJECT_WORKSPACES_HEADER_KEY)).toBe(true)
    expect(folderRowKeys(rows)).toEqual([])
  })

  it.each(['workspace-status', 'pr-status', 'none'] as const)(
    'render in a lane when grouping by %s',
    (groupBy) => {
      expect(folderRowKeys(buildSidebarRows({ groupBy }))).toEqual(['folder-workspace:mp-1'])
    }
  )

  it('reveals through the multi-project section under Group by project', () => {
    expect(
      getFolderWorkspaceRevealGroupKeys('folder:mp-1', [MULTI_PROJECT], [GROUP], {
        groupBy: 'repo',
        defaultHostId: 'local'
      })
    ).toEqual([MULTI_PROJECT_WORKSPACES_HEADER_KEY, 'host:local'])
  })
})
