import { createWriteStream, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnProcess } from '../../../shared/child-process/run-process'
import { resolveCommandOnLocalPath } from '../../../shared/child-process/command-path-resolution'

const TAIL_BYTES = 4096
const TAIL_LINES = 15

export type HeavyJobRun = {
  exitCode: number
  durationMs: number
  logPath: string
  tail: string
}

/**
 * Runs the command in the caller's worktree with full output in a log file, so the agent reads
 * only the tail instead of paying tokens for a whole build log.
 */
export async function runHeavyJob(command: readonly string[], cwd: string): Promise<HeavyJobRun> {
  const [program, ...args] = command
  const logDir = path.join(tmpdir(), 'dolphin-exec')
  mkdirSync(logDir, { recursive: true })
  const logPath = path.join(
    logDir,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.log`
  )
  const log = createWriteStream(logPath)
  let tail = Buffer.alloc(0)
  const record = (chunk: Buffer): void => {
    log.write(chunk)
    tail = Buffer.concat([tail, chunk])
    if (tail.length > TAIL_BYTES) {
      tail = tail.subarray(tail.length - TAIL_BYTES)
    }
  }
  const startedAt = Date.now()
  const exitCode = await new Promise<number>((resolve) => {
    void resolveProgram(program, cwd).then((resolved) => {
      let child: ReturnType<typeof spawnProcess>
      try {
        child = spawnProcess({ program: resolved, args, cwd, env: process.env })
      } catch (error) {
        record(Buffer.from(`${error instanceof Error ? error.message : String(error)}\n`))
        resolve(127)
        return
      }
      child.stdin.end()
      child.stdout.on('data', record)
      child.stderr.on('data', record)
      const forward = (): void => {
        child.kill()
      }
      const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const
      for (const signal of signals) {
        process.once(signal, forward)
      }
      const settle = (code: number): void => {
        for (const signal of signals) {
          process.removeListener(signal, forward)
        }
        resolve(code)
      }
      child.once('error', (error) => {
        record(Buffer.from(`${error.message}\n`))
        settle(127)
      })
      child.once('close', (code) => settle(typeof code === 'number' ? code : 1))
    })
  })
  await new Promise<void>((resolve) => log.end(resolve))
  return {
    exitCode,
    durationMs: Date.now() - startedAt,
    logPath,
    tail: lastLines(tail.toString('utf8'), TAIL_LINES)
  }
}

async function resolveProgram(program: string, cwd: string): Promise<string> {
  if (path.isAbsolute(program)) {
    return program
  }
  if (program.includes('/') || program.includes('\\')) {
    return path.resolve(cwd, program)
  }
  // Why: Node does not apply PATHEXT, so a bare `pnpm` must resolve to its `.cmd` on Windows.
  return (await resolveCommandOnLocalPath(program, { cwd })) ?? program
}

function lastLines(text: string, count: number): string {
  const lines = text.replace(/\s+$/, '').split(/\r?\n/)
  return lines.slice(-count).join('\n')
}
