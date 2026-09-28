import { describe, expect, it } from 'vitest'

import {
  DOLPHIND_SNAPSHOT_EXCLUDED,
  DOLPHIND_SNAPSHOT_MEMBERS,
  captureDolphindStateSnapshotCommand,
  compareDolphindStateSnapshotCommand,
  newestStateMtimeCommand,
  dolphindSnapshotDirName,
  parseNewestStateMtimeSeconds,
  parseDolphindSnapshotCapture,
  parseDolphindSnapshotRestore,
  restoreDolphindStateSnapshotCommand
} from './dolphind-state-snapshot'
import { getRemoteHostPlatform } from './ssh-remote-platform'

const posix = getRemoteHostPlatform('linux-x64')
const windows = getRemoteHostPlatform('win32-x64')
const ROOT = '/home/u/.dolphin'
const SNAP = '/home/u/.dolphin-remote/dolphind-state-snapshots/pre-0.2.0+bb01-1000'

describe('capturing the pre-activation snapshot', () => {
  it('captures the profile state a rollback needs', () => {
    const command = captureDolphindStateSnapshotCommand(posix, ROOT, SNAP)
    for (const member of DOLPHIND_SNAPSHOT_MEMBERS) {
      expect(command).toContain(`'${member}'`)
    }
  })

  // The live daemon owns <root>/daemon and outlives every restart. Restoring a stale copy of
  // its socket, PID record and token would break the fence that keeps its terminals adoptable.
  it.each(DOLPHIND_SNAPSHOT_EXCLUDED)('never captures %s', (excluded) => {
    expect(captureDolphindStateSnapshotCommand(posix, ROOT, SNAP)).not.toContain(`'${excluded}'`)
  })

  it.each(DOLPHIND_SNAPSHOT_EXCLUDED)('never removes or restores over %s', (excluded) => {
    expect(restoreDolphindStateSnapshotCommand(posix, ROOT, SNAP)).not.toContain(`'${excluded}'`)
  })

  it('writes the archive under a temp name and renames, so a killed deploy leaves no torn tar', () => {
    const command = captureDolphindStateSnapshotCommand(posix, ROOT, SNAP)
    expect(command).toContain('.partial')
    expect(command.indexOf('tar -C')).toBeLessThan(command.indexOf('mv '))
  })

  it.each([
    ['CAPTURED', 'captured'],
    ['EMPTY', 'empty'],
    ['tar: broken', 'failed'],
    ['', 'failed']
  ])('parses %s as %s', (output, expected) => {
    expect(parseDolphindSnapshotCapture(output)).toBe(expected)
  })

  it('keys the snapshot dir on both version and time, so a retry cannot overwrite one', () => {
    expect(dolphindSnapshotDirName('0.2.0+bb01', 1000)).not.toBe(
      dolphindSnapshotDirName('0.2.0+bb01', 2000)
    )
  })
})

describe('restoring the snapshot', () => {
  it('clears the members before extracting, so files the new build added do not survive', () => {
    const command = restoreDolphindStateSnapshotCommand(posix, ROOT, SNAP)
    expect(command.indexOf('rm -rf')).toBeLessThan(command.indexOf('tar -C'))
  })

  it('reports a missing archive instead of extracting nothing and claiming success', () => {
    expect(restoreDolphindStateSnapshotCommand(posix, ROOT, SNAP)).toContain('echo MISSING')
    expect(parseDolphindSnapshotRestore('MISSING')).toBe('missing')
    expect(parseDolphindSnapshotRestore('RESTORED')).toBe('restored')
    expect(parseDolphindSnapshotRestore('FAILED')).toBe('failed')
  })
})

describe('detecting writes since activation', () => {
  it.each([
    ['1700000000', 1_700_000_000],
    ['UNKNOWN', null],
    ['', null]
  ])('parses %s', (output, expected) => {
    expect(parseNewestStateMtimeSeconds(output)).toBe(expected)
  })

  it('looks at the same members the snapshot covers', () => {
    const command = newestStateMtimeCommand(posix, ROOT)
    for (const member of DOLPHIND_SNAPSHOT_MEMBERS) {
      expect(command).toContain(`'${member}'`)
    }
  })
})

describe('Windows hosts', () => {
  it.each([
    ['capture', () => captureDolphindStateSnapshotCommand(windows, ROOT, SNAP)],
    ['restore', () => restoreDolphindStateSnapshotCommand(windows, ROOT, SNAP)],
    ['compare', () => compareDolphindStateSnapshotCommand(windows, ROOT, SNAP)],
    ['mtime', () => newestStateMtimeCommand(windows, ROOT)]
  ])('refuses %s rather than emitting a POSIX command', (_label, build) => {
    expect(build).toThrow('dolphind to a Windows host is not implemented')
  })
})
