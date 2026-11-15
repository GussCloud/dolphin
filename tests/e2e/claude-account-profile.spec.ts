import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ElectronApplication } from '@playwright/test'
import { test, expect } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'

function appPath(electronApp: ElectronApplication, name: 'home' | 'userData'): Promise<string> {
  return electronApp.evaluate(({ app }, which) => app.getPath(which), name)
}

test.describe('Claude account profile screen', () => {
  test('imports only what the user picks and edits the account instructions', async ({
    electronApp,
    appPage
  }, testInfo) => {
    await waitForSessionReady(appPage)
    const home = await appPath(electronApp, 'home')
    const userData = await appPath(electronApp, 'userData')
    mkdirSync(path.join(home, '.claude', 'skills', 'deploy'), { recursive: true })
    writeFileSync(path.join(home, '.claude', 'skills', 'deploy', 'SKILL.md'), 'deploy\n')
    writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), '# personal\n')
    writeFileSync(
      path.join(home, '.claude.json'),
      JSON.stringify({ mcpServers: { vps: { command: 'ssh-mcp' } } })
    )
    await appPage.evaluate(async () => {
      await window.api.settings.set({
        claudeManagedAccounts: [
          {
            id: 'work',
            email: 'me@corp.example',
            managedAuthPath: '/nonexistent/claude-accounts/work/auth',
            authMethod: 'subscription-oauth',
            createdAt: 1,
            updatedAt: 1,
            lastAuthenticatedAt: 1
          }
        ]
      })
      await window.__store?.getState().fetchSettings()
      const state = window.__store?.getState()
      state?.openSettingsTarget({ pane: 'accounts', repoId: null, sectionId: 'accounts-claude' })
      state?.openSettingsPage()
    })

    const section = appPage.locator('#accounts-claude')
    await section.getByRole('button', { name: 'Profile' }).click({ timeout: 15_000 })
    const dialog = appPage.getByRole('dialog', { name: 'Profile of me@corp.example' })
    await expect(dialog).toBeVisible()
    const mcp = dialog.getByRole('checkbox', { name: 'MCP server vps' })
    await expect(mcp).not.toBeChecked()
    await dialog.getByRole('checkbox', { name: 'Skill deploy' }).click()
    await dialog.screenshot({ path: testInfo.outputPath('claude-profile.png') })
    await dialog.getByRole('button', { name: 'Import selected' }).click()

    const profile = path.join(userData, 'claude-accounts', 'work', 'config')
    await expect
      .poll(() => existsSync(path.join(profile, 'skills', 'deploy', 'SKILL.md')))
      .toBe(true)
    // Not chosen, so the personal MCP server never reached the account.
    expect(existsSync(path.join(profile, '.claude.json'))).toBe(false)

    await dialog.getByRole('textbox', { name: 'Instructions (CLAUDE.md)' }).fill('# company\n')
    await dialog.getByRole('button', { name: 'Save instructions' }).click()
    await expect
      .poll(() =>
        existsSync(path.join(profile, 'CLAUDE.md'))
          ? readFileSync(path.join(profile, 'CLAUDE.md'), 'utf-8')
          : ''
      )
      .toBe('# company\n')
    expect(readFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'utf-8')).toBe('# personal\n')
  })
})
