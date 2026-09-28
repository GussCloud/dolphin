import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from './helpers/dolphin-app'

test('panel consent enables real local transcript search; clearing restores history', async ({
  electronApp,
  appPage,
  seededRepoPath
}, testInfo) => {
  const home = await electronApp.evaluate(({ app }) => app.getPath('home'))
  const directory = path.join(home, '.claude', 'projects', '-synthetic-pr7')
  mkdirSync(directory, { recursive: true })
  const sessionId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
  writeFileSync(
    path.join(directory, `${sessionId}.jsonl`),
    `${[
      {
        type: 'user',
        sessionId,
        cwd: seededRepoPath,
        timestamp: new Date().toISOString(),
        message: { role: 'user', content: 'Synthetic panel transcript' }
      },
      {
        type: 'assistant',
        sessionId,
        timestamp: new Date().toISOString(),
        message: {
          role: 'assistant',
          content: 'The nebulariver implementation handles <script>literal text</script> safely.'
        }
      }
    ]
      .map((record) => JSON.stringify(record))
      .join('\n')}\n`
  )
  await appPage.evaluate(() => {
    const state = window.__store?.getState()
    state?.setRightSidebarOpen(true)
    state?.setRightSidebarTab('vault')
    state?.setRightSidebarWidth(400)
  })
  await appPage.getByRole('button', { name: 'Agents', exact: true }).click()
  await appPage.getByRole('radio', { name: 'All', exact: true }).click()
  const input = appPage.getByRole('textbox', { name: 'Search sessions', exact: true })
  await input.fill('nebulariver')
  await expect(appPage.getByText('Enable full-text search?', { exact: false })).toBeVisible()
  const cdp = await appPage.context().newCDPSession(appPage)
  async function screenshot(name: string) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
    const screenshotPath = testInfo.outputPath(name)
    writeFileSync(screenshotPath, Buffer.from(data, 'base64'))
    await testInfo.attach(name, { path: screenshotPath, contentType: 'image/png' })
  }
  await screenshot('consent.png')
  await appPage.getByRole('button', { name: 'Enable', exact: true }).click()
  // Indexed searches are snapshots; enabling starts indexing independently of the panel.
  await expect
    .poll(
      () =>
        appPage.evaluate(async () => (await window.api.aiVault.searchStatus('local')).filesIndexed),
      { timeout: 30_000 }
    )
    .toBeGreaterThan(0)
  await appPage.getByRole('button', { name: 'Refresh Session History', exact: true }).click()
  await expect(appPage.locator('mark').filter({ hasText: 'nebulariver' })).toBeVisible()
  await expect(appPage.getByText('Synthetic panel transcript', { exact: true })).toBeVisible()
  await screenshot('results.png')
  await appPage.getByTitle('Drag to resume in a new tab', { exact: true }).click()
  await expect(appPage.locator('mark').filter({ hasText: 'nebulariver' })).toBeVisible()
  await appPage.getByTitle('Drag to resume in a new tab', { exact: true }).click()
  const title = appPage.getByText('Synthetic panel transcript', { exact: true })
  await expect(title).toHaveAttribute('draggable', 'true')
  const drag = await title.evaluate((element) => {
    const dataTransfer = new DataTransfer()
    element.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }))
    const payload = dataTransfer.getData('application/x-dolphin-ai-vault-session')
    element.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }))
    return payload
  })
  expect(JSON.parse(drag)).toMatchObject({ sessionId, sessionExecutionHostId: 'local' })
  await title.click({ button: 'right' })
  await expect(
    appPage.getByRole('menuitem', { name: 'Copy Session ID', exact: true })
  ).toBeVisible()
  await appPage.keyboard.press('Escape')
  await expect(appPage.locator('[role="menu"]')).toHaveCount(0)
  await appPage.evaluate(async () => {
    await window.__store?.getState().updateSettingsOrThrow({ theme: 'dark' })
    window.__store?.getState().setRightSidebarWidth(280)
  })
  await expect(appPage.locator('html')).toHaveClass(/dark/)
  await screenshot('results-dark-narrow.png')
  await title.click({ button: 'right' })
  await appPage.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await appPage.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(title).toHaveCount(0)
  await expect(appPage.locator('mark')).toHaveCount(0)
  await input.fill('nothingmatchesprseven')
  await expect(
    appPage.getByText('No matching sessions in the indexed history.', { exact: false })
  ).toBeVisible()
  await screenshot('empty.png')
  await input.press('Escape')
  await expect(input).toHaveValue('')
  await expect(appPage.getByText('Indexed history · best matches', { exact: false })).toHaveCount(0)
  await cdp.detach()
})

test('panel renders transport failure and unavailable reasons without a local fallback', async ({
  electronApp,
  appPage
}, testInfo) => {
  await appPage.evaluate(async () => {
    await window.__store
      ?.getState()
      .updateSettingsOrThrow({ aiVaultSearch: { enabled: true, historyDays: null } })
    window.__store?.getState().setRightSidebarOpen(true)
    window.__store?.getState().setRightSidebarTab('vault')
  })
  await electronApp.evaluate(({ ipcMain }) => {
    ipcMain.removeHandler('aiVault:searchSessions')
    ipcMain.handle('aiVault:searchSessions', () => {
      throw new Error('Synthetic transport failure')
    })
  })
  const input = appPage.getByRole('textbox', { name: 'Search sessions', exact: true })
  await input.fill('needle')
  await expect(appPage.getByText('Could not search this computer.', { exact: false })).toBeVisible()
  await appPage.screenshot({ path: testInfo.outputPath('failure.png') })
  for (const reason of ['disabled', 'not-ready', 'no-service'] as const) {
    await electronApp.evaluate(({ ipcMain }, value) => {
      ipcMain.removeHandler('aiVault:searchSessions')
      ipcMain.handle('aiVault:searchSessions', () => ({ kind: 'unavailable', reason: value }))
    }, reason)
    await appPage.getByRole('button', { name: 'Try again', exact: true }).click()
    const copy =
      reason === 'disabled'
        ? 'Search is disabled on this computer.'
        : reason === 'not-ready'
          ? 'The search index is not ready yet.'
          : 'Search is unavailable on this computer.'
    await expect(appPage.getByText(copy, { exact: false })).toBeVisible()
  }
})
