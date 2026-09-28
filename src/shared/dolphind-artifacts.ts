/**
 * What a packaged `dolphind` directory must contain, declared once — the same single-source
 * treatment `relay-artifacts.ts` gives the relay, for the same reason: the build, the
 * content hash and the remote install probe must not keep three lists that drift.
 *
 * Order is load-bearing: the hash concatenates these files in sequence.
 *
 * Keep this file erasable-only TypeScript — build-dolphind.mjs imports it directly under
 * Node's type stripping, which rejects enums, namespaces and parameter properties.
 */
export const DOLPHIND_BUN_RUNTIME_FILENAME = 'bun-runtime'
export const DOLPHIND_WINDOWS_BUN_RUNTIME_FILENAME = 'bun-runtime.exe'
export const DOLPHIND_WINDOWS_PROCESS_TREE_FILENAME = 'windows-process-tree.node'

export function dolphindBunRuntimeFilename(target: string): string {
  return target === 'win32' || target.startsWith('win32-')
    ? DOLPHIND_WINDOWS_BUN_RUNTIME_FILENAME
    : DOLPHIND_BUN_RUNTIME_FILENAME
}

/** Keep renamed Windows executables in a new content-addressed slot. */
export function dolphindArtifactHashPrefix(target: string): string {
  return dolphindBunRuntimeFilename(target) === DOLPHIND_WINDOWS_BUN_RUNTIME_FILENAME
    ? `${DOLPHIND_WINDOWS_BUN_RUNTIME_FILENAME}\0`
    : ''
}
export const DOLPHIND_BUILD_TARGET_FILENAME = '.build-target'
export const DOLPHIND_PARCEL_WATCHER_ENTRY = 'node_modules/@parcel/watcher/index.js'
export const DOLPHIND_PARCEL_WATCHER_NATIVE = 'node_modules/@parcel/watcher/watcher.node'
export const DOLPHIND_EMOJI_SHORTCODE_DATASET =
  'node_modules/emojibase-data/en/shortcodes/emojibase.json'

export const DOLPHIND_VERSION = '0.1.0'

// Kept here because build-dolphind.mjs imports this manifest directly under Node type stripping.
export const DOLPHIND_RIPGREP_ARTIFACTS = [
  'ripgrep/linux-x64/rg',
  'ripgrep/linux-arm64/rg',
  'ripgrep/darwin-x64/rg',
  'ripgrep/darwin-arm64/rg',
  'ripgrep/win32-x64/rg.exe',
  'ripgrep/win32-arm64/rg.exe'
] as const

export const DOLPHIND_RIPGREP_LICENSE_ARTIFACTS = [
  'ripgrep/licenses/JEMALLOC-COPYING',
  'ripgrep/licenses/LICENSE-MIT',
  'ripgrep/licenses/LLVM-LIBUNWIND-LICENSE.TXT',
  'ripgrep/licenses/MUSL-COPYRIGHT',
  'ripgrep/licenses/PCRE2-LICENCE.md',
  'ripgrep/licenses/README.md',
  'ripgrep/licenses/RUST-CRATE-NOTICES.txt',
  'ripgrep/licenses/SLJIT-LICENSE',
  'ripgrep/licenses/UNLICENSE'
] as const

export type DolphindArtifact = {
  filename: string
  /**
   * Absence is a degradation, not a torn install, so the remote probe must not require it.
   * The agent-browser binary is the only one: `resolveDolphindBrowserProvider` already answers
   * "no headless browser" when it is missing, and it is named per platform-arch anyway.
   */
  optional?: boolean
}

export const DOLPHIND_ARTIFACTS: readonly DolphindArtifact[] = [
  { filename: 'dolphind.js' },
  // Forked so a native @parcel/watcher fault kills the child, not the server.
  { filename: 'parcel-watcher-process-entry.js' },
  // Forked so PTYs outlive the runtime process; its absence makes every restart destructive.
  { filename: 'daemon-entry.js' },
  { filename: 'windows-bun-pty-gate-entry.js' },
  { filename: 'profile-state-writer-worker-entry.js' },
  { filename: 'profile-state-backup-worker-entry.js' },
  // Target-specific even when the JavaScript bundle is shared across packaged slots.
  { filename: DOLPHIND_BUILD_TARGET_FILENAME },
  // dolphind never depends on a host runtime or host-installed native module.
  { filename: DOLPHIND_BUN_RUNTIME_FILENAME },
  { filename: DOLPHIND_PARCEL_WATCHER_ENTRY },
  { filename: DOLPHIND_PARCEL_WATCHER_NATIVE },
  { filename: DOLPHIND_EMOJI_SHORTCODE_DATASET },
  ...DOLPHIND_RIPGREP_ARTIFACTS.map((filename) => ({ filename })),
  ...DOLPHIND_RIPGREP_LICENSE_ARTIFACTS.map((filename) => ({ filename }))
]

/** Written after the artifacts, so it is never an input to its own hash. */
export const DOLPHIND_VERSION_FILENAME = '.version'
export const DOLPHIND_TEMPLATE_MANIFEST_FILENAME = 'dolphind-template.json'
export const DOLPHIND_TEMPLATE_TARGETS_DIR = 'targets'

/** Written last by the installer; its absence means a torn install. */
export const DOLPHIND_INSTALL_COMPLETE_FILENAME = '.install-complete'

export function dolphindArtifactFilenames(target = ''): string[] {
  const filenames = DOLPHIND_ARTIFACTS.filter((artifact) => !artifact.optional).map((artifact) =>
    artifact.filename === DOLPHIND_BUN_RUNTIME_FILENAME
      ? dolphindBunRuntimeFilename(target)
      : artifact.filename
  )
  if (target === 'win32' || target.startsWith('win32-')) {
    filenames.push(DOLPHIND_WINDOWS_PROCESS_TREE_FILENAME)
  }
  return filenames
}

export function dolphindTemplateCommonFilenames(): string[] {
  return dolphindArtifactFilenames().filter(
    (filename) =>
      filename !== DOLPHIND_BUN_RUNTIME_FILENAME &&
      filename !== DOLPHIND_BUILD_TARGET_FILENAME &&
      filename !== DOLPHIND_PARCEL_WATCHER_NATIVE
  )
}
