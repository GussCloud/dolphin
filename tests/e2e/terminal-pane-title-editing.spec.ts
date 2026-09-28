/**
 * E2E tests for editing a pane title through Set Title: opening the editor,
 * committing it, and keeping it pane-local while tab titles churn.
 */

import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/dolphin-app'
import { splitActiveTerminalPane, waitForPaneCount } from './helpers/terminal'
import { getActiveWorktreeId, getActiveTabId, getWorktreeTabs } from './helpers/store'
import { pressShortcut } from './helpers/shortcuts'
import {
  setPaneTitleFromTerminalMenu,
  openTerminalContextMenu
} from './helpers/terminal-pane-title-actions'
import {
  readVisibleXtermContainerBox,
  expectTerminalToReserveTitleSpace
} from './helpers/terminal-pane-geometry'
import { registerTerminalPaneMountReadiness } from './helpers/terminal-pane-mount-readiness'

async function openPaneTitleContextMenu(page: Page, title: string): Promise<void> {
  const modifiers: ('Alt' | 'Control' | 'Meta' | 'Shift')[] = (await page.evaluate(() =>
    navigator.userAgent.includes('Windows')
  ))
    ? ['Control']
    : []
  const isMac = await page.evaluate(() => navigator.userAgent.includes('Mac'))
  const titleBar = page.locator('.pane-title-bar', { hasText: title }).first()
  await expect(titleBar).toBeVisible()
  await titleBar.click({
    button: isMac ? 'left' : 'right',
    position: { x: 20, y: 10 },
    modifiers: isMac ? ['Control'] : modifiers
  })
  await expect(page.getByText('Set Title…', { exact: true })).toBeVisible()
}

async function getTabCustomTitle(
  page: Page,
  worktreeId: string,
  tabId: string
): Promise<string | null> {
  return page.evaluate(
    ({ targetWorktreeId, targetTabId }) => {
      const state = window.__store!.getState()
      const tab = (state.tabsByWorktree[targetWorktreeId] ?? []).find(
        (entry) => entry.id === targetTabId
      )
      return tab?.customTitle ?? null
    },
    { targetWorktreeId: worktreeId, targetTabId: tabId }
  )
}

async function expectTabCustomTitle(
  page: Page,
  worktreeId: string,
  tabId: string,
  expected: string | null
): Promise<void> {
  await expect
    .poll(() => getTabCustomTitle(page, worktreeId, tabId), { timeout: 3_000 })
    .toBe(expected)
}

async function expectSavedLayoutNotToContainTitle(
  page: Page,
  tabId: string,
  title: string
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ targetTabId, title }) => {
            const layout = window.__store!.getState().terminalLayoutsByTabId[targetTabId]
            return Object.values(layout?.titlesByLeafId ?? {}).includes(title)
          },
          { targetTabId: tabId, title }
        ),
      { timeout: 3_000 }
    )
    .toBe(false)
}

// Why: keep the suite serial so the headful pane tests never ask Playwright to
// open multiple visible Electron windows at once.
test.describe.configure({ mode: 'serial' })
test.describe('Terminal Panes', () => {
  registerTerminalPaneMountReadiness()

  test('first Set Title from terminal context menu stays open for typing', async ({
    dolphinPage
  }) => {
    const title = `First menu title ${Date.now()}`

    await openTerminalContextMenu(dolphinPage)
    await dolphinPage.getByText('Set Title…', { exact: true }).click()

    const titleInput = dolphinPage.locator('.pane-title-input').first()
    await expect(titleInput).toBeVisible()
    await expect(titleInput).toBeFocused()
    await dolphinPage.waitForTimeout(250)
    await expect(titleInput).toBeVisible()
    await expect(titleInput).toBeFocused()

    await titleInput.fill(title)
    await titleInput.press('Enter')

    await expect(titleInput).toHaveCount(0)
    await expect(dolphinPage.locator('.pane-title-text', { hasText: title })).toHaveCount(1)
  })

  test('Set Title editor renders in Dolphin overlay while terminal reserves title space', async ({
    dolphinPage
  }) => {
    const title = `Reserved overlay title ${Date.now()}`
    const terminalBoxBefore = await readVisibleXtermContainerBox(dolphinPage)

    await openTerminalContextMenu(dolphinPage)
    await dolphinPage.getByText('Set Title…', { exact: true }).click()

    const titleInput = dolphinPage.locator('.pane-title-overlay-layer .pane-title-input').first()
    await expect(titleInput).toBeVisible()
    await expect(titleInput).toBeFocused()
    await expect(dolphinPage.getByText('Set Title…', { exact: true })).toBeHidden()
    await expect(dolphinPage.locator('.pane .pane-title-input')).toHaveCount(0)
    await expect(dolphinPage.locator('.pane[data-has-title]')).toHaveCount(1)
    await expect
      .poll(() =>
        dolphinPage
          .locator('.pane-title-bar')
          .first()
          .evaluate((titleBar) => getComputedStyle(titleBar).backgroundColor)
      )
      .not.toBe('rgba(0, 0, 0, 0)')
    const terminalBoxEditing = await readVisibleXtermContainerBox(dolphinPage)
    expectTerminalToReserveTitleSpace(terminalBoxEditing, terminalBoxBefore)

    await titleInput.fill(title)
    await titleInput.press('Enter')
    await expect(dolphinPage.locator('.pane-title-text', { hasText: title })).toBeVisible()
    await expect(dolphinPage.locator('.pane[data-has-title]')).toHaveCount(1)
    expectTerminalToReserveTitleSpace(
      await readVisibleXtermContainerBox(dolphinPage),
      terminalBoxBefore
    )
  })

  test('Set Title context menu opens from the title overlay strip', async ({ dolphinPage }) => {
    const title = `Overlay menu title ${Date.now()}`
    const updatedTitle = `Overlay menu updated ${Date.now()}`

    await setPaneTitleFromTerminalMenu(dolphinPage, title)
    await openPaneTitleContextMenu(dolphinPage, title)
    await dolphinPage.getByText('Set Title…', { exact: true }).click()

    const titleInput = dolphinPage.locator('.pane-title-input').first()
    await expect(titleInput).toBeVisible()
    await expect(titleInput).toBeFocused()
    await expect(titleInput).toHaveValue(title)
    await titleInput.fill(updatedTitle)
    await titleInput.press('Enter')

    await expect(dolphinPage.locator('.pane-title-text', { hasText: updatedTitle })).toHaveCount(1)
    await expect(dolphinPage.locator('.pane-title-text', { hasText: title })).toHaveCount(0)
  })

  test('Set Title commits when tabbing away from the title input', async ({ dolphinPage }) => {
    const title = `Tab commit title ${Date.now()}`

    await openTerminalContextMenu(dolphinPage)
    await dolphinPage.getByText('Set Title…', { exact: true }).click()

    const titleInput = dolphinPage.locator('.pane-title-input').first()
    await expect(titleInput).toBeVisible()
    await expect(titleInput).toBeFocused()
    await titleInput.fill(title)
    await titleInput.press('Tab')

    await expect(titleInput).toHaveCount(0)
    await expect(dolphinPage.locator('.pane-title-text', { hasText: title })).toHaveCount(1)
  })

  test('Set Title overlay hides with its inactive terminal tab', async ({ dolphinPage }) => {
    const title = `Hidden tab title ${Date.now()}`
    const worktreeId = (await getActiveWorktreeId(dolphinPage))!

    await setPaneTitleFromTerminalMenu(dolphinPage, title)
    await expect(dolphinPage.locator('.pane-title-text', { hasText: title })).toBeVisible()

    await pressShortcut(dolphinPage, 't')
    await expect
      .poll(async () => (await getWorktreeTabs(dolphinPage, worktreeId)).length, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(2)
    await expect(dolphinPage.locator('.pane-title-text', { hasText: title })).toBeHidden()

    await pressShortcut(dolphinPage, 'BracketLeft', { shift: true })
    await expect(dolphinPage.locator('.pane-title-text', { hasText: title })).toBeVisible()
  })

  test('Set Title still commits by blur after focus settles', async ({ dolphinPage }) => {
    const title = `Blur commit title ${Date.now()}`

    await openTerminalContextMenu(dolphinPage)
    await dolphinPage.getByText('Set Title…', { exact: true }).click()

    const titleInput = dolphinPage.locator('.pane-title-input').first()
    await expect(titleInput).toBeVisible()
    await expect(titleInput).toBeFocused()
    await dolphinPage.waitForTimeout(100)
    await titleInput.fill(title)
    await dolphinPage
      .locator('.xterm:visible')
      .first()
      .click({ position: { x: 40, y: 60 } })

    await expect(titleInput).toHaveCount(0)
    await expect(dolphinPage.locator('.pane-title-text', { hasText: title })).toHaveCount(1)
  })

  test('Set Title stays pane-local during agent title churn', async ({ dolphinPage }) => {
    const worktreeId = (await getActiveWorktreeId(dolphinPage))!
    const tabId = (await getActiveTabId(dolphinPage))!
    const paneTitle = `Codex pane ${Date.now()}`
    const removeButtonTitle = `Remove button label ${Date.now()}`
    const splitTitle = `Split label ${Date.now()}`
    const runtimeTitle = '⠋ Codex working'

    await setPaneTitleFromTerminalMenu(dolphinPage, paneTitle)
    await expect(dolphinPage.locator('.pane-title-text', { hasText: paneTitle })).toBeVisible()
    await expectTabCustomTitle(dolphinPage, worktreeId, tabId, null)

    await dolphinPage.getByRole('button', { name: `Edit pane title: ${paneTitle}` }).focus()
    await dolphinPage.keyboard.press('Enter')
    const paneTitleInput = dolphinPage.getByRole('textbox', { name: 'Pane title' })
    await expect(paneTitleInput).toBeVisible()
    await expect(paneTitleInput).toBeFocused()
    await dolphinPage.keyboard.press('Escape')
    await expect(paneTitleInput).toHaveCount(0)
    await expect(dolphinPage.locator('.pane-title-text', { hasText: paneTitle })).toBeVisible()

    await dolphinPage.evaluate(
      ({ targetTabId, title }) => {
        window.__store!.getState().updateTabTitle(targetTabId, title)
      },
      { targetTabId: tabId, title: runtimeTitle }
    )

    // Why: active agents continuously write OSC titles. Set Title is Dolphin's
    // pane-local overlay and must remain visible while the tab runtime title
    // continues to follow the active PTY.
    await expect(dolphinPage.locator('.pane-title-text', { hasText: paneTitle })).toBeVisible()
    await expect(
      dolphinPage.locator(`[data-testid="sortable-tab"][data-tab-id="${tabId}"]`)
    ).toHaveAttribute('data-tab-title', runtimeTitle)
    await expectTabCustomTitle(dolphinPage, worktreeId, tabId, null)

    await setPaneTitleFromTerminalMenu(dolphinPage, '')
    await expect(dolphinPage.locator('.pane-title-text', { hasText: paneTitle })).toBeHidden()
    await expectSavedLayoutNotToContainTitle(dolphinPage, tabId, paneTitle)

    await setPaneTitleFromTerminalMenu(dolphinPage, removeButtonTitle)
    await setPaneTitleFromTerminalMenu(dolphinPage, '')
    await expect(
      dolphinPage.locator('.pane-title-text', { hasText: removeButtonTitle })
    ).toBeHidden()
    await expectSavedLayoutNotToContainTitle(dolphinPage, tabId, removeButtonTitle)

    await setPaneTitleFromTerminalMenu(dolphinPage, splitTitle)
    await expectTabCustomTitle(dolphinPage, worktreeId, tabId, null)

    await splitActiveTerminalPane(dolphinPage, 'vertical')
    await waitForPaneCount(dolphinPage, 2)
    await expect(dolphinPage.locator('.pane-title-text', { hasText: splitTitle })).toBeVisible()

    await dolphinPage.evaluate(
      ({ targetTabId, title }) => {
        window.__store!.getState().updateTabTitle(targetTabId, title)
      },
      { targetTabId: tabId, title: runtimeTitle }
    )
    await expect(
      dolphinPage.locator(`[data-testid="sortable-tab"][data-tab-id="${tabId}"]`)
    ).toHaveAttribute('data-tab-title', runtimeTitle)
  })
})
