const {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync
} = require('node:fs')
const { spawnSync } = require('node:child_process')
const { tmpdir } = require('node:os')
const { dirname, join } = require('node:path')

// Owned by src/main/daemon/daemon-host-chunk-manifest.ts -- keep in sync.
const DAEMON_HOST_CHUNK_MANIFEST_NAME = 'daemon-entry.host-chunks.json'

// Why: `asarUnpack` in config/electron-builder.config.cjs lists
// out/main/daemon-entry.js on every platform, and the packaged daemon fork
// (src/main/daemon/daemon-init.ts) resolves exactly this unpacked path. A
// missing entry means the package layout regressed, so the check throws
// instead of skipping — a silent skip false-passed exactly the layout bug
// this gate exists to catch.
function assertPackagedDaemonEntryExists(resourcesDir) {
  const entryPath = join(resourcesDir, 'app.asar.unpacked', 'out', 'main', 'daemon-entry.js')
  if (!existsSync(entryPath)) {
    throw new Error(
      `[verify-packaged-daemon-entry] missing unpacked daemon entry at ${entryPath} — ` +
        `asarUnpack expects out/main/daemon-entry.js on every platform, so the packaged ` +
        `daemon cannot be forked from this layout`
    )
  }
  return entryPath
}

// Why: v1.4.129-rc.1 shipped a terminal daemon that could not load (an electron
// `require` leaked into its bundle) while every build check passed. This boots
// the PACKAGED daemon-entry under plain Node against the asar-unpacked layout,
// so a bundling / asar-unpack regression fails packaging instead of reaching
// users. Module-load proof only: with no args the entry must reach argv parsing
// and print its "Usage: daemon-entry" error — a MODULE_NOT_FOUND or a missing
// usage line means the packaged graph does not load and the build must fail.
//
// resourcesDir is the packaged Resources dir (Contents/Resources on macOS,
// <appOutDir>/resources elsewhere). execPath defaults to the packaging Node.
function bootDaemonEntryOrThrow(execPath, entryPath, label) {
  const result = spawnSync(execPath, [entryPath], { encoding: 'utf8', timeout: 10_000 })
  if (result.error) {
    throw new Error(
      `[verify-packaged-daemon-entry] could not launch ${label}: ${result.error.message}`
    )
  }
  const stderr = result.stderr || ''
  if (/Cannot find module|MODULE_NOT_FOUND/.test(stderr)) {
    throw new Error(
      `[verify-packaged-daemon-entry] ${label} failed to load under plain Node:\n${stderr}`
    )
  }
  if (!stderr.includes('Usage: daemon-entry')) {
    throw new Error(
      `[verify-packaged-daemon-entry] ${label} did not reach argv parsing ` +
        `(expected the "Usage: daemon-entry" error). stderr:\n${stderr}`
    )
  }
}

function verifyPackagedDaemonEntryBoots(resourcesDir, options = {}) {
  const execPath = options.execPath || process.execPath
  const entryPath = assertPackagedDaemonEntryExists(resourcesDir)
  bootDaemonEntryOrThrow(execPath, entryPath, 'packaged daemon-entry.js')
  console.log('[verify-packaged-daemon-entry] OK — packaged daemon-entry loads under plain Node')
}

// Same shape check as parseDaemonHostChunkManifest: plain .js files directly under chunks/.
function readPackagedDaemonHostChunks(resourcesDir) {
  const mainDir = join(resourcesDir, 'app.asar.unpacked', 'out', 'main')
  const manifestPath = join(mainDir, DAEMON_HOST_CHUNK_MANIFEST_NAME)
  if (!existsSync(manifestPath)) {
    throw new Error(
      `[verify-packaged-daemon-entry] missing ${manifestPath} — the main build emits it and ` +
        `asarUnpack must list it, or the relocated Windows daemon host copies every chunk`
    )
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const chunks = manifest && manifest.formatVersion === 1 ? manifest.chunks : undefined
  if (
    !Array.isArray(chunks) ||
    !chunks.every((chunk) => typeof chunk === 'string' && /^chunks\/[^/\\:]+\.js$/.test(chunk))
  ) {
    throw new Error(`[verify-packaged-daemon-entry] unreadable chunk list in ${manifestPath}`)
  }
  const missing = chunks.filter((chunk) => !existsSync(join(mainDir, ...chunk.split('/'))))
  if (missing.length > 0) {
    throw new Error(
      `[verify-packaged-daemon-entry] ${DAEMON_HOST_CHUNK_MANIFEST_NAME} lists chunks the ` +
        `package does not contain: ${missing.join(', ')}`
    )
  }
  return chunks
}

// Why: the Windows daemon host copies only the listed chunks (daemon-host-manifest.ts). Booting
// a copy holding just those proves the list covers the entry's load-time graph.
function verifyPackagedDaemonHostChunksBoot(resourcesDir, options = {}) {
  const execPath = options.execPath || process.execPath
  const entryPath = assertPackagedDaemonEntryExists(resourcesDir)
  const chunks = readPackagedDaemonHostChunks(resourcesDir)
  const sourceOutDir = dirname(dirname(entryPath))
  const tempRoot = mkdtempSync(join(tmpdir(), 'dolphin-daemon-host-chunks-'))
  try {
    const outDir = join(tempRoot, 'resources', 'app.asar.unpacked', 'out')
    const copyOut = (relative) => {
      const dest = join(outDir, ...relative.split('/'))
      mkdirSync(dirname(dest), { recursive: true })
      copyFileSync(join(sourceOutDir, ...relative.split('/')), dest)
    }
    if (existsSync(join(sourceOutDir, 'package.json'))) {
      copyOut('package.json')
    }
    copyOut('main/daemon-entry.js')
    for (const chunk of chunks) {
      copyOut(`main/${chunk}`)
    }
    bootDaemonEntryOrThrow(
      execPath,
      join(outDir, 'main', 'daemon-entry.js'),
      `daemon-entry.js with only the ${chunks.length} chunks in ${DAEMON_HOST_CHUNK_MANIFEST_NAME}`
    )
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
  console.log(
    `[verify-packaged-daemon-entry] OK — daemon-entry loads from its ${chunks.length} listed chunks`
  )
}

module.exports = {
  assertPackagedDaemonEntryExists,
  readPackagedDaemonHostChunks,
  verifyPackagedDaemonEntryBoots,
  verifyPackagedDaemonHostChunksBoot
}
