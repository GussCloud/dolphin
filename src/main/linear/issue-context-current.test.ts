import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LinearWorkspace } from '../../shared/linear/workspace-types'

const { connectedWorkspaces } = vi.hoisted(() => ({
  connectedWorkspaces: [] as LinearWorkspace[]
}))

vi.mock('./issue-context-client', () => ({
  getConnectedWorkspaces: () => connectedWorkspaces
}))

import {
  getLinearCurrentIssueFromWorktree,
  resolveLegacyLinearLinkWorkspace
} from './issue-context-current'

describe('linear issue current worktree link resolution', () => {
  beforeEach(() => {
    connectedWorkspaces.length = 0
  })

  it('uses split organization URL key metadata from CLI-created Linear links', () => {
    const link = getLinearCurrentIssueFromWorktree({
      id: 'repo::/tmp/worktree',
      path: '/tmp/worktree',
      linkedLinearIssue: 'sta-335',
      linkedLinearIssueWorkspaceId: null,
      linkedLinearIssueOrganizationUrlKey: 'gusscloud'
    })

    expect(link).toMatchObject({
      identifier: 'STA-335',
      workspaceId: null,
      organizationUrlKey: 'gusscloud',
      worktreeId: 'repo::/tmp/worktree'
    })
  })

  it('backfills workspace id from split organization URL key metadata', () => {
    connectedWorkspaces.push(
      makeWorkspace('workspace-1', 'gusscloud'),
      makeWorkspace('workspace-2', 'acme')
    )

    expect(resolveLegacyLinearLinkWorkspace('STA-335', 'gusscloud')).toEqual({
      workspaceId: 'workspace-1',
      organizationUrlKey: 'gusscloud'
    })
  })

  it('keeps ambiguous split organization URL key backfill workspace-free', () => {
    connectedWorkspaces.push(
      makeWorkspace('workspace-1', 'gusscloud'),
      makeWorkspace('workspace-2', 'gusscloud')
    )

    expect(resolveLegacyLinearLinkWorkspace('STA-335', 'gusscloud')).toEqual({
      organizationUrlKey: 'gusscloud'
    })
  })
})

function makeWorkspace(id: string, organizationUrlKey: string): LinearWorkspace {
  return {
    id,
    organizationId: id,
    organizationName: organizationUrlKey,
    organizationUrlKey,
    displayName: organizationUrlKey,
    email: `${id}@example.com`
  }
}
