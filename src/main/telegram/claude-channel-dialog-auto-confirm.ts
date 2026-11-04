/**
 * Answers Claude's development-channels confirmation on goal-coordinator PTYs, whose launch is
 * unattended and lists only Dolphin's own channel servers. Other channel panes keep the manual
 * confirmation.
 */
import { createClaudeDevChannelsAutoConfirm } from '../../shared/claude-dev-channels-dialog'
import { DOLPHIN_ORCHESTRATION_CHANNEL_SERVER_NAME } from '../orchestration-channel/orchestration-channel-protocol'
import {
  isClaudeChannelAutoConfirmPty,
  releaseClaudeChannelAutoConfirmPty
} from './claude-channel-panes'
import { DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME } from './telegram-channel-protocol'

const DOLPHIN_CHANNEL_SERVERS = [
  DOLPHIN_ORCHESTRATION_CHANNEL_SERVER_NAME,
  DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME
]
const MAX_OBSERVED_PTYS = 64

const observers = new Map<string, ReturnType<typeof createClaudeDevChannelsAutoConfirm>>()

/** Fed every PTY chunk; a no-op unless the PTY was launched as an auto-confirm coordinator. */
export function observeClaudeChannelDialogOutput(
  ptyId: string,
  data: string,
  pressEnter: () => void
): void {
  if (!isClaudeChannelAutoConfirmPty(ptyId)) {
    return
  }
  let observer = observers.get(ptyId)
  if (!observer) {
    observer = createClaudeDevChannelsAutoConfirm(DOLPHIN_CHANNEL_SERVERS)
    observers.set(ptyId, observer)
    if (observers.size > MAX_OBSERVED_PTYS) {
      const oldest = observers.keys().next().value
      if (oldest !== undefined) {
        observers.delete(oldest)
        releaseClaudeChannelAutoConfirmPty(oldest)
      }
    }
  }
  if (observer.observe(data)) {
    console.info('[orchestration-channel] confirmed Claude development channels for', ptyId)
    pressEnter()
  }
  if (observer.done()) {
    observers.delete(ptyId)
    releaseClaudeChannelAutoConfirmPty(ptyId)
  }
}
