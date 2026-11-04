import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeClient, RuntimeClientError } from '../../runtime-client'
import {
  HEAVY_JOB_QUEUE_TIMEOUT_EXIT_CODE,
  HEAVY_JOB_WRONG_HOST_EXIT_CODE
} from '../../../shared/heavy-job-queue'
import { ORCHESTRATION_HANDLERS } from '../orchestration'

type Call = { name: string; params: Record<string, unknown> }

const NODE_COMMAND = [process.execPath, '-e', "console.log('built ok'); process.exit(3)"]

describe('orchestration exec (CLI handler)', () => {
  const originalCliCwd = process.env.DOLPHIN_CLI_CWD
  let calls: Call[]
  let stdout: string[]
  let stderr: string[]

  beforeEach(() => {
    calls = []
    stdout = []
    stderr = []
    delete process.env.DOLPHIN_CLI_CWD
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdout.push(String(chunk))
      return true
    })
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderr.push(String(chunk))
      return true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.exitCode = undefined
    if (originalCliCwd === undefined) {
      delete process.env.DOLPHIN_CLI_CWD
    } else {
      process.env.DOLPHIN_CLI_CWD = originalCliCwd
    }
  })

  function clientAnswering(acquire: (params: Record<string, unknown>) => unknown): RuntimeClient {
    const client: RuntimeClient = Object.create(RuntimeClient.prototype)
    vi.spyOn(client, 'call').mockImplementation(async (name, params) => {
      const recorded = params && typeof params === 'object' ? { ...params } : {}
      calls.push({ name, params: recorded })
      if (name === 'orchestration.heavyJobAcquire') {
        return { id: 'req', ok: true, result: acquire(recorded), _meta: { runtimeId: 'rt' } }
      }
      return { id: 'req', ok: true, result: {}, _meta: { runtimeId: 'rt' } }
    })
    return client
  }

  async function exec(
    client: RuntimeClient,
    command: string[],
    flags = new Map<string, string | boolean>()
  ) {
    await ORCHESTRATION_HANDLERS['orchestration exec']({
      flags,
      client,
      cwd: process.cwd(),
      json: false,
      rawArgs: command
    })
  }

  it('runs the command once granted, reports exit, tail and log, then releases', async () => {
    const client = clientAnswering(() => ({ ticket: 'hjob_1', granted: true, ahead: 0 }))
    await exec(client, NODE_COMMAND)

    expect(process.exitCode).toBe(3)
    const report = stdout.join('')
    expect(report).toMatch(/^exit 3 in \d+s \(queued 0s\); full log: /)
    expect(report).toContain('built ok')
    const logPath = /full log: (.+)\n/.exec(report)![1]
    expect(readFileSync(logPath, 'utf8')).toContain('built ok')
    expect(calls.at(-1)).toEqual({
      name: 'orchestration.heavyJobRelease',
      params: { ticket: 'hjob_1' }
    })
  })

  it('exits 75 without running anything when the queue stays busy past --max-wait-ms', async () => {
    const client = clientAnswering(() => ({ ticket: 'hjob_2', granted: false, ahead: 2 }))
    await exec(client, NODE_COMMAND, new Map([['max-wait-ms', '1']]))

    expect(process.exitCode).toBe(HEAVY_JOB_QUEUE_TIMEOUT_EXIT_CODE)
    expect(stderr.join('')).toContain('Queued behind 2 heavy job(s).')
    expect(stderr.join('')).toContain('nothing ran')
    expect(stdout).toEqual([])
    // A timed-out waiter gives up its place instead of holding the line until TTL.
    expect(calls.at(-1)).toEqual({
      name: 'orchestration.heavyJobRelease',
      params: { ticket: 'hjob_2' }
    })
  })

  it('runs the command directly with a warning on a host that predates the queue', async () => {
    const client = clientAnswering(() => {
      throw new RuntimeClientError('method_not_found', 'Unknown method')
    })
    await exec(client, NODE_COMMAND)

    expect(process.exitCode).toBe(3)
    expect(stderr.join('')).toContain(
      'running without the heavy-job queue (the Dolphin runtime predates the heavy-job queue)'
    )
    expect(calls.map((call) => call.name)).toEqual(['orchestration.heavyJobAcquire'])
  })

  it('refuses from a bridged SSH or WSL invocation without running anything', async () => {
    process.env.DOLPHIN_CLI_CWD = '/home/me/repo'
    const client = clientAnswering(() => ({ ticket: 'hjob_3', granted: true, ahead: 0 }))
    await exec(client, NODE_COMMAND)

    expect(process.exitCode).toBe(HEAVY_JOB_WRONG_HOST_EXIT_CODE)
    expect(calls).toEqual([])
    expect(stdout).toEqual([])
  })

  it('requires a command after --', async () => {
    const client = clientAnswering(() => ({ ticket: 'hjob_4', granted: true, ahead: 0 }))
    await expect(exec(client, [])).rejects.toMatchObject({ code: 'invalid_argument' })
  })
})
