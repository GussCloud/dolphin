import { test, expect } from './helpers/dolphin-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'
import {
  execInTerminal,
  focusActiveTerminalInput,
  getTerminalContent,
  waitForActivePanePtyId,
  waitForActiveTerminalManager
} from './helpers/terminal'

test('terminal search counts real matches and repeat find selects the query', async ({
  appPage
}, testInfo) => {
  await waitForSessionReady(appPage)
  await waitForActiveWorktree(appPage)
  await ensureTerminalVisible(appPage)
  await waitForActiveTerminalManager(appPage, 30_000)
  const ptyId = await waitForActivePanePtyId(appPage)
  for (let line = 0; line < 3; line++) {
    await execInTerminal(appPage, ptyId, 'echo dolphin-search-proof')
  }
  await expect
    .poll(
      async () =>
        (await getTerminalContent(appPage))
          .split(/\r?\n/)
          .filter((line) => line.trim() === 'dolphin-search-proof').length
    )
    .toBe(3)
  await focusActiveTerminalInput(appPage)
  const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
  await appPage.keyboard.press(`${modifier}+f`)
  const search = appPage.locator('[data-terminal-search-root]')
  const input = search.locator('input')
  await expect(input).toBeFocused()
  await search.getByTitle('Regex', { exact: true }).click()
  const query = '^dolphin-search-proof$'
  await input.fill(query)
  await expect(search).toContainText(/[1-3]\/3/)
  const initialCount = await search.innerText()
  await input.press('Enter')
  await expect.poll(() => search.innerText()).not.toBe(initialCount)
  await appPage.screenshot({ path: testInfo.outputPath('search-results.png') })
  await input.press('ArrowLeft')
  await appPage.keyboard.press(`${modifier}+f`)
  await expect(input).toBeFocused()
  await expect
    .poll(() =>
      input.evaluate((element) => ({ start: element.selectionStart, end: element.selectionEnd }))
    )
    .toEqual({ start: 0, end: query.length })
  await appPage.screenshot({ path: testInfo.outputPath('search-query-selected.png') })
  await input.fill('no-such-search-result-314159')
  await expect(search).toContainText('No results')
  await input.press('Escape')
  await expect(search).toBeHidden()
})
