import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'

export const MAX_DOLPHIN_RPC_OUTPUT_BYTES = 20 * 1024 * 1024

export function appendDolphinRpcOutput(output, chunk, bytes, limit = MAX_DOLPHIN_RPC_OUTPUT_BYTES) {
  const nextBytes = bytes + Buffer.byteLength(chunk)
  return {
    output: nextBytes > limit ? output : output + chunk,
    bytes: nextBytes,
    exceeded: nextBytes > limit
  }
}

export function resolveDolphinCliCommand({ env = process.env, platform = process.platform } = {}) {
  if (env.DOLPHIN_CLI_COMMAND?.trim()) {
    return env.DOLPHIN_CLI_COMMAND.trim()
  }
  if (env.DOLPHIN_DEV_REPO_ROOT) {
    return 'dolphin-dev'
  }
  return platform === 'linux' ? 'dolphin-ide' : 'dolphin'
}

export function resolveDolphinCliInvocation({
  env = process.env,
  platform = process.platform,
  nodeExecutable = process.execPath
} = {}) {
  const command = resolveDolphinCliCommand({ env, platform })
  const commandName = platform === 'win32' ? path.win32.basename(command).toLowerCase() : command
  if (
    platform === 'win32' &&
    env.DOLPHIN_DEV_REPO_ROOT &&
    (commandName === 'dolphin-dev' || commandName === 'dolphin-dev.cmd')
  ) {
    const defaultUserDataPath = path.win32.join(
      env.APPDATA ?? path.win32.join(env.USERPROFILE ?? '', 'AppData', 'Roaming'),
      'dolphin-dev'
    )
    return {
      command: nodeExecutable,
      prefixArgs: [path.win32.join(env.DOLPHIN_DEV_REPO_ROOT, 'out', 'cli', 'index.js')],
      env: {
        ...env,
        DOLPHIN_USER_DATA_PATH:
          env.DOLPHIN_USER_DATA_PATH ?? env.DOLPHIN_DEV_USER_DATA_PATH ?? defaultUserDataPath,
        DOLPHIN_DEV_CLI_INVOCATION: '1',
        DOLPHIN_APP_EXECUTABLE:
          env.DOLPHIN_APP_EXECUTABLE ??
          path.win32.join(
            env.DOLPHIN_DEV_REPO_ROOT,
            'node_modules',
            'electron',
            'dist',
            'electron.exe'
          ),
        DOLPHIN_APP_EXECUTABLE_NEEDS_APP_ROOT: '1'
      }
    }
  }
  return { command, prefixArgs: [] }
}

export function createDolphinRpc({
  envName,
  cliCommand,
  env = process.env,
  platform = process.platform
}) {
  const cliInvocation = cliCommand
    ? { command: cliCommand, prefixArgs: [] }
    : resolveDolphinCliInvocation({ env, platform })
  const commandLabel = cliCommand ?? resolveDolphinCliCommand({ env, platform })
  const commandArgs = (args, local) => [
    ...cliInvocation.prefixArgs,
    ...args,
    ...(local ? [] : ['--environment', envName]),
    '--json'
  ]

  function dolphinJsonSync(args, opts = {}) {
    const started = performance.now()
    const result = spawnSync(cliInvocation.command, commandArgs(args, opts.local), {
      encoding: 'utf8',
      env: cliInvocation.env,
      maxBuffer: MAX_DOLPHIN_RPC_OUTPUT_BYTES,
      timeout: opts.timeoutMs ?? 120_000
    })
    const elapsedMs = performance.now() - started
    if (result.error) {
      throw new Error(`${commandLabel} ${args.join(' ')} failed to start: ${String(result.error)}`)
    }
    if (result.status !== 0) {
      throw new Error(
        `${commandLabel} ${args.join(' ')} failed (${result.status}): ${result.stderr || result.stdout}`
      )
    }
    const parsed = JSON.parse(result.stdout)
    if (parsed.ok === false) {
      throw new Error(`${commandLabel} ${args.join(' ')} ok=false: ${JSON.stringify(parsed)}`)
    }
    return { parsed, elapsedMs, result: parsed.result }
  }

  function dolphinJsonAsync(args, opts = {}) {
    const started = performance.now()
    return new Promise((resolve, reject) => {
      const child = spawn(cliInvocation.command, commandArgs(args, opts.local), {
        env: cliInvocation.env,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      let stdout = ''
      let stderr = ''
      let outputBytes = 0
      let settled = false
      let timer
      const fail = (error) => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        reject(error)
      }
      const append = (stream, chunk) => {
        if (settled) {
          return stream
        }
        const appended = appendDolphinRpcOutput(stream, chunk, outputBytes)
        outputBytes = appended.bytes
        if (appended.exceeded) {
          child.kill('SIGKILL')
          fail(new Error(`${commandLabel} ${args.join(' ')} exceeded 20 MiB output limit`))
          return stream
        }
        return appended.output
      }
      timer = setTimeout(() => {
        child.kill('SIGKILL')
        fail(
          new Error(
            `${commandLabel} ${args.join(' ')} timed out after ${opts.timeoutMs ?? 120_000}ms`
          )
        )
      }, opts.timeoutMs ?? 120_000)
      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk) => {
        stdout = append(stdout, chunk)
      })
      child.stderr.on('data', (chunk) => {
        stderr = append(stderr, chunk)
      })
      child.on('error', fail)
      child.on('close', (code) => {
        if (settled) {
          return
        }
        clearTimeout(timer)
        const elapsedMs = performance.now() - started
        if (code !== 0) {
          fail(
            new Error(
              `${commandLabel} ${args.join(' ')} failed (${code}): ${stderr || stdout}`.slice(
                0,
                800
              )
            )
          )
          return
        }
        try {
          const parsed = JSON.parse(stdout)
          if (parsed.ok === false) {
            fail(
              new Error(
                `${commandLabel} ${args.join(' ')} ok=false: ${JSON.stringify(parsed)}`.slice(
                  0,
                  800
                )
              )
            )
            return
          }
          settled = true
          resolve({ parsed, elapsedMs, result: parsed.result })
        } catch (error) {
          fail(
            new Error(
              `${commandLabel} parse failed: ${String(error)}; stdout=${stdout.slice(0, 400)}`
            )
          )
        }
      })
    })
  }

  async function runReconnectRefreshStorm(notes) {
    const started = performance.now()
    const jobs = [
      () => dolphinJsonAsync(['status'], { timeoutMs: 90_000 }),
      () => dolphinJsonAsync(['worktree', 'list'], { timeoutMs: 120_000 }),
      () => dolphinJsonAsync(['terminal', 'list'], { timeoutMs: 120_000 }),
      () => dolphinJsonAsync(['status'], { local: true, timeoutMs: 60_000 }),
      () => dolphinJsonAsync(['worktree', 'list'], { timeoutMs: 120_000 }),
      () => dolphinJsonAsync(['terminal', 'list'], { timeoutMs: 120_000 })
    ]
    const results = await Promise.all(
      jobs.map(async (job, index) => {
        try {
          const result = await job()
          return { index, ok: true, ms: result.elapsedMs }
        } catch (error) {
          notes.push(`reconnect-refresh job ${index} failed: ${String(error).slice(0, 200)}`)
          return { index, ok: false, ms: null, error: String(error) }
        }
      })
    )
    const wallMs = performance.now() - started
    const maxJobMs = Math.max(0, ...results.map((result) => result.ms || 0))
    notes.push(
      `reconnect-refresh wall=${wallMs.toFixed(0)}ms maxJob=${maxJobMs.toFixed(0)}ms ok=${results.filter((result) => result.ok).length}/${results.length}`
    )
    return { wallMs, maxJobMs, results }
  }

  async function runRestartProxy(notes) {
    const started = performance.now()
    try {
      const opened = await dolphinJsonAsync(['open'], { local: true, timeoutMs: 120_000 })
      notes.push(`dolphin open ms=${opened.elapsedMs.toFixed(0)}`)
    } catch (error) {
      notes.push(`dolphin open failed: ${String(error).slice(0, 200)}`)
    }
    const storm = await runReconnectRefreshStorm(notes)
    return { wallMs: performance.now() - started, storm }
  }

  return { dolphinJsonSync, dolphinJsonAsync, runReconnectRefreshStorm, runRestartProxy }
}
