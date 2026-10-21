import { FORK_IDENTITY } from '../../shared/fork-identity'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import os from 'node:os'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as FsPromises from 'node:fs/promises'
import { setAppEnvironment } from '../../shared/app-environment'
import type * as RelocationModule from './daemon-host-relocation'

type RaceHook = (() => Promise<void>) | null
// Lets a test run a peer instance at an exact point of this launch's publish sequence.
const raceHooks = vi.hoisted((): { beforeMarker: RaceHook; beforeRename: RaceHook } => ({
  beforeMarker: null,
  beforeRename: null
}))

async function runRaceHook(name: keyof typeof raceHooks): Promise<void> {
  const hook = raceHooks[name]
  raceHooks[name] = null
  await hook?.()
}

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>()
  return {
    ...actual,
    writeFile: async (...args: Parameters<typeof actual.writeFile>) => {
      await runRaceHook('beforeMarker')
      return actual.writeFile(...args)
    },
    rename: async (...args: Parameters<typeof actual.rename>) => {
      await runRaceHook('beforeRename')
      return actual.rename(...args)
    }
  }
})

// Mutable host stub. Relocation now reads the AppEnvironment port rather than electron's
// `app`, so dolphind's daemon launch path can resolve without Electron in the graph.
const hostApp = {
  isPackaged: true,
  userDataPath: '',
  appPath: '',
  version: '9.9.9'
}

function installHostApp(install: typeof setAppEnvironment = setAppEnvironment): void {
  install({
    getPath: () => hostApp.userDataPath,
    getAppPath: () => hostApp.appPath,
    getVersion: () => hostApp.version,
    isPackaged: () => hostApp.isPackaged,
    onWillQuit: () => {},
    exit: () => {},
    getAppMetrics: () => []
  })
}

import { serializeDaemonHostChunkManifest } from './daemon-host-chunk-manifest'
import { buildDaemonHostManifest } from './daemon-host-manifest'
import { getRelocatedDaemonHost, materializeRelocatedDaemonHost } from './daemon-host-relocation'

let tempDir: string
let installDir: string
let userDataDir: string
let localAppDataDir: string
const originalPlatform = process.platform
const originalExecPath = process.execPath
const originalResourcesPath = process.resourcesPath
const originalLocalAppData = process.env.LOCALAPPDATA

function setProcessProp(key: string, value: unknown): void {
  Object.defineProperty(process, key, { value, configurable: true, writable: true })
}

// Build a win-unpacked fixture: exe + blobs + DLLs at root, daemon bundle and
// node-pty under resources, mirroring the packaged layout the copy expects.
function buildInstallFixture(root: string): void {
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'Dolphin.exe'), 'exe-bytes')
  for (const name of ['icudtl.dat', 'snapshot_blob.bin', 'v8_context_snapshot.bin']) {
    writeFileSync(join(root, name), name)
  }
  writeFileSync(join(root, 'ffmpeg.dll'), 'dll')
  writeFileSync(join(root, 'libEGL.dll'), 'dll')
  const mainDir = join(root, 'resources', 'app.asar.unpacked', 'out', 'main')
  mkdirSync(join(mainDir, 'chunks'), { recursive: true })
  writeFileSync(join(mainDir, 'daemon-entry.js'), 'entry')
  writeFileSync(join(mainDir, 'chunks', 'a.js'), 'chunk')
  writeFileSync(join(root, 'resources', 'app.asar.unpacked', 'out', 'package.json'), '{}')
  const nativeDir = join(root, 'resources', 'node_modules', 'node-pty', 'build', 'Release')
  mkdirSync(nativeDir, { recursive: true })
  writeFileSync(join(nativeDir, 'conpty.node'), 'native')
  writeFileSync(join(nativeDir, 'conpty.pdb'), 'debug-symbols')
  mkdirSync(join(nativeDir, 'conpty'), { recursive: true })
  writeFileSync(join(nativeDir, 'conpty', 'conpty.dll'), 'conpty-dll')
  // Both win32 prebuilds exist in the packaged tree (build-time prune keeps the
  // `win32-` prefix); the copy filter keeps the host arch's and drops the other.
  const prebuildsRoot = join(root, 'resources', 'node_modules', 'node-pty', 'prebuilds')
  for (const arch of ['win32-x64', 'win32-arm64']) {
    mkdirSync(join(prebuildsRoot, arch), { recursive: true })
    writeFileSync(join(prebuildsRoot, arch, 'pty.node'), `${arch}-prebuild`)
  }
  const processTreeDir = join(root, 'resources', 'node_modules', '@vscode', 'windows-process-tree')
  mkdirSync(join(processTreeDir, 'build', 'Release'), { recursive: true })
  mkdirSync(join(processTreeDir, 'lib'), { recursive: true })
  mkdirSync(join(processTreeDir, 'src'), { recursive: true })
  writeFileSync(join(processTreeDir, 'package.json'), '{"main":"lib/index.js"}')
  writeFileSync(join(processTreeDir, 'lib', 'index.js'), 'module.exports = {}')
  writeFileSync(
    join(processTreeDir, 'build', 'Release', 'windows_process_tree.node'),
    'process-tree-native'
  )
  writeFileSync(join(processTreeDir, 'build', 'Release', 'windows_process_tree.pdb'), 'symbols')
  writeFileSync(join(processTreeDir, 'src', 'process.cc'), 'source')
  writeFileSync(join(processTreeDir, 'lib', 'promises.js'), 'require("./index")')
  mkdirSync(join(processTreeDir, 'build', 'Release', 'obj'), { recursive: true })
  writeFileSync(join(processTreeDir, 'build', 'Release', 'obj', 'addon.obj'), 'intermediate')
}

const PROCESS_TREE_DIR_REL = join('resources', 'node_modules', '@vscode', 'windows-process-tree')

const PROCESS_TREE_ADDON_REL = join(
  'resources',
  'node_modules',
  '@vscode',
  'windows-process-tree',
  'build',
  'Release',
  'windows_process_tree.node'
)

// The win32 prebuild dir the running host arch loads vs. the one that is pruned.
const HOST_PREBUILD = `win32-${process.arch}`
const OTHER_PREBUILD = HOST_PREBUILD === 'win32-arm64' ? 'win32-x64' : 'win32-arm64'

beforeEach(() => {
  tempDir = mkdtempSync(join(os.tmpdir(), 'daemon-host-relocation-'))
  installDir = join(tempDir, 'app')
  userDataDir = join(tempDir, 'userData')
  mkdirSync(userDataDir, { recursive: true })
  localAppDataDir = join(tempDir, 'localAppData')
  mkdirSync(localAppDataDir, { recursive: true })
  process.env.LOCALAPPDATA = localAppDataDir
  buildInstallFixture(installDir)
  hostApp.isPackaged = true
  hostApp.userDataPath = userDataDir
  hostApp.appPath = join(installDir, 'resources', 'app.asar')
  hostApp.version = '9.9.9'
  installHostApp()
  setProcessProp('platform', 'win32')
  setProcessProp('execPath', join(installDir, 'Dolphin.exe'))
  setProcessProp('resourcesPath', join(installDir, 'resources'))
})

afterEach(() => {
  // A test that fails between spyOn and mockRestore must not leak its mock into later tests.
  vi.restoreAllMocks()
  raceHooks.beforeMarker = null
  raceHooks.beforeRename = null
  setProcessProp('platform', originalPlatform)
  setProcessProp('execPath', originalExecPath)
  setProcessProp('resourcesPath', originalResourcesPath)
  if (originalLocalAppData === undefined) {
    delete process.env.LOCALAPPDATA
  } else {
    process.env.LOCALAPPDATA = originalLocalAppData
  }
  try {
    rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // Best-effort
  }
})

describe('buildDaemonHostManifest', () => {
  it('mirrors the win-unpacked layout: exe + data blobs + resources tree, no GPU DLLs', async () => {
    const appDir = 'C:\\app'
    const ops = buildDaemonHostManifest({
      appDir,
      execPath: 'C:\\app\\Dolphin.exe',
      resourcesPath: 'C:\\app\\resources',
      entrySourcePath: 'C:\\app\\resources\\app.asar.unpacked\\out\\main\\daemon-entry.js',
      entryRelPath: 'resources/app.asar.unpacked/out/main/daemon-entry.js',
      windowsProcessTreeDir: 'C:\\app\\resources\\node_modules\\@vscode\\windows-process-tree',
      daemonChunkFiles: null
    })
    const byDest = new Map(ops.map((op) => [op.destRel, op]))
    // The host exe keeps the source basename: a verbatim, signature-preserving copy with no
    // image-name mismatch. What escapes the updater's sweep is the path, not the name.
    expect(byDest.get('Dolphin.exe')?.kind).toBe('file')
    const exeOp = ops.find((op) => op.sourcePath === 'C:\\app\\Dolphin.exe')
    expect(exeOp?.destRel).toBe('Dolphin.exe')
    // Without this op the relocated daemon cannot resolve the native process
    // table and falls back to a powershell.exe scan per snapshot (#16905).
    expect(byDest.get('resources/node_modules/@vscode/windows-process-tree')?.kind).toBe('dir')
    // V8/ICU data blobs are read by the Electron bootstrap and kept.
    expect(byDest.has('icudtl.dat')).toBe(true)
    // GPU/graphics DLLs are never loaded by the windowless host, so not copied.
    expect(byDest.has('ffmpeg.dll')).toBe(false)
    expect(byDest.has('libEGL.dll')).toBe(false)
    // Daemon bundle + node-pty mirrored at their real resources-relative paths.
    expect(byDest.get('resources/app.asar.unpacked/out/main/daemon-entry.js')?.kind).toBe('file')
    expect(byDest.get('resources/app.asar.unpacked/out/main/chunks')?.kind).toBe('dir')
    // node-pty is copied with a filter dropping .pdb + non-host-arch prebuilds.
    const nodePtyOp = byDest.get('resources/node_modules/node-pty')
    expect(nodePtyOp?.kind).toBe('dir')
    expect(nodePtyOp?.filter?.('node-pty/build/Release/conpty.node')).toBe(true)
    expect(nodePtyOp?.filter?.('node-pty/build/Release/conpty.pdb')).toBe(false)
    expect(nodePtyOp?.filter?.(`node-pty/prebuilds/${HOST_PREBUILD}/pty.node`)).toBe(true)
    expect(nodePtyOp?.filter?.(`node-pty/prebuilds/${OTHER_PREBUILD}/pty.node`)).toBe(false)
  })
})

describe('daemon chunk trimming', () => {
  const mainRel = join('resources', 'app.asar.unpacked', 'out', 'main')
  const hostDest = (): string =>
    join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host', '9.9.9')

  function writeChunkManifest(chunks: string[]): void {
    writeFileSync(
      join(installDir, mainRel, 'daemon-entry.host-chunks.json'),
      serializeDaemonHostChunkManifest(chunks)
    )
  }

  beforeEach(() => {
    writeFileSync(join(installDir, mainRel, 'chunks', 'main-only.js'), 'main chunk')
  })

  it('plans one required file op per listed chunk instead of the whole chunks dir', async () => {
    const ops = buildDaemonHostManifest({
      appDir: 'C:\\app',
      execPath: 'C:\\app\\Dolphin.exe',
      resourcesPath: 'C:\\app\\resources',
      entrySourcePath: 'C:\\app\\resources\\app.asar.unpacked\\out\\main\\daemon-entry.js',
      entryRelPath: 'resources/app.asar.unpacked/out/main/daemon-entry.js',
      windowsProcessTreeDir: 'C:\\app\\resources\\node_modules\\@vscode\\windows-process-tree',
      daemonChunkFiles: ['chunks/a.js']
    })
    const byDest = new Map(ops.map((op) => [op.destRel, op]))
    expect(byDest.has('resources/app.asar.unpacked/out/main/chunks')).toBe(false)
    const chunkOp = byDest.get('resources/app.asar.unpacked/out/main/chunks/a.js')
    expect(chunkOp?.kind).toBe('file')
    expect(chunkOp?.optional).toBeUndefined()
  })

  it('copies only the chunks the build listed for daemon-entry', async () => {
    writeChunkManifest(['chunks/a.js'])
    expect(await materializeRelocatedDaemonHost()).not.toBeNull()
    expect(readdirSync(join(hostDest(), mainRel, 'chunks'))).toEqual(['a.js'])
    // A build input, not something the daemon reads.
    expect(existsSync(join(hostDest(), mainRel, 'daemon-entry.host-chunks.json'))).toBe(false)
  })

  it('copies every chunk when the manifest is unreadable', async () => {
    writeFileSync(join(installDir, mainRel, 'daemon-entry.host-chunks.json'), '{"chunks":')
    expect(await materializeRelocatedDaemonHost()).not.toBeNull()
    expect(readdirSync(join(hostDest(), mainRel, 'chunks')).sort()).toEqual([
      'a.js',
      'main-only.js'
    ])
  })

  it('fails open rather than publish a host missing a listed chunk', async () => {
    writeChunkManifest(['chunks/a.js', 'chunks/gone.js'])
    expect(await materializeRelocatedDaemonHost()).toBeNull()
    const hostRoot = join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host')
    expect(existsSync(hostRoot) ? readdirSync(hostRoot) : []).toEqual([])
  })

  it('keeps using a same-version host materialized before trimming', async () => {
    expect(await materializeRelocatedDaemonHost()).not.toBeNull()
    writeChunkManifest(['chunks/a.js'])
    expect(await materializeRelocatedDaemonHost()).not.toBeNull()
    expect(readdirSync(join(hostDest(), mainRel, 'chunks')).sort()).toEqual([
      'a.js',
      'main-only.js'
    ])
  })
})

describe('materializeRelocatedDaemonHost', () => {
  it('copies the tree, writes the marker, and returns mirrored fork paths', async () => {
    const result = await materializeRelocatedDaemonHost()
    expect(result).not.toBeNull()
    const dest = join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host', '9.9.9')
    expect(result?.execPath).toBe(join(dest, 'Dolphin.exe'))
    expect(result?.entryPath).toBe(
      join(dest, 'resources', 'app.asar.unpacked', 'out', 'main', 'daemon-entry.js')
    )
    expect(existsSync(result!.execPath)).toBe(true)
    expect(existsSync(result!.entryPath)).toBe(true)
    // node-pty native + conpty runtime copied at the require-resolvable path.
    expect(
      existsSync(
        join(dest, 'resources', 'node_modules', 'node-pty', 'build', 'Release', 'conpty.node')
      )
    ).toBe(true)
    expect(
      existsSync(join(dest, 'resources', 'app.asar.unpacked', 'out', 'main', 'chunks', 'a.js'))
    ).toBe(true)
    // Trim: GPU DLLs, .pdb debug symbols, and non-host-arch prebuilds excluded;
    // the host arch's prebuild is retained so node-pty resolves its native addon.
    expect(existsSync(join(dest, 'ffmpeg.dll'))).toBe(false)
    expect(existsSync(join(dest, 'libEGL.dll'))).toBe(false)
    expect(
      existsSync(
        join(dest, 'resources', 'node_modules', 'node-pty', 'build', 'Release', 'conpty.pdb')
      )
    ).toBe(false)
    const prebuildsDest = join(dest, 'resources', 'node_modules', 'node-pty', 'prebuilds')
    expect(existsSync(join(prebuildsDest, HOST_PREBUILD, 'pty.node'))).toBe(true)
    expect(existsSync(join(prebuildsDest, OTHER_PREBUILD, 'pty.node'))).toBe(false)
    // Marker records the version + entry rel path, written into the published dir.
    const marker = JSON.parse(readFileSync(join(dest, '.materialized.json'), 'utf8'))
    expect(marker.version).toBe('9.9.9')
    expect(marker.entryRelPath).toBe('resources/app.asar.unpacked/out/main/daemon-entry.js')
    // The whole package is mirrored, so require() finds every hop it walks.
    const processTreeDest = join(
      dest,
      'resources',
      'node_modules',
      '@vscode',
      'windows-process-tree'
    )
    expect(existsSync(join(processTreeDest, 'build', 'Release', 'windows_process_tree.node'))).toBe(
      true
    )
    expect(existsSync(join(processTreeDest, 'lib', 'index.js'))).toBe(true)
    expect(existsSync(join(processTreeDest, 'lib', 'promises.js'))).toBe(true)
    // Build intermediates are ~25MB of the installed package; the loader never reads them.
    expect(existsSync(join(processTreeDest, 'build', 'Release', 'windows_process_tree.pdb'))).toBe(
      false
    )
    expect(existsSync(join(processTreeDest, 'build', 'Release', 'obj'))).toBe(false)
    expect(existsSync(join(processTreeDest, 'src'))).toBe(false)
    // The loader requires the BARE package, so resolution runs through the copied
    // package.json's `main`. Asserting the .node subpath instead would still pass
    // with package.json dropped from the filter, while the daemon's own require
    // failed and it silently went back to the CIM scan.
    expect(
      createRequire(
        join(dest, 'resources', 'app.asar.unpacked', 'out', 'main', 'chunks', 'a.js')
      ).resolve('@vscode/windows-process-tree')
    ).toBe(realpathSync(join(processTreeDest, 'lib', 'index.js')))
  })

  it('copies the exe verbatim: same file name and same bytes as the install-dir exe', async () => {
    const result = await materializeRelocatedDaemonHost()
    const sourceExe = join(installDir, 'Dolphin.exe')
    // Byte-for-byte under the same name is what preserves the Authenticode signature and leaves
    // no renamed-image signal for endpoint detection to read as masquerading.
    expect(basename(result!.execPath)).toBe(basename(sourceExe))
    expect(readFileSync(result!.execPath)).toEqual(readFileSync(sourceExe))
  })

  it('tracks a differently-named app exe rather than pinning an image name of its own', async () => {
    // A dev-channel or rebranded build ships a different executableName; the host copy must follow
    // it, which is what keeps the copy verbatim instead of reintroducing a name mismatch.
    renameSync(join(installDir, 'Dolphin.exe'), join(installDir, 'Dolphin Nightly.exe'))
    setProcessProp('execPath', join(installDir, 'Dolphin Nightly.exe'))
    const result = await materializeRelocatedDaemonHost()
    const dest = join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host', '9.9.9')
    expect(result?.execPath).toBe(join(dest, 'Dolphin Nightly.exe'))
    expect(existsSync(join(dest, 'dolphin-terminal-daemon.exe'))).toBe(false)
    // Re-resolution must agree with materialization or the fork would target a missing exe.
    expect(getRelocatedDaemonHost()?.execPath).toBe(join(dest, 'Dolphin Nightly.exe'))
  })

  it.each([
    ['the binary', PROCESS_TREE_ADDON_REL],
    ['package.json', join(PROCESS_TREE_DIR_REL, 'package.json')],
    ['lib/index.js', join(PROCESS_TREE_DIR_REL, 'lib', 'index.js')]
  ])('refuses a mirror that lost %s', async (_label, relativePath) => {
    // Any one of them missing means require() cannot reach the addon, and a host
    // that cannot load it runs anyway -- forking a shell per snapshot (#16905).
    await materializeRelocatedDaemonHost()
    const dest = join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host', '9.9.9')
    expect(getRelocatedDaemonHost()).not.toBeNull()

    rmSync(join(dest, relativePath))

    expect(getRelocatedDaemonHost()).toBeNull()
  })

  it('rematerializes a host whose copied addon went missing', async () => {
    await materializeRelocatedDaemonHost()
    const dest = join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host', '9.9.9')
    const relocatedAddon = join(dest, PROCESS_TREE_ADDON_REL)

    rmSync(relocatedAddon)
    // A sentinel proves the host was rebuilt rather than reused.
    const sentinel = join(dest, 'sentinel.txt')
    writeFileSync(sentinel, 'remove')

    expect(await materializeRelocatedDaemonHost()).not.toBeNull()
    expect(readFileSync(relocatedAddon, 'utf8')).toBe('process-tree-native')
    expect(existsSync(sentinel)).toBe(false)
  })

  it('does not read the install dir to decide an existing host is still good', async () => {
    // Relocation exists to outlive the install dir, so validity cannot depend on
    // it: an updater mid-copy would otherwise condemn an intact host. A real
    // upgrade changes the version keying this directory, which already forces a
    // rebuild, and nothing else in the mirror is source-verified either.
    await materializeRelocatedDaemonHost()
    const dest = join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host', '9.9.9')
    const sentinel = join(dest, 'sentinel.txt')
    writeFileSync(sentinel, 'keep')

    rmSync(join(installDir, 'resources', 'node_modules', '@vscode'), {
      recursive: true,
      force: true
    })

    expect(getRelocatedDaemonHost()).not.toBeNull()
    expect(existsSync(sentinel)).toBe(true)
  })

  it.each([
    ['the binary', PROCESS_TREE_ADDON_REL],
    ['package.json', join(PROCESS_TREE_DIR_REL, 'package.json')],
    ['lib/index.js', join(PROCESS_TREE_DIR_REL, 'lib', 'index.js')]
  ])('refuses to copy anything when the install lost %s', async (_label, relativePath) => {
    // Each of these would be accepted by the copy plan and then refused by the
    // mirror check, which is a ~260MB copy per launch to reach a verdict the
    // source could have given for free. Sharing one list is what prevents that.
    rmSync(join(installDir, relativePath))

    expect(await materializeRelocatedDaemonHost()).toBeNull()
    // Not even the host root: the source is checked before any directory is made.
    expect(existsSync(join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host'))).toBe(false)
  })

  it('is idempotent: a valid marker short-circuits without recopying', async () => {
    await materializeRelocatedDaemonHost()
    const dest = join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host', '9.9.9')
    // A recopy would rm the dest; a sentinel inside it must survive the 2nd call.
    const sentinel = join(dest, 'sentinel.txt')
    writeFileSync(sentinel, 'keep')
    const result = await materializeRelocatedDaemonHost()
    expect(result?.execPath).toBe(join(dest, 'Dolphin.exe'))
    expect(existsSync(sentinel)).toBe(true)
  })

  it('fails open on a missing required input, leaving no dest or staging dir', async () => {
    rmSync(join(installDir, 'resources', 'node_modules', 'node-pty'), {
      recursive: true,
      force: true
    })
    const result = await materializeRelocatedDaemonHost()
    expect(result).toBeNull()
    const hostRoot = join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host')
    // Neither the published dest nor any leftover staging dir remains.
    const remaining = existsSync(hostRoot) ? readdirSync(hostRoot) : []
    expect(remaining).toEqual([])
  })

  it('returns null off win32', async () => {
    setProcessProp('platform', 'darwin')
    expect(await materializeRelocatedDaemonHost()).toBeNull()
    expect(existsSync(join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host'))).toBe(false)
  })

  it('does nothing for a packaged host with no asar root (dolphind on win32)', async () => {
    // dolphind answers isPackaged() true — it is a shipped build — but it is plain Node: no
    // asar, no resourcesPath, and no NSIS updater to escape. Relocation staging a copy of
    // an Electron tree that is not there is the isPackaged-honesty defect, and it would
    // silently produce a null host on a path whose failures are meant to be visible.
    hostApp.appPath = join(installDir, 'resources', 'app')
    installHostApp()
    expect(await materializeRelocatedDaemonHost()).toBeNull()
    expect(getRelocatedDaemonHost()).toBeNull()
    expect(existsSync(join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host'))).toBe(false)
  })
})

describe('getRelocatedDaemonHost', () => {
  it('returns null when the marker version does not match the current version', async () => {
    const dest = join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host', '9.9.9')
    mkdirSync(dirname(join(dest, 'x')), { recursive: true })
    writeFileSync(join(dest, 'Dolphin.exe'), 'exe')
    mkdirSync(join(dest, 'resources', 'app.asar.unpacked', 'out', 'main'), { recursive: true })
    writeFileSync(
      join(dest, 'resources', 'app.asar.unpacked', 'out', 'main', 'daemon-entry.js'),
      'e'
    )
    // The process-table files too, or this passes because the mirror has no addon
    // and never exercises the version comparison it is named for.
    mkdirSync(join(dest, PROCESS_TREE_DIR_REL, 'lib'), { recursive: true })
    mkdirSync(dirname(join(dest, PROCESS_TREE_ADDON_REL)), { recursive: true })
    writeFileSync(join(dest, PROCESS_TREE_DIR_REL, 'package.json'), '{}')
    writeFileSync(join(dest, PROCESS_TREE_DIR_REL, 'lib', 'index.js'), 'm')
    writeFileSync(join(dest, PROCESS_TREE_ADDON_REL), 'n')
    writeFileSync(
      join(dest, '.materialized.json'),
      JSON.stringify({
        version: '8.8.8',
        completedAt: '',
        entryRelPath: 'resources/app.asar.unpacked/out/main/daemon-entry.js'
      })
    )
    expect(getRelocatedDaemonHost()).toBeNull()
  })
})

describe('materializeRelocatedDaemonHost concurrency', () => {
  const hostRoot = (): string => join(localAppDataDir, FORK_IDENTITY.productName, 'daemon-host')

  // A second app instance shares the LOCALAPPDATA root but not this module's in-flight promise.
  async function importPeerInstance(): Promise<typeof RelocationModule> {
    vi.resetModules()
    installHostApp((await import('../../shared/app-environment')).setAppEnvironment)
    return import('./daemon-host-relocation')
  }

  it('yields the event loop while copying instead of blocking it', async () => {
    let loopTurned = false
    setImmediate(() => {
      loopTurned = true
    })
    const pending = materializeRelocatedDaemonHost()
    expect(loopTurned).toBe(false)
    expect(await pending).not.toBeNull()
    expect(loopTurned).toBe(true)
  })

  it('shares one copy between concurrent launches in the same process', async () => {
    const first = materializeRelocatedDaemonHost()
    const second = materializeRelocatedDaemonHost()
    expect(second).toBe(first)
    expect(await first).not.toBeNull()
    expect(readdirSync(hostRoot())).toEqual(['9.9.9'])
  })

  it('leaves one valid host and no staging dirs when two instances race', async () => {
    const peer = await importPeerInstance()
    const [ours, theirs] = await Promise.all([
      materializeRelocatedDaemonHost(),
      peer.materializeRelocatedDaemonHost()
    ])
    expect(ours?.execPath).toBe(join(hostRoot(), '9.9.9', 'Dolphin.exe'))
    expect(theirs).toEqual(ours)
    expect(readdirSync(hostRoot())).toEqual(['9.9.9'])
    expect(getRelocatedDaemonHost()).toEqual(ours)
  })

  it('never replaces a host a peer published while this launch was copying', async () => {
    const peer = await importPeerInstance()
    const sentinel = join(hostRoot(), '9.9.9', 'sentinel.txt')
    raceHooks.beforeMarker = async () => {
      expect(await peer.materializeRelocatedDaemonHost()).not.toBeNull()
      writeFileSync(sentinel, 'keep')
    }
    expect(await materializeRelocatedDaemonHost()).toEqual(getRelocatedDaemonHost())
    // Removing the published dir could pull files from under the daemon the peer is forking.
    expect(existsSync(sentinel)).toBe(true)
    expect(readdirSync(hostRoot())).toEqual(['9.9.9'])
  })

  it('adopts a peer host published between removing the stale dest and renaming', async () => {
    const peer = await importPeerInstance()
    raceHooks.beforeRename = async () => {
      expect(await peer.materializeRelocatedDaemonHost()).not.toBeNull()
    }
    const ours = await materializeRelocatedDaemonHost()
    expect(ours?.execPath).toBe(join(hostRoot(), '9.9.9', 'Dolphin.exe'))
    expect(readdirSync(hostRoot())).toEqual(['9.9.9'])
  })
})
