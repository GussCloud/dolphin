import { expect, test } from './helpers/dolphin-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import { crashGuestRenderer } from './browser-guest-runtime-oracle'
import { observeBrowserLoadingSurface } from './browser-loading-surface-oracle'

test('browser host follows the theme before content and preserves the webpage canvas', async ({
  appPage,
  electronApp
}, testInfo) => {
  await waitForSessionReady(appPage)
  await ensureTerminalVisible(appPage)
  await waitForActiveWorktree(appPage)
  const observations = await observeBrowserLoadingSurface(
    appPage,
    (name) => testInfo.outputPath(name),
    async (id) => {
      await crashGuestRenderer(electronApp, id)
    }
  )
  expect(observations.filter((entry) => !entry.pass)).toEqual([])
})
