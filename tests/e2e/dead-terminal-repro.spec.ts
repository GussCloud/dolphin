/**
 * Stress test for dead-terminal reproduction (setup-split flow).
 *
 * Why @headful: the dead-terminal bug is a WebGL canvas staleness issue — after
 * wrapInSplit() reparents the existing pane's container, the WebGL canvas can
 * fail to repaint. In headless mode WebGL is NEVER active, so the DOM fallback
 * renderer is used and the bug cannot manifest. Running headful ensures real
 * WebGL contexts matching production.
 *
 * See helpers/dead-terminal.ts for the shared worktree-creation helper that
 * replicates the exact activateAndRevealWorktree + ensureWorktreeHasInitialTerminal
 * production flow.
 */

import { test, expect } from './helpers/dolphin-app'
import {
  waitForSessionReady,
  waitForActiveWorktree,
  getActiveWorktreeId,
  switchToWorktree,
  ensureTerminalVisible
} from './helpers/store'
import { waitForActiveTerminalManager, waitForPaneCount } from './helpers/terminal'
import {
  createAndActivateWorktreeWithSetup,
  removeWorktreeViaStore,
  waitForAllPanesToHaveContent,
  checkWebglState
} from './helpers/dead-terminal'

const STRESS_ITERATIONS = 5

test.describe('Dead Terminal Reproduction @headful', () => {
  const createdWorktreeIds: string[] = []

  test.beforeEach(async ({ dolphinPage }) => {
    await waitForSessionReady(dolphinPage)
    await waitForActiveWorktree(dolphinPage)
    await ensureTerminalVisible(dolphinPage)

    await dolphinPage.evaluate(async () => {
      const state = window.__store?.getState()
      if (!state) {
        return
      }
      state.updateSettings({ setupScriptLaunchMode: 'split-vertical' })
    })
  })

  test.afterEach(async ({ dolphinPage }) => {
    for (const id of createdWorktreeIds) {
      await removeWorktreeViaStore(dolphinPage, id)
    }
    createdWorktreeIds.length = 0
  })

  test('@headful setup-split flow does not produce dead terminals', async ({ dolphinPage }) => {
    test.setTimeout(120_000)
    const homeWorktreeId = await waitForActiveWorktree(dolphinPage)
    await waitForActiveTerminalManager(dolphinPage, 30_000)
    await checkWebglState(dolphinPage, 'home-initial')

    for (let i = 0; i < STRESS_ITERATIONS; i++) {
      const direction = i % 2 === 0 ? 'vertical' : 'horizontal'
      const newId = await createAndActivateWorktreeWithSetup(dolphinPage, `setup-${i}`, direction)
      createdWorktreeIds.push(newId)

      await expect
        .poll(async () => getActiveWorktreeId(dolphinPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(dolphinPage)
      await waitForActiveTerminalManager(dolphinPage, 30_000)
      await waitForPaneCount(dolphinPage, 2, 15_000)
      await checkWebglState(dolphinPage, `setup-${i}`)
      await waitForAllPanesToHaveContent(dolphinPage, `setup-${i} both panes`)

      await switchToWorktree(dolphinPage, homeWorktreeId)
      await expect
        .poll(async () => getActiveWorktreeId(dolphinPage), { timeout: 10_000 })
        .toBe(homeWorktreeId)
      await removeWorktreeViaStore(dolphinPage, newId)
      createdWorktreeIds.pop()
    }
  })

  test('@headful setup-split then switch-back does not leave panes dead', async ({
    dolphinPage
  }) => {
    test.setTimeout(120_000)
    const homeWorktreeId = await waitForActiveWorktree(dolphinPage)
    await waitForActiveTerminalManager(dolphinPage, 30_000)

    for (let i = 0; i < STRESS_ITERATIONS; i++) {
      const newId = await createAndActivateWorktreeWithSetup(
        dolphinPage,
        `switchback-${i}`,
        'vertical'
      )
      createdWorktreeIds.push(newId)

      await expect
        .poll(async () => getActiveWorktreeId(dolphinPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(dolphinPage)
      await waitForActiveTerminalManager(dolphinPage, 30_000)
      await waitForPaneCount(dolphinPage, 2, 15_000)
      await waitForAllPanesToHaveContent(dolphinPage, `switchback-${i} initial`)

      await switchToWorktree(dolphinPage, homeWorktreeId)
      await expect
        .poll(async () => getActiveWorktreeId(dolphinPage), { timeout: 10_000 })
        .toBe(homeWorktreeId)
      await ensureTerminalVisible(dolphinPage)
      await waitForActiveTerminalManager(dolphinPage, 15_000)

      await switchToWorktree(dolphinPage, newId)
      await expect
        .poll(async () => getActiveWorktreeId(dolphinPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(dolphinPage)
      await waitForActiveTerminalManager(dolphinPage, 15_000)
      await waitForAllPanesToHaveContent(dolphinPage, `switchback-${i} after return`)

      await switchToWorktree(dolphinPage, homeWorktreeId)
      await expect
        .poll(async () => getActiveWorktreeId(dolphinPage), { timeout: 10_000 })
        .toBe(homeWorktreeId)
      await removeWorktreeViaStore(dolphinPage, newId)
      createdWorktreeIds.pop()
    }
  })

  test('@headful rapid switching between many setup-split worktrees', async ({ dolphinPage }) => {
    test.setTimeout(120_000)
    const homeWorktreeId = await waitForActiveWorktree(dolphinPage)
    await waitForActiveTerminalManager(dolphinPage, 30_000)

    const worktreeIds = [homeWorktreeId]
    for (let i = 0; i < 4; i++) {
      const newId = await createAndActivateWorktreeWithSetup(dolphinPage, `multi-${i}`, 'vertical')
      createdWorktreeIds.push(newId)
      worktreeIds.push(newId)

      await expect
        .poll(async () => getActiveWorktreeId(dolphinPage), { timeout: 10_000 })
        .toBe(newId)
      await ensureTerminalVisible(dolphinPage)
      await waitForActiveTerminalManager(dolphinPage, 30_000)
      await waitForPaneCount(dolphinPage, 2, 15_000)
      await waitForAllPanesToHaveContent(dolphinPage, `multi-create-${i}`)
    }

    for (let round = 0; round < 3; round++) {
      for (const wId of worktreeIds) {
        await switchToWorktree(dolphinPage, wId)
        await expect
          .poll(async () => getActiveWorktreeId(dolphinPage), { timeout: 10_000 })
          .toBe(wId)
        await ensureTerminalVisible(dolphinPage)
        await waitForActiveTerminalManager(dolphinPage, 15_000)
        await waitForAllPanesToHaveContent(dolphinPage, `multi-r${round}-${wId.slice(0, 8)}`)
      }
    }
  })
})
