import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runProcessSync } from '../../shared/child-process/run-process'
import { removeTree } from '../../shared/windows-transient-lock-removal'
import { buildWslAgentTeamsTmuxShim } from './wsl-agent-teams-guest-scripts'
import { buildWslLauncher } from './wsl-cli-scripts'

const posix = process.platform !== 'win32'
const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await removeTree(root)
  }
})

async function fixtureRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dolphin wsl agent teams ')))
  roots.push(root)
  return root
}

async function writeExecutable(path: string, content: string): Promise<void> {
  await writeFile(path, content, { mode: 0o700 })
}

function recordArgsAndEnv(names: string[]): string {
  return `#!/bin/bash\nprintf '%s\\0' "$@"\n${names.map((name) => `printf '${name}=%s\\0' "\${${name}:-}"`).join('\n')}\n`
}

describe('WSL Agent Teams guest tmux shim', () => {
  it('execs the sibling launcher with agent-teams-tmux and no shell rewriting', () => {
    const shim = buildWslAgentTeamsTmuxShim('dolphin-ide')
    expect(shim.startsWith('#!/bin/sh\n')).toBe(true)
    expect(shim).toContain('exec "$(dirname -- "$0")/../dolphin-ide" agent-teams-tmux "$@"')
  })

  it.skipIf(!posix)(
    'forwards the team credentials guest->Windows exactly once and keeps tmux argv intact',
    async () => {
      const root = await fixtureRoot()
      await mkdir(join(root, 'agent-teams-bin'))
      await writeExecutable(
        join(root, 'agent-teams-bin', 'tmux'),
        buildWslAgentTeamsTmuxShim('dolphin-ide')
      )
      await writeExecutable(join(root, 'dolphin-ide'), recordArgsAndEnv(['WSLENV']))
      const argv = ['display-message', '-t', '%1', '-p', '#{pane_id} $HOME "q"']
      const result = runProcessSync({
        program: join(root, 'agent-teams-bin', 'tmux'),
        args: argv,
        env: {
          PATH: process.env.PATH ?? '/usr/bin:/bin',
          WSLENV:
            'DOLPHIN_USER_DATA_PATH/p::TMUX_PANE/u:DOLPHIN_AGENT_TEAMS_TOKEN:DOLPHIN_PANE_KEY/u'
        }
      })
      expect(result.code).toBe(0)
      expect(result.stdout.split('\0').slice(0, -1)).toEqual([
        'agent-teams-tmux',
        ...argv,
        'WSLENV=DOLPHIN_USER_DATA_PATH/p:DOLPHIN_PANE_KEY/u:DOLPHIN_AGENT_TEAMS_TEAM_ID/w:DOLPHIN_AGENT_TEAMS_TOKEN/w:TMUX_PANE/w'
      ])
    }
  )
})

describe('WSL launcher claude-teams branch', () => {
  async function launcherFixture(powershellBody: string) {
    const root = await fixtureRoot()
    const fakeBin = join(root, 'fake-bin')
    await mkdir(fakeBin)
    await writeExecutable(join(fakeBin, 'wslpath'), '#!/bin/bash\nprintf "%s" "$2"\n')
    await writeExecutable(join(fakeBin, 'powershell.exe'), powershellBody)
    await writeExecutable(
      join(fakeBin, 'claude'),
      recordArgsAndEnv(['TMUX', 'TMUX_PANE', 'DOLPHIN_AGENT_TEAMS_TOKEN', 'PATH', 'INJECTED'])
    )
    await mkdir(join(root, 'agent-teams-bin'))
    await writeExecutable(
      join(root, 'agent-teams-bin', 'tmux'),
      buildWslAgentTeamsTmuxShim('dolphin-ide')
    )
    const launcher = join(root, 'dolphin-ide')
    await writeExecutable(launcher, buildWslLauncher('C:\\Dolphin\\dolphin.exe', '/bridge.ps1'))
    const run = (args: string[], env: Record<string, string> = {}) =>
      runProcessSync({
        program: '/bin/bash',
        args: [launcher, ...args],
        env: { PATH: `${fakeBin}:/usr/bin:/bin`, HOME: root, ...env },
        cwd: root
      })
    return { root, run }
  }

  it.skipIf(!posix)(
    'runs the distro claude on this PTY with only the filtered team env and the shim first on PATH',
    async () => {
      const { root, run } = await launcherFixture(
        [
          '#!/bin/bash',
          // Why the noise lines: only well-formed allowlisted exports may reach eval.
          'echo "banner from a profile"',
          `echo "export INJECTED='x'"`,
          `echo "export TMUX='/tmp/dolphin-claude-agent-teams/team-1,0,1'"`,
          `printf "export TMUX_PANE='%%1'\\r\\n"`,
          `echo "export DOLPHIN_AGENT_TEAMS_TEAM_ID='team-1'"`,
          `echo "export DOLPHIN_AGENT_TEAMS_TOKEN='tok'"`,
          `echo "touch pwned"`,
          `echo "WSLENV=$WSLENV ARGS=$*" >&2`
        ].join('\n')
      )
      const result = run(['claude-teams', '--resume', 'a b'], {
        WSL_DISTRO_NAME: 'Ubuntu Work',
        WSLENV: 'DOLPHIN_PANE_KEY/u'
      })
      expect(result.code).toBe(0)
      expect(result.stderr).toContain('WSLENV=DOLPHIN_PANE_KEY/w ')
      expect(result.stderr).toContain(
        `ARGS=-NoProfile -ExecutionPolicy Bypass -File /bridge.ps1 C:\\Dolphin\\dolphin.exe -WslCwd ${root} -WslDistro Ubuntu Work agent-teams-wsl-env`
      )
      expect(result.stdout.split('\0').slice(0, -1)).toEqual([
        '--teammate-mode',
        'auto',
        '--resume',
        'a b',
        'TMUX=/tmp/dolphin-claude-agent-teams/team-1,0,1',
        'TMUX_PANE=%1',
        'DOLPHIN_AGENT_TEAMS_TOKEN=tok',
        `PATH=${root}/agent-teams-bin:${root}/fake-bin:/usr/bin:/bin`,
        'INJECTED='
      ])
    }
  )

  it.skipIf(!posix)('keeps an explicit teammate mode', async () => {
    const { run } = await launcherFixture(
      `#!/bin/bash\necho "export DOLPHIN_AGENT_TEAMS_TEAM_ID='team-1'"\n`
    )
    const result = run(['claude-teams', '--teammate-mode=in-process'])
    expect(result.code).toBe(0)
    expect(result.stdout.split('\0')[0]).toBe('--teammate-mode=in-process')
    expect(result.stdout.split('\0')[1]).toMatch(/^TMUX=/)
  })

  it.skipIf(!posix)('falls back to in-process teammates when Windows minted no team', async () => {
    const { root, run } = await launcherFixture('#!/bin/bash\necho "nothing useful"\n')
    const result = run(['claude-teams', '--resume', 'x'], {
      DOLPHIN_AGENT_TEAMS_TEAM_ID: 'stale-team',
      TMUX: '/tmp/real-tmux,1,0'
    })
    expect(result.code).toBe(0)
    expect(result.stderr).toContain('teammates will run in-process')
    expect(result.stdout.split('\0').slice(0, -1)).toEqual([
      '--teammate-mode',
      'in-process',
      '--resume',
      'x',
      'TMUX=',
      'TMUX_PANE=',
      'DOLPHIN_AGENT_TEAMS_TOKEN=',
      `PATH=${root}/fake-bin:/usr/bin:/bin`,
      'INJECTED='
    ])
  })

  it.skipIf(!posix)('keeps an explicit teammate mode on the in-process fallback', async () => {
    const { run } = await launcherFixture('#!/bin/bash\necho "nothing useful"\n')
    const result = run(['claude-teams', '--teammate-mode', 'tmux'])
    expect(result.code).toBe(0)
    expect(result.stdout.split('\0').slice(0, 2)).toEqual(['--teammate-mode', 'tmux'])
  })

  it.skipIf(!posix)('propagates a failed Windows prepare without starting claude', async () => {
    const { run } = await launcherFixture('#!/bin/bash\necho "boom" >&2\nexit 7\n')
    const result = run(['claude-teams'])
    expect(result.code).toBe(7)
    expect(result.stdout).toBe('')
  })
})
