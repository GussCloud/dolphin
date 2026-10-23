import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as Os from 'node:os'
import type * as Scanner from './scanner'

const tempRoots: string[] = []

afterEach(async () => {
  vi.doUnmock('os')
  vi.resetModules()
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function assistantTurn(sessionId: string, model: string, inputTokens: number): string {
  return JSON.stringify({
    type: 'assistant',
    sessionId,
    timestamp: '2026-10-20T10:00:00.000Z',
    cwd: '/workspace/repo-a',
    message: {
      id: `msg-${sessionId}`,
      model,
      usage: { input_tokens: inputTokens, output_tokens: 5 }
    }
  })
}

async function makeHomeWithBothCorpora(): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'dolphin-deepseek-usage-scan-'))
  tempRoots.push(home)
  const claudeProject = join(home, '.claude', 'projects', 'repo-a')
  const deepSeekProject = join(home, '.claude-deepseek', 'projects', 'repo-a')
  await mkdir(claudeProject, { recursive: true })
  await mkdir(deepSeekProject, { recursive: true })
  await writeFile(
    join(claudeProject, 'claude.jsonl'),
    assistantTurn('claude-1', 'claude-sonnet-4-6', 100)
  )
  await writeFile(
    join(deepSeekProject, 'deepseek.jsonl'),
    assistantTurn('deepseek-1', 'deepseek-flash', 700)
  )
  return home
}

async function loadScannerWithHome(home: string): Promise<typeof Scanner> {
  vi.resetModules()
  vi.doMock('os', async () => ({
    ...(await vi.importActual<typeof Os>('os')),
    homedir: () => home
  }))
  return import('./scanner')
}

describe('Claude-format usage scan sources', () => {
  it('keeps DeepSeek transcripts out of the Claude scan and in the DeepSeek scan', async () => {
    const home = await makeHomeWithBothCorpora()
    const { scanClaudeUsageFiles } = await loadScannerWithHome(home)

    const claude = await scanClaudeUsageFiles([])
    const deepSeek = await scanClaudeUsageFiles([], [], undefined, 'deepseek')

    expect(claude.sessions.map((session) => session.sessionId)).toEqual(['claude-1'])
    expect(claude.dailyAggregates.map((row) => [row.model, row.inputTokens])).toEqual([
      ['claude-sonnet-4-6', 100]
    ])
    expect(claude.processedFiles.every((file) => !file.path.includes('.claude-deepseek'))).toBe(
      true
    )

    expect(deepSeek.sessions.map((session) => session.sessionId)).toEqual(['deepseek-1'])
    expect(deepSeek.dailyAggregates.map((row) => [row.model, row.inputTokens])).toEqual([
      ['deepseek-flash', 700]
    ])
    expect(deepSeek.processedFiles.every((file) => file.path.includes('.claude-deepseek'))).toBe(
      true
    )
  })
})
