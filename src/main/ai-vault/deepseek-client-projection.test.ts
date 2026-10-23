import { describe, expect, it } from 'vitest'
import type { AiVaultListResult, AiVaultSession } from '../../shared/ai-vault-types'
import type { AiVaultSearchHit, AiVaultSearchResponse } from '../../shared/ai-vault-search-types'
import { AiVaultSearchResponseSchema } from '../../shared/ai-vault-search-contract'
import { AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY } from '../../shared/protocol-version'
import { remoteRuntimeClientCapabilities } from '../../shared/remote-runtime-client-capabilities'
import {
  projectDeepSeekAiVaultListResult,
  projectDeepSeekAiVaultSearchResponse
} from './deepseek-client-projection'

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
  sessions: [session('claude'), session('deepseek')],
  issues: [{ agent: 'deepseek', path: '/x', message: 'm' }],
  scannedAt: '2026-05-01T00:00:00.000Z'
}

const search: AiVaultSearchResponse = {
  kind: 'results',
  hits: [hit('claude'), hit('deepseek')],
  page: { cursor: null, hasMore: false },
  generation: 1,
  truncated: { candidates: false, snippets: 0, query: false, freshness: false },
  durationMs: 1
}

describe('DeepSeek AI Vault rows for remote clients', () => {
  it('withholds DeepSeek rows and hits from a remote client that does not advertise them', () => {
    const oldClient = { clientKind: 'runtime' as const, clientCapabilities: [] }

    expect(
      projectDeepSeekAiVaultListResult(list, oldClient).sessions.map((row) => row.agent)
    ).toEqual(['claude'])
    expect(projectDeepSeekAiVaultListResult(list, oldClient).issues).toEqual([])
    const projected = projectDeepSeekAiVaultSearchResponse(search, oldClient)
    expect(projected.kind === 'results' && projected.hits.map((row) => row.agent)).toEqual([
      'claude'
    ])
  })

  it('keeps them, still as deepseek, for in-process callers and capable clients', () => {
    expect(projectDeepSeekAiVaultListResult(list, {})).toBe(list)
    expect(
      projectDeepSeekAiVaultSearchResponse(search, {
        clientKind: 'mobile',
        clientCapabilities: [AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY]
      })
    ).toBe(search)
  })

  it('is advertised by every remote transport of this build, whose schema accepts the hit', () => {
    expect(remoteRuntimeClientCapabilities()).toContain(
      AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY
    )
    expect(AiVaultSearchResponseSchema.safeParse(search).success).toBe(true)
  })
})
