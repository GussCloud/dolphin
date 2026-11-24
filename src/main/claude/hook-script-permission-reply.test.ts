import { afterEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BYPASS_PERMISSION_ALLOW_REPLY } from '../agent-hooks/bypass-permission-decision'
import { getManagedScript } from './hook-script'

const PERMISSION_REQUEST = JSON.stringify({
  session_id: 's',
  cwd: '/repo',
  permission_mode: 'bypassPermissions',
  hook_event_name: 'PermissionRequest',
  tool_name: 'Bash',
  tool_input: { command: 'rm -rf $X', description: 'clean' }
})
const STOP = JSON.stringify({ session_id: 's', hook_event_name: 'Stop' })

let server: Server | null = null
afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
  server = null
})

async function startListener(
  reply: (headers: IncomingHttpHeaders) => { status: number; body?: string }
): Promise<number> {
  server = createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      const { status, body } = reply(req.headers)
      res.writeHead(status)
      res.end(body)
    })
  })
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  return typeof address === 'object' && address ? address.port : 0
}

function runHook(
  input: string,
  env: NodeJS.ProcessEnv
): Promise<{ stdout: string; status: number | null; ms: number }> {
  const dir = mkdtempSync(join(tmpdir(), 'dolphin-claude-hook-'))
  const script = join(dir, 'claude-hook.sh')
  writeFileSync(script, getManagedScript('posix'))
  chmodSync(script, 0o755)
  const clean: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith('DOLPHIN_') && key !== 'CLAUDE_JOB_DIR') {
      clean[key] = value
    }
  }
  const started = Date.now()
  return new Promise((resolve) => {
    const child = spawn('/bin/sh', [script], { env: { ...clean, ...env } })
    let stdout = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.on('close', (status) => resolve({ stdout, status, ms: Date.now() - started }))
    child.stdin.end(input)
  })
}

const paneEnv = (port: number): NodeJS.ProcessEnv => ({
  DOLPHIN_AGENT_HOOK_PORT: String(port),
  DOLPHIN_AGENT_HOOK_TOKEN: 'token',
  DOLPHIN_PANE_KEY: 'tab-1:11111111-1111-4111-8111-111111111111',
  DOLPHIN_WORKTREE_ID: 'repo::/repo'
})

describe.skipIf(process.platform === 'win32')('managed Claude hook permission reply', () => {
  it('prints the listener answer for a PermissionRequest, and says it relays it', async () => {
    let relayHeader: unknown
    const port = await startListener((headers) => {
      relayHeader = headers['x-dolphin-agent-hook-decision-reply']
      return { status: 200, body: BYPASS_PERMISSION_ALLOW_REPLY }
    })
    const result = await runHook(PERMISSION_REQUEST, paneEnv(port))
    expect(result.status).toBe(0)
    expect(result.stdout).toBe(`${BYPASS_PERMISSION_ALLOW_REPLY}\n`)
    expect(relayHeader).toBe('1')
  })

  it('prints {} for a PermissionRequest the listener leaves to the user', async () => {
    const port = await startListener(() => ({ status: 204 }))
    expect((await runHook(PERMISSION_REQUEST, paneEnv(port))).stdout).toBe('{}\n')
  })

  it('ignores a non-JSON response body', async () => {
    const port = await startListener(() => ({ status: 200, body: 'allow' }))
    expect((await runHook(PERMISSION_REQUEST, paneEnv(port))).stdout).toBe('{}\n')
  })

  it('prints {} quickly when the listener is down', async () => {
    const port = await startListener(() => ({ status: 204 }))
    await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = null
    const result = await runHook(PERMISSION_REQUEST, paneEnv(port))
    expect(result.stdout).toBe('{}\n')
    expect(result.ms).toBeLessThan(2000)
  })

  it('answers other events with {} once, whatever the listener returns', async () => {
    const port = await startListener(() => ({ status: 200, body: BYPASS_PERMISSION_ALLOW_REPLY }))
    expect((await runHook(STOP, paneEnv(port))).stdout).toBe('{}\n')
  })

  it('prints exactly {} on the early exits', async () => {
    const port = await startListener(() => ({ status: 200, body: BYPASS_PERMISSION_ALLOW_REPLY }))
    expect((await runHook(PERMISSION_REQUEST, {})).stdout).toBe('{}\n')
    expect((await runHook('', paneEnv(port))).stdout).toBe('{}\n')
    expect(
      (await runHook(PERMISSION_REQUEST, { ...paneEnv(port), CLAUDE_JOB_DIR: '/tmp/job' })).stdout
    ).toBe('{}\n')
  })
})
