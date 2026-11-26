import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { claudeTranscriptRootDirs, ompSessionsRootDirs } from './session-scanner-roots'

describe('ompSessionsRootDirs', () => {
  it('drops a degenerate root that would resolve to the process cwd', () => {
    // normalizeAgentSessionsDir('/') returns ''. Kept, that root would resolve()
    // to the cwd and allowlist it for renderer-supplied subagent paths.
    expect(ompSessionsRootDirs({ ompSessionsDir: '' })).toEqual([])
    expect(ompSessionsRootDirs({ ompSessionsDir: '   ' })).toEqual([])
  })

  it('keeps the host root and one root per distinct WSL distro home', () => {
    expect(
      ompSessionsRootDirs({
        ompSessionsDir: '/home/ada/.omp/agent/sessions',
        wslHomeDirs: ['/wsl/ubuntu/home/ada', '/wsl/ubuntu/home/ada', '  ']
      })
    ).toEqual([
      '/home/ada/.omp/agent/sessions',
      join('/wsl/ubuntu/home/ada', '.omp', 'agent', 'sessions')
    ])
  })
})

describe('claudeTranscriptRootDirs', () => {
  const profileProjects = join('/data', 'claude-accounts', 'work', 'config', 'projects')

  const apiProjects = join('/data', 'claude-accounts', 'api-1', 'config', 'projects')

  it('admits Claude account profile histories for Claude only', () => {
    expect(claudeTranscriptRootDirs('claude', [], { plan: [profileProjects] })).toContain(
      profileProjects
    )
    expect(claudeTranscriptRootDirs('deepseek', [], { plan: [profileProjects] })).not.toContain(
      profileProjects
    )
  })

  it('gives each API account profile history to claude-api only', () => {
    const profiles = { plan: [profileProjects], api: [apiProjects] }
    expect(claudeTranscriptRootDirs('claude-api', ['/wsl/home'], profiles)).toEqual([apiProjects])
    expect(claudeTranscriptRootDirs('claude', [], profiles)).not.toContain(apiProjects)
    expect(claudeTranscriptRootDirs('deepseek', [], profiles)).not.toContain(apiProjects)
  })
})
