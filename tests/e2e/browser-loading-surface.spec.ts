import { expect, test } from './helpers/dolphin-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { crashGuestRenderer } from './browser-guest-runtime-oracle'
import { observeBrowserLoadingSurface } from './browser-loading-surface-oracle'

test('browser host follows the theme before content and preserves the webpage canvas', async ({
  dolphinPage,
  electronApp
}, testInfo) => {
  await waitForSessionReady(dolphinPage)
  await ensureTerminalVisible(dolphinPage)
  await waitForActiveWorktree(dolphinPage)
  const observations = await observeBrowserLoadingSurface(
    dolphinPage,
    (name) => testInfo.outputPath(name),
    async (id) => {
      await crashGuestRenderer(electronApp, id)
    }
  )
  expect(observations.filter((entry) => !entry.pass)).toEqual([])
})
