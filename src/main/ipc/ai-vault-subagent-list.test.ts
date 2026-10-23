import { homedir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listInBackground } = vi.hoisted(() => ({
  listInBackground: vi.fn(async () => ({ sessions: [], issues: [] }))
}))

vi.mock('../ai-vault/cached-session-list', () => ({
  getAiVaultWslHomeDirs: async () => []
}))
vi.mock('../ai-vault/session-scanner-background', () => ({
  listAiVaultSubagentSessionsInBackground: listInBackground
}))

import { listAiVaultSubagentSessions } from './ai-vault-subagent-list'

const claudeParent = join(homedir(), '.claude', 'projects', '-repo', 'abc.jsonl')
const deepSeekParent = join(homedir(), '.claude-deepseek', 'projects', '-repo', 'abc.jsonl')

describe('listAiVaultSubagentSessions path guard', () => {
  beforeEach(() => {
    listInBackground.mockClear()
  })

  it('reads a DeepSeek parent under the DeepSeek root as deepseek', async () => {
    await listAiVaultSubagentSessions({ agent: 'deepseek', parentFilePath: deepSeekParent })

    expect(listInBackground).toHaveBeenCalledWith({
      agent: 'deepseek',
      parentFilePath: deepSeekParent
    })
  })

  it('refuses a DeepSeek row pointing into the Claude root, and the reverse', async () => {
    await expect(
      listAiVaultSubagentSessions({ agent: 'deepseek', parentFilePath: claudeParent })
    ).resolves.toEqual({ sessions: [], issues: [] })
    await expect(
      listAiVaultSubagentSessions({ agent: 'claude', parentFilePath: deepSeekParent })
    ).resolves.toEqual({ sessions: [], issues: [] })
    expect(listInBackground).not.toHaveBeenCalled()
  })
})
