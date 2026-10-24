import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  claudeProjectKeys,
  resolveClaudeTrustConfigTarget,
  writeClaudeFolderTrust
} from './autonomous-goal-claude-trust'

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

describe('autonomous goal Claude folder trust', () => {
  let root: string

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'goal-claude-trust-')))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('accepts trust for the worktree and keeps every other key', async () => {
    const configPath = join(root, '.claude.json')
    const worktree = join(root, 'wt')
    mkdirSync(worktree)
    writeFileSync(
      configPath,
      JSON.stringify({
        oauthAccount: { id: 'x' },
        projects: {
          [worktree]: { allowedTools: ['Bash'] },
          '/other': { hasTrustDialogAccepted: false }
        }
      })
    )

    await writeClaudeFolderTrust({ configPath, requireExisting: true }, worktree)

    const config = readJson(configPath)
    expect(config.oauthAccount).toEqual({ id: 'x' })
    expect(config.projects).toMatchObject({
      [worktree]: { allowedTools: ['Bash'], hasTrustDialogAccepted: true },
      '/other': { hasTrustDialogAccepted: false }
    })
  })

  it('writes the realpath too, since Claude resolves symlinks before the lookup', async () => {
    const configPath = join(root, '.claude.json')
    const real = join(root, 'real')
    const link = join(root, 'link')
    mkdirSync(real)
    symlinkSync(real, link)
    writeFileSync(configPath, '{}')

    await writeClaudeFolderTrust({ configPath, requireExisting: true }, link)

    expect(claudeProjectKeys(link)).toEqual(expect.arrayContaining([link, real]))
    expect(readJson(configPath).projects).toMatchObject({
      [link]: { hasTrustDialogAccepted: true },
      [real]: { hasTrustDialogAccepted: true }
    })
  })

  it('never creates the default Claude config', async () => {
    const configPath = join(root, '.claude.json')
    await writeClaudeFolderTrust({ configPath, requireExisting: true }, root)
    expect(() => readFileSync(configPath)).toThrow()
  })

  it('leaves a malformed config untouched', async () => {
    const configPath = join(root, '.claude.json')
    writeFileSync(configPath, '{not json')
    await expect(
      writeClaudeFolderTrust({ configPath, requireExisting: true }, root)
    ).rejects.toThrow()
    expect(readFileSync(configPath, 'utf-8')).toBe('{not json')
  })

  it('seeds DeepSeek onboarding before trusting, so a fresh config home skips the theme picker', async () => {
    const target = resolveClaudeTrustConfigTarget('deepseek-agent-teams', root)
    expect(target.configPath).toBe(join(root, '.claude-deepseek', '.claude.json'))

    await writeClaudeFolderTrust(target, root)

    expect(readJson(target.configPath)).toMatchObject({
      hasCompletedOnboarding: true,
      projects: { [root]: { hasTrustDialogAccepted: true } }
    })
  })
})
