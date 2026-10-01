import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const describeWindows = process.platform === 'win32' ? describe : describe.skip
const TRICKY_ARGV = [
  'display-message',
  '-t',
  '%2',
  '-p',
  'say "hi" \\"there\\" \\',
  'line one\nline two',
  'ünïcødé 🐬 中文',
  '%PATH%',
  '',
  'tab\there'
]

let root
let tmuxPath

function newEndpoint() {
  return `\\\\.\\pipe\\dolphin-agent-teams-${process.pid}-${randomBytes(16).toString('hex')}`
}

function baseEnv(extra) {
  const env = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('DOLPHIN_AGENT_TEAMS_') && key !== 'TMUX_PANE') {
      env[key] = value
    }
  }
  return {
    ...env,
    DOLPHIN_AGENT_TEAMS_TEAM_ID: 'team-1',
    DOLPHIN_AGENT_TEAMS_TOKEN: 'token-1',
    TMUX_PANE: '%1',
    // Why: the fallback fixture is `node agent-teams-tmux <args>`, resolved against the cwd.
    DOLPHIN_AGENT_TEAMS_SHIM_BIN: process.execPath,
    ...extra
  }
}

// Why async: the fake server lives in this process, so a blocking spawnSync would deadlock it.
function runTmux(args, env) {
  return new Promise((resolvePromise, reject) => {
    const started = performance.now()
    const child = spawn(tmuxPath, args, { cwd: root, env, windowsHide: true })
    const stdout = []
    const stderr = []
    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.on('error', reject)
    child.on('close', (status) =>
      resolvePromise({
        status,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr).toString('utf8'),
        ms: performance.now() - started
      })
    )
  })
}

async function withServer(onRequest, test) {
  const endpoint = newEndpoint()
  const requests = []
  const server = createServer((socket) => {
    let buffer = ''
    socket.setEncoding('utf8')
    socket.on('error', () => {})
    socket.on('data', (chunk) => {
      buffer += chunk
      const newline = buffer.indexOf('\n')
      if (newline === -1) {
        return
      }
      const request = JSON.parse(buffer.slice(0, newline))
      requests.push(request)
      onRequest(socket, request)
    })
  })
  await new Promise((resolvePromise) => server.listen(endpoint, resolvePromise))
  try {
    await test(endpoint, requests)
  } finally {
    await new Promise((resolvePromise) => server.close(resolvePromise))
  }
}

function reply(socket, request, body) {
  socket.write(
    `${JSON.stringify({ v: 1, id: request.id, stdout: '', stderr: '', exitCode: 0, ...body })}\n`
  )
}

describeWindows('tmux.exe Agent Teams shim', () => {
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'dolphin tmux shim '))
    tmuxPath = join(root, 'tmux.exe')
    const build = spawnSync(
      process.execPath,
      ['config/scripts/build-windows-cli-launcher.mjs', '--output', tmuxPath],
      { cwd: projectRoot, encoding: 'utf8' }
    )
    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0)
    writeFileSync(
      join(root, 'agent-teams-tmux'),
      "process.stdout.write('FALLBACK ' + JSON.stringify(process.argv.slice(2)))\n",
      'utf8'
    )
  }, 60_000)

  afterAll(() => {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    } catch {
      // Why: Windows can hold the just-run exe image briefly; a leftover temp dir is not a failure.
    }
  })

  it('answers static commands without any server or CLI', async () => {
    const env = baseEnv({ DOLPHIN_AGENT_TEAMS_SHIM_BIN: '' })
    const cases = [
      [['-V'], 'tmux 3.4\n'],
      [['-L', 'sock', '-v'], 'tmux 3.4\n'],
      [['show-options', '-gv', 'extended-keys'], 'on\n'],
      [['-S', '/tmp/x', 'SHOW', '-g', 'extended-keys'], 'extended-keys on\n'],
      [['set-option', '-g', 'mouse', 'on'], ''],
      [['has-session', '-t', 'dolphin'], ''],
      [['resize-pane', '-t', '%2', '-x', '30%'], '']
    ]
    for (const [args, stdout] of cases) {
      const result = await runTmux(args, env)
      expect({ args, status: result.status, stdout: result.stdout.toString('utf8') }).toEqual({
        args,
        status: 0,
        stdout
      })
    }
    // A non-static option still needs Dolphin, so it reaches the (here unusable) CLI path.
    expect((await runTmux(['show-options', '-g', 'mouse'], env)).status).toBe(127)
  })

  it('sends argv, identity and cwd verbatim and relays raw UTF-8 output and exit code', async () => {
    await withServer(
      (socket, request) =>
        reply(socket, request, { stdout: 'héllo 🐬 中文\n', stderr: 'wärn ✓\n', exitCode: 3 }),
      async (endpoint, requests) => {
        const result = await runTmux(
          TRICKY_ARGV,
          baseEnv({ DOLPHIN_AGENT_TEAMS_ENDPOINT: endpoint })
        )
        expect(result.status).toBe(3)
        expect(result.stdout.equals(Buffer.from('héllo 🐬 中文\n', 'utf8'))).toBe(true)
        expect(result.stderr).toBe('wärn ✓\n')
        expect(requests).toEqual([
          {
            v: 1,
            id: expect.stringMatching(/^[0-9a-f]{32}$/),
            teamId: 'team-1',
            token: 'token-1',
            envPane: '%1',
            cwd: root,
            argv: TRICKY_ARGV
          }
        ])
      }
    )
  })

  it('skips keepalive frames before the response', async () => {
    await withServer(
      (socket, request) => {
        socket.write('{"_keepalive":true}\n{"_keepalive":true}\n')
        setTimeout(() => reply(socket, request, { stdout: '%3\n' }), 50)
      },
      async (endpoint) => {
        const result = await runTmux(
          ['split-window', '-P'],
          baseEnv({ DOLPHIN_AGENT_TEAMS_ENDPOINT: endpoint })
        )
        expect(result.status).toBe(0)
        expect(result.stdout.toString('utf8')).toBe('%3\n')
      }
    )
  })

  // Why: a split waits on the terminal daemon, which took 10.4s while busy spawning another pane.
  it('waits past 10s for a slow split response', async () => {
    await withServer(
      (socket, request) => setTimeout(() => reply(socket, request, { stdout: '%4\n' }), 10_500),
      async (endpoint) => {
        const result = await runTmux(
          ['split-window', '-P'],
          baseEnv({ DOLPHIN_AGENT_TEAMS_ENDPOINT: endpoint })
        )
        expect(result.status).toBe(0)
        expect(result.stdout.toString('utf8')).toBe('%4\n')
      }
    )
  }, 20_000)

  it('falls back to the CLI when the endpoint is missing, malformed, or not listening', async () => {
    for (const endpoint of [undefined, '\\\\.\\pipe\\someone-else', newEndpoint()]) {
      const result = await runTmux(
        ['list-panes', '%2'],
        baseEnv(endpoint ? { DOLPHIN_AGENT_TEAMS_ENDPOINT: endpoint } : {})
      )
      expect(result.status).toBe(0)
      expect(result.stdout.toString('utf8')).toBe('FALLBACK ["list-panes","%2"]')
    }
  })

  it('never falls back once the request was written', async () => {
    await withServer(
      (socket) => socket.destroy(),
      async (endpoint, requests) => {
        const result = await runTmux(
          ['split-window', '-h', '--', 'cat'],
          baseEnv({ DOLPHIN_AGENT_TEAMS_ENDPOINT: endpoint })
        )
        expect(requests).toHaveLength(1)
        expect(result.status).toBe(1)
        expect(result.stdout.toString('utf8')).toBe('')
        expect(result.stderr).toMatch(/^tmux: .+\n$/)
      }
    )
  })

  it('reports a mismatched response id as an error', async () => {
    await withServer(
      (socket, request) => reply(socket, { ...request, id: 'other' }, { stdout: 'nope' }),
      async (endpoint) => {
        const result = await runTmux(
          ['list-panes'],
          baseEnv({ DOLPHIN_AGENT_TEAMS_ENDPOINT: endpoint })
        )
        expect(result.status).toBe(1)
        expect(result.stdout.toString('utf8')).toBe('')
        expect(result.stderr).toBe('tmux: response id does not match the request\n')
      }
    )
  })

  it('measures static and pipe round trips', async () => {
    const samples = async (run) => {
      const times = []
      for (let i = 0; i < 10; i += 1) {
        times.push((await run()).ms)
      }
      return times.sort((a, b) => a - b)[5]
    }
    const staticMs = await samples(() => runTmux(['-V'], baseEnv()))
    await withServer(
      (socket, request) => reply(socket, request, { stdout: '%1\n' }),
      async (endpoint) => {
        const pipeMs = await samples(() =>
          runTmux(
            ['display-message', '-p', '#{pane_id}'],
            baseEnv({ DOLPHIN_AGENT_TEAMS_ENDPOINT: endpoint })
          )
        )
        console.log(
          `[tmux.exe] median static ${staticMs.toFixed(1)}ms, pipe ${pipeMs.toFixed(1)}ms`
        )
        expect(pipeMs).toBeLessThan(2_000)
      }
    )
  })
})
