import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DOLPHIND_VERSION,
  dolphindArtifactFilenames,
  dolphindArtifactHashPrefix
} from '../../src/shared/dolphind-artifacts.ts'

export function computeDolphindFullVersion(
  artifactDir,
  { target = '', agentBrowserFilename } = {}
) {
  const hash = createHash('sha256').update(dolphindArtifactHashPrefix(target))
  for (const filename of dolphindArtifactFilenames(target)) {
    const artifactPath = join(artifactDir, filename)
    if (!existsSync(artifactPath)) {
      throw new Error(
        `dolphind declares ${filename} in DOLPHIND_ARTIFACTS but never emitted it. Add the build ` +
          'step, or drop it from src/shared/dolphind-artifacts.ts.'
      )
    }
    hash.update(readFileSync(artifactPath))
  }
  if (agentBrowserFilename && existsSync(join(artifactDir, agentBrowserFilename))) {
    hash.update(readFileSync(join(artifactDir, agentBrowserFilename)))
  }
  return `${DOLPHIND_VERSION}+${hash.digest('hex').slice(0, 12)}`
}
