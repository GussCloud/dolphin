import { describe, expect, it } from 'vitest'
import { canTransitionDesign, DESIGN_STATUSES } from '../../../../shared/design-types'
import { designStatusActions } from './design-status-actions'

describe('designStatusActions', () => {
  it('offers the moves each status allows', () => {
    expect(designStatusActions('draft').map((a) => a.to)).toEqual(['in-progress', 'discarded'])
    expect(designStatusActions('in-progress').map((a) => a.to)).toEqual(['done', 'discarded'])
    expect(designStatusActions('done').map((a) => a.to)).toEqual(['in-progress'])
    expect(designStatusActions('discarded').map((a) => a.to)).toEqual(['draft'])
  })

  it('never offers a move the host would refuse', () => {
    for (const status of DESIGN_STATUSES) {
      for (const action of designStatusActions(status)) {
        expect(canTransitionDesign(status, action.to)).toBe(true)
      }
    }
  })
})
