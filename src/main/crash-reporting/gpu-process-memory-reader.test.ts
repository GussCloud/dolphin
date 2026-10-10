import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setAppEnvironment, type AppProcessMetric } from '../../shared/app-environment'
import { readGpuProcessMemory } from './gpu-process-memory-reader'

const SLOT = Symbol.for('dolphin.host.appEnvironment')
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
    previousEnvironment = Reflect.get(globalThis, SLOT)
  })

  afterEach(() => {
    Reflect.set(globalThis, SLOT, previousEnvironment)
  })

  it("reports the GPU process's private bytes", () => {
    installMetrics([
      { pid: 1, type: 'Browser', memory: { privateBytes: 200_000 } },
      { pid: 2, type: 'GPU', memory: { workingSetSize: 300_000, privateBytes: 190_000 } }
    ])
    expect(readGpuProcessMemory()).toEqual({ privateKB: 190_000 })
  })

  it('stays null where Electron reports no private bytes, rather than using working set', () => {
    installMetrics([{ pid: 2, type: 'GPU', memory: { workingSetSize: 300_000 } }])
    expect(readGpuProcessMemory()).toBeNull()
  })

  it('stays null without a GPU process or an app environment', () => {
    installMetrics([{ pid: 1, type: 'Browser', memory: { privateBytes: 200_000 } }])
    expect(readGpuProcessMemory()).toBeNull()
    Reflect.set(globalThis, SLOT, null)
    expect(readGpuProcessMemory()).toBeNull()
  })
})
