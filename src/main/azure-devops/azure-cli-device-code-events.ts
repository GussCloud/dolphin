// Seam between the device-code `az login` (producer) and the phone relays (Telegram, mobile push).

/** What `az login --use-device-code` printed: the user opens `verificationUrl` and types `userCode`. */
export type AzureCliDeviceCodePrompt = {
  attemptId: string
  verificationUrl: string
  userCode: string
  expiresAtMs: number
}

export type AzureCliDeviceCodeOutcome = {
  attemptId: string
  outcome: 'renewed' | 'expired' | 'failed' | 'cancelled'
  error?: string
}

type PromptListener = (prompt: AzureCliDeviceCodePrompt) => void
type OutcomeListener = (outcome: AzureCliDeviceCodeOutcome) => void
/** Whether a phone channel can deliver a code right now; a device-code login without one is pointless. */
type ChannelProbe = () => boolean

const promptListeners = new Set<PromptListener>()
const outcomeListeners = new Set<OutcomeListener>()
const channelProbes = new Set<ChannelProbe>()

function notify<T>(listeners: Set<(value: T) => void>, value: T): void {
  for (const listener of listeners) {
    try {
      listener(value)
    } catch (error) {
      console.error('[azure-devops] device-code listener threw', error)
    }
  }
}

export function emitAzureCliDeviceCodePrompt(prompt: AzureCliDeviceCodePrompt): void {
  notify(promptListeners, prompt)
}

export function emitAzureCliDeviceCodeOutcome(outcome: AzureCliDeviceCodeOutcome): void {
  notify(outcomeListeners, outcome)
}

export function onAzureCliDeviceCodePrompt(listener: PromptListener): () => void {
  promptListeners.add(listener)
  return () => promptListeners.delete(listener)
}

export function onAzureCliDeviceCodeOutcome(listener: OutcomeListener): () => void {
  outcomeListeners.add(listener)
  return () => outcomeListeners.delete(listener)
}

export function registerAzureCliDeviceCodeChannel(probe: ChannelProbe): () => void {
  channelProbes.add(probe)
  return () => channelProbes.delete(probe)
}

export function hasAzureCliDeviceCodeChannel(): boolean {
  for (const probe of channelProbes) {
    try {
      if (probe()) {
        return true
      }
    } catch {
      // A broken probe means that channel cannot deliver.
    }
  }
  return false
}

/** @internal - tests need a clean seam between cases. */
export function _resetAzureCliDeviceCodeEvents(): void {
  promptListeners.clear()
  outcomeListeners.clear()
  channelProbes.clear()
}
