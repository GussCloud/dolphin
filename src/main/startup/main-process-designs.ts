import { startDesignInboxWatchdog } from '../designs/design-inbox-watchdog'
import { startDesignRendererBroadcast } from '../designs/design-renderer-broadcast'
import { getDesignStore } from '../designs/design-store-instance'
import { readLatestTerminalInputAt } from '../terminal-client-input-clock'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import { isAgentPromptStalledError } from '../runtime/agent-prompt-submission-verification'

/** Announces design writes to open windows and paired clients, and delivers user input to agents. */
export function startMainProcessDesigns(runtime: DolphinRuntimeService): () => void {
  const store = getDesignStore()
  // Why once per design and kind: the watchdog retries every tick, and one line says enough.
  const warnedUnsent = new Set<string>()
  const warnUnsentNudge = (designId: string, error: unknown): void => {
    const kind = error instanceof Error ? error.message : String(error)
    const key = `${designId}\0${kind}`
    if (!warnedUnsent.has(key)) {
      warnedUnsent.add(key)
      console.warn(`[designs] inbox nudge for ${designId} was not sent: ${kind}`)
    }
  }
  const stopBroadcast = startDesignRendererBroadcast(
    (notify) => store.subscribe(notify),
    () => runtime.notifyDesignsChanged()
  )
  const watchdog = startDesignInboxWatchdog({
    listDesigns: () => store.list(),
    subscribe: (listener) => store.subscribe(listener),
    // Why no stale row-handle fallback: a pane the runtime no longer has live must not be typed into.
    resolveTerminalHandle: (paneKey) => runtime.getLiveTerminalHandleForPaneKey(paneKey),
    readAgentStatus: async (terminal) => (await runtime.getTerminalAgentStatus(terminal)).status,
    readLastInputAt: (terminal) => {
      const ptyId = runtime.resolveLiveLeafForHandle(terminal)?.ptyId
      return ptyId ? readLatestTerminalInputAt(ptyId) : undefined
    },
    readUserComposingWaitMs: (terminal) => runtime.readTerminalUserComposingWaitMs(terminal),
    sendNudge: async (terminal, text, designId) => {
      try {
        await runtime.sendTerminalAgentPrompt(terminal, text)
        return true
      } catch (error) {
        // Why: a stalled verdict still wrote the nudge; only an unwritable pane counts as unsent.
        if (isAgentPromptStalledError(error)) {
          return true
        }
        warnUnsentNudge(designId, error)
        return false
      }
    },
    recordNudge: (designId) => {
      store.recordNudge(designId)
    },
    markDeliveryBlocked: (designId) => store.markDeliveryBlocked(designId)
  })
  return () => {
    watchdog.stop()
    stopBroadcast()
  }
}
