import { describe, expect, it, vi } from 'vitest'
import { DolphinRuntimeService } from './dolphin-runtime'
import { makePaneKey } from '../../shared/stable-pane-id'

vi.mock('electron', () => ({
  BrowserWindow: { fromId: vi.fn(() => null) },
  webContents: { fromId: vi.fn(() => null) },
  ipcMain: { on: vi.fn(), removeListener: vi.fn() },
  app: { getPath: vi.fn(() => '/tmp') }
}))

const TAB_ID = 'tab-live'
const LEAF_ID = '11111111-1111-4111-8111-111111111111'
const PANE_KEY = makePaneKey(TAB_ID, LEAF_ID)

function runtimeWithPane(): DolphinRuntimeService {
  const runtime = new DolphinRuntimeService(null)
  runtime.syncWindowGraph(1, {
    tabs: [
      { tabId: TAB_ID, worktreeId: 'wt-1', title: 'claude', activeLeafId: LEAF_ID, layout: null }
    ],
    leaves: [
      {
        tabId: TAB_ID,
        worktreeId: 'wt-1',
        leafId: LEAF_ID,
        paneRuntimeId: 1,
        ptyId: 'pty-live',
        paneTitle: null
      }
    ]
  })
  return runtime
}

describe('getLiveTerminalHandleForPaneKey', () => {
  it('returns the same handle as the general lookup while the terminal is connected', () => {
    const runtime = runtimeWithPane()
    const handle = runtime.getLiveTerminalHandleForPaneKey(PANE_KEY)
    expect(handle).toEqual(expect.any(String))
    expect(runtime.getTerminalHandleForPaneKey(PANE_KEY)).toBe(handle)
  })

  it('returns null once the pane terminal has exited, unlike the general lookup', () => {
    const runtime = runtimeWithPane()
    runtime.onPtyExit('pty-live', 0)
    expect(runtime.getLiveTerminalHandleForPaneKey(PANE_KEY)).toBeNull()
    expect(runtime.getTerminalHandleForPaneKey(PANE_KEY)).not.toBeNull()
  })

  it('returns null for a pane the runtime does not know', () => {
    const runtime = runtimeWithPane()
    expect(
      runtime.getLiveTerminalHandleForPaneKey(
        makePaneKey('other', '22222222-2222-4222-8222-222222222222')
      )
    ).toBeNull()
  })
})
