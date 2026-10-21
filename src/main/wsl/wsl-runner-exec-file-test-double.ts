import type { WslResult } from './wsl-runner'

type ExecFileCallback = (error: Error | null, stdout: string) => void
type ExecFileDouble = (
  command: string,
  args: string[],
  options: object,
  callback: ExecFileCallback
) => unknown

/** Test double: replays runWslProcess as one `wsl.exe` execFile call, so spawn-count suites still see it. */
export function createExecFileWslRunner(execFile: ExecFileDouble): {
  runWslProcess: (request: {
    distro: string
    program: string
    args?: readonly string[]
  }) => Promise<WslResult>
} {
  return {
    runWslProcess: (request) =>
      new Promise((resolve) => {
        execFile(
          'wsl.exe',
          ['-d', request.distro, '--exec', request.program, ...(request.args ?? [])],
          {},
          (error, stdout) =>
            resolve({
              environmentResolved: true,
              code: error ? 1 : 0,
              stdout: error ? '' : stdout,
              stderr: '',
              timedOut: false
            })
        )
      })
  }
}
