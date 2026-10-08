import { describe, expect, it } from 'vitest'
import {
  APPROVAL_ALLOW_KEYS,
  APPROVAL_DENY_KEYS,
  askAnswerKeyGroupBytes,
  parseApprovalEnvelope,
  planAskAnswerDelivery
} from './agent-prompt-answer-keys'
import type { AskPrompt } from './native-chat-ask'

const prompt: AskPrompt = {
  questions: [
    { question: 'Color?', multiSelect: false, options: [{ label: 'Red' }, { label: 'Blue' }] }
  ]
}

describe('parseApprovalEnvelope', () => {
  it('reads tool and summary', () => {
    expect(
      parseApprovalEnvelope(JSON.stringify({ approval: { tool: 'Bash', summary: 'ls' } }))
    ).toEqual({ tool: 'Bash', summary: 'ls' })
  })

  it('drops an empty summary', () => {
    expect(
      parseApprovalEnvelope(JSON.stringify({ approval: { tool: 'Edit', summary: '' } }))
    ).toEqual({ tool: 'Edit' })
  })

  it.each([undefined, null, '', 'not json', '{}', '{"approval":{}}', '{"approval":{"tool":""}}'])(
    'rejects %s',
    (value) => {
      expect(parseApprovalEnvelope(value)).toBeNull()
    }
  )

  it('keeps the TUI approval keys', () => {
    expect(APPROVAL_ALLOW_KEYS).toBe('1')
    expect(APPROVAL_DENY_KEYS).toBe('\x1b')
  })
})

describe('planAskAnswerDelivery', () => {
  it('steps Claude and OpenClaude selectors by option number', () => {
    for (const agent of ['claude', 'openclaude']) {
      expect(planAskAnswerDelivery(agent, prompt, [{ indices: [1] }])).toEqual({
        kind: 'keys',
        groups: [{ raw: '2' }]
      })
    }
  })

  it('uses Codex overlay keys for Codex', () => {
    const delivery = planAskAnswerDelivery('codex', prompt, [{ indices: [], other: 'Green' }])
    expect(delivery.kind).toBe('keys')
    expect(delivery.kind === 'keys' && delivery.groups.some((group) => 'text' in group)).toBe(true)
  })

  it('pastes labels for agents without a digit selector', () => {
    expect(planAskAnswerDelivery('grok', prompt, [{ indices: [0] }])).toEqual({
      kind: 'paste',
      text: 'Red'
    })
    expect(planAskAnswerDelivery(null, prompt, [{ indices: [1] }])).toEqual({
      kind: 'paste',
      text: 'Blue'
    })
  })
})

describe('askAnswerKeyGroupBytes', () => {
  it('writes raw keys verbatim and collapses free-text newlines', () => {
    expect(askAnswerKeyGroupBytes({ raw: '\r' })).toBe('\r')
    expect(askAnswerKeyGroupBytes({ text: 'a\r\nb\nc' })).toBe('a b c')
  })
})
