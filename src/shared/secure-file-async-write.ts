import { randomBytes } from 'node:crypto'
import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { adoptStagedRestriction, hardenSecurePathOnce, rememberHardenedPath } from './secure-file'
import { recordHardeningOutcome } from './secure-path-hardening-retry-budget'
import { bestEffortRestrictWindowsPath } from './secure-path-windows-acl'

/**
 * `writeSecureJsonFile` for stores written on a hot path. Same restrict-before-publish order, but
 * icacls is awaited instead of spawned synchronously on the main thread (#20497).
 */
export async function writeSecureJsonFileAsync(
  targetPath: string,
  value: unknown
): Promise<boolean> {
  const dir = dirname(targetPath)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  hardenSecurePathOnce(dir, true)

  const tmpFile = `${targetPath}.${process.pid}.${Date.now()}.${randomBytes(4).toString('hex')}.tmp`
  try {
    await writeFile(tmpFile, JSON.stringify(value, null, 2), { encoding: 'utf-8', mode: 0o600 })
    const staged = await restrictSecureFile(tmpFile, true)
    await rename(tmpFile, targetPath)
    if (staged) {
      adoptStagedRestriction(targetPath)
    }
    const published = staged || (await restrictSecureFile(targetPath, false))
    if (published) {
      rememberHardenedPath(targetPath, false)
    }
    return staged && published
  } catch (error) {
    await rm(tmpFile, { force: true })
    throw error
  }
}

async function restrictSecureFile(targetPath: string, freshlyCreated: boolean): Promise<boolean> {
  if (process.platform !== 'win32') {
    await chmod(targetPath, 0o600)
    return true
  }
  const restricted = await new Promise<boolean>((resolve) =>
    bestEffortRestrictWindowsPath(targetPath, false, resolve, { freshlyCreated })
  )
  // Success only, like the sync write path: a failure must stay retryable on the next write.
  if (restricted) {
    recordHardeningOutcome(targetPath, true)
  }
  return restricted
}
