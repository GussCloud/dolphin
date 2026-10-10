/**
 * Every Windows PTY in a process drains its ConPTY output through ONE shared worker thread.
 *
 * Upstream node-pty starts a `worker_threads` Worker per PTY (its own V8 isolate, ~13.5 MB
 * private each) only to keep conout draining off the main thread. The patch in
 * config/patches/node-pty@1.1.0.patch shares one worker per process, keeps per-PTY output
 * isolated, and terminates the worker after the last PTY closes. A live Worker holds one
 * MessagePort in `process.getActiveResourcesInfo()`, which is what this counts. If the shared
 * worker dies, every live PTY must still reach an exit and lose its shell, never hang.
 */
import { spawn, type IPty } from 'node-pty'
import type { Worker } from 'node:worker_threads'
import { describe, expect, it } from 'vitest'

const PTY_COUNT = 4

function countMessagePorts(): number {
  return process.getActiveResourcesInfo().filter((name) => name === 'MessagePort').length
}

async function waitUntil(predicate: () => boolean, label: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${label}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

type TrackedPty = { pty: IPty; output: string; exited: boolean }

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function hasKey<K extends string>(value: unknown, key: K): value is Record<K, unknown> {
  return typeof value === 'object' && value !== null && key in value
}

/** The private node-pty Worker behind a PTY's conout connection, read without casts. */
function sharedConoutWorker(pty: IPty): Worker {
  const agent = hasKey(pty, '_agent') ? pty._agent : undefined
  const connection = hasKey(agent, '_conoutSocketWorker') ? agent._conoutSocketWorker : undefined
  const worker = hasKey(connection, '_worker') ? connection._worker : undefined
  if (!hasKey(worker, 'terminate') || typeof worker.terminate !== 'function') {
    throw new Error('node-pty internals changed: no conout worker on this PTY')
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: narrowed above to an object with terminate(); only terminate() is called.
  return worker as unknown as Worker
}

function spawnTracked(): TrackedPty {
  const pty = spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/q'], {
    cwd: process.cwd(),
    env: process.env,
    useConptyDll: true
  })
  const tracked: TrackedPty = { pty, output: '', exited: false }
  pty.onData((chunk) => {
    tracked.output += chunk
  })
  pty.onExit(() => {
    tracked.exited = true
  })
  return tracked
}

describe.skipIf(process.platform !== 'win32')('node-pty shared conout worker', () => {
  it('drains every PTY through one worker and releases it after the last exit', async () => {
    const baselinePorts = countMessagePorts()
    const ptys = Array.from({ length: PTY_COUNT }, spawnTracked)
    try {
      // `^` keeps the typed command distinct from what cmd prints back.
      ptys.forEach(({ pty }, index) => pty.write(`echo MARK-${index}-^END\r`))
      await waitUntil(
        () => ptys.every(({ output }, index) => output.includes(`MARK-${index}-END`)),
        'every PTY echo'
      )
      for (const [index, { output }] of ptys.entries()) {
        const foreign = ptys.some(
          (_, other) => other !== index && output.includes(`MARK-${other}-END`)
        )
        expect(foreign).toBe(false)
      }
      expect(countMessagePorts() - baselinePorts).toBe(1)

      for (const { pty } of ptys) {
        pty.write('exit\r')
      }
      await waitUntil(() => ptys.every(({ exited }) => exited), 'every PTY exit')
      // The worker exits after the 1s conout flush grace.
      await waitUntil(() => countMessagePorts() === baselinePorts, 'conout worker shutdown')
    } finally {
      for (const tracked of ptys) {
        if (!tracked.exited) {
          tracked.pty.kill()
        }
      }
    }
  }, 60_000)

  it('ends every live PTY and its shell when the shared worker dies', async () => {
    const ptys = Array.from({ length: 3 }, spawnTracked)
    try {
      ptys.forEach(({ pty }, index) => pty.write(`echo UP-${index}-^END\r`))
      await waitUntil(
        () => ptys.every(({ output }, index) => output.includes(`UP-${index}-END`)),
        'every PTY echo'
      )
      const worker = sharedConoutWorker(ptys[0]!.pty)
      expect(ptys.every(({ pty }) => sharedConoutWorker(pty) === worker)).toBe(true)

      await worker.terminate()

      await waitUntil(() => ptys.every(({ exited }) => exited), 'every PTY exit after worker death')
      await waitUntil(
        () => ptys.every(({ pty }) => !isProcessAlive(pty.pid)),
        'every shell killed after worker death'
      )
      // The next PTY gets a fresh worker.
      const next = spawnTracked()
      ptys.push(next)
      next.pty.write('echo AGAIN-^END\r')
      await waitUntil(() => next.output.includes('AGAIN-END'), 'respawned PTY echo')
    } finally {
      for (const tracked of ptys) {
        if (!tracked.exited) {
          tracked.pty.kill()
        }
      }
    }
  }, 60_000)
})
