import {
  DEEPSEEK_ONE_MILLION_CONTEXT_SUFFIX,
  type DeepSeekModelOption
} from '../../../../shared/deepseek-claude-provider'

const ONE_MILLION_TOKENS = 1_000_000

export type DeepSeekModelPickerOption = {
  value: string
  /** False for the saved value when DeepSeek's current list no longer offers it. */
  listed: boolean
  /** True for a `<id>[1m]` value, which Claude Code reads as a 1M-token context window. */
  oneMillionContext: boolean
}

// Why: DeepSeek's /models reports no context window, so unknown (null) still offers the variant;
// only a known window under 1M rules it out.
function mayHaveOneMillionContext(contextWindow: number | null): boolean {
  return contextWindow === null || contextWindow >= ONE_MILLION_TOKENS
}

/** Options for one model slot: API ids in API order (plus `[1m]` variants), then the saved value if unlisted. */
export function buildDeepSeekModelPickerOptions(
  models: readonly DeepSeekModelOption[],
  savedValue: string
): DeepSeekModelPickerOption[] {
  const options: DeepSeekModelPickerOption[] = []
  const seen = new Set<string>()
  const add = (value: string, listed: boolean): void => {
    if (value && !seen.has(value)) {
      seen.add(value)
      options.push({
        value,
        listed,
        oneMillionContext: value.endsWith(DEEPSEEK_ONE_MILLION_CONTEXT_SUFFIX)
      })
    }
  }
  for (const model of models) {
    const id = model.id.trim()
    add(id, true)
    if (id && mayHaveOneMillionContext(model.contextWindow)) {
      add(`${id}${DEEPSEEK_ONE_MILLION_CONTEXT_SUFFIX}`, true)
    }
  }
  add(savedValue.trim(), false)
  return options
}
