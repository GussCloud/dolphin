import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { writeSecureJsonFile } from '../../shared/secure-file'
import { getDolphinProfileDirectory } from './profile-storage-paths'

// Why: background sign-ins (Azure DevOps) must not undo a sign-out the user chose;
// only another successful sign-in on the profile lifts it.
function markerPath(profileId: string, userDataPath: string): string {
  return join(getDolphinProfileDirectory(profileId, userDataPath), 'account-signed-out.json')
}

export function markDolphinCloudExplicitSignOut(profileId: string, userDataPath: string): void {
  writeSecureJsonFile(markerPath(profileId, userDataPath), { version: 1, signedOutAt: Date.now() })
}

export function clearDolphinCloudExplicitSignOut(profileId: string, userDataPath: string): void {
  rmSync(markerPath(profileId, userDataPath), { force: true })
}

export function hasDolphinCloudExplicitSignOut(profileId: string, userDataPath: string): boolean {
  return existsSync(markerPath(profileId, userDataPath))
}
