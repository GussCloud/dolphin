import { existsSync, realpathSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  exposeShimDirsOnClaudeSafePath,
  isClaudeSafePathEntry
} from './claude-agent-teams-ascii-path-junction'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
  roots.length = 0
})

async function makeBase(): Promise<string> {
  // Why: Windows tmpdir() can be the 8.3 `GUSTAV~1` spelling, which is itself Claude-unsafe.
  const base = await mkdtemp(join(realpathSync.native(tmpdir()), 'dolphin-ascii-junction-'))
  roots.push(base)
  return base
}

describe('isClaudeSafePathEntry', () => {
  it('accepts printable ASCII and rejects non-ASCII, 8.3 tildes and control characters', () => {
    expect(isClaudeSafePathEntry('C:\\Program Files\\Dolphin\\resources\\bin\\agent-teams')).toBe(
      true
    )
    expect(isClaudeSafePathEntry('C:\\Users\\JoãoRicardo\\.dolphin\\claude-agent-teams-bin')).toBe(
      false
    )
    expect(isClaudeSafePathEntry('C:\\Users\\JOORIC~1\\.dolphin')).toBe(false)
    expect(isClaudeSafePathEntry('C:\\tmp\\a\tb')).toBe(false)
  })
})

describe('exposeShimDirsOnClaudeSafePath', () => {
  it('returns the dirs untouched off Windows or when every dir is already safe', async () => {
    const unsafe = ['C:\\Users\\João\\bin']
    await expect(
      exposeShimDirsOnClaudeSafePath(unsafe, { platform: 'linux', junctionRoots: [] })
    ).resolves.toEqual({ dirs: unsafe, allSafe: true })
    await expect(
      exposeShimDirsOnClaudeSafePath(['C:\\Dolphin\\bin'], { platform: 'win32', junctionRoots: [] })
    ).resolves.toEqual({ dirs: ['C:\\Dolphin\\bin'], allSafe: true })
  })

  it('reports an unsafe dir it cannot junction so the caller degrades', async () => {
    const base = await makeBase()
    await expect(
      exposeShimDirsOnClaudeSafePath(['C:\\Dolphin\\bin', 'C:\\Users\\João\\bin'], {
        platform: 'win32',
        registryPath: join(base, 'registry.json'),
        junctionRoots: ['C:\\Users\\João\\links']
      })
    ).resolves.toEqual({ dirs: ['C:\\Dolphin\\bin', 'C:\\Users\\João\\bin'], allSafe: false })
  })

  it.runIf(process.platform === 'win32')(
    'exposes a non-ASCII dir through an ASCII junction, reuses it, and replaces a tampered one',
    async () => {
      const base = await makeBase()
      const target = join(base, 'perfil-João', 'agent-teams')
      await mkdir(target, { recursive: true })
      await writeFile(join(target, 'tmux.cmd'), '@echo tmux 3.4\r\n')
      const safeDir = join(base, 'safe')
      const options = {
        platform: 'win32' as const,
        registryPath: join(base, 'registry.json'),
        junctionRoots: [join(base, 'junctions')]
      }

      const first = await exposeShimDirsOnClaudeSafePath([target, safeDir], options)
      expect(first.allSafe).toBe(true)
      expect(first.dirs[1]).toBe(safeDir)
      const link = first.dirs[0] ?? ''
      expect(isClaudeSafePathEntry(link)).toBe(true)
      expect(link.startsWith(join(base, 'junctions'))).toBe(true)
      await expect(readFile(join(link, 'tmux.cmd'), 'utf8')).resolves.toBe('@echo tmux 3.4\r\n')

      await expect(exposeShimDirsOnClaudeSafePath([target], options)).resolves.toEqual({
        dirs: [link],
        allSafe: true
      })

      // A recorded link that now points elsewhere is never adopted.
      const decoy = join(base, 'decoy')
      await mkdir(decoy)
      await rm(link)
      await symlink(decoy, link, 'junction')
      const afterTamper = await exposeShimDirsOnClaudeSafePath([target], options)
      expect(afterTamper.dirs[0]).not.toBe(link)
      expect(existsSync(join(afterTamper.dirs[0] ?? '', 'tmux.cmd'))).toBe(true)

      // A recorded path that is a plain directory is not a junction to the target either.
      const plain = afterTamper.dirs[0] ?? ''
      await rm(plain)
      await mkdir(plain)
      const afterPlain = await exposeShimDirsOnClaudeSafePath([target], options)
      expect(afterPlain.dirs[0]).not.toBe(plain)
      expect(existsSync(join(afterPlain.dirs[0] ?? '', 'tmux.cmd'))).toBe(true)
    }
  )
})
