import { describe, expect, it } from 'vitest'
import { DESIGN_EVENT_KINDS } from '../../../../shared/design-types'
import { designEventKeys, designEventLabel } from './design-event-labels'

describe('designEventLabel', () => {
  it('gives every event kind its own label', () => {
    const labels = DESIGN_EVENT_KINDS.map(designEventLabel)
    expect(labels.every((label) => label.length > 0)).toBe(true)
    expect(new Set(labels).size).toBe(DESIGN_EVENT_KINDS.length)
  })
})

describe('designEventKeys', () => {
  it('keeps keys unique for identical events', () => {
    const event = { kind: 'inbox-nudged' as const, at: 5, actor: 'dolphin' as const }
    const keys = designEventKeys([event, event, { ...event, at: 6 }])
    expect(new Set(keys).size).toBe(3)
  })
})
