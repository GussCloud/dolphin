import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import {
  DOLPHIND_BUILD_TARGET_FILENAME,
  DOLPHIND_VERSION,
  dolphindArtifactFilenames,
  dolphindArtifactHashPrefix
} from '../../shared/dolphind-artifacts'
import { DOLPHIND_BUN_TARGETS } from '../../shared/dolphind-bun-runtime'
import { dolphindAgentBrowserNativeName } from '../../shared/dolphind-agent-browser-name'

/** Hash installed bytes in the build's order; a version marker is not proof of delivery. */
export async function readDolphindArtifactIdentity(directory: string): Promise<string> {
  const target = z
    .enum(DOLPHIND_BUN_TARGETS)
    .parse((await readFile(join(directory, DOLPHIND_BUILD_TARGET_FILENAME), 'utf8')).trim())
  const platform = target.startsWith('win32-')
    ? 'win32'
    : target.startsWith('darwin-')
      ? 'darwin'
      : 'linux'
  const browser = dolphindAgentBrowserNativeName(
    platform,
    target.split('-')[1] ?? '',
    target.endsWith('-musl') ? 'musl' : 'glibc'
  )
  const filenames = dolphindArtifactFilenames(target)
  if (existsSync(join(directory, browser))) {
    filenames.push(browser)
  }
  const hash = createHash('sha256').update(dolphindArtifactHashPrefix(target))
  for (const filename of filenames) {
    for await (const chunk of createReadStream(join(directory, filename))) {
      hash.update(chunk)
    }
  }
  return `${DOLPHIND_VERSION}+${hash.digest('hex').slice(0, 12)}`
}
