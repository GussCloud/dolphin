import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { chmod, copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { getAppEnvironment } from '../../shared/app-environment'
import { waitForPromiseWithSignal } from '../../shared/abort-signal-reason'
import {
  DOLPHIND_BUILD_TARGET_FILENAME,
  dolphindBunRuntimeFilename,
  dolphindArtifactHashPrefix,
  DOLPHIND_TEMPLATE_MANIFEST_FILENAME,
  DOLPHIND_TEMPLATE_TARGETS_DIR,
  DOLPHIND_VERSION,
  DOLPHIND_VERSION_FILENAME,
  DOLPHIND_RIPGREP_ARTIFACTS,
  dolphindArtifactFilenames,
  dolphindTemplateCommonFilenames
} from '../../shared/dolphind-artifacts'
import type { DolphindBunTarget } from '../../shared/dolphind-bun-runtime'
import { findDolphindCachePath } from './dolphind-cache-path'
import {
  fileSha256,
  materializeCachedDolphindBunRuntime,
  verifyFileSha256,
  type DolphindBunRuntimeMaterializeOptions
} from './dolphind-bun-runtime-materializer'

const TemplateTargetSchema = z
  .object({
    targetSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    watcherSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    browserName: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u)
      .optional(),
    browserSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional()
  })
  .refine((target) => Boolean(target.browserName) === Boolean(target.browserSha256), {
    message: 'browserName and browserSha256 must either both be present or both be absent'
  })
const TemplateManifestSchema = z.object({
  schemaVersion: z.literal(2),
  commonSha256: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/u)),
  targets: z.record(z.string(), TemplateTargetSchema)
})

type MaterializeOptions = DolphindBunRuntimeMaterializeOptions & {
  templateDir?: string
  cacheRoot?: string
}

const materializations = new Map<string, Promise<string>>()

export async function materializeDolphindArtifact(
  target: DolphindBunTarget,
  options: MaterializeOptions = {}
): Promise<string> {
  options.signal?.throwIfAborted()
  const templateDir = options.templateDir ?? resolveDolphindTemplateDir()
  const cacheRoot =
    options.cacheRoot ?? join(getAppEnvironment().getPath('userData'), 'dolphind-artifacts')
  const key = `${templateDir}\0${cacheRoot}\0${target}`
  const existing = materializations.get(key)
  if (existing) {
    return waitForPromiseWithSignal(existing, options.signal)
  }
  // Cancellation detaches one caller; the bounded cache fill still serves other deployments.
  const pending = materializeDolphindArtifactInner(target, templateDir, cacheRoot, {
    fetcher: options.fetcher
  }).finally(() => materializations.delete(key))
  materializations.set(key, pending)
  return waitForPromiseWithSignal(pending, options.signal)
}

async function materializeDolphindArtifactInner(
  target: DolphindBunTarget,
  templateDir: string,
  cacheRoot: string,
  options: MaterializeOptions
): Promise<string> {
  const manifest = await readTemplateManifest(templateDir)
  await verifyTemplate(templateDir, target, manifest)
  const runtimePath = await materializeCachedDolphindBunRuntime(target, cacheRoot, options)
  return await assembleDolphindArtifact({ templateDir, cacheRoot, target, runtimePath, manifest })
}

export async function assembleDolphindArtifact(args: {
  templateDir: string
  cacheRoot: string
  target: DolphindBunTarget
  runtimePath: string
  manifest?: z.infer<typeof TemplateManifestSchema>
}): Promise<string> {
  const manifest = args.manifest ?? (await readTemplateManifest(args.templateDir))
  await verifyTemplate(args.templateDir, args.target, manifest)
  const sources = artifactSources(args.templateDir, args.target, args.runtimePath, manifest)
  const { fullVersion, sourceHashes } = await computeArtifactIdentity(sources, args.target)
  const targetRoot = join(args.cacheRoot, args.target)
  const cached = await findDolphindCachePath(
    (attempt) => join(targetRoot, `${fullVersion}${attempt ? `.repair-${attempt}` : ''}`),
    (path) => isCompleteArtifact(path, fullVersion, sources, sourceHashes)
  )
  const targetDir = cached.path
  if (cached.verified) {
    return targetDir
  }
  await mkdir(targetRoot, { recursive: true })
  const stagingDir = join(targetRoot, `.staging-${process.pid}-${randomUUID()}`)
  try {
    for (const source of sources) {
      const destination = join(stagingDir, source.filename)
      await mkdir(dirname(destination), { recursive: true })
      await copyFile(source.path, destination)
      if (source.executable && !args.target.startsWith('win32-')) {
        await chmod(destination, 0o755)
      }
    }
    await writeFile(join(stagingDir, DOLPHIND_VERSION_FILENAME), `${fullVersion}\n`, {
      mode: 0o600
    })
    if (!(await isCompleteArtifact(stagingDir, fullVersion, sources, sourceHashes))) {
      throw new Error('Dolphind artifact sources changed while copying')
    }
    try {
      await rename(stagingDir, targetDir)
    } catch (error) {
      if (!(await isCompleteArtifact(targetDir, fullVersion, sources, sourceHashes))) {
        throw new Error(`Dolphind artifact cache entry is unavailable or corrupted: ${targetDir}`, {
          cause: error
        })
      }
    }
    return targetDir
  } finally {
    await rm(stagingDir, { recursive: true, force: true })
  }
}

function artifactSources(
  templateDir: string,
  target: DolphindBunTarget,
  runtimePath: string,
  manifest: z.infer<typeof TemplateManifestSchema>
): { filename: string; path: string; executable?: boolean }[] {
  const targetDir = join(templateDir, DOLPHIND_TEMPLATE_TARGETS_DIR, target)
  const targetManifest = manifest.targets[target]
  if (!targetManifest) {
    throw new Error(`Packaged dolphind template does not support ${target}`)
  }
  const required = dolphindArtifactFilenames(target).map((filename) => ({
    filename,
    path:
      filename === dolphindBunRuntimeFilename(target)
        ? runtimePath
        : filename === DOLPHIND_BUILD_TARGET_FILENAME
          ? join(targetDir, DOLPHIND_BUILD_TARGET_FILENAME)
          : filename.endsWith('watcher.node')
            ? join(targetDir, 'watcher.node')
            : join(templateDir, filename),
    executable:
      filename === dolphindBunRuntimeFilename(target) ||
      DOLPHIND_RIPGREP_ARTIFACTS.some(
        (artifact) => artifact === filename && artifact.endsWith('/rg')
      )
  }))
  if (!targetManifest.browserName) {
    return required
  }
  return [
    ...required,
    {
      filename: targetManifest.browserName,
      path: join(targetDir, targetManifest.browserName),
      executable: true
    }
  ]
}

async function computeArtifactIdentity(
  sources: { filename: string; path: string }[],
  target: DolphindBunTarget
): Promise<{ fullVersion: string; sourceHashes: Map<string, string> }> {
  const hash = createHash('sha256').update(dolphindArtifactHashPrefix(target))
  const sourceHashes = new Map<string, string>()
  for (const source of sources) {
    const sourceHash = createHash('sha256')
    for await (const chunk of createReadStream(source.path)) {
      hash.update(chunk)
      sourceHash.update(chunk)
    }
    sourceHashes.set(source.filename, sourceHash.digest('hex'))
  }
  return {
    fullVersion: `${DOLPHIND_VERSION}+${hash.digest('hex').slice(0, 12)}`,
    sourceHashes
  }
}

async function isCompleteArtifact(
  dir: string,
  fullVersion: string,
  sources: { filename: string }[],
  sourceHashes: Map<string, string>
): Promise<boolean> {
  try {
    if ((await readFile(join(dir, DOLPHIND_VERSION_FILENAME), 'utf8')).trim() !== fullVersion) {
      return false
    }
    for (const source of sources) {
      if ((await fileSha256(join(dir, source.filename))) !== sourceHashes.get(source.filename)) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

async function readTemplateManifest(
  templateDir: string
): Promise<z.infer<typeof TemplateManifestSchema>> {
  return TemplateManifestSchema.parse(
    JSON.parse(await readFile(join(templateDir, DOLPHIND_TEMPLATE_MANIFEST_FILENAME), 'utf8'))
  )
}

async function verifyTemplate(
  templateDir: string,
  target: DolphindBunTarget,
  manifest: z.infer<typeof TemplateManifestSchema>
): Promise<void> {
  const targetManifest = manifest.targets[target]
  if (!targetManifest) {
    throw new Error(`Packaged dolphind template does not support ${target}`)
  }
  const commonFilenames = dolphindTemplateCommonFilenames()
  for (const filename of commonFilenames) {
    const expected = manifest.commonSha256[filename]
    if (!expected) {
      throw new Error(`Packaged dolphind template manifest omits ${filename}`)
    }
    await verifyFileSha256(join(templateDir, filename), expected, `dolphind template ${filename}`)
  }
  const targetDir = join(templateDir, DOLPHIND_TEMPLATE_TARGETS_DIR, target)
  const targetIdentityPath = join(targetDir, DOLPHIND_BUILD_TARGET_FILENAME)
  await verifyFileSha256(targetIdentityPath, targetManifest.targetSha256, `${target} build target`)
  if ((await readFile(targetIdentityPath, 'utf8')).trim() !== target) {
    throw new Error(`Packaged dolphind template target identity does not match ${target}`)
  }
  await verifyFileSha256(
    join(targetDir, 'watcher.node'),
    targetManifest.watcherSha256,
    `${target} watcher`
  )
  if (targetManifest.browserName && targetManifest.browserSha256) {
    await verifyFileSha256(
      join(targetDir, targetManifest.browserName),
      targetManifest.browserSha256,
      `${target} browser`
    )
  }
}

export function getDolphindTemplateCandidates(): string[] {
  const candidates: string[] = []
  if (process.env.DOLPHIN_DOLPHIND_TEMPLATE_PATH) {
    candidates.push(process.env.DOLPHIN_DOLPHIND_TEMPLATE_PATH)
  }
  if (process.resourcesPath) {
    candidates.push(join(process.resourcesPath, 'dolphind-template'))
  }
  const appPath = getAppEnvironment().getAppPath()
  candidates.push(
    join(appPath, 'out', 'dolphind-template'),
    join(appPath, 'resources', 'dolphind-template')
  )
  return [...new Set(candidates)]
}

function resolveDolphindTemplateDir(): string {
  const found = getDolphindTemplateCandidates().find((candidate) => existsSync(candidate))
  if (!found) {
    throw new Error('The packaged dolphind deployment template is missing')
  }
  return found
}

export function resetDolphindArtifactMaterializationsForTests(): void {
  materializations.clear()
}
