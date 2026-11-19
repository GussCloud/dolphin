import { describe, expect, it } from 'vitest'
import { canTransitionDesign, DESIGN_STATUSES } from '../../../../shared/design-types'
import { designStatusActions } from './design-status-actions'

function moves(status: (typeof DESIGN_STATUSES)[number], placement: 'primary' | 'overflow') {
  return designStatusActions(status, { agentBound: true, hasCanvas: true, agentProcessing: false })
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
        designStatusActions(status, {
          agentBound: bound,
          hasCanvas: true,
          agentProcessing: false
        }).map((a) => [a.to, a.confirm])
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
      designStatusActions('draft', { agentBound: true, hasCanvas, agentProcessing: false }).find(
        (action) => action.to === 'in-progress'
      )?.disabledReason
    expect(approve(false)).toContain('Wait for the agent to draw')
    expect(approve(true)).toBeNull()
  })

  it('blocks approval while the agent is processing, and only approval', () => {
    const actions = designStatusActions('draft', {
      agentBound: true,
      hasCanvas: true,
      agentProcessing: true
    })
    expect(actions.find((action) => action.to === 'in-progress')?.disabledReason).toBe(
      'Wait for the agent to finish processing before approving.'
    )
    expect(actions.find((action) => action.to === 'discarded')?.disabledReason).toBeNull()
    const undrawn = designStatusActions('draft', {
      agentBound: true,
      hasCanvas: false,
      agentProcessing: true
    })
    expect(undrawn.find((action) => action.to === 'in-progress')?.disabledReason).toContain(
      'Wait for the agent to draw'
    )
  })

  it('never offers a move the host would refuse', () => {
    for (const status of DESIGN_STATUSES) {
      for (const action of designStatusActions(status, {
        agentBound: true,
        hasCanvas: true,
        agentProcessing: false
      })) {
        expect(canTransitionDesign(status, action.to)).toBe(true)
      }
    }
  })
})
