/**
 * Every Windows PTY in a process drains its ConPTY output through ONE shared worker thread.
 *
 * Upstream node-pty starts a `worker_threads` Worker per PTY (its own V8 isolate, ~13.5 MB
 * private each) only to keep conout draining off the main thread. The patch in
 * config/patches/node-pty@1.1.0.patch shares one worker per process, keeps per-PTY output
 * isolated, and terminates the worker after the last PTY closes. A live Worker holds one
 * MessagePort in `process.getActiveResourcesInfo()`, which is what this counts.
 */
import { spawn, type IPty } from 'node-pty'
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
})
