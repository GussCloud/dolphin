import { test, expect } from './helpers/dolphin-app'
import { getStoreState, waitForSessionReady } from './helpers/store'
import type { ElectronApplication } from '@stablyai/playwright-test'

async function openFeatureTourFromMenu(electronApp: ElectronApplication): Promise<void> {
  await electronApp.evaluate(({ BrowserWindow, Menu }) => {
    const featureTourItem = Menu.getApplicationMenu()
      ?.items.find((item) => item.label === 'Help')
      ?.submenu?.items.find((item) => item.label === 'Explore Dolphin')

    if (!featureTourItem) {
      throw new Error('Explore Dolphin menu item was not registered')
    }

    const window = BrowserWindow.getAllWindows()[0]
    featureTourItem.click(featureTourItem, window, {
      triggeredByAccelerator: false,
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false
    } as Electron.KeyboardEvent)
  })
}

test.describe('Feature tour modal', () => {
  test.beforeEach(async ({ dolphinPage }) => {
    await waitForSessionReady(dolphinPage)
  })

  test('opens from the Help menu and renders the workflow rail', async ({
    electronApp,
    dolphinPage
  }) => {
    await openFeatureTourFromMenu(electronApp)

    await expect(dolphinPage.getByRole('dialog', { name: 'Get to know Dolphin' })).toBeVisible({
      timeout: 10_000
    })
    await expect(
      dolphinPage.getByText('Reopen any time from Help > Explore Dolphin.')
    ).toBeVisible()

    // Five workflow rows in the rail.
    const rail = dolphinPage.getByRole('navigation', { name: 'Workflows' })
    await expect(rail.getByRole('tab')).toHaveCount(5)
    await expect(rail.getByRole('tab', { name: /Workspaces/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    await expect(dolphinPage.locator('[data-ws-id]')).toHaveCount(3)

    // ArrowDown moves selection through the rail.
    await rail.getByRole('tab', { name: /Workspaces/i }).focus()
    await dolphinPage.keyboard.press('ArrowDown')
    await expect(rail.getByRole('tab', { name: /Tasks/i })).toHaveAttribute('aria-selected', 'true')
    await dolphinPage.keyboard.press('ArrowDown')
    await expect(rail.getByRole('tab', { name: /Agents/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    await rail.getByRole('tab', { name: /Workbench/i }).click()
    await rail.getByRole('button', { name: /Browser/i }).click()
    await expect(
      dolphinPage.getByText(
        "Run your app in Dolphin's browser, send selected UI elements to agents, and let your agents interact with your webpage."
      )
    ).toBeVisible()
    await expect(dolphinPage.getByRole('heading', { name: 'Browser Use skill' })).toBeVisible()
    await expect(
      dolphinPage.getByText("Enables agents to navigate and verify pages in Dolphin's browser.")
    ).toBeVisible()
    await expect(dolphinPage.getByRole('heading', { name: 'CLI skill' })).toHaveCount(0)
    await expect(dolphinPage.getByText('With the Dolphin CLI skill', { exact: false })).toHaveCount(
      0
    )
  })

  test('shows unified task copy without leaving the walkthrough', async ({ dolphinPage }) => {
    await dolphinPage.evaluate(() => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      store.setState({
        preflightStatus: {
          git: { installed: true },
          gh: { installed: true, authenticated: false },
          glab: { installed: false, authenticated: false },
          bitbucket: { configured: false, authenticated: false, account: null },
          azureDevOps: {
            configured: false,
            authenticated: false,
            account: null,
            baseUrl: null,
            tokenConfigured: false
          },
          gitea: {
            configured: false,
            authenticated: false,
            account: null,
            baseUrl: null,
            tokenConfigured: false
          }
        },
        preflightStatusChecked: true,
        preflightStatusLoading: false,
        linearStatus: { connected: false, viewer: null },
        linearStatusChecked: true
      })
      store.getState().openModal('feature-wall', { source: 'help_menu' })
    })

    await expect(dolphinPage.getByRole('dialog', { name: 'Get to know Dolphin' })).toBeVisible({
      timeout: 10_000
    })
    await dolphinPage
      .getByRole('navigation', { name: 'Workflows' })
      .getByRole('tab', { name: /Tasks/i })
      .click()
    await expect(dolphinPage.getByText('Start work directly from GitHub or Linear.')).toBeVisible()
    await expect(dolphinPage.getByText('Connect GitHub or Linear once')).toHaveCount(0)
    await expect(dolphinPage.getByRole('dialog', { name: 'Get to know Dolphin' })).toBeVisible()
    await expect
      .poll(async () => getStoreState<string>(dolphinPage, 'activeView'))
      .not.toBe('settings')
  })

  test('continue advances through workflow substeps before the next workflow', async ({
    dolphinPage
  }) => {
    await dolphinPage.evaluate(() => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      store.getState().openModal('feature-wall', { source: 'help_menu' })
    })

    const rail = dolphinPage.getByRole('navigation', { name: 'Workflows' })
    const continueButton = dolphinPage.getByRole('button', { name: /^Continue/ })

    await continueButton.click()
    await expect(rail.getByRole('tab', { name: /Tasks/i })).toHaveAttribute('aria-selected', 'true')

    await continueButton.click()
    await expect(rail.getByRole('tab', { name: /Agents/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(rail.getByRole('button', { name: /Visibility/i })).toHaveAttribute(
      'aria-current',
      'step'
    )

    await continueButton.click()
    await expect(rail.getByRole('button', { name: /Orchestration/i })).toHaveAttribute(
      'aria-current',
      'step'
    )
    await expect(rail.getByRole('tab', { name: /Workbench/i })).toHaveAttribute(
      'aria-selected',
      'false'
    )

    await continueButton.click()
    await expect(rail.getByRole('button', { name: /Usage/i })).toHaveAttribute(
      'aria-current',
      'step'
    )

    await continueButton.click()
    await expect(rail.getByRole('tab', { name: /Workbench/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(rail.getByRole('button', { name: /Terminal/i })).toHaveAttribute(
      'aria-current',
      'step'
    )
  })

  test('does not pre-check configured workflows until the user visits them', async ({
    dolphinPage,
    electronApp
  }) => {
    await electronApp.evaluate(
      ({ ipcMain }, preflightStatus) => {
        ipcMain.removeHandler('preflight:check')
        ipcMain.handle('preflight:check', () => preflightStatus)
        ipcMain.removeHandler('linear:status')
        ipcMain.handle('linear:status', () => ({ connected: false, viewer: null }))
        ipcMain.removeHandler('jira:status')
        ipcMain.handle('jira:status', () => ({ connected: false, viewer: null }))
      },
      {
        git: { installed: true },
        gh: { installed: true, authenticated: true },
        glab: { installed: false, authenticated: false },
        bitbucket: { configured: false, authenticated: false, account: null },
        azureDevOps: {
          configured: false,
          authenticated: false,
          account: null,
          baseUrl: null,
          tokenConfigured: false
        },
        gitea: {
          configured: false,
          authenticated: false,
          account: null,
          baseUrl: null,
          tokenConfigured: false
        }
      }
    )
    await dolphinPage.evaluate(async () => {
      for (const key of [
        'dolphin.featureWall.visitedWorkflows.v1',
        'dolphin.featureWall.visitedAgentSteps.v1',
        'dolphin.featureWall.visitedWorkbenchSteps.v1',
        'dolphin.featureWall.visitedReviewSteps.v1',
        'dolphin.featureWall.completedWorkflows.v1',
        'dolphin.featureWall.completedAgentSteps.v1',
        'dolphin.featureWall.completedWorkbenchSteps.v1',
        'dolphin.featureWall.completedReviewSteps.v1'
      ]) {
        localStorage.removeItem(key)
      }
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      // Seed through the status actions so each result gets the current execution context.
      await Promise.all([
        store.getState().refreshPreflightStatus({ force: true }),
        store.getState().checkLinearConnection(true),
        store.getState().checkJiraConnection()
      ])
      store.getState().openModal('feature-wall', { source: 'help_menu' })
    })

    const rail = dolphinPage.getByRole('navigation', { name: 'Workflows' })
    const workspacesTab = rail.locator('[data-feature-wall-workflow-id="workspaces"]')
    const tasksTab = rail.locator('[data-feature-wall-workflow-id="tasks"]')
    await expect(workspacesTab.locator('[aria-label="Completed"]')).toHaveCount(1)
    await expect(tasksTab.locator('[aria-label="Completed"]')).toHaveCount(0)
    await tasksTab.click()
    await expect(tasksTab.locator('[aria-label="Completed"]')).toHaveCount(1)
    await expect(workspacesTab.locator('[aria-label="Completed"]')).toHaveCount(1)
  })

  test('keeps persisted completed setup-backed substeps checked when reopened', async ({
    dolphinPage
  }) => {
    await dolphinPage.evaluate(() => {
      localStorage.setItem(
        'dolphin.featureWall.completedAgentSteps.v1',
        JSON.stringify(['orchestration'])
      )
      localStorage.setItem(
        'dolphin.featureWall.completedWorkbenchSteps.v1',
        JSON.stringify(['browser'])
      )
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      store.getState().openModal('feature-wall', { source: 'help_menu' })
    })

    const rail = dolphinPage.getByRole('navigation', { name: 'Workflows' })

    await rail.getByRole('tab', { name: /Agents/i }).click()
    await expect(
      rail.getByRole('button', { name: /Orchestration/i }).locator('[aria-label="Completed"]')
    ).toHaveCount(1)

    await rail.getByRole('tab', { name: /Workbench/i }).click()
    await expect(
      rail.getByRole('button', { name: /Browser/i }).locator('[aria-label="Completed"]')
    ).toHaveCount(1)
  })
})
