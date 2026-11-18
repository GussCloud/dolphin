import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as RunProcessModule from './child-process/run-process'
import {
  getCheapProcessTableSnapshot,
  resetCheapProcessTableSnapshotForTests
} from './cheap-process-table-snapshot-reader'
import {
  getStrictProcessTableSnapshot,
  resetProcessTableSnapshotForTests
} from './process-table-snapshot-reader'
import { psLocaleEnvironment } from './ps-locale-environment'

const { runProcessMock } = vi.hoisted(() => ({ runProcessMock: vi.fn() }))

vi.mock('./child-process/run-process', async (importOriginal) => ({
  ...(await importOriginal<typeof RunProcessModule>()),
  runProcess: runProcessMock
}))

const originalPlatform = process.platform

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

afterEach(() => {
  setPlatform(originalPlatform)
  vi.unstubAllEnvs()
  runProcessMock.mockReset()
  resetProcessTableSnapshotForTests()
  resetCheapProcessTableSnapshotForTests()
})

describe('psLocaleEnvironment', () => {
  it('pins macOS ps to en_US.UTF-8 and keeps the rest of the environment', () => {
    expect(psLocaleEnvironment('darwin', { PATH: '/usr/bin', LC_ALL: 'de_DE.UTF-8' })).toEqual({
      PATH: '/usr/bin',
      LC_ALL: 'en_US.UTF-8'
    })
  })

  it.each(['linux', 'win32'] as const)('leaves %s ps on the inherited environment', (platform) => {
    expect(psLocaleEnvironment(platform, { LC_ALL: 'de_DE.UTF-8' })).toBeUndefined()
  })
})

it('runs the cheap macOS process-table capture under the pinned locale', async () => {
  setPlatform('darwin')
  vi.stubEnv('LC_ALL', 'de_DE.UTF-8')
  runProcessMock.mockResolvedValue({ stdout: '', stderr: '', code: 0, outputTruncated: false })
  await getCheapProcessTableSnapshot().catch(() => [])
  expect(runProcessMock).toHaveBeenCalledWith(
    expect.objectContaining({
      program: 'ps',
      env: expect.objectContaining({ LC_ALL: 'en_US.UTF-8' })
    })
  )
})

it.runIf(originalPlatform === 'darwin').each(['de_DE.UTF-8', 'C'])(
  'reads real macOS ps rows under LC_ALL=%s',
  async (locale) => {
    vi.stubEnv('LC_ALL', locale)
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', 'café-ü'])
    try {
      await once(child, 'spawn')
      const strict = (await getStrictProcessTableSnapshot()).find((row) => row.pid === child.pid)
      expect(strict?.command).toContain('café-ü')
      expect(Number.isFinite(Date.parse(strict?.startTime ?? ''))).toBe(true)
    } finally {
      child.kill()
    }
  }
)
