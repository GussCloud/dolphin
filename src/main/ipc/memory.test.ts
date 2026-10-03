import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock, collectMemorySnapshotMock, collectHostMemoryMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  collectMemorySnapshotMock: vi.fn(),
  collectHostMemoryMock: vi.fn()
}))

vi.mock('electron', () => ({ ipcMain: { handle: handleMock } }))
vi.mock('../memory/collector', () => ({ collectMemorySnapshot: collectMemorySnapshotMock }))
vi.mock('../memory/host-memory', () => ({ collectHostMemory: collectHostMemoryMock }))

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
})
