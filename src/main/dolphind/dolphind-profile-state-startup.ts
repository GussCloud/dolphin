import { createProfileStateStoreForStartup } from '../persistence/profile-state/profile-state-startup-authority'
import type { ProfileStateStoreFactoryResult } from '../persistence/profile-state/profile-state-store-factory'
import {
  ensureActiveDolphinProfile,
  initDolphinProfilePaths
} from '../dolphin-profiles/profile-index-store'
import { initSshHostKeyStoreFile } from '../ssh/ssh-host-key-store'
import { emitDolphindProfileStateAuthoritySelected } from './dolphind-profile-state-telemetry'

export type DolphindProfileStateProfile = {
  dataFile: string
  stateDatabaseFile: string
  profile: { id: string }
}

export type DolphindProfileStateStartup = {
  store: ProfileStateStoreFactoryResult['store']
  authority: {
    backend: ProfileStateStoreFactoryResult['backend']
    classification: ProfileStateStoreFactoryResult['classification']
    authority_mode: 'sqlite-established'
    runtime: 'dolphind'
    migrated: boolean
  }
}

/** Build the headless Store and publish its authority selection at one Node-only seam. */
export async function createDolphindProfileStateStartup(
  userDataPath: string
): Promise<DolphindProfileStateStartup> {
  initDolphinProfilePaths()
  const profile = ensureActiveDolphinProfile(userDataPath)
  const result = await createProfileStateStoreForStartup({
    dataFile: profile.dataFile,
    databaseFile: profile.stateDatabaseFile,
    profileId: profile.profile.id,
    runtime: 'dolphind',
    storageAuthority: 'runtime'
  })
  const authority = {
    backend: result.backend,
    classification: result.classification,
    authority_mode: 'sqlite-established' as const,
    runtime: 'dolphind' as const,
    migrated: result.migrated
  }
  try {
    initSshHostKeyStoreFile(profile.dataFile)
    emitDolphindProfileStateAuthoritySelected(authority)
    return { store: result.store, authority }
  } catch (error) {
    try {
      await result.store.freezeWritesAsync()
    } catch (closeError) {
      console.error(
        '[persistence] Failed to close profile persistence after startup failure:',
        closeError
      )
    }
    throw error
  }
}
