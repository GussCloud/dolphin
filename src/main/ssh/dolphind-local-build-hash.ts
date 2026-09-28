/**
 * The build identity the deploy expects the host to answer with.
 *
 * It must be computed the same way `computeDolphindBuildHash` computes it on the host —
 * sha256 of `dolphind.js`, first 16 hex characters — or the activation gate would reject every
 * healthy candidate. Keeping the two in one comment is deliberate: they are one contract
 * split across a network, and the version string cannot stand in for it, because
 * `DOLPHIN_VERSION` is whatever the launch command exported and two builds can carry one value.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const DOLPHIND_BUILD_HASH_LENGTH = 16

export function computeLocalDolphindBuildHash(localDolphindDir: string): string {
  const entry = join(localDolphindDir, 'dolphind.js')
  return createHash('sha256')
    .update(readFileSync(entry))
    .digest('hex')
    .slice(0, DOLPHIND_BUILD_HASH_LENGTH)
}
