import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { resetSessionParseCacheForTests } from '../ai-vault/session-scanner-parse-cache'
import { resetTranscriptConsumersForTests } from '../ai-vault/session-transcript-consumers'
import { registerSessionSearchIndexConsumer } from './session-search-index-consumer'
import { runSessionSearchIndexPass } from './session-search-index-pass'
import {
  openSessionSearchIndexerHarness,
  writeClaudeTranscript,
  type SessionSearchIndexerHarness
} from './session-search-indexer-test-fixture'
import { discoverSessionSearchCandidates } from './session-search-scan-roots'
import { SessionSearchStore } from './session-search-store'

// Builds before claude-api indexed API account profiles as Claude; after the upgrade the same,
// unchanged transcript is discovered as `claude-api` and its stored row must follow.

const SESSION = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

let harness: SessionSearchIndexerHarness
let store: SessionSearchStore

beforeEach(async () => {
  resetSessionParseCacheForTests()
  resetTranscriptConsumersForTests()
  harness = await openSessionSearchIndexerHarness('ss-agent-change')
  await writeClaudeTranscript(
    join(harness.claudeProjectDir, `${SESSION}.jsonl`),
    ['billed to the api key'],
    SESSION
  )
  store = new SessionSearchStore(harness.databasePath, () => undefined)
  registerSessionSearchIndexConsumer(store)
})

afterEach(async () => {
  resetTranscriptConsumersForTests()
  store.close()
  await harness.cleanup()
})

it('re-reads an unchanged file whose agent changed, so no row keeps the old agent', async () => {
  const discovered = (
    await discoverSessionSearchCandidates(harness.roots, {
      limitPerAgent: Number.POSITIVE_INFINITY
    })
  ).candidates.filter((candidate) => candidate.agent === 'claude')
  const rows = () => new Map(store.files().map((row) => [row.path, row]))
  await runSessionSearchIndexPass(store, discovered, { rows: rows() })

  const asApi = discovered.map((candidate) => ({ ...candidate, agent: 'claude-api' as const }))
  const second = await runSessionSearchIndexPass(store, asApi, { rows: rows() })

  expect(second.stats.fullParses).toBe(1)
  const sessions = harness.read((db) =>
    db.prepare('SELECT agent, resume_command AS resumeCommand FROM sessions').all()
  )
  expect(sessions).toEqual([{ agent: 'claude-api', resumeCommand: '' }])
})
