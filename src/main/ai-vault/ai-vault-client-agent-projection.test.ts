import { describe, expect, it } from 'vitest'
import type { AiVaultListResult, AiVaultSession } from '../../shared/ai-vault-types'
import type { AiVaultSearchHit, AiVaultSearchResponse } from '../../shared/ai-vault-search-types'
import { AiVaultSearchResponseSchema } from '../../shared/ai-vault-search-contract'
import { remoteRuntimeClientCapabilities } from '../../shared/remote-runtime-client-capabilities'
import {
  AI_VAULT_CLAUDE_API_SESSIONS_RUNTIME_CAPABILITY,
  AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY
} from '../../shared/ai-vault-agent-runtime-capabilities'
import {
  projectAiVaultListResultForClient,
  projectAiVaultSearchResponseForClient
} from './ai-vault-client-agent-projection'

function session(agent: AiVaultSession['agent']): AiVaultSession {
  return {
    id: `local:${agent}:s:/x`,
    executionHostId: 'local',
    agent,
    sessionId: 's',
    title: 't',
    cwd: null,
    branch: null,
    model: null,
    filePath: '/x',
    codexHome: null,
    createdAt: null,
    updatedAt: null,
    modifiedAt: '2026-05-01T00:00:00.000Z',
    messageCount: 1,
    totalTokens: 0,
    previewMessages: [],
    queuedMessageCount: 0,
    subagentTranscriptCount: 0,
    resumeCommand: 'claude --resume s',
    subagent: null
  }
}

function hit(agent: AiVaultSearchHit['agent']): AiVaultSearchHit {
  return {
    agent,
    sessionId: 's',
    title: 't',
    cwd: null,
    branch: null,
    updatedAt: null,
    messageCount: 1,
    score: 1,
    source: { presence: 'unverifiable' },
    evidence: null
  }
}

const list: AiVaultListResult = {
  sessions: [session('claude'), session('deepseek'), session('claude-api')],
  issues: [{ agent: 'deepseek', path: '/x', message: 'm' }],
  scannedAt: '2026-05-01T00:00:00.000Z'
}

const search: AiVaultSearchResponse = {
  kind: 'results',
  hits: [hit('claude'), hit('deepseek'), hit('claude-api')],
  page: { cursor: null, hasMore: false },
  generation: 1,
  truncated: { candidates: false, snippets: 0, query: false, freshness: false },
  durationMs: 1
}

describe('gated AI Vault agent rows for remote clients', () => {
  it('withholds DeepSeek and claude-api rows and hits from a remote client that advertises neither', () => {
    const oldClient = { clientKind: 'runtime' as const, clientCapabilities: [] }

    expect(
      projectAiVaultListResultForClient(list, oldClient).sessions.map((row) => row.agent)
    ).toEqual(['claude'])
    expect(projectAiVaultListResultForClient(list, oldClient).issues).toEqual([])
    const projected = projectAiVaultSearchResponseForClient(search, oldClient)
    expect(projected.kind === 'results' && projected.hits.map((row) => row.agent)).toEqual([
      'claude'
    ])
  })

  it('keeps them, still as their own agents, for in-process callers and capable clients', () => {
    expect(projectAiVaultListResultForClient(list, {})).toBe(list)
    expect(
      projectAiVaultSearchResponseForClient(search, {
        clientKind: 'mobile',
        clientCapabilities: [
          AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY,
          AI_VAULT_CLAUDE_API_SESSIONS_RUNTIME_CAPABILITY
        ]
      })
    ).toBe(search)
  })

  it('gates claude-api rows on their own capability, apart from DeepSeek', () => {
    const deepSeekOnlyClient = {
      clientKind: 'runtime' as const,
      clientCapabilities: [AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY]
    }
    expect(
      projectAiVaultListResultForClient(list, deepSeekOnlyClient).sessions.map((row) => row.agent)
    ).toEqual(['claude', 'deepseek'])
    const projected = projectAiVaultSearchResponseForClient(search, deepSeekOnlyClient)
    expect(projected.kind === 'results' && projected.hits.map((row) => row.agent)).toEqual([
      'claude',
      'deepseek'
    ])
  })

  it('is advertised by every remote transport of this build, whose schema accepts the hit', () => {
    expect(remoteRuntimeClientCapabilities()).toContain(
      AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY
    )
    expect(remoteRuntimeClientCapabilities()).toContain(
      AI_VAULT_CLAUDE_API_SESSIONS_RUNTIME_CAPABILITY
    )
    expect(AiVaultSearchResponseSchema.safeParse(search).success).toBe(true)
  })
})
