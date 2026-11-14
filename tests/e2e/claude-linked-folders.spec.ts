import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ElectronApplication } from '@playwright/test'
import { test, expect } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'

function isolatedHome(electronApp: ElectronApplication): Promise<string> {
  return electronApp.evaluate(({ app }) => app.getPath('home'))
}

function claudeFolder(
  dir: string,
  email: string,
  statePath = path.join(dir, '.claude.json')
): void {
  mkdirSync(dir, { recursive: true })
  writeFileSync(statePath, JSON.stringify({ oauthAccount: { emailAddress: email } }))
}

test.describe('Claude account folders from a terminal menu', () => {
  test('finds the menu folders, links one as is, and leaves the menu untouched', async ({
    electronApp,
    appPage
  }, testInfo) => {
    await waitForSessionReady(appPage)
    const home = await isolatedHome(electronApp)
    claudeFolder(path.join(home, '.claude'), 'me@personal.example', path.join(home, '.claude.json'))
    claudeFolder(path.join(home, '.claude-empresa'), 'me@corp.example')
    const menu = [
      'claude() {',
      '  echo "1) Pessoal  2) Empresa"; read -r opcao',
      '  case "$opcao" in',
      '    2) CLAUDE_CONFIG_DIR="$HOME/.claude-empresa" command claude "$@" ;;',
      '    *) command claude "$@" ;;',
      '  esac',
      '}'
    ].join('\n')
    writeFileSync(path.join(home, '.claude', 'contas.zsh'), menu)
    writeFileSync(path.join(home, '.zshrc'), 'source ~/.claude/contas.zsh\n')

    await appPage.evaluate(() => {
      const state = window.__store?.getState()
      if (!state) {
        throw new Error('store unavailable')
      }
      state.openSettingsTarget({ pane: 'accounts', repoId: null, sectionId: 'accounts-claude' })
      state.openSettingsPage()
    })
    const section = appPage.locator('#accounts-claude')
    await expect(section.getByText('Account folders you already use')).toBeVisible({
      timeout: 15_000
    })
    await expect(section.getByText(path.join(home, '.claude', 'contas.zsh'))).toBeVisible()
    await expect(section.getByText('me@corp.example')).toBeVisible()
    await expect(section.getByText('Default folder')).toBeVisible()
    await section.screenshot({ path: testInfo.outputPath('claude-folders-found.png') })

    // Folders are listed in the menu's order: the company folder comes first.
    await section.getByRole('button', { name: 'Link', exact: true }).first().click()

    await expect(
      section.getByText(`Linked folder ${path.join(home, '.claude-empresa')}`)
    ).toBeVisible({ timeout: 15_000 })
    const accounts = await appPage.evaluate(() => window.api.claudeAccounts.list())
    expect(accounts.accounts).toEqual([
      expect.objectContaining({
        email: 'me@corp.example',
        linkedConfigDir: path.join(home, '.claude-empresa')
      })
    ])
    // The user's own menu and folder are untouched.
    expect(readFileSync(path.join(home, '.claude', 'contas.zsh'), 'utf-8')).toBe(menu)
    expect(existsSync(path.join(home, '.claude-empresa', '.credentials.json'))).toBe(false)
    await section.screenshot({ path: testInfo.outputPath('claude-folder-linked.png') })
  })
})
