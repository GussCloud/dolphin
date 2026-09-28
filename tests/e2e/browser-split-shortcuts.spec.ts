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
  test.beforeEach(async ({ dolphinPage }) => {
    await waitForSessionReady(dolphinPage)
    await waitForActiveWorktree(dolphinPage)
    await ensureTerminalVisible(dolphinPage)
  })

  test('routes repeated Find shortcuts to the focused terminal or browser split', async ({
    dolphinPage
  }) => {
    const fixture = await createTerminalBrowserSplit(dolphinPage)

    await dolphinPage.evaluate(({ terminalGroupId }) => {
      const state = window.__store?.getState()
      const worktreeId = state?.activeWorktreeId
      if (state && worktreeId) {
        state.focusGroup(worktreeId, terminalGroupId)
      }
    }, fixture)
    await focusActiveTerminalInput(dolphinPage)
    await waitForFocusedGroup(dolphinPage, fixture.terminalGroupId)
    await dolphinPage.keyboard.press(`${modifier}+f`)
    await expect(terminalFindInput(dolphinPage)).toBeFocused()
    await expect(browserFindInput(dolphinPage)).toBeHidden()
    await dolphinPage.keyboard.press('Escape')

    await focusBrowserGroup(dolphinPage, fixture.browserGroupId)
    await focusBrowserAddressBar(dolphinPage, fixture.browserTabId)
    await dolphinPage.keyboard.press(`${modifier}+f`)
    await expect(browserFindInput(dolphinPage)).toBeFocused()
    await expect(terminalFindInput(dolphinPage)).toBeHidden()
    await browserFindCloseButton(dolphinPage).click()
    await expect(browserFindInput(dolphinPage)).toBeHidden()

    await dolphinPage.keyboard.press(`${modifier}+f`)
    await expect(browserFindInput(dolphinPage)).toBeFocused()
    await browserFindCloseButton(dolphinPage).click()

    await dolphinPage.evaluate(({ browserTabId }) => {
      window.__store?.getState().closeBrowserTab(browserTabId)
    }, fixture)
    await expect(
      dolphinPage.locator(`[data-browser-overlay-tab-id="${fixture.browserTabId}"]`)
    ).toHaveCount(0)

    await focusActiveTerminalInput(dolphinPage)
    await dolphinPage.keyboard.press(`${modifier}+f`)
    await expect(terminalFindInput(dolphinPage)).toBeFocused()
    await expect(browserFindInput(dolphinPage)).toBeHidden()
  })

  test('opens Find only in the browser split whose guest owns the shortcut', async ({
    dolphinPage
  }) => {
    const fixture = await createBrowserSplit(dolphinPage)

    await pressFindInBrowserGuest(
      dolphinPage,
      fixture.firstBrowserTabId,
      fixture.firstBrowserPageId
    )

    await expect(browserSplitFindInput(dolphinPage, fixture.firstBrowserTabId)).toBeVisible()
    await expect(browserSplitFindInput(dolphinPage, fixture.secondBrowserTabId)).toBeHidden()
    await expect
      .poll(() =>
        dolphinPage.evaluate(
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
    dolphinPage
  }) => {
    const fixture = await createTerminalBrowserSplit(dolphinPage)
    await focusBrowserGroup(dolphinPage, fixture.browserGroupId)
    const addressBar = browserAddressBar(dolphinPage, fixture.browserTabId)
    await focusBrowserAddressBar(dolphinPage, fixture.browserTabId)

    await dolphinPage.evaluate(() => {
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

    await dolphinPage.keyboard.press(`${modifier}+f`)
    await expect(browserFindInput(dolphinPage)).toBeFocused()
    await expect(terminalFindInput(dolphinPage)).toBeHidden()
  })

  test('keeps browser Find available when the focused split ID is stale', async ({
    dolphinPage
  }) => {
    const fixture = await createTerminalBrowserSplit(dolphinPage)
    await focusBrowserGroup(dolphinPage, fixture.browserGroupId)
    const addressBar = browserAddressBar(dolphinPage, fixture.browserTabId)
    await focusBrowserAddressBar(dolphinPage, fixture.browserTabId)

    await dolphinPage.evaluate(() => {
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

    await dolphinPage.keyboard.press(`${modifier}+f`)
    await expect(browserFindInput(dolphinPage)).toBeFocused()
    await expect(terminalFindInput(dolphinPage)).toBeHidden()
  })
})
