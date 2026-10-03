import { afterEach, describe, expect, it, vi } from 'vitest'
import { spawnDaemonChildProcess } from './daemon-launched-child-spawn'

const { spawn, fork, heapCeilingArgs } = vi.hoisted(() => ({
  spawn: vi.fn(),
  fork: vi.fn(),
  heapCeilingArgs: vi.fn((): string[] => ['--max-old-space-size=2048'])
}))
vi.mock('../../shared/child-process/run-process', () => ({ spawnProcess: spawn }))
vi.mock('../../shared/child-process/fork-process', () => ({ forkProcess: fork }))
vi.mock('../../shared/app-environment', () => ({
  getAppEnvironment: () => ({ getVersion: () => '1.0.0' })
}))
vi.mock('./daemon-launch-paths', () => ({ daemonLogArgs: () => [] }))
vi.mock('./daemon-heap-ceiling', () => ({ daemonHeapCeilingExecArgv: heapCeilingArgs }))

const options = {
  entryPath: '/app/daemon-entry.js',
  forkEntryPath: '/app/daemon-entry.js',
  userDataPath: '/tmp/dolphin',
  socketPath: '/tmp/dolphin/daemon.sock',
  tokenPath: '/tmp/dolphin/token',
  pidPath: '/tmp/dolphin/pid',
  launchNonce: 'scope-owner',
  macosLoginSessionWatch: false
}

afterEach(() => vi.clearAllMocks())

describe('daemon launch scope ownership', () => {
  it('only arms lifetime cleanup through the private scope launcher', () => {
    spawnDaemonChildProcess(options, true)
    expect(fork).not.toHaveBeenCalled()
    expect(spawn).toHaveBeenCalledWith(
      expect.objectContaining({
        program: 'systemd-run',
        args: expect.arrayContaining([
          '--scope',
          '--unit=dolphin-daemon-scope-owner.scope',
          '--property=TimeoutStopSec=5s',
          '--fresh-daemon-scope'
        ])
      })
    )
  })

  it('does not arm cleanup on the direct launch fallback', () => {
    spawnDaemonChildProcess(options, false)
    expect(spawn).not.toHaveBeenCalled()
    expect(fork).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.not.arrayContaining(['--fresh-daemon-scope'])
      })
    )
  })
})

describe('daemon heap ceiling', () => {
  it('passes the ceiling as an engine flag on the direct fork, keeping inherited flags', () => {
    spawnDaemonChildProcess(options, false)
    expect(fork).toHaveBeenCalledWith(
      expect.objectContaining({
        execArgv: [...process.execArgv, '--max-old-space-size=2048'],
        args: expect.not.arrayContaining(['--max-old-space-size=2048'])
      })
    )
  })

  it('places the ceiling before the entry module inside the scope launcher', () => {
    spawnDaemonChildProcess(options, true)
    const args: string[] = spawn.mock.calls[0][0].args
    const flagIndex = args.indexOf('--max-old-space-size=2048')
    expect(flagIndex).toBeGreaterThan(args.indexOf('--'))
    expect(flagIndex).toBeLessThan(args.indexOf(options.forkEntryPath))
  })

  it('leaves fork inheriting execArgv when there is no ceiling', () => {
    heapCeilingArgs.mockReturnValueOnce([])
    spawnDaemonChildProcess(options, false)
    expect(fork.mock.calls[0][0]).not.toHaveProperty('execArgv')
  })
})
