import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type * as NodeOs from 'node:os'

const GB = 1024 ** 3

const { handleMock, removeHandlerMock, homedirMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
  homedirMock: vi.fn<() => string>()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: handleMock, removeHandler: removeHandlerMock }
}))

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeOs>()
  return { ...actual, homedir: homedirMock, totalmem: () => 32 * GB }
})

import {
  analyzeWslConfig,
  applyWslConfig,
  registerWslConfigTuningHandlers
} from './wslconfig-tuning'

let root: string
const originalPlatform = process.platform

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true })
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dolphin-wslconfig-'))
  homedirMock.mockReturnValue(root)
  setPlatform('win32')
})

afterEach(() => {
  setPlatform(originalPlatform)
  rmSync(root, { recursive: true, force: true })
  vi.clearAllMocks()
})

describe('wslConfigTuning handlers', () => {
  it('registers analyze and apply channels idempotently', () => {
    registerWslConfigTuningHandlers()
    expect(removeHandlerMock).toHaveBeenCalledWith('wslConfigTuning:analyze')
    expect(handleMock.mock.calls.map((call) => call[0])).toEqual([
      'wslConfigTuning:analyze',
      'wslConfigTuning:apply'
    ])
  })

  it('is unsupported off Windows and never touches the file', async () => {
    setPlatform('darwin')
    expect(await analyzeWslConfig()).toEqual({ state: 'unsupported' })
    expect(await applyWslConfig(['sparse-vhd'])).toMatchObject({ ok: false, reason: 'unsupported' })
    expect(existsSync(join(root, '.wslconfig'))).toBe(false)
  })

  it('previews and creates a missing file without a backup', async () => {
    const analysis = await analyzeWslConfig()
    expect(analysis).toMatchObject({ state: 'ready', fileExists: false, totalMemoryGb: 32 })
    const result = await applyWslConfig(['auto-memory-reclaim', 'sparse-vhd'])
    expect(result).toMatchObject({ ok: true, backupPath: null })
    expect(readFileSync(join(root, '.wslconfig'), 'utf-8')).toBe(
      '[experimental]\nautoMemoryReclaim=gradual\nsparseVhd=true\n'
    )
  })

  it('backs up an existing file and keeps its other content', async () => {
    const path = join(root, '.wslconfig')
    writeFileSync(path, '\uFEFF# mine\n[wsl2]\nmemory=30GB\n', 'utf-8')
    const result = await applyWslConfig(['memory-cap', 'bogus'])
    expect(result).toMatchObject({ ok: true, appliedIds: ['memory-cap'] })
    expect(readFileSync(path, 'utf-8')).toBe('# mine\n[wsl2]\nmemory=16GB\n')
    expect(readFileSync(`${path}.dolphin-backup`, 'utf-8')).toBe(
      '\uFEFF# mine\n[wsl2]\nmemory=30GB\n'
    )
  })

  it('refuses to rewrite a UTF-16 file', async () => {
    const path = join(root, '.wslconfig')
    writeFileSync(path, Buffer.from('\uFEFF[wsl2]\n', 'utf16le'))
    expect(await analyzeWslConfig()).toEqual({ state: 'unreadable', configPath: path })
    expect(await applyWslConfig(['sparse-vhd'])).toMatchObject({ ok: false, reason: 'unreadable' })
  })
})
