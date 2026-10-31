import {
  FLOATING_TERMINAL_TRIGGER_SIZE,
  clampFloatingTerminalTriggerPosition,
  getDefaultFloatingTerminalTriggerCommittedPosition,
  readPersistedFloatingTerminalTriggerPosition,
  resolveFloatingTerminalTriggerPosition,
  type FloatingTerminalTriggerPosition
} from '../floating-terminal/floating-terminal-trigger-position'

const STACK_GAP = 8

// Where the floating workspace toggle sits now: its saved drag position, else its default.
function readFloatingToggleSpot(): FloatingTerminalTriggerPosition {
  const persisted = readPersistedFloatingTerminalTriggerPosition()
  return persisted
    ? resolveFloatingTerminalTriggerPosition(persisted, 'user')
    : resolveFloatingTerminalTriggerPosition(
        getDefaultFloatingTerminalTriggerCommittedPosition(),
        'default'
      )
}

// Takes the toggle's spot when it is hidden; otherwise stacks above it, or below
// when the toggle was dragged against the top edge.
export function resolveAzureDevOpsSignInNoticePosition(
  floatingToggleShown: boolean
): FloatingTerminalTriggerPosition {
  const toggle = readFloatingToggleSpot()
  if (!floatingToggleShown) {
    return toggle
  }
  const step = FLOATING_TERMINAL_TRIGGER_SIZE + STACK_GAP
  const above = clampFloatingTerminalTriggerPosition({ left: toggle.left, top: toggle.top - step })
  if (above.top === toggle.top - step) {
    return above
  }
  return clampFloatingTerminalTriggerPosition({ left: toggle.left, top: toggle.top + step })
}
