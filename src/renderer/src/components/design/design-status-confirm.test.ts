import { describe, expect, it } from 'vitest'
import { designStatusConfirmOptions } from './design-status-confirm'

describe('designStatusConfirmOptions', () => {
  it('names the approved canvas version', () => {
    const options = designStatusConfirmOptions('approve', {
      canvasVersion: 3,
      openDecisionCount: 0,
      unreadInputCount: 0
    })
    expect(options.description).toContain('canvas version 3')
    expect(options.description).not.toContain('open decisions')
  })

  it('warns about open decisions and recommends answering them first', () => {
    const options = designStatusConfirmOptions('approve', {
      canvasVersion: 3,
      openDecisionCount: 2,
      unreadInputCount: 0
    })
    expect(options.description).toContain('2 open decisions will go unanswered')
    expect(options.description).toContain('Answer them first')
  })

  it('makes discarding a destructive confirmation that says the agent stops', () => {
    const options = designStatusConfirmOptions('discard', {
      canvasVersion: 1,
      openDecisionCount: 0,
      unreadInputCount: 0
    })
    expect(options.confirmVariant).toBe('destructive')
    expect(options.description).toContain('told to stop')
  })

  it('warns that unread input reaches the agent before the approval', () => {
    const options = designStatusConfirmOptions('approve', {
      canvasVersion: 2,
      openDecisionCount: 0,
      unreadInputCount: 3
    })
    expect(options.description).toContain('3')
    expect(options.description).toContain('before the approval')
  })
})
