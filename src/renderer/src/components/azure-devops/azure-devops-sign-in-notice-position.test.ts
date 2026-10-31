// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest'
import {
  FLOATING_TERMINAL_TRIGGER_POSITION_STORAGE_KEY,
  getDefaultFloatingTerminalTriggerPosition
} from '../floating-terminal/floating-terminal-trigger-position'
import { resolveAzureDevOpsSignInNoticePosition } from './azure-devops-sign-in-notice-position'

describe('resolveAzureDevOpsSignInNoticePosition', () => {
  afterEach(() => window.localStorage.clear())

  it('takes the toggle spot when the floating toggle is hidden', () => {
    expect(resolveAzureDevOpsSignInNoticePosition(false)).toEqual(
      getDefaultFloatingTerminalTriggerPosition()
    )
  })

  it('stacks above the default toggle without overlapping it', () => {
    const toggle = getDefaultFloatingTerminalTriggerPosition()
    const notice = resolveAzureDevOpsSignInNoticePosition(true)
    expect(notice.left).toBe(toggle.left)
    expect(toggle.top - notice.top).toBe(44)
  })

  it('stacks below a toggle dragged against the top edge', () => {
    window.localStorage.setItem(
      FLOATING_TERMINAL_TRIGGER_POSITION_STORAGE_KEY,
      JSON.stringify({ anchorX: 'left', anchorY: 'top', offsetX: 100, offsetY: 40 })
    )
    expect(resolveAzureDevOpsSignInNoticePosition(true)).toEqual({ left: 100, top: 84 })
  })
})
