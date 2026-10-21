import { describe, expect, it, vi } from 'vitest'
import { createAgentInteractionViewedReporter } from './agent-interaction-viewed-report'

describe('createAgentInteractionViewedReporter', () => {
  it('sends only when what is on screen changes, unless forced', () => {
    const send = vi.fn()
    const report = createAgentInteractionViewedReporter(send)
    report(['b', 'a', null, 'a'])
    report(['a', 'b'])
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenLastCalledWith(['a', 'b'])
    report(['a', 'b'], { force: true })
    expect(send).toHaveBeenCalledTimes(2)
    report([])
    expect(send).toHaveBeenLastCalledWith([])
  })
})
