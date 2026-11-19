import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyClaudeProfileEntry } from './claude-profile-entry-copy'

let root = ''

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'dolphin-profile-entry-copy-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('copyClaudeProfileEntry', () => {
  it.skipIf(process.platform === 'win32')(
    'keeps links inside the copied tree relative and re-aims links that leave it',
    () => {
      const shared = join(root, 'shared')
      mkdirSync(shared, { recursive: true })
      writeFileSync(join(shared, 'tool.sh'), 'tool\n')
      const source = join(root, 'user', 'skills', 'deploy')
      mkdirSync(join(source, 'scripts'), { recursive: true })
      writeFileSync(join(source, 'SKILL.md'), 'deploy\n')
      symlinkSync(join('..', 'SKILL.md'), join(source, 'scripts', 'readme'))
      symlinkSync(
        join('..', '..', '..', '..', 'shared', 'tool.sh'),
        join(source, 'scripts', 'tool')
      )
      const target = join(root, 'profile', 'a', 'b', 'skills', 'deploy')

      copyClaudeProfileEntry(source, target)

      expect(readlinkSync(join(target, 'scripts', 'readme'))).toBe(join('..', 'SKILL.md'))
      expect(readFileSync(join(target, 'scripts', 'readme'), 'utf-8')).toBe('deploy\n')
      expect(readFileSync(join(target, 'scripts', 'tool'), 'utf-8')).toBe('tool\n')
    }
  )

  it('copies a folder linked from elsewhere so its content is reachable from the profile', () => {
    const canonical = join(root, 'agents', 'skills', 'orchestration')
    mkdirSync(canonical, { recursive: true })
    writeFileSync(join(canonical, 'SKILL.md'), 'orchestration\n')
    const source = join(root, 'user', 'skills', 'orchestration')
    mkdirSync(join(root, 'user', 'skills'), { recursive: true })
    // How `npx skills` links on each platform: a junction on Windows, a symlink elsewhere.
    symlinkSync(canonical, source, process.platform === 'win32' ? 'junction' : 'dir')
    const target = join(root, 'profile', 'skills', 'orchestration')

    copyClaudeProfileEntry(source, target)

    expect(readFileSync(join(target, 'SKILL.md'), 'utf-8')).toBe('orchestration\n')
  })
})
