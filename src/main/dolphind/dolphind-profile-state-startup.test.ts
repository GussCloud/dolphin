import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createProfileStateStoreForStartupMock,
  emitMock,
  ensureActiveDolphinProfileMock,
  initDolphinProfilePathsMock,
  initSshHostKeyStoreFileMock
} = vi.hoisted(() => ({
  createProfileStateStoreForStartupMock: vi.fn(),
  emitMock: vi.fn(),
  ensureActiveDolphinProfileMock: vi.fn(),
  initDolphinProfilePathsMock: vi.fn(),
  initSshHostKeyStoreFileMock: vi.fn()
}))

vi.mock('../persistence/profile-state/profile-state-startup-authority', () => ({
  createProfileStateStoreForStartup: createProfileStateStoreForStartupMock
}))
vi.mock('../dolphin-profiles/profile-index-store', () => ({
  ensureActiveDolphinProfile: ensureActiveDolphinProfileMock,
  initDolphinProfilePaths: initDolphinProfilePathsMock
}))
vi.mock('../ssh/ssh-host-key-store', () => ({
  initSshHostKeyStoreFile: initSshHostKeyStoreFileMock
}))
vi.mock('./dolphind-profile-state-telemetry', () => ({
  emitDolphindProfileStateAuthoritySelected: emitMock
}))

const { createDolphindProfileStateStartup } = await import('./dolphind-profile-state-startup')

beforeEach(() => {
  vi.resetAllMocks()
  ensureActiveDolphinProfileMock.mockReturnValue({
    dataFile: '/tmp/profile/dolphin-data.json',
    stateDatabaseFile: '/tmp/profile/profile-state.db',
    profile: { id: 'profile-1' }
  })
})

describe('dolphind profile-state startup', () => {
  it('selects the capable authority once and publishes bounded metadata', async () => {
    const store = { getSettings: vi.fn() }
    createProfileStateStoreForStartupMock.mockReturnValue({
      store,
      authority: { readSerializedState: vi.fn() },
      backend: 'sqlite',
      classification: 'json-only',
      migrated: true
    })

    const result = await createDolphindProfileStateStartup('/tmp/user-data')

    expect(initDolphinProfilePathsMock).toHaveBeenCalledOnce()
    expect(ensureActiveDolphinProfileMock).toHaveBeenCalledWith('/tmp/user-data')
    expect(initSshHostKeyStoreFileMock).toHaveBeenCalledWith('/tmp/profile/dolphin-data.json')

    expect(createProfileStateStoreForStartupMock).toHaveBeenCalledWith({
      dataFile: '/tmp/profile/dolphin-data.json',
      databaseFile: '/tmp/profile/profile-state.db',
      profileId: 'profile-1',
      runtime: 'dolphind',
      storageAuthority: 'runtime'
    })
    expect(result.store).toBe(store)
    expect(result.authority).toEqual({
      backend: 'sqlite',
      classification: 'json-only',
      authority_mode: 'sqlite-established',
      runtime: 'dolphind',
      migrated: true
    })
    expect(emitMock).toHaveBeenCalledWith(result.authority)
  })

  it('publishes nothing before the profile writer is ready', async () => {
    let refuse = (_error: Error) => {}
    createProfileStateStoreForStartupMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          refuse = reject
        })
    )
    const startup = createDolphindProfileStateStartup('/tmp/user-data')
    const failure = new Error('writer startup refused')
    const rejected = expect(startup).rejects.toBe(failure)
    expect(initSshHostKeyStoreFileMock).not.toHaveBeenCalled()
    expect(emitMock).not.toHaveBeenCalled()
    refuse(failure)
    await rejected
  })

  it('closes a ready writer if sidecar initialization fails', async () => {
    const store = { freezeWritesAsync: vi.fn(async () => {}) }
    createProfileStateStoreForStartupMock.mockResolvedValueOnce({
      store,
      backend: 'sqlite',
      classification: 'sqlite-only',
      migrated: false
    })
    const failure = new Error('sidecar initialization refused')
    initSshHostKeyStoreFileMock.mockImplementationOnce(() => {
      throw failure
    })
    await expect(createDolphindProfileStateStartup('/tmp/user-data')).rejects.toBe(failure)
    expect(store.freezeWritesAsync).toHaveBeenCalledOnce()
    expect(emitMock).not.toHaveBeenCalled()
  })
})
