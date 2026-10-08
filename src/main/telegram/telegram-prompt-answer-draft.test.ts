import { describe, expect, it } from 'vitest'
import type { AskQuestion } from '../../shared/native-chat-ask'
import {
  applyTelegramFreeText,
  applyTelegramOptionPick,
  describeTelegramAnswerDraft,
  isTelegramAnswerDraftComplete,
  telegramQuestionsNeedSubmit
} from './telegram-prompt-answer-draft'

const single: AskQuestion = {
  question: 'A?',
  multiSelect: false,
  options: [{ label: 'a1' }, { label: 'a2' }]
}
const multi: AskQuestion = {
  question: 'B?',
  multiSelect: true,
  options: [{ label: 'b1' }, { label: 'b2' }]
}

describe('telegram answer draft', () => {
  it('replaces a single-select pick, including a typed answer', () => {
    const typed = applyTelegramFreeText([single], [], 'mine', () => true)!
    expect(typed).toEqual([{ indices: [], other: 'mine' }])
    expect(applyTelegramOptionPick([single], typed, 0, 1)).toEqual([{ indices: [1] }])
  })

  it('toggles multi-select picks in option order', () => {
    const once = applyTelegramOptionPick([multi], [], 0, 1)!
    const twice = applyTelegramOptionPick([multi], once, 0, 0)!
    expect(twice).toEqual([{ indices: [0, 1] }])
    expect(applyTelegramOptionPick([multi], twice, 0, 1)).toEqual([{ indices: [0] }])
  })

  it('rejects out-of-range taps', () => {
    expect(applyTelegramOptionPick([single], [], 0, 2)).toBeNull()
    expect(applyTelegramOptionPick([single], [], 1, 0)).toBeNull()
  })

  it('routes typed text to the first unanswered question that accepts it', () => {
    const selections = [{ indices: [0] }]
    expect(applyTelegramFreeText([single, single], selections, ' x ', () => true)).toEqual([
      { indices: [0] },
      { indices: [], other: 'x' }
    ])
    expect(applyTelegramFreeText([single], selections, 'x', () => true)).toBeNull()
    expect(applyTelegramFreeText([single], [], 'x', () => false)).toBeNull()
    expect(applyTelegramFreeText([single], [], '   ', () => true)).toBeNull()
  })

  it('reports completeness, submit need, and a readable summary', () => {
    expect(telegramQuestionsNeedSubmit([single])).toBe(false)
    expect(telegramQuestionsNeedSubmit([single, multi])).toBe(true)
    expect(isTelegramAnswerDraftComplete([single, multi], [{ indices: [0] }])).toBe(false)
    expect(
      describeTelegramAnswerDraft([single, multi], [{ indices: [1] }, { indices: [0], other: 'z' }])
    ).toBe('1. a2\n2. b1, z')
  })
})
