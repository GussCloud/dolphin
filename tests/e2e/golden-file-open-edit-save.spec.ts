import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect } from './helpers/dolphin-app'
import {
  activateGoldenWorktree,
  cleanupGoldenWorktree,
  createGoldenWorktree
} from './helpers/golden-source-control'
import { waitForSessionReady } from './helpers/store'

const README_PATH = 'README.md'

test('@golden opens, edits, saves, and reopens a tracked file', async ({
  dolphinPage,
  testRepoPath,
  registerPostElectronShutdownCleanup
}) => {
  const fixture = createGoldenWorktree(testRepoPath, 'file-save')
  registerPostElectronShutdownCleanup(async () => cleanupGoldenWorktree(testRepoPath, fixture))
  const sentinel = `Golden file save ${Date.now()}`
  const readmePath = path.join(fixture.worktreePath, README_PATH)

  await waitForSessionReady(dolphinPage)
  await activateGoldenWorktree(dolphinPage, testRepoPath, fixture.worktreePath)
  await dolphinPage.evaluate(() => {
    const state = window.__store?.getState()
    state?.setRightSidebarTab('source-control')
    state?.setRightSidebarOpen(true)
  })
  await dolphinPage.getByRole('button', { name: 'Explorer' }).click()

  const explorer = dolphinPage.locator('[data-dolphin-explorer-shell]')
  // Why: after save the row's full text is "README.md M" from the git badge.
  const readmeRow = explorer.locator('[data-file-explorer-row]').filter({
    has: dolphinPage
      .locator('[data-file-explorer-row-name]')
      .getByText(README_PATH, { exact: true })
  })
  await expect(readmeRow).toBeVisible({ timeout: 10_000 })
  await readmeRow.click()

  await expect(dolphinPage.locator('.editor-header-path').first()).toContainText(README_PATH, {
    timeout: 20_000
  })
  const editor = dolphinPage.locator('.rich-markdown-editor')
  await expect(editor).toBeVisible({ timeout: 25_000 })
  await expect(editor).toContainText('Dolphin E2E Test Repo')
  await editor.click()
  await dolphinPage.keyboard.press('ControlOrMeta+End')
  await dolphinPage.keyboard.press('Enter')
  await dolphinPage.keyboard.type(sentinel)
  await dolphinPage.keyboard.press('ControlOrMeta+S')

  await expect.poll(() => readFileSync(readmePath, 'utf8'), { timeout: 10_000 }).toContain(sentinel)
  const readmeTab = dolphinPage.locator('[data-tab-id]').filter({ hasText: README_PATH }).last()
  await readmeTab.getByRole('button', { name: 'Close tab' }).click()
  await expect(
    dolphinPage.locator('.editor-header-path').filter({ hasText: README_PATH })
  ).toHaveCount(0)

  await readmeRow.click()
  await expect(dolphinPage.locator('.rich-markdown-editor')).toContainText(sentinel, {
    timeout: 25_000
  })
  await expect(explorer).toBeVisible()
  await expect(readmeRow).toBeVisible()
  await expect(
    dolphinPage.getByText(path.basename(testRepoPath), { exact: true }).first()
  ).toBeVisible()
})
