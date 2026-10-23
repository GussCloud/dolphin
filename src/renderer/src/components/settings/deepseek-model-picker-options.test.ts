import { describe, expect, it } from 'vitest'
import { buildDeepSeekModelPickerOptions } from './deepseek-model-picker-options'

describe('buildDeepSeekModelPickerOptions', () => {
  it('adds a [1m] variant for known 1M windows and for unknown windows, never for known smaller ones', () => {
    const options = buildDeepSeekModelPickerOptions(
      [
        { id: 'deepseek-flash', contextWindow: 1_000_000 },
        { id: 'deepseek-small', contextWindow: 999_999 },
        { id: 'deepseek-unknown', contextWindow: null }
      ],
      'deepseek-flash'
    )
    expect(options).toEqual([
      { value: 'deepseek-flash', listed: true, oneMillionContext: false },
      { value: 'deepseek-flash[1m]', listed: true, oneMillionContext: true },
      { value: 'deepseek-small', listed: true, oneMillionContext: false },
      { value: 'deepseek-unknown', listed: true, oneMillionContext: false },
      { value: 'deepseek-unknown[1m]', listed: true, oneMillionContext: true }
    ])
  })

  it('keeps the saved value selectable when the API no longer lists it', () => {
    const options = buildDeepSeekModelPickerOptions(
      [{ id: 'deepseek-flash', contextWindow: 128_000 }],
      'deepseek-retired[1m]'
    )
    expect(options).toEqual([
      { value: 'deepseek-flash', listed: true, oneMillionContext: false },
      { value: 'deepseek-retired[1m]', listed: false, oneMillionContext: true }
    ])
  })

  it('treats a saved [1m] variant as listed when the API offers it', () => {
    const options = buildDeepSeekModelPickerOptions(
      [{ id: 'deepseek-flash', contextWindow: null }],
      'deepseek-flash[1m]'
    )
    expect(options.every((option) => option.listed)).toBe(true)
    expect(options).toHaveLength(2)
  })

  it('marks a saved [1m] value unlisted when the known window is below 1M', () => {
    const options = buildDeepSeekModelPickerOptions(
      [{ id: 'deepseek-flash', contextWindow: 128_000 }],
      'deepseek-flash[1m]'
    )
    expect(options).toEqual([
      { value: 'deepseek-flash', listed: true, oneMillionContext: false },
      { value: 'deepseek-flash[1m]', listed: false, oneMillionContext: true }
    ])
  })

  it('drops blank and duplicate ids and trims whitespace', () => {
    const options = buildDeepSeekModelPickerOptions(
      [
        { id: ' deepseek-flash ', contextWindow: 64_000 },
        { id: 'deepseek-flash', contextWindow: 64_000 },
        { id: '   ', contextWindow: null }
      ],
      '  '
    )
    expect(options).toEqual([{ value: 'deepseek-flash', listed: true, oneMillionContext: false }])
  })

  it('returns only the saved value when the list is empty', () => {
    expect(buildDeepSeekModelPickerOptions([], 'deepseek-flash')).toEqual([
      { value: 'deepseek-flash', listed: false, oneMillionContext: false }
    ])
  })
})
