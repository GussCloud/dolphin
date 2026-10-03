import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  evaluateReproduction,
  MEMORY_AUDIT_REPRODUCTIONS,
  runMemoryAuditReproductions
} from './run-memory-audit-reproductions.mjs'

const MIB = 1024 * 1024

function reproduction(audit) {
  const entry = MEMORY_AUDIT_REPRODUCTIONS.find((candidate) => candidate.audit === audit)
  if (!entry) {
    throw new Error(`missing reproduction ${audit}`)
  }
  return entry
}

function succeeded(output) {
  return { status: 0, signal: null, stdout: `log line\n${JSON.stringify(output)}\n`, stderr: '' }
}

function heapCase(fixed, heapDelta, extra = {}) {
  return { kind: 'command-code-detector', fixed, inputChars: 65536, count: 32, heapDelta, ...extra }
}

describe('run-memory-audit-reproductions', () => {
  it('points every selected reproduction at an existing audit script', () => {
    for (const { audit } of MEMORY_AUDIT_REPRODUCTIONS) {
      expect(existsSync(`docs/audits/${audit}/reproduce.mjs`), audit).toBe(true)
    }
  })

  it('passes heap cases that retain under the baseline and the ceiling', () => {
    const output = { results: [heapCase(false, 2 * MIB), heapCase(true, 500_000)] }
    expect(evaluateReproduction(reproduction('pty-detector-retention'), succeeded(output))).toEqual(
      []
    )
  })

  it('fails heap cases that regress toward the baseline or exceed the ceiling', () => {
    const nearBaseline = { results: [heapCase(false, 2 * MIB), heapCase(true, 1.5 * MIB)] }
    const failures = evaluateReproduction(
      reproduction('pty-detector-retention'),
      succeeded(nearBaseline)
    )
    expect(failures.join('\n')).toContain('not under half')
    expect(failures.join('\n')).toContain('exceeded ceiling 1048576 B')
  })

  it('fails when a fixed case has no baseline to prove the defect is exercised', () => {
    const failures = evaluateReproduction(
      reproduction('pty-detector-retention'),
      succeeded({ results: [heapCase(true, 10)] })
    )
    expect(failures).toEqual(['command-code-detector 65536 chars: no baseline case to compare'])
  })

  it('bounds owned text copies by their returned bytes', () => {
    const textCase = (fixed, heapDelta) => ({
      kind: 'terminal-session-buffer',
      fixed,
      entries: 8,
      logicalBytes: 4 * MIB,
      heapDelta
    })
    const check = reproduction('retained-text-slices')
    expect(
      evaluateReproduction(
        check,
        succeeded({ results: [textCase(false, 32 * MIB), textCase(true, 4 * MIB)] })
      )
    ).toEqual([])
    expect(
      evaluateReproduction(
        check,
        succeeded({ results: [textCase(false, 32 * MIB), textCase(true, 7 * MIB)] })
      ).join('\n')
    ).toContain('exceeded ceiling')
  })

  it('requires the late-cancel source to release every pending request', () => {
    const check = reproduction('scanner-late-cancel')
    const clean = { after: { pending: 0, controllers: 0, cancelled: 0 } }
    expect(evaluateReproduction(check, succeeded(clean))).toEqual([])
    expect(
      evaluateReproduction(
        check,
        succeeded({ after: { pending: 0, controllers: 0, cancelled: 3 } })
      )
    ).toEqual(['after.cancelled is 3, expected 0'])
  })

  it('reports script failures, signals and unreadable output', () => {
    const check = reproduction('scanner-late-cancel')
    expect(
      evaluateReproduction(check, { status: 1, signal: null, stdout: '', stderr: 'a\nboom' })
    ).toEqual(['exited 1:\na\nboom'])
    expect(evaluateReproduction(check, { status: null, signal: 'SIGTERM' })).toEqual([
      'exited with signal SIGTERM'
    ])
    expect(evaluateReproduction(check, { status: 0, signal: null, stdout: 'no json' })).toEqual([
      'unreadable result: no JSON result printed'
    ])
  })

  it('runs each reproduction in the background with its node flags and fails on any failure', () => {
    const calls = []
    const errors = []
    const exitCode = runMemoryAuditReproductions({
      reproductions: [
        { audit: 'a', nodeFlags: ['--expose-gc'], check: () => [] },
        { audit: 'b', nodeFlags: [], check: () => ['too big'] }
      ],
      spawnSyncImpl: (command, args, options) => {
        calls.push({ command, args, launch: options.env.DOLPHIN_BACKGROUND_LAUNCH })
        return succeeded({})
      },
      log: () => {},
      logError: (line) => errors.push(line)
    })

    expect(exitCode).toBe(1)
    expect(calls).toEqual([
      {
        command: process.execPath,
        args: ['--expose-gc', 'docs/audits/a/reproduce.mjs'],
        launch: '1'
      },
      { command: process.execPath, args: ['docs/audits/b/reproduce.mjs'], launch: '1' }
    ])
    expect(errors.join('\n')).toMatch(/FAIL b .*\n {2}- too big/)
  })
})
