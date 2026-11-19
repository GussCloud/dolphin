// Copies an entry of the user's Claude dir into an account profile, keeping links as links.
// A link's text is relative to where it sits, so a copy into another folder must re-aim every
// link that leaves the copied tree, or `npx skills`' `../../.agents/skills/x` lands nowhere.
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  statSync,
  symlinkSync,
  unlinkSync
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Links `link` to the absolute `target`; a junction for folders on Windows (no privilege needed). */
function linkTo(target: string, link: string): void {
  if (process.platform !== 'win32') {
    symlinkSync(target, link)
    return
  }
  if (statSync(target, { throwIfNoEntry: false })?.isFile() !== true) {
    symlinkSync(target, link, 'junction')
    return
  }
  try {
    symlinkSync(target, link, 'file')
  } catch {
    // Why: file symlinks need Developer Mode on Windows; the content is what the profile needs.
    copyFileSync(target, link)
  }
}

function copyLink(source: string, target: string, root: string): void {
  const text = readlinkSync(source)
  const pointsAt = resolve(dirname(source), text)
  if (process.platform !== 'win32' && !isAbsolute(text) && isInside(root, pointsAt)) {
    symlinkSync(text, target)
    return
  }
  linkTo(pointsAt, target)
}

function copyTree(source: string, target: string, root: string): void {
  const stats = lstatSync(source)
  if (stats.isSymbolicLink()) {
    copyLink(source, target, root)
    return
  }
  if (stats.isDirectory()) {
    mkdirSync(target, { recursive: true, mode: stats.mode & 0o777 })
    for (const name of readdirSync(source)) {
      copyTree(join(source, name), join(target, name), root)
    }
    return
  }
  copyFileSync(source, target)
}

/** Copies `source` to `target`; links stay links, and still reach what they reached before. */
export function copyClaudeProfileEntry(source: string, target: string): void {
  mkdirSync(dirname(target), { recursive: true })
  copyTree(source, target, source)
}

/**
 * Repoints top-level links in `profileFolder` that an earlier verbatim copy broke: a relative
 * link that resolves nowhere here but resolves from `userFolder`, where it was copied from.
 * Returns the repaired names. A broken link with no such origin is left untouched.
 */
export function repairCopiedProfileLinks(profileFolder: string, userFolder: string): string[] {
  let names: string[]
  try {
    names = readdirSync(profileFolder)
  } catch {
    return []
  }
  const repaired: string[] = []
  for (const name of names) {
    const link = join(profileFolder, name)
    try {
      if (!lstatSync(link).isSymbolicLink() || existsSync(link)) {
        continue
      }
      const text = readlinkSync(link)
      const origin = resolve(userFolder, text)
      if (isAbsolute(text) || !existsSync(origin)) {
        continue
      }
      unlinkSync(link)
      linkTo(origin, link)
      repaired.push(name)
    } catch (error) {
      // Why: one unreadable entry must not block the launch that runs this repair.
      console.warn('[claude-profile] Could not repair copied link:', link, error)
    }
  }
  return repaired
}
