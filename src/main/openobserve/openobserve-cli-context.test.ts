import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activateOpenObserveContext, saveOpenObserveContext } from './openobserve-cli-context'
import type * as OpenObserveCliRunner from './openobserve-cli-runner'

const mocks = vi.hoisted(() => ({
  runOpenObserveCli: vi.fn()
}))

vi.mock('./openobserve-cli-runner', async (importOriginal) => ({
  ...(await importOriginal<typeof OpenObserveCliRunner>()),
  ...mocks
}))

const result = (code: number, stdout = '', stderr = ''): object => ({
  code,
  signal: null,
  stdout,
  stderr,
  timedOut: false
})

const contexts = (...names: string[]): object =>
  result(0, JSON.stringify({ has_more: false, items: names.map((name) => ({ name })) }))

const INPUT = {
  name: 'prod',
  baseUrl: ' o2.example.com/ ',
  org: 'acme',
  authScheme: 'token' as const
}

describe('saveOpenObserveContext', () => {
  beforeEach(() => {
    mocks.runOpenObserveCli.mockReset()
  })

  it('writes a new context with normalized values and activates it', async () => {
    mocks.runOpenObserveCli.mockResolvedValueOnce(contexts()).mockResolvedValueOnce(result(0, '{}'))
    await expect(saveOpenObserveContext(INPUT)).resolves.toEqual({ ok: true })
    expect(mocks.runOpenObserveCli).toHaveBeenLastCalledWith([
      'config',
      'set-context',
      'prod',
      '--base-url',
      'https://o2.example.com',
      '--org',
      'acme',
      '--auth-scheme',
      'token',
      '--activate'
    ])
  })

  it('overwrites an existing context instead of failing with a conflict', async () => {
    mocks.runOpenObserveCli
      .mockResolvedValueOnce(contexts('local', 'prod'))
      .mockResolvedValueOnce(result(0, '{}'))
    await expect(saveOpenObserveContext(INPUT)).resolves.toEqual({ ok: true })
    expect(mocks.runOpenObserveCli.mock.lastCall?.[0]).toContain('--overwrite')
  })

  it('rejects input that could be read as a CLI flag without spawning', async () => {
    await expect(saveOpenObserveContext({ ...INPUT, name: '--allow-writes' })).resolves.toEqual({
      ok: false,
      error: 'Invalid OpenObserve name'
    })
    await expect(saveOpenObserveContext({ ...INPUT, org: '-x' })).resolves.toMatchObject({
      ok: false
    })
    await expect(
      saveOpenObserveContext({ ...INPUT, baseUrl: 'ftp://o2.example.com' })
    ).resolves.toMatchObject({ ok: false })
    expect(mocks.runOpenObserveCli).not.toHaveBeenCalled()
  })

  it("returns the CLI's structured error message", async () => {
    mocks.runOpenObserveCli.mockResolvedValueOnce(contexts()).mockResolvedValueOnce(
      result(
        3,
        '',
        JSON.stringify({
          error: { message: 'unsupported authentication scheme', hint: 'Use one of: token.' }
        })
      )
    )
    await expect(saveOpenObserveContext(INPUT)).resolves.toEqual({
      ok: false,
      error: 'unsupported authentication scheme. Use one of: token.'
    })
  })
})

describe('activateOpenObserveContext', () => {
  beforeEach(() => {
    mocks.runOpenObserveCli.mockReset()
  })

  it('switches the current context', async () => {
    mocks.runOpenObserveCli.mockResolvedValueOnce(result(0, '{}'))
    await expect(activateOpenObserveContext('local')).resolves.toEqual({ ok: true })
    expect(mocks.runOpenObserveCli).toHaveBeenCalledWith(['config', 'use-context', 'local'])
  })

  it('rejects names the CLI would parse as flags', async () => {
    await expect(activateOpenObserveContext('--help')).resolves.toMatchObject({ ok: false })
    expect(mocks.runOpenObserveCli).not.toHaveBeenCalled()
  })
})
