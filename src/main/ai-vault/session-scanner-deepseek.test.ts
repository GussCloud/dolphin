import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateAiVaultSessionDeleteTarget } from './session-delete-target'
import { scanAiVaultSessions } from './session-scanner'
import { claudeTranscriptRootDirs, deepSeekProjectsRootDirs } from './session-scanner-roots'
import { isolatedScanRoots, jsonLines } from './session-scanner-test-fixtures'

// DeepSeek runs Claude Code under `~/.claude-deepseek`; the vault must list its
// transcripts as DeepSeek and never mix them into Claude's rows.

let tempRoots: string[] = []

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { recursive: true, force: true })))
  tempRoots = []
})

async function writeTranscript(args: {
  projectsDir: string
  dirName: string
  sessionId: string
  cwd: string
  iso: string
}): Promise<string> {
  const dir = join(args.projectsDir, args.dirName)
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, `${args.sessionId}.jsonl`)
  await writeFile(
    filePath,
    `${jsonLines([
      {
        type: 'user',
        sessionId: args.sessionId,
        timestamp: args.iso,
        cwd: args.cwd,
        message: { role: 'user', content: `prompt for ${args.sessionId}` }
      },
      {
        type: 'assistant',
        sessionId: args.sessionId,
        timestamp: args.iso,
        message: { role: 'assistant', model: 'deepseek-flash', content: 'ok' }
      }
    ])}\n`
  )
  const time = new Date(args.iso)
  await utimes(filePath, time, time)
  return filePath
}

describe('DeepSeek sessions in the AI Vault', () => {
  it('attributes a .claude-deepseek transcript to deepseek and a .claude one to claude', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dolphin-ai-vault-deepseek-'))
    tempRoots.push(root)
    const roots = isolatedScanRoots(root)
    const claudeFile = await writeTranscript({
      projectsDir: roots.claudeProjectsDir,
      dirName: '-repo',
      sessionId: 'claude-session',
      cwd: '/repo',
      iso: '2026-05-01T10:00:00.000Z'
    })
    const deepSeekFile = await writeTranscript({
      projectsDir: roots.deepSeekProjectsDir,
      dirName: '-repo',
      sessionId: 'deepseek-session',
      cwd: '/repo',
      iso: '2026-05-01T11:00:00.000Z'
    })

    const result = await scanAiVaultSessions({ ...roots, platform: 'darwin', limit: 20 })

    expect(result.issues).toEqual([])
    const agentByPath = new Map(result.sessions.map((session) => [session.filePath, session]))
    expect(agentByPath.get(deepSeekFile)).toMatchObject({
      agent: 'deepseek',
      sessionId: 'deepseek-session',
      // Nothing a CLI/RPC consumer could run bare on the Claude login.
      resumeCommand: ''
    })
    expect(agentByPath.get(claudeFile)?.agent).toBe('claude')
    expect(
      result.sessions.filter(
        (session) =>
          session.agent === 'claude' && session.filePath.startsWith(roots.deepSeekProjectsDir)
      )
    ).toEqual([])
  })

  it('keeps an in-scope DeepSeek session older than the recency cap, still as deepseek', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dolphin-ai-vault-deepseek-scope-'))
    tempRoots.push(root)
    const roots = isolatedScanRoots(root)
    await writeTranscript({
      projectsDir: roots.deepSeekProjectsDir,
      dirName: '-repo-app',
      sessionId: 'old-deepseek',
      cwd: '/repo/app',
      iso: '2026-01-01T10:00:00.000Z'
    })
    for (const index of [1, 2, 3]) {
      await writeTranscript({
        projectsDir: roots.claudeProjectsDir,
        dirName: '-elsewhere',
        sessionId: `recent-${index}`,
        cwd: '/elsewhere',
        iso: `2026-05-0${index}T10:00:00.000Z`
      })
    }

    const result = await scanAiVaultSessions({
      ...roots,
      platform: 'darwin',
      limit: 1,
      scopePaths: ['/repo/app']
    })

    const old = result.sessions.find((session) => session.sessionId === 'old-deepseek')
    expect(old?.agent).toBe('deepseek')
  })
})

describe('DeepSeek transcript roots', () => {
  it('lists the host root and each WSL home under .claude-deepseek, apart from Claude', () => {
    const wslHome = join('/wsl', 'ubuntu', 'home', 'ada')
    expect(
      deepSeekProjectsRootDirs({ deepSeekProjectsDir: '/h/ds', wslHomeDirs: [wslHome] })
    ).toEqual(['/h/ds', join(wslHome, '.claude-deepseek', 'projects')])
    const claudeRoots = claudeTranscriptRootDirs('claude', [wslHome])
    const deepSeekRoots = claudeTranscriptRootDirs('deepseek', [wslHome])
    expect(deepSeekRoots.some((rootDir) => claudeRoots.includes(rootDir))).toBe(false)
  })
})

describe('DeepSeek session delete', () => {
  // resolve(): the validator returns resolved paths, which gain a drive letter on Windows.
  const home = resolve('/tmp', 'dolphin-ai-vault-deepseek-delete-home')
  const claudeRoot = join(home, '.claude', 'projects')
  const deepSeekRoot = join(home, '.claude-deepseek', 'projects')
  const rootOptions = { claudeProjectsDir: claudeRoot, deepSeekProjectsDir: deepSeekRoot }

  it('deletes a DeepSeek transcript with companions in the DeepSeek config dir', () => {
    const filePath = join(deepSeekRoot, '-repo', 'abc.jsonl')
    const result = validateAiVaultSessionDeleteTarget({
      agent: 'deepseek',
      filePath,
      executionHostId: 'local',
      rootOptions
    })

    expect(result).toMatchObject({
      allowed: true,
      agent: 'deepseek',
      removals: [
        { path: join(deepSeekRoot, '-repo', 'abc'), kind: 'directory' },
        { path: join(home, '.claude-deepseek', 'session-env', 'abc'), kind: 'directory' },
        { path: filePath, kind: 'file' }
      ]
    })
  })

  it('refuses a path from the other agent root in either direction', () => {
    expect(
      validateAiVaultSessionDeleteTarget({
        agent: 'deepseek',
        filePath: join(claudeRoot, '-repo', 'abc.jsonl'),
        executionHostId: 'local',
        rootOptions
      })
    ).toMatchObject({ allowed: false, reason: 'path-outside-known-roots' })
    expect(
      validateAiVaultSessionDeleteTarget({
        agent: 'claude',
        filePath: join(deepSeekRoot, '-repo', 'abc.jsonl'),
        executionHostId: 'local',
        rootOptions
      })
    ).toMatchObject({ allowed: false, reason: 'path-outside-known-roots' })
  })
})
