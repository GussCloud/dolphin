import { describe, expect, it } from 'vitest'
import { getLocalExecutionHostLabel } from '../../../src/shared/execution-host'
import {
  buildNewWorkspaceProjectOptions,
  buildNewWorkspaceRunTargetOptions,
  getNewWorkspaceRunTarget
} from './new-workspace-project-targets'

const LOCAL_HOST_LABEL = getLocalExecutionHostLabel('darwin')

describe('new workspace project targets', () => {
  it('groups local and SSH checkouts of the same project', () => {
    const upstream = { owner: 'gusscloud', repo: 'dolphin' }
    const options = buildNewWorkspaceProjectOptions([
      { id: 'local', displayName: 'dolphin', path: '/src/dolphin', upstream },
      {
        id: 'ssh',
        displayName: 'dolphin',
        path: '/home/dev/dolphin',
        connectionId: 'build-server',
        upstream
      }
    ])

    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({ label: 'dolphin', detail: 'gusscloud/dolphin' })
  })

  it('shows the provider slug recovered from canonical git identity', () => {
    const options = buildNewWorkspaceProjectOptions([
      {
        id: 'local',
        displayName: 'dolphin',
        path: '/src/dolphin',
        gitRemoteIdentity: {
          canonicalKey: 'github.com/GussCloud/dolphin',
          remoteName: 'origin',
          remoteUrl: 'git@github.com:gusscloud/dolphin.git'
        }
      }
    ])

    expect(options[0]).toMatchObject({ label: 'dolphin', detail: 'gusscloud/dolphin' })
  })

  it('labels local, SSH, and paired runtime targets', () => {
    expect(
      getNewWorkspaceRunTarget(
        { id: 'local', displayName: 'dolphin', path: '/src/dolphin' },
        'darwin'
      )
    ).toEqual({ label: LOCAL_HOST_LABEL, detail: '/src/dolphin' })
    expect(
      getNewWorkspaceRunTarget({ id: 'local', displayName: 'dolphin', path: 'C:\\src\\dolphin' })
    ).toEqual({ label: 'This computer', detail: 'C:\\src\\dolphin' })
    expect(
      getNewWorkspaceRunTarget(
        { id: 'local', displayName: 'dolphin', path: 'C:\\src\\dolphin' },
        'win32'
      )
    ).toEqual({ label: 'Local Windows', detail: 'C:\\src\\dolphin' })
    expect(
      getNewWorkspaceRunTarget({
        id: 'ssh',
        displayName: 'dolphin',
        path: 'C:\\src\\dolphin',
        executionHostId: 'ssh:Windows%20VM'
      })
    ).toEqual({ label: 'SSH · Windows VM', detail: 'C:\\src\\dolphin' })
    expect(
      getNewWorkspaceRunTarget({
        id: 'runtime',
        displayName: 'dolphin',
        path: '/src/dolphin',
        executionHostId: 'runtime:devbox'
      })
    ).toEqual({ label: 'Remote · devbox', detail: '/src/dolphin' })
  })

  it('shows one target per host when the project has multiple local worktrees', () => {
    const upstream = { owner: 'gusscloud', repo: 'dolphin' }
    const repos = [
      { id: 'local-a', displayName: 'dolphin-a', path: '/src/dolphin-a', upstream },
      { id: 'local-b', displayName: 'dolphin-b', path: '/src/dolphin-b', upstream },
      {
        id: 'ssh',
        displayName: 'dolphin',
        path: '/home/dev/dolphin',
        connectionId: 'build-server',
        upstream
      }
    ]
    const projectId = buildNewWorkspaceProjectOptions(repos)[0]?.id ?? null

    expect(buildNewWorkspaceRunTargetOptions(repos, projectId, 'darwin')).toEqual([
      expect.objectContaining({ id: 'local-a', label: LOCAL_HOST_LABEL, detail: '/src/dolphin-a' }),
      expect.objectContaining({
        id: 'ssh',
        label: 'SSH · build-server',
        detail: '/home/dev/dolphin'
      })
    ])
  })
})
