import { describe, expect, it } from 'vitest'

import {
  DOLPHIND_READINESS_FILENAME,
  dolphindLaunchCommand,
  dolphindLivenessBlocksGc,
  dolphindLivenessProbeCommand,
  DolphindRemoteLaunchUnsupportedError,
  parseDolphindLiveness,
  parseDolphindReadinessOutput
} from './dolphind-remote-launch'
import {
  dolphindStopFreedTheHost,
  parseDolphindStopOutcome,
  stopDolphindCommand
} from './dolphind-remote-process-control'
import { getRemoteHostPlatform } from './ssh-remote-platform'

const posix = getRemoteHostPlatform('linux-x64')
const windows = getRemoteHostPlatform('win32-x64')

const SPEC = {
  remoteInstallDir: '/home/u/.dolphin-remote/dolphind-0.2.0+bb01',
  nodePath: '/usr/bin/node',
  fullVersion: '0.2.0+bb01',
  userDataDir: '/home/u/.dolphin',
  bindHost: '127.0.0.1',
  port: 7777
}

const READY_LINE = JSON.stringify({
  type: 'dolphin_server_ready',
  schemaVersion: 1,
  runtimeId: 'r1',
  boundEndpoint: 'ws://127.0.0.1:7777',
  advertisedEndpoint: null,
  managedWslCliReconciliation: 'settled',
  pairing: { available: false, reason: 'disabled_by_operator', guidance: 'n/a' },
  health: { buildHash: 'abc', terminalDaemon: { state: 'live' } }
})

describe('dolphindLaunchCommand', () => {
  it('states the bind posture rather than inheriting the build default', () => {
    expect(dolphindLaunchCommand(posix, SPEC)).toContain("--bind '127.0.0.1'")
  })

  it('truncates the readiness file, so a stale line cannot be activated on', () => {
    const command = dolphindLaunchCommand(posix, SPEC)
    const truncate = command.indexOf(
      `: > '${SPEC.remoteInstallDir}/${DOLPHIND_READINESS_FILENAME}'`
    )
    const launch = command.indexOf('nohup')
    expect(truncate).toBeGreaterThan(-1)
    expect(truncate).toBeLessThan(launch)
  })

  it('exports the version and the shared data root the deploy decided on', () => {
    const command = dolphindLaunchCommand(posix, SPEC)
    expect(command).toContain(`DOLPHIN_VERSION '${SPEC.fullVersion}'`.replace(' ', '='))
    expect(command).toContain(`DOLPHIN_USER_DATA='${SPEC.userDataDir}'`)
  })

  it('declares the Windows refusal instead of emitting a command that cannot work', () => {
    expect(() => dolphindLaunchCommand(windows, SPEC)).toThrow(DolphindRemoteLaunchUnsupportedError)
  })
})

describe('readiness parsing', () => {
  it('extracts the dolphin_server_ready payload', () => {
    const parsed = parseDolphindReadinessOutput(`${READY_LINE}\n`)
    expect(parsed).toMatchObject({ state: 'ready' })
    expect(parsed.state === 'ready' && parsed.readiness.boundEndpoint).toBe('ws://127.0.0.1:7777')
  })

  it('treats an empty or half-written file as pending, not as a failure', () => {
    expect(parseDolphindReadinessOutput('')).toEqual({ state: 'pending' })
    expect(parseDolphindReadinessOutput('{"type":"dolphin_serv')).toEqual({ state: 'pending' })
  })

  it('reports a complete JSON line that is not a readiness payload as malformed', () => {
    expect(parseDolphindReadinessOutput('{"type":"something_else"}')).toMatchObject({
      state: 'malformed'
    })
  })
})

describe('liveness', () => {
  it('reads the pid recorded in the version dir', () => {
    expect(dolphindLivenessProbeCommand(posix, SPEC.remoteInstallDir)).toContain('.dolphind-pid')
  })

  it.each([
    ['LIVE', 'LIVE', true],
    ['DEAD', 'DEAD', false],
    ['', 'UNKNOWN', true],
    ['garbage', 'UNKNOWN', true]
  ])('parses %s and blocks GC = %s', (output, expected, blocks) => {
    expect(parseDolphindLiveness(output)).toBe(expected)
    expect(dolphindLivenessBlocksGc(parseDolphindLiveness(output))).toBe(blocks)
  })
})

describe('stopping a running dolphind', () => {
  it('sends SIGTERM and never SIGKILL', () => {
    const command = stopDolphindCommand(posix, SPEC.remoteInstallDir, {
      waitSeconds: 20,
      nodePath: SPEC.nodePath
    })
    expect(command).toContain('kill -TERM')
    for (const kill of ['kill -9', 'kill -KILL', 'kill -SIGKILL', 'pkill']) {
      expect(command).not.toContain(kill)
    }
  })

  it.each([
    ['STOPPED', 'stopped', true],
    ['ALREADY_EXITED', 'already-exited', true],
    ['NO_PID', 'no-pid', false],
    ['STILL_RUNNING', 'still-running', false],
    ['SIGNAL_FAILED', 'signal-failed', false],
    ['UNKNOWN', 'unknown', false],
    ['', 'unknown', false]
  ])('parses %s and frees the host = %s', (output, expected, frees) => {
    expect(parseDolphindStopOutcome(output)).toBe(expected)
    expect(dolphindStopFreedTheHost(parseDolphindStopOutcome(output))).toBe(frees)
  })
})
