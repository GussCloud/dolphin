import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import {
  MultiProjectWorkspacePlanError,
  planMultiProjectMemberAddition,
  planMultiProjectWorkspace
} from './multi-project-workspace-plan'

const ROOT = join('/', 'workspaces')

// Why: each project lives in its own unrelated folder with no group, the case users pick from.
function makeRepo(id: string, overrides: Partial<Repo> = {}): Repo {
  return {
    id,
    path: `/code/${id}-home/${id}`,
    displayName: id,
    badgeColor: '#000',
    addedAt: 0,
    kind: 'git',
    ...overrides
  }
}

const placementRules = {
  repos: [makeRepo('saas'), makeRepo('crm-ui'), makeRepo('crm-api')],
  resolveWorkspaceRoot: () => ROOT,
  hasPinnedWorktreeLocation: () => false,
  sanitizeName: (name: string) => name.replace(/\s+/g, '-'),
  isCaseInsensitiveFs: false
}

function plan(overrides: Partial<Parameters<typeof planMultiProjectWorkspace>[0]> = {}) {
  return planMultiProjectWorkspace({
    ...placementRules,
    containerName: 'feature x',
    repoIds: ['crm-ui', 'crm-api'],
    ...overrides
  })
}

describe('planMultiProjectWorkspace', () => {
  it('places each member under a container named after the workspace', () => {
    const result = plan()
    expect(result.containerPath).toBe(join(ROOT, 'feature-x'))
    expect(result.members.map((member) => member.worktreePath)).toEqual([
      join(ROOT, 'feature-x', 'crm-ui'),
      join(ROOT, 'feature-x', 'crm-api')
    ])
  })

  it('accepts any combination of ungrouped projects from unrelated folders', () => {
    const result = plan({ repoIds: ['saas', 'crm-ui', 'crm-api', 'saas'] })
    expect(result.members.map((member) => member.repo.id)).toEqual(['saas', 'crm-ui', 'crm-api'])
  })

  it('suffixes members whose folders share a name', () => {
    const result = plan({
      repos: [makeRepo('api', { path: '/code/a/app' }), makeRepo('web', { path: '/code/b/App' })],
      repoIds: ['api', 'web'],
      isCaseInsensitiveFs: true
    })
    expect(result.members.map((member) => member.worktreePath)).toEqual([
      join(ROOT, 'feature-x', 'app'),
      join(ROOT, 'feature-x', 'App-2')
    ])
  })

  it.each([
    ['an empty selection', { repoIds: [] }, 'Select at least one project.'],
    ['an unknown project', { repoIds: ['crm-ui', 'stranger'] }, 'was not found'],
    [
      'a folder project',
      { repos: [makeRepo('crm-ui'), makeRepo('crm-api', { kind: 'folder' })] },
      'is not a Git repository'
    ],
    [
      'an SSH project',
      { repos: [makeRepo('crm-ui'), makeRepo('crm-api', { connectionId: 'ssh-1' })] },
      'remote host'
    ],
    [
      'a project with a pinned worktree location',
      { hasPinnedWorktreeLocation: (repo: Repo) => repo.id === 'crm-api' },
      'custom worktree location'
    ],
    [
      'projects that resolve to different workspace roots',
      { resolveWorkspaceRoot: (repo: Repo) => join(ROOT, repo.id) },
      'different folder than "crm-ui"'
    ]
  ])('rejects %s', (_label, overrides, message) => {
    expect(() => plan(overrides)).toThrow(MultiProjectWorkspacePlanError)
    expect(() => plan(overrides)).toThrow(message)
  })
})

describe('planMultiProjectMemberAddition', () => {
  const containerPath = join(ROOT, 'feature-x')

  function addMember(
    overrides: Partial<Parameters<typeof planMultiProjectMemberAddition>[0]> = {}
  ) {
    return planMultiProjectMemberAddition({
      ...placementRules,
      containerPath,
      repoId: 'crm-api',
      existingMembers: [{ repoId: 'crm-ui', worktreePath: join(containerPath, 'crm-ui') }],
      ...overrides
    })
  }

  it('places a new project beside the existing members', () => {
    expect(addMember().worktreePath).toBe(join(containerPath, 'crm-api'))
  })

  it('avoids a folder name an existing member already uses', () => {
    const result = addMember({
      existingMembers: [{ repoId: 'saas', worktreePath: join(containerPath, 'crm-api') }]
    })
    expect(result.worktreePath).toBe(join(containerPath, 'crm-api-2'))
  })

  it.each([
    ['a project already in the workspace', { repoId: 'crm-ui' }, 'already in the workspace'],
    [
      'a project whose worktrees live elsewhere',
      { resolveWorkspaceRoot: () => join('/', 'other') },
      'different folder than this workspace'
    ],
    [
      'a remote project',
      { repos: [makeRepo('crm-api', { executionHostId: 'ssh:box' })] },
      'remote host'
    ]
  ])('rejects %s', (_label, overrides, message) => {
    expect(() => addMember(overrides)).toThrow(message)
  })
})
