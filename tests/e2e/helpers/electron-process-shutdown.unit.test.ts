import { EventEmitter } from 'node:events'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PassThrough } from 'node:stream'
import { spawn, type ChildProcess } from 'node:child_process'
import type { ElectronApplication } from '@playwright/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { closeElectronAppForE2E } from './electron-process-shutdown'

function exitedAppFixture() {
  const proc = Object.assign(new EventEmitter(), {
    exitCode: null as number | null,
    signalCode: null,
    stdio: [new PassThrough(), new PassThrough(), new PassThrough()]
  })
  const pipesClosed = Promise.all(
    proc.stdio.map((stream) => new Promise<void>((resolve) => stream.once('close', resolve)))
  )
  const close = vi.fn(() => pipesClosed)
  const app = {
    process: () => proc as unknown as ChildProcess,
    close
  } as unknown as ElectronApplication
  return { proc, app, close }
}

afterEach(() => vi.useRealTimers())

describe('Electron shutdown with inherited pipes', () => {
  it('releases retained pipes only after Electron exits, settling Playwright cleanup', async () => {
    const { proc, app, close } = exitedAppFixture()
    const closing = closeElectronAppForE2E(app)
    expect(close).toHaveBeenCalledOnce()
    expect(proc.stdio.every((stream) => !stream.destroyed)).toBe(true)
    proc.exitCode = 0
    proc.emit('exit', 0, null)
    await closing
    expect(proc.stdio.every((stream) => stream.destroyed)).toBe(true)
    expect(proc.listenerCount('exit')).toBe(0)
  })

  it('releases pipes when Electron already exited before cleanup starts', async () => {
    const { proc, app } = exitedAppFixture()
    proc.exitCode = 0
    await closeElectronAppForE2E(app)
    expect(proc.stdio.every((stream) => stream.destroyed)).toBe(true)
  })

  it('does not release pipes if shutdown times out without confirmed process exit', async () => {
    vi.useFakeTimers()
    const { proc, app } = exitedAppFixture()
    const closing = closeElectronAppForE2E(app)
    await vi.advanceTimersByTimeAsync(10_000)
    await closing
    expect(proc.stdio.every((stream) => !stream.destroyed)).toBe(true)
    expect(proc.listenerCount('exit')).toBe(0)
    for (const stream of proc.stdio) {
      stream.destroy()
    }
  })
})

describe("Electron shutdown with a detached daemon holding Playwright's pipe", () => {
  it.skipIf(process.platform === 'win32')(
    'releases the daemon when Electron exits instead of waiting out the close timeout',
    async () => {
      const userDataDir = mkdtempSync(path.join(tmpdir(), 'dolphin-e2e-close-'))
      // A real process stands in for the daemon that inherits Playwright's control pipe.
      const daemon = spawn('sleep', ['60'], { detached: true, stdio: 'ignore' })
      try {
        mkdirSync(path.join(userDataDir, 'daemon'))
        writeFileSync(
          path.join(userDataDir, 'daemon', 'dolphind.pid'),
          JSON.stringify({ pid: daemon.pid })
        )
        const daemonGone = new Promise<void>((resolve) => daemon.once('exit', () => resolve()))
        const { proc, app } = exitedAppFixture()
        vi.mocked(app.close).mockImplementation(() => daemonGone)

        const started = Date.now()
        const closing = closeElectronAppForE2E(app, { userDataDir })
        proc.exitCode = 0
        proc.emit('exit', 0, null)
        await closing

        expect(Date.now() - started).toBeLessThan(5_000)
        expect(daemon.exitCode !== null || daemon.signalCode !== null).toBe(true)
      } finally {
        daemon.kill('SIGKILL')
        rmSync(userDataDir, { recursive: true, force: true })
      }
    },
    15_000
  )

  it.skipIf(process.platform === 'win32')(
    'leaves the daemon alone while Electron is still running',
    async () => {
      vi.useFakeTimers()
      const userDataDir = mkdtempSync(path.join(tmpdir(), 'dolphin-e2e-close-'))
      const daemon = spawn('sleep', ['60'], { detached: true, stdio: 'ignore' })
      try {
        mkdirSync(path.join(userDataDir, 'daemon'))
        writeFileSync(
          path.join(userDataDir, 'daemon', 'dolphind.pid'),
          JSON.stringify({ pid: daemon.pid })
        )
        const { app } = exitedAppFixture()
        const closing = closeElectronAppForE2E(app, { userDataDir })
        await vi.advanceTimersByTimeAsync(9_000)

        expect(daemon.exitCode).toBeNull()
        expect(daemon.signalCode).toBeNull()
        await vi.advanceTimersByTimeAsync(1_000)
        await closing
      } finally {
        vi.useRealTimers()
        daemon.kill('SIGKILL')
        rmSync(userDataDir, { recursive: true, force: true })
      }
    },
    15_000
  )
})
