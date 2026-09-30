import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn<(spec: SpawnSpec) => unknown>()
}))

// The claude-teams handler spawns `claude` via spawnProcess; mock it so we can
// inspect the child env without launching a real process.
vi.mock('../../shared/child-process/run-process', () => ({ spawnProcess: spawnMock }))

// Keep the socket runtime client out of the import graph; only the error type
// and serveDolphinApp binding are referenced by the module under test.
vi.mock('../runtime-client', () => ({
  RuntimeClientError: class RuntimeClientError extends Error {
    readonly code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
  serveDolphinApp: vi.fn()
}))

import { CORE_HANDLERS } from './core'
import type { HandlerContext } from '../dispatch'
import type { RuntimeClient } from '../runtime-client'

type SpawnEnv = Record<string, string | undefined>
type SpawnSpec = { program: string; args: string[]; stdio: unknown; env: SpawnEnv }

function lastSpawnSpec(): SpawnSpec {
  const spec = spawnMock.mock.calls.at(-1)?.[0]
  if (!spec) {
    throw new Error('claude was not spawned')
  }
  return spec
}

// Minimal child stub: the handler only awaits `exit`, so resolve it on the next
// microtask to complete the spawned-process promise deterministically.
function mockClaudeChild(exitCode = 0): {
  once: (event: string, cb: (...args: unknown[]) => void) => unknown
} {
  const child = {
    once(event: string, cb: (...args: unknown[]) => void) {
      if (event === 'exit') {
        queueMicrotask(() => cb(exitCode, null))
      }
      return child
    }
  }
  return child
}

describe('dolphin claude-teams CLI handler', () => {
  let previousRunAsNode: string | undefined
  let previousPaneKey: string | undefined
  let previousExitCode: typeof process.exitCode
  let previousWslDistro: string | undefined

  const callMock = vi.fn()
  const client = { call: callMock } as unknown as RuntimeClient

  function runClaudeTeams(cwd = '/tmp/repo'): Promise<void> {
    const ctx: HandlerContext = {
      flags: new Map(),
      client,
      cwd,
      json: false,
      rawArgs: []
    }
    return CORE_HANDLERS['claude-teams'](ctx)
  }

  const hostPlatform = Object.getOwnPropertyDescriptor(process, 'platform')

  beforeEach(() => {
    // Why: win32 refuses claude-teams, so the spawn contract is pinned to a POSIX host.
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    spawnMock.mockReset()
    spawnMock.mockImplementation(() => mockClaudeChild())
    callMock.mockReset()
    callMock.mockResolvedValue({
      result: {
        launch: { env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1', PATH: '/shim:/usr/bin' } }
      }
    })
    previousRunAsNode = process.env.ELECTRON_RUN_AS_NODE
    previousPaneKey = process.env.DOLPHIN_PANE_KEY
    previousExitCode = process.exitCode
    previousWslDistro = process.env.DOLPHIN_CLI_WSL_DISTRO
    delete process.env.DOLPHIN_CLI_WSL_DISTRO
    // The `dolphin` launcher runs Dolphin's Electron binary as Node, so the CLI process
    // itself carries ELECTRON_RUN_AS_NODE=1. Reproduce that inherited flag here.
    process.env.ELECTRON_RUN_AS_NODE = '1'
    process.env.DOLPHIN_PANE_KEY = 'tab-1:leaf-1'
  })

  afterEach(() => {
    if (hostPlatform) {
      Object.defineProperty(process, 'platform', hostPlatform)
    }
    if (previousRunAsNode === undefined) {
      delete process.env.ELECTRON_RUN_AS_NODE
    } else {
      process.env.ELECTRON_RUN_AS_NODE = previousRunAsNode
    }
    if (previousPaneKey === undefined) {
      delete process.env.DOLPHIN_PANE_KEY
    } else {
      process.env.DOLPHIN_PANE_KEY = previousPaneKey
    }
    process.exitCode = previousExitCode
    if (previousWslDistro === undefined) {
      delete process.env.DOLPHIN_CLI_WSL_DISTRO
    } else {
      process.env.DOLPHIN_CLI_WSL_DISTRO = previousWslDistro
    }
  })

  it('does not leak ELECTRON_RUN_AS_NODE into the spawned claude child', async () => {
    await runClaudeTeams()

    const spec = lastSpawnSpec()
    expect(spec.args).toEqual(['--teammate-mode', 'auto'])
    expect(spec.stdio).toBe('inherit')
    expect(spec.env.ELECTRON_RUN_AS_NODE).toBeUndefined()
    expect(process.exitCode).toBe(0)

    // The prepareLaunch request env is built from the same helper, so it must
    // be sanitized too.
    const prepareLaunchEnv = (callMock.mock.calls[0][1] as { env: SpawnEnv }).env
    expect(prepareLaunchEnv.ELECTRON_RUN_AS_NODE).toBeUndefined()
  })

  it('still forwards non-Electron parent env and prepareLaunch env to claude', async () => {
    const previousMarker = process.env.DOLPHIN_TEST_MARKER
    process.env.DOLPHIN_TEST_MARKER = 'keep-me'
    try {
      await runClaudeTeams()
    } finally {
      if (previousMarker === undefined) {
        delete process.env.DOLPHIN_TEST_MARKER
      } else {
        process.env.DOLPHIN_TEST_MARKER = previousMarker
      }
    }

    const spawnEnv = lastSpawnSpec().env
    expect(spawnEnv.DOLPHIN_TEST_MARKER).toBe('keep-me')
    expect(spawnEnv.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBe('1')
    expect(spawnEnv.PATH).toBe('/shim:/usr/bin')
  })

  it('removes managed auth variables before spawning Claude', async () => {
    const previousApiKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'sk-ant-inherited'
    callMock.mockResolvedValueOnce({
      result: {
        launch: {
          env: {
            CLAUDE_CONFIG_DIR: '/managed/claude',
            CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1'
          },
          envToDelete: ['ANTHROPIC_API_KEY']
        }
      }
    })
    try {
      await runClaudeTeams()
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY
      } else {
        process.env.ANTHROPIC_API_KEY = previousApiKey
      }
    }

    const spawnEnv = lastSpawnSpec().env
    expect(spawnEnv.ANTHROPIC_API_KEY).toBeUndefined()
    expect(spawnEnv.CLAUDE_CONFIG_DIR).toBe('/managed/claude')
  })

  it('preserves API-key auth when no managed deletion is requested', async () => {
    const previousApiKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'sk-ant-system'
    try {
      await runClaudeTeams()
    } finally {
      if (previousApiKey === undefined) {
        delete process.env.ANTHROPIC_API_KEY
      } else {
        process.env.ANTHROPIC_API_KEY = previousApiKey
      }
    }

    expect(lastSpawnSpec().env.ANTHROPIC_API_KEY).toBe('sk-ant-system')
  })

  it('keeps an explicit --teammate-mode and reports the claude exit code', async () => {
    spawnMock.mockImplementationOnce(() => mockClaudeChild(3))
    const ctx: HandlerContext = {
      flags: new Map(),
      client,
      cwd: '/tmp/repo',
      json: false,
      rawArgs: ['--teammate-mode=in-process']
    }
    await CORE_HANDLERS['claude-teams'](ctx)

    expect(lastSpawnSpec().args).toEqual(['--teammate-mode=in-process'])
    expect(process.exitCode).toBe(3)
  })

  describe('on Windows', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')

    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    })

    afterEach(() => {
      if (originalPlatform) {
        Object.defineProperty(process, 'platform', originalPlatform)
      }
    })

    it('refuses claude-teams, whose Electron-as-Node hop cannot host the claude TUI', async () => {
      await expect(runClaudeTeams('C:\repo')).rejects.toMatchObject({
        code: 'unsupported_platform',
        message: expect.stringContaining('agent picker')
      })
      expect(callMock).not.toHaveBeenCalled()
      expect(spawnMock).not.toHaveBeenCalled()
    })

    it('refuses claude-teams from an outdated WSL launcher that forwards it to Windows', async () => {
      process.env.DOLPHIN_CLI_WSL_DISTRO = 'Ubuntu'

      await expect(runClaudeTeams('/mnt/c/repo')).rejects.toMatchObject({
        code: 'unsupported_platform'
      })
      expect(callMock).not.toHaveBeenCalled()
      expect(spawnMock).not.toHaveBeenCalled()
    })
  })
})
