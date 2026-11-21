import { describe, expect, it } from 'vitest'
import { AGENT_STATUS_STATES } from '../../../shared/agent-status-types'
import type { AgentRowState } from './agent-row-decay-state'
import {
  formatAgentToolPreview,
  getAgentToolPreviewParts,
  showsAgentToolPreview
} from './agent-row-tool-preview'

const TOOL = { toolName: 'bash', toolInput: 'rm -rf build/' }
const ROW_STATES: readonly AgentRowState[] = [...AGENT_STATUS_STATES, 'idle', 'unverifiable']

describe('showsAgentToolPreview', () => {
  it('covers exactly the two states whose tool fields describe live work', () => {
    // Why: enumerate every row state so a new one has to make this decision explicitly
    // rather than defaulting into showing a stale tool.
    const showing = ROW_STATES.filter((state) => showsAgentToolPreview(state))

    expect(showing).toEqual(['working', 'waiting'])
  })

  it('shows nothing when the state is unknown', () => {
    expect(showsAgentToolPreview(null)).toBe(false)
    expect(showsAgentToolPreview(undefined)).toBe(false)
  })
})

describe('formatAgentToolPreview', () => {
  it('names what a blocked approval is waiting on', () => {
    expect(formatAgentToolPreview(TOOL, 'waiting')).toBe('bash: rm -rf build/')
  })

  it('names the running tool while working', () => {
    expect(formatAgentToolPreview(TOOL, 'working')).toBe('bash: rm -rf build/')
  })

  it('keeps a resolved tool off every other state', () => {
    for (const state of ROW_STATES.filter((candidate) => !showsAgentToolPreview(candidate))) {
      expect(formatAgentToolPreview(TOOL, state)).toBe('')
    }
  })

  it('shows nothing on a wait that carries no tool', () => {
    // Why: a question-style wait sets no tool fields; it must not borrow an earlier one.
    expect(formatAgentToolPreview({}, 'waiting')).toBe('')
  })

  it('falls back to the bare tool name when the input is not previewable', () => {
    expect(formatAgentToolPreview({ toolName: 'edit' }, 'waiting')).toBe('edit')
  })

  it('ignores whitespace-only fields', () => {
    expect(formatAgentToolPreview({ toolName: '  ', toolInput: '  ' }, 'working')).toBe('')
  })
})

describe('getAgentToolPreviewParts', () => {
  it('splits the tool name from its input under the shared state gate', () => {
    expect(getAgentToolPreviewParts(TOOL, 'working')).toEqual({
      toolName: 'bash',
      toolInput: 'rm -rf build/'
    })
    for (const state of ROW_STATES.filter((candidate) => !showsAgentToolPreview(candidate))) {
      expect(getAgentToolPreviewParts(TOOL, state)).toBeNull()
    }
  })

  it('keeps an input that itself contains the separator intact', () => {
    // Why: splitting the formatted line on ': ' would cut inputs like "echo a: b".
    expect(
      getAgentToolPreviewParts({ toolName: 'bash', toolInput: 'echo a: b' }, 'waiting')
    ).toEqual({ toolName: 'bash', toolInput: 'echo a: b' })
  })

  it('never shows an input without a tool name to label it', () => {
    expect(getAgentToolPreviewParts({ toolInput: 'src/a.ts' }, 'working')).toBeNull()
    expect(getAgentToolPreviewParts({ toolName: ' edit ' }, 'working')).toEqual({
      toolName: 'edit',
      toolInput: ''
    })
  })
})
