import type * as pty from 'node-pty'

export type PtyStartupLatency = {
  firstOutputMs?: number
  da1QueryMs?: number
  da1ReplyMs?: number
  firstOutputAfterDa1ReplyMs?: number
}

const ESC = '\x1b'
const PRIMARY_DEVICE_ATTRIBUTES_REPLY_BODY = /^\[\?[\d;]*c/
const STARTUP_LATENCY_WINDOW_MS = 15_000

function containsDa1Query(data: string): boolean {
  return data.includes(`${ESC}[c`) || data.includes(`${ESC}[0c`)
}

function containsDa1Reply(data: string): boolean {
  return data.split(ESC).some((part) => PRIMARY_DEVICE_ATTRIBUTES_REPLY_BODY.test(part))
}

/**
 * Diagnostic: when a fresh PTY first prints, and whether a startup DA1 query
 * (ConPTY's console host blocks on it) was answered and how fast. Reports once.
 */
export function observePtyStartupLatency(
  proc: Pick<pty.IPty, 'onData' | 'write'>,
  report: (latency: PtyStartupLatency) => void,
  now: () => number = () => performance.now()
): void {
  const startedAt = now()
  const latency: PtyStartupLatency = {}
  const elapsed = (): number => Math.round(now() - startedAt)
  const originalWrite = proc.write
  let done = false
  const finish = (): void => {
    if (done) {
      return
    }
    done = true
    clearTimeout(timer)
    dataListener.dispose()
    proc.write = originalWrite
    report(latency)
  }
  const dataListener = proc.onData((data) => {
    latency.firstOutputMs ??= elapsed()
    if (latency.da1QueryMs === undefined && containsDa1Query(data)) {
      latency.da1QueryMs = elapsed()
    } else if (latency.da1ReplyMs !== undefined) {
      latency.firstOutputAfterDa1ReplyMs = elapsed()
      finish()
    }
  })
  // Why patch write: replies reach the PTY from several writers (session, startup ingress, barrier).
  proc.write = (data) => {
    if (
      latency.da1QueryMs !== undefined &&
      latency.da1ReplyMs === undefined &&
      containsDa1Reply(String(data))
    ) {
      latency.da1ReplyMs = elapsed()
    }
    originalWrite.call(proc, data)
  }
  const timer = setTimeout(finish, STARTUP_LATENCY_WINDOW_MS)
  timer.unref?.()
}
