import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AiVaultAgent } from '../../shared/ai-vault-types'
import {
  ensureSessionParseCacheLoaded,
  initSessionParseCachePersistence,
  resetSessionParseCachePersistenceForTests
} from './session-parse-cache-persistence'
import {
  createSessionParseStats,
  parseAgentSessionFileCached,
  resetSessionParseCacheForTests,
  snapshotSessionParseCacheForPersistence
} from './session-scanner-parse-cache'
import type { SessionFileCandidate } from './session-scanner-types'

// Builds before claude-api scanned API account profiles as Claude, so their parse cache holds
// those transcripts stamped `claude`; the same unchanged file must come back as `claude-api`.

let root: string | undefined

afterEach(async () => {
  resetSessionParseCacheForTests()
  resetSessionParseCachePersistenceForTests()
  if (root) {
    await rm(root, { recursive: true, force: true })
  }
})

async function transcript(): Promise<(agent: AiVaultAgent) => SessionFileCandidate> {
  root = await mkdtemp(join(tmpdir(), 'dolphin-parse-cache-agent-'))
  const path = join(root, 'api-session.jsonl')
  await writeFile(
    path,
    `${JSON.stringify({
      type: 'user',
      sessionId: 'api-session',
      timestamp: '2026-05-01T10:00:00.000Z',
      cwd: '/repo',
      message: { role: 'user', content: 'ship it' }
    })}\n`
  )
  const fileStat = await stat(path)
  return (agent) => ({
    agent,
    codexHome: null,
    file: {
      path,
      mtimeMs: fileStat.mtimeMs,
      modifiedAt: fileStat.mtime.toISOString(),
      sizeBytes: fileStat.size,
      sidecar: 'none'
    }
  })
}

describe('parse cache across an agent change', () => {
  it('re-parses an in-memory entry stamped for another agent', async () => {
    const candidateFor = await transcript()
    expect((await parseAgentSessionFileCached(candidateFor('claude'), 'darwin'))?.agent).toBe(
      'claude'
    )

    const stats = createSessionParseStats()
    const session = await parseAgentSessionFileCached(candidateFor('claude-api'), 'darwin', stats)

    expect(stats.reused).toBe(0)
    expect(session).toMatchObject({ agent: 'claude-api', resumeCommand: '' })
    expect(session?.id).toContain('claude-api')
  })

  it('re-parses a persisted entry written by an older build as claude', async () => {
    const candidateFor = await transcript()
    await parseAgentSessionFileCached(candidateFor('claude'), 'darwin')
    const cacheFile = join(root ?? '', 'cache.json')
    await writeFile(
      cacheFile,
      JSON.stringify({
        // The current schema: an older build's file is reused across app versions.
        schemaVersion: 3,
        appVersion: 'old',
        entries: snapshotSessionParseCacheForPersistence()
      })
    )
    resetSessionParseCacheForTests()
    initSessionParseCachePersistence({ filePath: cacheFile, appVersion: 'new' })
    await ensureSessionParseCacheLoaded()

    const stats = createSessionParseStats()
    const session = await parseAgentSessionFileCached(candidateFor('claude-api'), 'darwin', stats)

    expect(stats.fullParses).toBe(1)
    expect(stats.reused).toBe(0)
    expect(session?.agent).toBe('claude-api')
    // The same entry still serves the agent it was stamped for.
    const again = createSessionParseStats()
    await parseAgentSessionFileCached(candidateFor('claude-api'), 'darwin', again)
    expect(again.reused).toBe(1)
  })
})
