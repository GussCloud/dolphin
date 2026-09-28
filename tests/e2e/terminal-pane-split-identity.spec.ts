/**
 * E2E tests for splitting terminal panes and the stable UUID leaf identity each
 * split pane carries into its PTY binding, DOLPHIN_PANE_KEY, and context menu.
 *
 * User Prompt:
 * - terminal panes can be split
 */

import { test, expect } from './helpers/dolphin-app'
import {
  UUID_RE,
  discoverActivePtyId,
  execInTerminal,
  countVisibleTerminalPanes,
  splitActiveTerminalPane,
  waitForPaneIdentitySnapshot,
  waitForTerminalOutput,
  waitForPaneCount
} from './helpers/terminal'
import { openTerminalContextMenu } from './helpers/terminal-pane-title-actions'
import { registerTerminalPaneMountReadiness } from './helpers/terminal-pane-mount-readiness'

// Why: keep the suite serial so the headful pane tests never ask Playwright to
// open multiple visible Electron windows at once.
test.describe.configure({ mode: 'serial' })
test.describe('Terminal Panes', () => {
  registerTerminalPaneMountReadiness()

  /**
   * User Prompt:
   * - terminal panes can be split
   */
  test('can split terminal pane right', async ({ appPage }) => {
    const paneCountBefore = await countVisibleTerminalPanes(appPage)

    await splitActiveTerminalPane(appPage, 'vertical')
    await waitForPaneCount(appPage, paneCountBefore + 1)

    const paneCountAfter = await countVisibleTerminalPanes(appPage)
    expect(paneCountAfter).toBe(paneCountBefore + 1)
  })

  /**
   * User Prompt:
   * - terminal panes can be split
   */
  test('can split terminal pane down', async ({ appPage }) => {
    const paneCountBefore = await countVisibleTerminalPanes(appPage)

    await splitActiveTerminalPane(appPage, 'horizontal')
    await waitForPaneCount(appPage, paneCountBefore + 1)

    const paneCountAfter = await countVisibleTerminalPanes(appPage)
    expect(paneCountAfter).toBe(paneCountBefore + 1)
  })

  test('split panes persist PTY bindings by stable UUID leaf id', async ({ appPage }) => {
    const paneCountBefore = await countVisibleTerminalPanes(appPage)

    await splitActiveTerminalPane(appPage, 'vertical')
    await waitForPaneCount(appPage, paneCountBefore + 1)

    const snapshot = await waitForPaneIdentitySnapshot(appPage, paneCountBefore + 1)
    const leafIds = snapshot.panes.map((pane) => pane.leafId)
    const ptyIds = snapshot.panes.map((pane) => pane.ptyId)

    expect(new Set(leafIds).size).toBe(leafIds.length)
    expect(new Set(ptyIds).size).toBe(ptyIds.length)
    expect(Object.keys(snapshot.ptyIdsByLeafId).sort()).toEqual([...leafIds].sort())
    expect(Object.keys(snapshot.ptyIdsByLeafId).every((leafId) => UUID_RE.test(leafId))).toBe(true)
    expect(
      snapshot.panes.some(
        (pane) =>
          String(pane.numericPaneId) === pane.leafId || `pane:${pane.numericPaneId}` === pane.leafId
      )
    ).toBe(false)
  })

  test('terminal process receives DOLPHIN_PANE_KEY with the active UUID leaf id', async ({
    appPage
  }) => {
    const snapshot = await waitForPaneIdentitySnapshot(appPage, 1)
    const activeLeafId = snapshot.activeLeafId ?? snapshot.panes[0]?.leafId
    if (!activeLeafId) {
      throw new Error('No active pane leaf id found')
    }

    const expectedPaneKey = `${snapshot.tabId}:${activeLeafId}`
    const ptyId = await discoverActivePtyId(appPage)
    const marker = `DOLPHIN_PANE_KEY_E2E_${Date.now()}`

    await execInTerminal(appPage, ptyId, `printf '${marker}=%s\\n' "$DOLPHIN_PANE_KEY"`)
    await waitForTerminalOutput(appPage, `${marker}=${expectedPaneKey}`)

    expect(activeLeafId).toMatch(UUID_RE)
  })

  test('terminal context menu copies the stable pane ID', async ({ appPage }) => {
    const snapshot = await waitForPaneIdentitySnapshot(appPage, 1)
    const leafId = snapshot.panes[0]?.leafId
    if (!leafId) {
      throw new Error('No terminal pane leaf id found')
    }
    const expectedPaneKey = `${snapshot.tabId}:${leafId}`

    await openTerminalContextMenu(appPage)
    await appPage.getByText('Copy Pane ID', { exact: true }).click()

    await expect
      .poll(() => appPage.evaluate(() => window.api.ui.readClipboardText()), { timeout: 3_000 })
      .toBe(expectedPaneKey)
    await expect(appPage.getByText('Pane ID copied', { exact: true })).toBeVisible()
    expect(leafId).toMatch(UUID_RE)
  })
})
