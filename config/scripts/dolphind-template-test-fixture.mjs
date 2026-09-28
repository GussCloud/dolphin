import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  DOLPHIND_BUILD_TARGET_FILENAME,
  DOLPHIND_TEMPLATE_MANIFEST_FILENAME,
  DOLPHIND_TEMPLATE_TARGETS_DIR,
  dolphindTemplateCommonFilenames
} from '../../src/shared/dolphind-artifacts.ts'
import { DOLPHIND_TEMPLATE_TARGETS } from '../../src/shared/dolphind-bun-runtime.ts'

async function write(path, contents) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
  return createHash('sha256').update(contents).digest('hex')
}

export async function writeDolphindTemplateTestFixture(resourcesDir) {
  const templateDir = join(resourcesDir, 'dolphind-template')
  const commonFilenames = dolphindTemplateCommonFilenames()
  const commonSha256 = {}
  for (const filename of commonFilenames) {
    commonSha256[filename] = await write(
      join(templateDir, ...filename.split('/')),
      Buffer.from(`common:${filename}`)
    )
  }
  const targets = {}
  for (const target of DOLPHIND_TEMPLATE_TARGETS) {
    const targetDir = join(templateDir, DOLPHIND_TEMPLATE_TARGETS_DIR, target)
    targets[target] = {
      targetSha256: await write(join(targetDir, DOLPHIND_BUILD_TARGET_FILENAME), `${target}\n`),
      watcherSha256: await write(join(targetDir, 'watcher.node'), `watcher:${target}`)
    }
  }
  const browserName = 'agent-browser-linux-x64'
  targets['linux-x64-glibc'] = {
    ...targets['linux-x64-glibc'],
    browserName,
    browserSha256: await write(
      join(templateDir, DOLPHIND_TEMPLATE_TARGETS_DIR, 'linux-x64-glibc', browserName),
      'browser'
    )
  }
  await writeFile(
    join(templateDir, DOLPHIND_TEMPLATE_MANIFEST_FILENAME),
    JSON.stringify({ schemaVersion: 2, commonSha256, targets })
  )
  return templateDir
}
