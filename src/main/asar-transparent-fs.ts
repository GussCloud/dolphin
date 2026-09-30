// Why: Electron patches `fs` so a `*.asar` file reports `isDirectory() === true`, so Node's
// recursive `rm` descends into the archive, tries to `rmdir` a real file, and fails the parent with
// ENOTEMPTY. Every worktree that has ever run `pnpm install` carries at least one
// (`node_modules/.pnpm/electron@…/…/Electron.app/Contents/Resources/default_app.asar`), so a
// worktree removal aborts there deterministically — the residue is not a concurrent-writer race and
// no amount of retrying clears it. `original-fs` is Electron's unpatched `fs`; unlike
// `process.noAsar` it is scoped to this call rather than to the whole process, which matters because
// a multi-GB removal runs for seconds while the main process may still be loading modules out of
// `app.asar`. See `cli/appimage-payload-removal.ts` for the same bug at a call site short enough to
// use the process-global flag.

import type { PathLike, Stats } from 'node:fs'
import { rm as nodeRm, stat as nodeStat } from 'node:fs/promises'
import { createRequire } from 'node:module'

type Rm = typeof nodeRm
type Stat = typeof nodeStat
type OriginalFsPromises = { rm?: Rm; stat?: Stat }

let resolvedPromises: OriginalFsPromises | null | undefined

function resolveOriginalFsPromises(): OriginalFsPromises | null {
  try {
    // Why require and not an import: `original-fs` only exists inside Electron, so vitest, the
    // `dolphin` CLI and the plain-node entrypoints must resolve `node:fs/promises` instead — and there
    // the shim does not exist either, so plain `fs` is already asar-transparent.
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: `original-fs` is Electron's unpatched `fs`, whose `promises` has this shape; each member is type-checked before use.
    const originalFs = createRequire(__filename)('original-fs') as { promises?: OriginalFsPromises }
    return originalFs.promises ?? null
  } catch {
    return null
  }
}

function originalFsPromises(): OriginalFsPromises | null {
  if (resolvedPromises === undefined) {
    resolvedPromises = resolveOriginalFsPromises()
  }
  return resolvedPromises
}

/** `fs.promises.rm` that sees a `*.asar` as the file it is rather than as a directory. */
export const rm: Rm = (path, options) => {
  const originalRm = originalFsPromises()?.rm
  return typeof originalRm === 'function' ? originalRm(path, options) : nodeRm(path, options)
}

/**
 * `fs.promises.stat` that does not open the archive. Electron's patched `stat` on a `*.asar` opens
 * it and caches the handle for the life of the process, so on Windows the file can no longer be
 * deleted or replaced.
 */
export function stat(path: PathLike): Promise<Stats> {
  const originalStat = originalFsPromises()?.stat
  return typeof originalStat === 'function' ? originalStat(path) : nodeStat(path)
}
