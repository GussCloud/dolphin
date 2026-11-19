/** What the New design composer opens with when the Design window asks for it (retry of a stuck design). */
export type DesignComposerPrefill = {
  name?: string
  request?: string
  repoId?: string
}

/** `designPopout:openComposer` — the main window opens the composer in Design mode. */
export type DesignPopoutOpenComposerArgs = { designPrefill?: DesignComposerPrefill }

/** `designPopout:revealWorktree` — the main window activates the design's workspace. */
export type DesignPopoutRevealWorktreeArgs = {
  worktreeId: string
  /** The remote environment the Design window was reading; null or absent means this machine. */
  runtimeEnvironmentId?: string | null
}

const MAX_ID_LENGTH = 512
const MAX_TEXT_LENGTH = 100_000

function isOptionalString(value: unknown, maxLength: number): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= maxLength)
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isDesignComposerPrefill(value: unknown): value is DesignComposerPrefill {
  return (
    isRecord(value) &&
    isOptionalString(value.name, MAX_TEXT_LENGTH) &&
    isOptionalString(value.request, MAX_TEXT_LENGTH) &&
    (value.repoId === undefined || isId(value.repoId))
  )
}

export function isDesignPopoutOpenComposerArgs(
  value: unknown
): value is DesignPopoutOpenComposerArgs {
  return (
    isRecord(value) &&
    (value.designPrefill === undefined || isDesignComposerPrefill(value.designPrefill))
  )
}

export function isDesignPopoutRevealWorktreeArgs(
  value: unknown
): value is DesignPopoutRevealWorktreeArgs {
  return (
    isRecord(value) &&
    isId(value.worktreeId) &&
    (value.runtimeEnvironmentId === undefined ||
      value.runtimeEnvironmentId === null ||
      isId(value.runtimeEnvironmentId))
  )
}
