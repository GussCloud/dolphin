import { existsSync, mkdirSync, mkdtempSync, realpathSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { confirmBypassRemovalOnDisk } from './bypass-removal-disk-check'

function workspace() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'dolphin-rm-disk-')))
  const home = join(root, 'home')
  const cwd = join(home, 'repo')
  const outside = join(root, 'outside')
  mkdirSync(join(cwd, 'src'), { recursive: true })
  mkdirSync(outside)
  return { root, home, cwd, outside }
}

describe.skipIf(process.platform === 'win32')('confirmBypassRemovalOnDisk', () => {
  it('confirms the cwd itself, also when reached through a symlink', async () => {
    const { root, home, cwd } = workspace()
    expect(
      await confirmBypassRemovalOnDisk([{ kind: 'is-cwd', path: cwd }], cwd, { homeDir: home })
    ).toBe(true)
    const linkedCwd = join(root, 'linked-repo')
    symlinkSync(cwd, linkedCwd)
    expect(
      await confirmBypassRemovalOnDisk([{ kind: 'is-cwd', path: linkedCwd }], linkedCwd, {
        homeDir: home
      })
    ).toBe(true)
  })

  it('rejects an is-cwd target that resolves elsewhere', async () => {
    const { root, home, cwd, outside } = workspace()
    const escape = join(root, 'escape')
    symlinkSync(outside, escape)
    expect(
      await confirmBypassRemovalOnDisk([{ kind: 'is-cwd', path: escape }], cwd, { homeDir: home })
    ).toBe(false)
  })

  it('rejects a cwd that really is home, a parent of home, or the root', async () => {
    const { root, home, cwd } = workspace()
    const homeLink = join(cwd, 'home-link')
    symlinkSync(home, homeLink)
    const rootLink = join(cwd, 'root-link')
    symlinkSync('/', rootLink)
    for (const path of [home, root, homeLink, rootLink]) {
      expect(
        await confirmBypassRemovalOnDisk([{ kind: 'is-cwd', path }], path, { homeDir: home })
      ).toBe(false)
    }
  })

  it.skipIf(process.platform !== 'darwin')('compares realpaths with exact case', async () => {
    const { home, cwd } = workspace()
    // On a case-insensitive volume realpath returns the stored spelling for both sides.
    const shouted = cwd.replace(/repo$/, 'REPO')
    expect(
      await confirmBypassRemovalOnDisk([{ kind: 'is-cwd', path: shouted }], shouted, {
        homeDir: home
      })
    ).toBe(true)
    // A target whose stored spelling differs from the cwd's is a different folder.
    mkdirSync(join(home, 'Other'))
    expect(
      await confirmBypassRemovalOnDisk([{ kind: 'is-cwd', path: join(home, 'other') }], cwd, {
        homeDir: home
      })
    ).toBe(false)
  })

  it('requires a mount path to be a real mount point that is not a symlink', async () => {
    const { root, home, outside } = workspace()
    const mount = join(root, 'mount')
    symlinkSync('/', mount)
    const options = { homeDir: home }
    expect(
      await confirmBypassRemovalOnDisk([{ kind: 'is-mount', path: mount }], outside, options)
    ).toBe(false)
    // A plain folder is not a mount point.
    expect(
      await confirmBypassRemovalOnDisk([{ kind: 'is-mount', path: outside }], outside, options)
    ).toBe(false)
    if (existsSync('/dev') && realpathSync('/dev') === '/dev') {
      expect(
        await confirmBypassRemovalOnDisk([{ kind: 'is-mount', path: '/dev' }], outside, options)
      ).toBe(true)
    }
  })

  it('makes no decision when a path is missing', async () => {
    const { home, cwd } = workspace()
    const options = { homeDir: home }
    expect(
      await confirmBypassRemovalOnDisk([{ kind: 'is-cwd', path: join(cwd, 'gone') }], cwd, options)
    ).toBe(false)
    expect(
      await confirmBypassRemovalOnDisk([{ kind: 'is-cwd', path: cwd }], join(cwd, 'x'), options)
    ).toBe(false)
  })

  it('needs no disk access when there is nothing to check', async () => {
    expect(await confirmBypassRemovalOnDisk([], '/does/not/exist')).toBe(true)
  })

  it('treats realpaths that differ only in case as different folders', async () => {
    // A case-sensitive APFS volume can hold both `Repo` and `REPO`.
    const realpaths: Record<string, string> = {
      '/vol/Repo': '/vol/Repo',
      '/vol/REPO': '/vol/REPO',
      '/home/u': '/home/u'
    }
    const fs = {
      realpath: async (path: string) => realpaths[path] ?? Promise.reject(new Error('ENOENT')),
      stat: async () => ({ dev: 1 })
    }
    expect(
      await confirmBypassRemovalOnDisk([{ kind: 'is-cwd', path: '/vol/REPO' }], '/vol/Repo', {
        homeDir: '/home/u',
        fs
      })
    ).toBe(false)
    expect(
      await confirmBypassRemovalOnDisk([{ kind: 'is-cwd', path: '/vol/Repo' }], '/vol/Repo', {
        homeDir: '/home/u',
        fs
      })
    ).toBe(true)
  })
})
