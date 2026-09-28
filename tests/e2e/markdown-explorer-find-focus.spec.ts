import { expect, test } from './helpers/dolphin-app'
import { openFileExplorer } from './helpers/file-explorer'
import { pressShortcut } from './helpers/shortcuts'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test('Explorer-opened Markdown accepts the find shortcut without a document click', async ({
  appPage
}) => {
  await waitForSessionReady(appPage)
  await waitForActiveWorktree(appPage)
  await openFileExplorer(appPage)

  const readmeRow = appPage.locator('[data-file-explorer-row]').filter({ hasText: 'README.md' })
  await expect(readmeRow).toBeVisible({ timeout: 10_000 })
  await readmeRow.focus()
  await readmeRow.click()

  await expect(appPage.locator('.rich-markdown-editor')).toBeVisible({ timeout: 25_000 })
  await pressShortcut(appPage, 'f')

  await expect(appPage.getByRole('textbox', { name: 'Find in rich markdown editor' })).toBeVisible()
})
