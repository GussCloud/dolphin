export type WslConfigSuggestionId = 'auto-memory-reclaim' | 'sparse-vhd' | 'memory-cap'

export type WslConfigSuggestion = {
  id: WslConfigSuggestionId
  section: 'wsl2' | 'experimental'
  key: string
  /** Null when the key is absent and WSL uses its built-in default. */
  currentValue: string | null
  suggestedValue: string
}

export type WslConfigAnalysis =
  | { state: 'unsupported' }
  // Why: an unreadable or UTF-16 file is never rewritten — round-tripping it could drop the user's settings.
  | { state: 'unreadable'; configPath: string }
  | {
      state: 'ready'
      configPath: string
      fileExists: boolean
      totalMemoryGb: number
      suggestions: WslConfigSuggestion[]
      /** Full file content after applying every suggestion. */
      preview: string
    }

export type WslConfigApplyResult =
  | {
      ok: true
      configPath: string
      backupPath: string | null
      appliedIds: WslConfigSuggestionId[]
    }
  | { ok: false; reason: 'unsupported' | 'unreadable' | 'write-failed'; configPath: string | null }
