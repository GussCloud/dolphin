import { expect, test } from './helpers/dolphin-app'
import { openFileExplorer } from './helpers/file-explorer'
import { pressShortcut } from './helpers/shortcuts'
import { waitForActiveWorktree, waitForSessionReady } from './helpers/store'

test('Explorer-opened Markdown accepts the find shortcut without a document click', async ({
  dolphinPage
}) => {
  await waitForSessionReady(dolphinPage)
  await waitForActiveWorktree(dolphinPage)
  await openFileExplorer(dolphinPage)

  const readmeRow = dolphinPage.locator('[data-file-explorer-row]').filter({ hasText: 'README.md' })
  await expect(readmeRow).toBeVisible({ timeout: 10_000 })
  await readmeRow.focus()
  await readmeRow.click()

  await expect(dolphinPage.locator('.rich-markdown-editor')).toBeVisible({ timeout: 25_000 })
  await pressShortcut(dolphinPage, 'f')

  await expect(
    dolphinPage.getByRole('textbox', { name: 'Find in rich markdown editor' })
  ).toBeVisible()
})
