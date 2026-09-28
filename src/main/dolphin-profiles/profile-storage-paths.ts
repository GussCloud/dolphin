import { getAppEnvironment } from '../../shared/app-environment'
import {
  getDolphinProfileDataFile as getSharedDolphinProfileDataFile,
  getDolphinProfileStateDatabaseFile as getSharedDolphinProfileStateDatabaseFile
} from '../../shared/profile-state-storage-paths'
import { hasProfileStateDatabaseFiles } from '../persistence/profile-state/profile-state-storage-classification'
import { join } from 'node:path'

const LEGACY_DATA_FILE_NAME = 'dolphin-data.json'
const LEGACY_BROWSER_SESSION_META_FILE_NAME = 'browser-session-meta.json'
const PROFILE_INDEX_FILE_NAME = 'dolphin-profile-index.json'
const PROFILE_BROWSER_SESSION_META_FILE_NAME = 'browser-session-meta.json'
const PROFILE_DIRECTORY_NAME = 'profiles'
const PROFILE_MOVE_INTENT_DIRECTORY_NAME = 'profile-move-intents'

export const LEGACY_BACKUP_COUNT = 5

let profileUserDataPath: string | null = null

export function initDolphinProfilePaths(): void {
  profileUserDataPath = getAppEnvironment().getPath('userData')
}

export function getProfileUserDataPath(): string {
  if (!profileUserDataPath) {
    profileUserDataPath = getAppEnvironment().getPath('userData')
  }
  return profileUserDataPath
}

export function getDolphinProfileIndexPath(userDataPath = getProfileUserDataPath()): string {
  return join(userDataPath, PROFILE_INDEX_FILE_NAME)
}

export function getDolphinProfilesDirectory(userDataPath = getProfileUserDataPath()): string {
  return join(userDataPath, PROFILE_DIRECTORY_NAME)
}

/** Durable cross-profile move intents live outside either profile database. */
export function getDolphinProfileMoveIntentDirectory(
  userDataPath = getProfileUserDataPath()
): string {
  return join(userDataPath, PROFILE_MOVE_INTENT_DIRECTORY_NAME)
}

export function getDolphinProfileDirectory(
  profileId: string,
  userDataPath = getProfileUserDataPath()
): string {
  return join(getDolphinProfilesDirectory(userDataPath), profileId)
}

export function getDolphinProfileDataFile(
  profileId: string,
  userDataPath = getProfileUserDataPath()
): string {
  return getSharedDolphinProfileDataFile(profileId, userDataPath)
}

/**
 * Return the future profile-state database path without changing the legacy
 * JSON path used by the current Store and its sidecars.
 */
export function getDolphinProfileStateDatabaseFile(
  profileId: string,
  userDataPath = getProfileUserDataPath()
): string {
  return getSharedDolphinProfileStateDatabaseFile(profileId, userDataPath)
}

export function hasDolphinProfileStateDatabase(
  profileId: string,
  userDataPath = getProfileUserDataPath()
): boolean {
  const databaseFile = getDolphinProfileStateDatabaseFile(profileId, userDataPath)
  return hasProfileStateDatabaseFiles(databaseFile)
}

export function getDolphinProfileBrowserSessionMetaFile(
  profileId: string,
  userDataPath = getProfileUserDataPath()
): string {
  return join(
    getDolphinProfileDirectory(profileId, userDataPath),
    PROFILE_BROWSER_SESSION_META_FILE_NAME
  )
}

export function legacyDataFilePath(userDataPath: string): string {
  return join(userDataPath, LEGACY_DATA_FILE_NAME)
}

export function legacyBrowserSessionMetaPath(userDataPath: string): string {
  return join(userDataPath, LEGACY_BROWSER_SESSION_META_FILE_NAME)
}

export function legacyBackupPath(userDataPath: string, index: number): string {
  return `${legacyDataFilePath(userDataPath)}.bak.${index}`
}

export function profileBackupPath(profileDataFile: string, index: number): string {
  return `${profileDataFile}.bak.${index}`
}
