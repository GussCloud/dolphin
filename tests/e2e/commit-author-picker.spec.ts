/**
 * The commit author is picked from authors registered in Dolphin (no free typing), a new one is
 * registered from the picker, and the list is shared by project settings and the add-project flow.
 */
import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from './helpers/dolphin-app'
import { openSidebarProjectDialog } from './helpers/sidebar-project-dialog'
import { getStoreState, waitForSessionReady } from './helpers/store'
import type { Repo } from '../../src/shared/repo-types'

const AUTHOR_LABEL = 'Pessoa Teste <pessoa@example.test>'

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const screenshotPath = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path: screenshotPath })
  await testInfo.attach(name, { path: screenshotPath, contentType: 'image/png' })
}

async function setLanguage(page: Page, uiLanguage: 'en' | 'pt-BR'): Promise<void> {
  await page.evaluate(
    (language) => window.__store!.getState().updateSettings({ uiLanguage: language }),
    uiLanguage
  )
}

test.describe('Commit author picker', () => {
  test('registers a new author from project settings and offers it when creating a project', async ({
    appPage
  }, testInfo) => {
    await waitForSessionReady(appPage)
    const repos = await getStoreState<Repo[]>(appPage, 'repos')
    expect(repos.length).toBeGreaterThan(0)
    const repo = repos[0]

    await setLanguage(appPage, 'pt-BR')
    await appPage.evaluate((repoId) => {
      const state = window.__store!.getState()
      state.openSettingsTarget({ pane: 'repo', repoId })
      state.openSettingsPage()
    }, repo.id)

    const repoSection = appPage.locator(`[data-settings-section="repo-${repo.id}"]`)
    const authorPicker = repoSection.getByRole('combobox', { name: 'Autor do commit' })
    await expect(authorPicker).toBeVisible({ timeout: 10_000 })
    await authorPicker.scrollIntoViewIfNeeded()
    await expect(authorPicker).toContainText('Identidade do git config (padrão)')
    // No free-typed author fields until the user asks to register one.
    await expect(repoSection.getByLabel('Nome do autor')).toHaveCount(0)

    await repoSection.getByRole('button', { name: 'Novo autor' }).click()
    await repoSection.getByLabel('Nome do autor').fill('Pessoa Teste')
    await repoSection.getByLabel('E-mail do autor').fill('pessoa@example.test')
    await attachScreenshot(appPage, testInfo, 'commit-author-new-form-pt-br')
    await repoSection.getByRole('button', { name: 'Adicionar autor' }).click()

    await expect(authorPicker).toContainText(AUTHOR_LABEL)
    // The picked author stays editable, for corrections.
    await expect(repoSection.getByLabel('Nome do autor')).toHaveValue('Pessoa Teste')
    await repoSection.getByRole('button', { name: 'Salvar autor' }).click()
    await expect(repoSection.getByRole('button', { name: 'Salvar autor' })).toBeDisabled()
    await attachScreenshot(appPage, testInfo, 'commit-author-saved-pt-br')

    // The registered author is offered in the add-project flow too.
    await appPage.keyboard.press('Escape')
    await setLanguage(appPage, 'en')
    await appPage.evaluate(() => window.__store!.getState().closeSettingsPage())
    await openSidebarProjectDialog(appPage)
    const dialog = appPage.getByRole('dialog', { name: /Add a project/i })
    await dialog.getByRole('button', { name: /Create new project/i }).click()
    // Why: the dialog is renamed on this step, so scope to it by role only.
    await appPage.getByRole('dialog').locator('button[aria-expanded="false"]').first().click()
    const createPicker = appPage.getByRole('dialog').getByRole('combobox', {
      name: 'Commit author'
    })
    await expect(createPicker).toBeVisible()
    await createPicker.click()
    await expect(appPage.getByRole('option', { name: AUTHOR_LABEL })).toBeVisible()
    await attachScreenshot(appPage, testInfo, 'commit-author-create-project')
  })
})
