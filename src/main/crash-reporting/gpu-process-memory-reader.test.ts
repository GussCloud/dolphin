import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAppEnvironment, type AppProcessMetric } from '../../shared/app-environment'

const { readDarwinProcessFootprints } = vi.hoisted(() => ({
  readDarwinProcessFootprints:
    vi.fn<(pids?: readonly number[]) => Promise<ReadonlyMap<number, number> | null>>()
}))
vi.mock('../memory/darwin-process-footprint', () => ({ readDarwinProcessFootprints }))

import { readGpuProcessMemory } from './gpu-process-memory-reader'

const SLOT: unique symbol = Symbol.for('dolphin.host.appEnvironment')
/** The realm slot app-environment installs into; saved and restored so other suites keep theirs. */
type AppEnvironmentSlot = typeof globalThis & { [SLOT]?: unknown }
const environmentSlot: AppEnvironmentSlot = globalThis
let previousEnvironment: unknown

function installMetrics(metrics: AppProcessMetric[]): void {
  setAppEnvironment({
    getPath: () => process.cwd(),
    getAppPath: () => process.cwd(),
    getVersion: () => '0.0.0-test',
    isPackaged: () => false,
    onWillQuit: () => {},
    exit: () => {},
    getAppMetrics: () => metrics
  })
}

describe('readGpuProcessMemory', () => {
  beforeEach(() => {
    previousEnvironment = environmentSlot[SLOT]
    readDarwinProcessFootprints.mockReset()
  })

  afterEach(() => {
    environmentSlot[SLOT] = previousEnvironment
  })

  it("reports the GPU process's private bytes, tagged as that metric", async () => {
    installMetrics([
      { pid: 1, type: 'Browser', memory: { privateBytes: 200_000 } },
      { pid: 2, type: 'GPU', memory: { workingSetSize: 300_000, privateBytes: 190_000 } }
    ])
    await expect(readGpuProcessMemory('win32')).resolves.toEqual({
      metric: 'private-bytes',
      kilobytes: 190_000
    })
    expect(readDarwinProcessFootprints).not.toHaveBeenCalled()
  })

  it("reads the GPU process's physical footprint on macOS, tagged as that metric", async () => {
    installMetrics([
      { pid: 1, type: 'Browser', memory: { workingSetSize: 100_000 } },
      { pid: 7, type: 'GPU', memory: { workingSetSize: 300_000 } }
    ])
    readDarwinProcessFootprints.mockResolvedValue(new Map([[7, 900 * 1024 * 1024]]))
    await expect(readGpuProcessMemory('darwin')).resolves.toEqual({
      metric: 'physical-footprint',
      kilobytes: 900 * 1024
    })
    expect(readDarwinProcessFootprints).toHaveBeenCalledWith([7])
  })

  it('stays null on macOS when the footprint reader has no answer for the GPU pid', async () => {
    installMetrics([{ pid: 7, type: 'GPU', memory: { workingSetSize: 300_000 } }])
    readDarwinProcessFootprints.mockResolvedValue(null)
    await expect(readGpuProcessMemory('darwin')).resolves.toBeNull()
    readDarwinProcessFootprints.mockResolvedValue(new Map([[8, 1]]))
    await expect(readGpuProcessMemory('darwin')).resolves.toBeNull()
    readDarwinProcessFootprints.mockRejectedValue(new Error('helper failed'))
    await expect(readGpuProcessMemory('darwin')).resolves.toBeNull()
  })

  it('stays null on Linux, rather than using working set', async () => {
    installMetrics([{ pid: 2, type: 'GPU', memory: { workingSetSize: 300_000 } }])
    await expect(readGpuProcessMemory('linux')).resolves.toBeNull()
    expect(readDarwinProcessFootprints).not.toHaveBeenCalled()
  })

  it('stays null without a GPU process or an app environment', async () => {
    installMetrics([{ pid: 1, type: 'Browser', memory: { privateBytes: 200_000 } }])
    await expect(readGpuProcessMemory('darwin')).resolves.toBeNull()
    environmentSlot[SLOT] = null
    await expect(readGpuProcessMemory('win32')).resolves.toBeNull()
  })
})
