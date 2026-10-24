import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readClaudeContextFromLines,
  readCodexContextFromLines,
  readCoordinatorContext
} from './autonomous-goal-context-probe'

const claudeAssistant = (input: number, cacheRead: number, extra: object = {}): string =>
  JSON.stringify({
    type: 'assistant',
    message: {
      usage: {
        input_tokens: input,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: cacheRead,
        output_tokens: 10
      }
    },
    ...extra
  })

describe('coordinator context probe', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reads the newest main-thread Claude response, skipping sidechains', () => {
    expect(
      readClaudeContextFromLines([
        claudeAssistant(10, 90_000),
        claudeAssistant(5, 1_000, { isSidechain: true }),
        '{"type":"user"}'
      ])
    ).toEqual({ contextTokens: 90_010 })
  })

  it('reads the Codex token_count event and its stated window', () => {
    const line = JSON.stringify({
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          last_token_usage: {
            input_tokens: 80_000,
            cached_input_tokens: 70_000,
            output_tokens: 500
          },
          model_context_window: 272_000
        }
      }
    })
    expect(readCodexContextFromLines([line, '{"type":"response_item"}'])).toEqual({
      contextTokens: 80_500,
      windowTokens: 272_000
    })
  })

  it('reads only the tail and tolerates a cut first line or a missing file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'goal-probe-'))
    dirs.push(dir)
    const file = join(dir, 't.jsonl')
    writeFileSync(file, `${'x'.repeat(600 * 1024)}\n${claudeAssistant(1, 50_000)}\n`)
    expect(await readCoordinatorContext('claude', file)).toEqual({ contextTokens: 50_001 })
    expect(await readCoordinatorContext('claude', join(dir, 'missing.jsonl'))).toBeNull()
  })
})
