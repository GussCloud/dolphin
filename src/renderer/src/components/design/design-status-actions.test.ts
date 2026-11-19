import { describe, expect, it } from 'vitest'
import { canTransitionDesign, DESIGN_STATUSES } from '../../../../shared/design-types'
import { designStatusActions } from './design-status-actions'

function moves(status: (typeof DESIGN_STATUSES)[number], placement: 'primary' | 'overflow') {
  return designStatusActions(status, { agentBound: true, hasCanvas: true })
    .filter((action) => action.placement === placement)
    .map((action) => action.to)
}

describe('designStatusActions', () => {
  it('offers the moves each status allows', () => {
    expect(moves('draft', 'primary')).toEqual(['in-progress', 'discarded'])
    expect(moves('in-progress', 'primary')).toEqual(['discarded'])
    expect(moves('done', 'primary')).toEqual(['in-progress'])
    expect(moves('discarded', 'primary')).toEqual(['draft'])
  })

  it('keeps finishing an in-progress design out of the primary buttons', () => {
    expect(moves('in-progress', 'primary')).not.toContain('done')
    expect(moves('in-progress', 'overflow')).toEqual(['done', 'draft'])
  })

  it('confirms approval and the fallback finish, and discard only while an agent is bound', () => {
    const confirmOf = (status: (typeof DESIGN_STATUSES)[number], bound: boolean) =>
      Object.fromEntries(
        designStatusActions(status, { agentBound: bound, hasCanvas: true }).map((a) => [
          a.to,
          a.confirm
        ])
      )
    expect(confirmOf('draft', true)).toEqual({ 'in-progress': 'approve', discarded: 'discard' })
    expect(confirmOf('draft', false)).toEqual({ 'in-progress': 'approve', discarded: null })
    expect(confirmOf('in-progress', true)).toEqual({
      discarded: 'discard',
      done: 'finish',
      draft: null
    })
    expect(confirmOf('done', true)).toEqual({ 'in-progress': null })
    expect(confirmOf('discarded', true)).toEqual({ draft: null })
  })

  it('blocks approval until the agent has drawn a canvas', () => {
    const approve = (hasCanvas: boolean) =>
      designStatusActions('draft', { agentBound: true, hasCanvas }).find(
        (action) => action.to === 'in-progress'
      )?.disabledReason
    expect(approve(false)).toContain('Wait for the agent to draw')
    expect(approve(true)).toBeNull()
  })

  it('never offers a move the host would refuse', () => {
    for (const status of DESIGN_STATUSES) {
      for (const action of designStatusActions(status, { agentBound: true, hasCanvas: true })) {
        expect(canTransitionDesign(status, action.to)).toBe(true)
      }
    }
  })
})
