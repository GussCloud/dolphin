import type { ElectronApplication } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Session } from 'node:inspector'
import path from 'node:path'

declare global {
  // Lives in Electron main between the start and stop evaluate calls.
  var __typingBenchMainProfilerSession: Session | undefined
}

// Why in-process: the main thread doubles as the browser UI thread, so a stall there delays
// key dispatch, PTY input and echo at once; only a main-side profile attributes it.
export async function withTypingMainCpuProfile<T>(
  app: ElectronApplication,
  outputPath: string | undefined,
  measure: () => Promise<T>
): Promise<T> {
  if (!outputPath) {
    return measure()
  }
  await app.evaluate(async () => {
    const inspector = process.getBuiltinModule('node:inspector')
    const session = new inspector.Session()
    session.connect()
    globalThis.__typingBenchMainProfilerSession = session
    const post = (method: 'Profiler.enable' | 'Profiler.start'): Promise<void> =>
      new Promise((resolve, reject) =>
        session.post(method, (err) => (err ? reject(err) : resolve()))
      )
    await post('Profiler.enable')
    await new Promise<void>((resolve, reject) =>
      session.post('Profiler.setSamplingInterval', { interval: 1000 }, (err) =>
        err ? reject(err) : resolve()
      )
    )
    await post('Profiler.start')
  })
  try {
    return await measure()
  } finally {
    const profile = await app.evaluate(async () => {
      const session = globalThis.__typingBenchMainProfilerSession
      globalThis.__typingBenchMainProfilerSession = undefined
      if (!session) {
        return 'null'
      }
      return new Promise<string>((resolve, reject) =>
        session.post('Profiler.stop', (err, result) => {
          session.disconnect()
          return err ? reject(err) : resolve(JSON.stringify(result.profile))
        })
      )
    })
    mkdirSync(path.dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, profile)
  }
}
