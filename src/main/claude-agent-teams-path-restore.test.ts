import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AGENT_TEAMS_PATH_RESTORE_BLOCK } from './claude-agent-teams-path-restore'
import { resolveGitBashPath } from './git-bash'

const bashPath = process.platform === 'win32' ? resolveGitBashPath() : '/bin/bash'
const describeWithBash = bashPath && existsSync(bashPath) ? describe : describe.skip

/** Runs the restore block in a non-login bash and returns the resulting PATH. */
function restoredPath(env: Record<string, string>, ostype?: string): string {
  if (!bashPath) {
    throw new Error('bash is required')
  }
  const { PATH: path, ...rest } = env
  // Why in-script: bash assigns OSTYPE at startup and Git for Windows' launcher rewrites PATH.
  const script = `${ostype ? `OSTYPE=${ostype}\n` : ''}PATH='${path}'\n${AGENT_TEAMS_PATH_RESTORE_BLOCK}\nprintf '%s' "$PATH"`
  const result = spawnSync(bashPath, ['--norc', '--noprofile', '-c', script], {
    env: { ...rest, HOME: process.env.HOME ?? '/', SYSTEMROOT: process.env.SYSTEMROOT ?? '' },
    encoding: 'utf8',
    windowsHide: true
  })
  expect(result.stderr).toBe('')
  return result.stdout
}

describeWithBash('agent teams PATH restore', () => {
  it('leads PATH with the ordered dirs and drops their later copies', () => {
    const path = restoredPath(
      {
        PATH: '/usr/bin:/opt/shim:/bin:/opt/tmux',
        DOLPHIN_AGENT_TEAMS_SHIM_DIR: '/opt/shim',
        DOLPHIN_AGENT_TEAMS_SHIM_PATH_DIRS: '/opt/tmux:/opt/shim'
      },
      'linux-gnu'
    )
    expect(path).toBe('/opt/tmux:/opt/shim:/usr/bin:/bin')
  })

  it('leaves a PATH that already leads with the dirs untouched', () => {
    const env = {
      PATH: '/opt/tmux:/opt/shim:/usr/bin:/opt/shim',
      DOLPHIN_AGENT_TEAMS_SHIM_PATH_DIRS: '/opt/tmux:/opt/shim'
    }
    expect(restoredPath(env, 'linux-gnu')).toBe(env.PATH)
  })

  it('falls back to the single shim dir from older launch envs', () => {
    expect(
      restoredPath({ PATH: '/usr/bin', DOLPHIN_AGENT_TEAMS_SHIM_DIR: '/opt/shim' }, 'linux-gnu')
    ).toBe('/opt/shim:/usr/bin')
  })

  it('ignores a Windows-form list outside MSYS instead of splitting it on the drive colon', () => {
    expect(
      restoredPath(
        {
          PATH: '/usr/bin',
          DOLPHIN_AGENT_TEAMS_SHIM_DIR: 'C:\\shim',
          DOLPHIN_AGENT_TEAMS_SHIM_PATH_DIRS: 'C:\\tmux;C:\\shim'
        },
        'linux-gnu'
      )
    ).toBe('/usr/bin')
  })

  it.skipIf(process.platform !== 'win32')(
    'converts the Windows-form list to POSIX in Git Bash so tmux.exe stays ahead of tmux.cmd',
    () => {
      const path = restoredPath({
        PATH: '/usr/bin:/c/Dolphin/resources/bin/agent-teams:/c/Data/claude-agent-teams-bin:/c/Windows',
        DOLPHIN_AGENT_TEAMS_SHIM_DIR: 'C:\\Data\\claude-agent-teams-bin',
        DOLPHIN_AGENT_TEAMS_SHIM_PATH_DIRS:
          'C:\\Dolphin\\resources\\bin\\agent-teams;C:\\Data\\claude-agent-teams-bin'
      })
      expect(path).toBe(
        '/c/Dolphin/resources/bin/agent-teams:/c/Data/claude-agent-teams-bin:/usr/bin:/c/Windows'
      )
    }
  )
})
