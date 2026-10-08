import { isShellProcess } from '../../shared/agent-detection'
import { isExpectedAgentProcess } from '../../shared/agent-process-recognition'
import { createDraftPasteReadyScanner } from '../../shared/draft-paste-ready-scanner'
import { resolveDraftPasteReadyTimeoutMs } from '../../shared/draft-paste-ready-timeout'
import { TUI_AGENT_CONFIG } from '../../shared/tui-agent-config'
import type { TuiAgent } from '../../shared/tui-agent'
import type {
  WorktreeStartupDraftPaste,
  WorktreeStartupFollowup
} from './runtime-worktree-agent-startup'
import {
  CLAUDE_DEV_CHANNELS_DIALOG_MAX_HOLD_MS,
  createClaudeDevChannelsDialogTracker,
  shouldExtendTimeoutForClaudeDevChannelsDialog
} from '../../shared/claude-dev-channels-dialog'

const BRACKETED_PASTE_BEGIN = '\x1b[200~'
const BRACKETED_PASTE_END = '\x1b[201~'
const BRACKETED_PASTE_QUIET_MS = 1500

export type WorktreeStartupReadinessHost = {
  getPtyId: (handle: string) => string | null
  getForegroundProcess: (ptyId: string) => Promise<string | null>
  hasChildProcesses?: (ptyId: string) => Promise<boolean>
  subscribeToData: (ptyId: string, listener: (data: string) => void) => () => void
  readRecentOutput: (ptyId: string) => string | undefined
  write: (ptyId: string, data: string) => void
  /** True only for a PTY Dolphin launched with the Claude channel flags. */
  isClaudeChannelPty?: (ptyId: string) => boolean
}

export function pasteWorktreeStartupDraftWhenReady(
  host: WorktreeStartupReadinessHost,
  handle: string,
  draft: WorktreeStartupDraftPaste
): void {
  void waitForWorktreeStartupDraft(host, handle, draft.agent)
    .then((ptyId) => {
      if (!ptyId) {
        console.warn('[worktree-create] agent did not become ready for draft paste')
        return
      }
      host.write(ptyId, `${BRACKETED_PASTE_BEGIN}${draft.content}${BRACKETED_PASTE_END}`)
    })
    .catch((error) => console.warn('[worktree-create] failed to paste startup draft:', error))
}

export function sendWorktreeStartupFollowupWhenReady(
  host: WorktreeStartupReadinessHost,
  handle: string,
  followup: WorktreeStartupFollowup
): void {
  void waitForWorktreeStartupFollowup(host, handle, followup.expectedProcess)
    .then((ptyId) => {
      if (!ptyId) {
        console.warn('[worktree-create] agent did not become ready for follow-up prompt')
        return
      }
      host.write(ptyId, `${followup.prompt}\r`)
    })
    .catch((error) =>
      console.warn('[worktree-create] failed to send startup follow-up prompt:', error)
    )
}

// Why: the follow-up is typed raw; into Claude's channel confirmation it would be swallowed.
async function waitOutClaudeDevChannelsDialog(
  host: WorktreeStartupReadinessHost,
  ptyId: string
): Promise<boolean> {
  if (!host.isClaudeChannelPty?.(ptyId)) {
    return true
  }
  const deadline = Date.now() + CLAUDE_DEV_CHANNELS_DIALOG_MAX_HOLD_MS
  while (createClaudeDevChannelsDialogTracker().observe(host.readRecentOutput(ptyId) ?? '')) {
    if (Date.now() > deadline) {
      console.warn(
        '[worktree-create] startup follow-up not sent: Claude channel confirmation still open'
      )
      return false
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return true
}

export async function waitForWorktreeStartupFollowup(
  host: WorktreeStartupReadinessHost,
  handle: string,
  expectedProcess: string
): Promise<string | null> {
  const ptyId = host.getPtyId(handle)
  if (!ptyId) {
    return null
  }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    try {
      const foregroundProcess = await host.getForegroundProcess(ptyId)
      if (isExpectedAgentProcess(foregroundProcess, expectedProcess)) {
        return (await waitOutClaudeDevChannelsDialog(host, ptyId)) ? ptyId : null
      }
      if (attempt >= 4 && !isShellProcess(foregroundProcess ?? '')) {
        if ((await host.hasChildProcesses?.(ptyId).catch(() => false)) ?? false) {
          return (await waitOutClaudeDevChannelsDialog(host, ptyId)) ? ptyId : null
        }
      }
    } catch {
      // Ignore transient PTY inspection failures and keep polling.
    }
  }
  return null
}

export function waitForWorktreeStartupDraft(
  host: WorktreeStartupReadinessHost,
  handle: string,
  agent: TuiAgent
): Promise<string | null> {
  const ptyId = host.getPtyId(handle)
  if (!ptyId) {
    return Promise.resolve(null)
  }
  const signal =
    TUI_AGENT_CONFIG[agent].draftPasteReadySignal ?? 'render-quiet-after-bracketed-paste'
  return new Promise((resolve) => {
    let settled = false
    const scanner = createDraftPasteReadyScanner(signal, {
      holdOnClaudeDevChannelsDialog: () => host.isClaudeChannelPty?.(ptyId) === true
    })
    const startedAt = Date.now()
    let quietTimer: NodeJS.Timeout | null = null
    let hardTimer: NodeJS.Timeout | null = null
    let unsubscribe: (() => void) | null = null
    const finish = (value: string | null): void => {
      if (settled) {
        return
      }
      settled = true
      if (quietTimer) {
        clearTimeout(quietTimer)
      }
      if (hardTimer) {
        clearTimeout(hardTimer)
      }
      unsubscribe?.()
      resolve(value)
    }
    const observe = (data: string): void => {
      const result = scanner.observe(data)
      if (result.ready) {
        return finish(ptyId)
      }
      if (result.hold && quietTimer) {
        clearTimeout(quietTimer)
        quietTimer = null
      }
      if (result.armQuietTimer) {
        if (quietTimer) {
          clearTimeout(quietTimer)
        }
        quietTimer = setTimeout(() => {
          quietTimer = null
          if (!scanner.isHolding()) {
            finish(ptyId)
          }
        }, BRACKETED_PASTE_QUIET_MS)
      }
    }
    unsubscribe = host.subscribeToData(ptyId, observe)
    const replay = host.readRecentOutput(ptyId)
    if (replay) {
      observe(replay)
    }
    const timeoutMs = resolveDraftPasteReadyTimeoutMs(agent)
    const onHardTimeout = (): void => {
      if (
        shouldExtendTimeoutForClaudeDevChannelsDialog(scanner.isHolding(), startedAt, Date.now())
      ) {
        hardTimer = setTimeout(onHardTimeout, timeoutMs)
        return
      }
      finish(null)
    }
    hardTimer = setTimeout(onHardTimeout, timeoutMs)
  })
}
