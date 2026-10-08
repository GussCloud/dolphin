import { describe, expect, it } from 'vitest'
import { nextTelegramDemoPhase, type TelegramDemoPhase } from './TelegramFeatureTipVisual'

describe('nextTelegramDemoPhase', () => {
  it('plays status, question, answer, then a channel reply, and loops back', () => {
    const phases: TelegramDemoPhase[] = []
    let phase: TelegramDemoPhase = 'idle'
    do {
      phase = nextTelegramDemoPhase(phase)
      phases.push(phase)
    } while (phase !== 'idle')

    expect(phases).toEqual(['status', 'question', 'answered', 'channel', 'done', 'idle'])
  })
})
