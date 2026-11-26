import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { ElectronApplication } from '@playwright/test'
import { test, expect } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'

const FAKE_KEY = 'sk-ant-test-fake'

function appPath(electronApp: ElectronApplication, name: 'home' | 'userData'): Promise<string> {
  return electronApp.evaluate(({ app }, which) => app.getPath(which), name)
}

function keyFiles(home: string): string[] {
  const dir = path.join(home, '.dolphin', 'claude-api-keys')
  return existsSync(dir) ? readdirSync(dir).map((name) => path.join(dir, name)) : []
}

test.describe('Claude API accounts', () => {
  test('adds an API account with an encrypted key, marks it, and removes it with its key', async ({
    electronApp,
    appPage
  }) => {
    await waitForSessionReady(appPage)
    if (process.platform === 'linux') {
      // Why: Linux CI has no keyring, so the app (rightly) refuses the save; this test-only switch
      // gives safeStorage an in-memory key, which is what the flow under test needs.
      await electronApp.evaluate(({ safeStorage }) => safeStorage.setUsePlainTextEncryption(true))
    }
    const home = await appPath(electronApp, 'home')
    const userData = await appPath(electronApp, 'userData')
    // Why: the host OS locale drives the default UI language; pin English for stable locators.
    await appPage.evaluate(() => window.__store?.getState().updateSettings({ uiLanguage: 'en' }))
    await appPage.evaluate(() => {
      const state = window.__store?.getState()
      state?.openSettingsTarget({ pane: 'accounts', repoId: null, sectionId: 'accounts-claude' })
      state?.openSettingsPage()
    })

    const section = appPage.locator('#accounts-claude')
    const apiAccounts = section.getByTestId('claude-api-accounts')
    await apiAccounts.getByRole('button', { name: 'Add API account' }).click({ timeout: 15_000 })
    await apiAccounts.getByLabel('Name').fill('Work API')
    await apiAccounts.getByLabel('Anthropic API key').fill(FAKE_KEY)
    await apiAccounts.getByRole('button', { name: 'Add account' }).click()

    const row = section.locator('[data-claude-account-kind="api-key"]')
    await expect(row).toContainText('Work API', { timeout: 15_000 })
    await expect(row).toContainText('API key')
    await expect(row.getByRole('button', { name: 'Replace key' })).toBeVisible()
    await expect(row.getByRole('button', { name: 'Re-authenticate' })).toHaveCount(0)

    const [keyFile] = keyFiles(home)
    expect(keyFile).toBeTruthy()
    expect(readFileSync(keyFile, 'utf-8')).not.toContain(FAKE_KEY)
    const accountId = path.basename(keyFile, '.enc')
    expect(
      existsSync(
        path.join(userData, 'claude-accounts', accountId, 'config', '.dolphin-claude-profile.json')
      )
    ).toBe(true)
    // The plan account plain `claude` uses never moved to the API account.
    const activeId = await appPage.evaluate(
      async () => (await window.api.claudeAccounts.list()).activeAccountId
    )
    expect(activeId).not.toBe(accountId)

    await row.getByRole('button', { name: 'Remove' }).click()
    await appPage.getByRole('button', { name: 'Remove Account' }).click()

    await expect(row).toHaveCount(0, { timeout: 15_000 })
    expect(keyFiles(home)).toEqual([])
    expect(existsSync(path.join(userData, 'claude-accounts', accountId))).toBe(false)
  })
})
