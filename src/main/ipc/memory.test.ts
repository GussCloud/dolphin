import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock, collectMemorySnapshotMock, collectHostMemoryMock, evaluateMemoryBudgetMock } =
  vi.hoisted(() => ({
    handleMock: vi.fn(),
    collectMemorySnapshotMock: vi.fn(),
    collectHostMemoryMock: vi.fn(),
    evaluateMemoryBudgetMock: vi.fn((): unknown[] => [])
  }))

vi.mock('electron', () => ({ ipcMain: { handle: handleMock } }))
vi.mock('../memory/collector', () => ({ collectMemorySnapshot: collectMemorySnapshotMock }))
vi.mock('../memory/host-memory', () => ({ collectHostMemory: collectHostMemoryMock }))
vi.mock('../diagnostics/memory-budget', () => ({
  evaluateMemoryBudget: evaluateMemoryBudgetMock,
  readMemoryBudget: () => ({})
}))
vi.mock('../observability/tracer', () => ({ startSpan: () => ({ end: () => {} }) }))

import { registerMemoryHandlers } from './memory'

function fakeStore() {
  return {
    getRepo: vi.fn(),
    getWorktreeMeta: vi.fn(),
    getFolderWorkspace: vi.fn(),
    getProjectGroups: vi.fn()
  }
}

function handlerFor(channel: string): () => unknown {
  const registration = handleMock.mock.calls.find(([name]) => name === channel)
  if (!registration) {
    throw new Error(`${channel} was not registered`)
  }
  return registration[1]
}

describe('registerMemoryHandlers', () => {
  beforeEach(() => {
    handleMock.mockReset()
    collectMemorySnapshotMock.mockReset()
    collectHostMemoryMock.mockReset()
    evaluateMemoryBudgetMock.mockReset()
    evaluateMemoryBudgetMock.mockReturnValue([])
  })

  it('serves host memory without running the process-table snapshot', async () => {
    const host = { totalMemory: 16, availableMemory: 4 }
    collectHostMemoryMock.mockResolvedValue(host)
    registerMemoryHandlers(fakeStore())

    await expect(handlerFor('memory:getHostMemory')()).resolves.toBe(host)
    expect(collectMemorySnapshotMock).not.toHaveBeenCalled()
  })

  it('keeps the full snapshot channel', async () => {
    const store = fakeStore()
    collectMemorySnapshotMock.mockResolvedValue({ collectedAt: 1 })
    registerMemoryHandlers(store)

    await expect(handlerFor('memory:getSnapshot')()).resolves.toEqual({ collectedAt: 1 })
    expect(collectMemorySnapshotMock).toHaveBeenCalledWith(store)
  })

  it('attaches over-budget owners to the snapshot only when there are any', async () => {
    const warning = { kind: 'daemon', subject: 'pid 7', bytes: 600, limitBytes: 512 }
    collectMemorySnapshotMock.mockResolvedValue({ collectedAt: 2 })
    evaluateMemoryBudgetMock.mockReturnValue([warning])
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    registerMemoryHandlers(fakeStore())

    await expect(handlerFor('memory:getSnapshot')()).resolves.toEqual({
      collectedAt: 2,
      budgetWarnings: [warning]
    })
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
