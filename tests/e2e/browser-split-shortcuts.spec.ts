import { expect, test } from './helpers/dolphin-app'
import type { Page } from '@stablyai/playwright-test'
import { focusActiveTerminalInput } from './helpers/terminal'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  browserAddressBar,
  createBrowserSplit,
  createTerminalBrowserSplit,
  focusBrowserAddressBar,
  focusBrowserGroup,
  guestModifier,
  pressKeyInBrowserGuest,
  shortcutModifier as modifier,
  waitForFocusedGroup
} from './helpers/browser-split-fixture'

function browserFindInput(page: Page) {
  return page.getByPlaceholder('Find in page...')
}

function browserFindCloseButton(page: Page) {
  return browserFindInput(page).locator('xpath=..').getByTitle('Close')
}

function browserSplitFindInput(page: Page, browserTabId: string) {
  return page
    .locator(`[data-browser-overlay-tab-id="${browserTabId}"]`)
    .getByPlaceholder('Find in page...')
}

async function pressFindInBrowserGuest(
  page: Page,
  browserTabId: string,
  browserPageId: string
): Promise<void> {
  await pressKeyInBrowserGuest(page, browserTabId, browserPageId, 'F', [guestModifier])
}

function terminalFindInput(page: Page) {
  return page.locator('[data-terminal-search-root] input:visible')
}

test.describe('browser split shortcuts', () => {
  test.beforeEach(async ({ appPage }) => {
    await waitForSessionReady(appPage)
    await waitForActiveWorktree(appPage)
    await ensureTerminalVisible(appPage)
  })

  test('routes repeated Find shortcuts to the focused terminal or browser split', async ({
    appPage
  }) => {
    const fixture = await createTerminalBrowserSplit(appPage)

    await appPage.evaluate(({ terminalGroupId }) => {
      const state = window.__store?.getState()
      const worktreeId = state?.activeWorktreeId
      if (state && worktreeId) {
        state.focusGroup(worktreeId, terminalGroupId)
      }
    }, fixture)
    await focusActiveTerminalInput(appPage)
    await waitForFocusedGroup(appPage, fixture.terminalGroupId)
    await appPage.keyboard.press(`${modifier}+f`)
    await expect(terminalFindInput(appPage)).toBeFocused()
    await expect(browserFindInput(appPage)).toBeHidden()
    await appPage.keyboard.press('Escape')

    await focusBrowserGroup(appPage, fixture.browserGroupId)
    await focusBrowserAddressBar(appPage, fixture.browserTabId)
    await appPage.keyboard.press(`${modifier}+f`)
    await expect(browserFindInput(appPage)).toBeFocused()
    await expect(terminalFindInput(appPage)).toBeHidden()
    await browserFindCloseButton(appPage).click()
    await expect(browserFindInput(appPage)).toBeHidden()

    await appPage.keyboard.press(`${modifier}+f`)
    await expect(browserFindInput(appPage)).toBeFocused()
    await browserFindCloseButton(appPage).click()

    await appPage.evaluate(({ browserTabId }) => {
      window.__store?.getState().closeBrowserTab(browserTabId)
    }, fixture)
    await expect(
      appPage.locator(`[data-browser-overlay-tab-id="${fixture.browserTabId}"]`)
    ).toHaveCount(0)

    await focusActiveTerminalInput(appPage)
    await appPage.keyboard.press(`${modifier}+f`)
    await expect(terminalFindInput(appPage)).toBeFocused()
    await expect(browserFindInput(appPage)).toBeHidden()
  })

  test('opens Find only in the browser split whose guest owns the shortcut', async ({
    appPage
  }) => {
    const fixture = await createBrowserSplit(appPage)

    await pressFindInBrowserGuest(appPage, fixture.firstBrowserTabId, fixture.firstBrowserPageId)

    await expect(browserSplitFindInput(appPage, fixture.firstBrowserTabId)).toBeVisible()
    await expect(browserSplitFindInput(appPage, fixture.secondBrowserTabId)).toBeHidden()
    await expect
      .poll(() =>
        appPage.evaluate(
          ({ browserPageId, browserTabId }) =>
            window.__store
              ?.getState()
              .browserPagesByWorkspace[browserTabId]?.find((page) => page.id === browserPageId)
              ?.loadError?.code ?? null,
          {
            browserPageId: fixture.firstBrowserPageId,
            browserTabId: fixture.firstBrowserTabId
          }
        )
      )
      .toBeNull()
  })

  test('keeps browser Find available when split focus state is temporarily missing', async ({
    appPage
  }) => {
    const fixture = await createTerminalBrowserSplit(appPage)
    await focusBrowserGroup(appPage, fixture.browserGroupId)
    const addressBar = browserAddressBar(appPage, fixture.browserTabId)
    await focusBrowserAddressBar(appPage, fixture.browserTabId)

    await appPage.evaluate(() => {
      const store = window.__store
      const worktreeId = store?.getState().activeWorktreeId
      if (!store || !worktreeId) {
        throw new Error('Active worktree unavailable')
      }
      store.setState((state) => {
        const activeGroupIdByWorktree = { ...state.activeGroupIdByWorktree }
        delete activeGroupIdByWorktree[worktreeId]
        return { activeGroupIdByWorktree }
      })
    })
    await expect(addressBar).toBeFocused()

    await appPage.keyboard.press(`${modifier}+f`)
    await expect(browserFindInput(appPage)).toBeFocused()
    await expect(terminalFindInput(appPage)).toBeHidden()
  })

  test('keeps browser Find available when the focused split ID is stale', async ({ appPage }) => {
    const fixture = await createTerminalBrowserSplit(appPage)
    await focusBrowserGroup(appPage, fixture.browserGroupId)
    const addressBar = browserAddressBar(appPage, fixture.browserTabId)
    await focusBrowserAddressBar(appPage, fixture.browserTabId)

    await appPage.evaluate(() => {
      const store = window.__store
      const worktreeId = store?.getState().activeWorktreeId
      if (!store || !worktreeId) {
        throw new Error('Active worktree unavailable')
      }
      store.setState((state) => ({
        activeGroupIdByWorktree: {
          ...state.activeGroupIdByWorktree,
          [worktreeId]: 'removed-group'
        }
      }))
    })
    await expect(addressBar).toBeFocused()

    await appPage.keyboard.press(`${modifier}+f`)
    await expect(browserFindInput(appPage)).toBeFocused()
    await expect(terminalFindInput(appPage)).toBeHidden()
  })
})
