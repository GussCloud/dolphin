import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ProjectGroup } from '../../shared/project-group-types'
import type { Repo } from '../../shared/repo-types'
import {
  MultiProjectWorkspacePlanError,
  planMultiProjectWorkspace
} from './multi-project-workspace-plan'

const ROOT = join('/', 'workspaces')

function makeGroup(id: string, parentGroupId: string | null = null): ProjectGroup {
  return {
    id,
    name: id,
    parentPath: `/code/${id}`,
    parentGroupId,
    createdFrom: 'folder-scan',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 0,
    updatedAt: 0
  }
}

function makeRepo(id: string, overrides: Partial<Repo> = {}): Repo {
  return {
    id,
    path: `/code/group/${id}`,
    displayName: id,
    badgeColor: '#000',
    addedAt: 0,
    kind: 'git',
    projectGroupId: 'group',
    ...overrides
  }
}

function plan(overrides: Partial<Parameters<typeof planMultiProjectWorkspace>[0]> = {}) {
  return planMultiProjectWorkspace({
    projectGroupId: 'group',
    containerName: 'feature x',
    repoIds: ['api', 'web'],
    projectGroups: [makeGroup('group'), makeGroup('nested', 'group')],
    repos: [makeRepo('api'), makeRepo('web'), makeRepo('lib', { projectGroupId: 'nested' })],
    resolveWorkspaceRoot: () => ROOT,
    hasPinnedWorktreeLocation: () => false,
    sanitizeName: (name) => name.replace(/\s+/g, '-'),
    isCaseInsensitiveFs: false,
    ...overrides
  })
}

describe('planMultiProjectWorkspace', () => {
  it('places each member under a container named after the workspace', () => {
    const result = plan()
    expect(result.containerPath).toBe(join(ROOT, 'feature-x'))
    expect(result.members.map((member) => member.worktreePath)).toEqual([
      join(ROOT, 'feature-x', 'api'),
      join(ROOT, 'feature-x', 'web')
    ])
  })

  it('accepts ungrouped projects that live inside the group folder', () => {
    const result = plan({
      repos: [
        makeRepo('api'),
        makeRepo('web', { projectGroupId: undefined, path: '/code/group/web' })
      ]
    })
    expect(result.members.map((member) => member.repo.id)).toEqual(['api', 'web'])
  })

  it('accepts projects from nested groups and ignores duplicate ids', () => {
    const result = plan({ repoIds: ['api', 'lib', 'api'] })
    expect(result.members.map((member) => member.repo.id)).toEqual(['api', 'lib'])
  })

  it('suffixes members whose folders share a name', () => {
    const result = plan({
      repos: [makeRepo('api', { path: '/code/a/app' }), makeRepo('web', { path: '/code/b/App' })],
      isCaseInsensitiveFs: true
    })
    expect(result.members.map((member) => member.worktreePath)).toEqual([
      join(ROOT, 'feature-x', 'app'),
      join(ROOT, 'feature-x', 'App-2')
    ])
  })

  it.each([
    ['an empty selection', { repoIds: [] }, 'Select at least one project.'],
    ['an unknown project', { repoIds: ['api', 'stranger'] }, 'is not in "group"'],
    [
      'a project outside the group and its folder',
      {
        repos: [
          makeRepo('api'),
          makeRepo('web', { projectGroupId: 'other', path: '/elsewhere/web' })
        ]
      },
      'is not in "group"'
    ],
    [
      'a folder project',
      { repos: [makeRepo('api'), makeRepo('web', { kind: 'folder' })] },
      'is not a Git repository'
    ],
    [
      'an SSH project',
      { repos: [makeRepo('api'), makeRepo('web', { connectionId: 'ssh-1' })] },
      'remote host'
    ],
    [
      'a project with a pinned worktree location',
      { hasPinnedWorktreeLocation: (repo: Repo) => repo.id === 'web' },
      'custom worktree location'
    ],
    [
      'projects that resolve to different workspace roots',
      { resolveWorkspaceRoot: (repo: Repo) => join(ROOT, repo.id) },
      'different folder'
    ]
  ])('rejects %s', (_label, overrides, message) => {
    expect(() => plan(overrides)).toThrow(MultiProjectWorkspacePlanError)
    expect(() => plan(overrides)).toThrow(message)
  })
})
