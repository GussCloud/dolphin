import { test, expect } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'

test.describe('Accounts for projects from before per-project accounts', () => {
  test('asks once which accounts an older project uses, then remembers the answer', async ({
    appPage
  }, testInfo) => {
    await waitForSessionReady(appPage)
    const repoId = await appPage.evaluate(() => {
      const state = window.__store?.getState()
      const repo = state?.repos.find((entry) => entry.id === state.activeRepoId) ?? state?.repos[0]
      if (!state || !repo) {
        throw new Error('no project')
      }
      // A project saved by an older version: no review mark, no account of its own.
      const { accountSetupReviewedAt: _reviewed, ...legacy } = repo
      window.__store?.setState({
        repos: state.repos.map((entry) => (entry.id === repo.id ? legacy : entry)),
        activeRepoId: repo.id
      })
      return repo.id
    })

    const dialog = appPage.getByRole('dialog', { name: /Choose the accounts for/ })
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    for (const provider of ['GitHub', 'Claude', 'Codex']) {
      await expect(dialog.getByRole('combobox', { name: provider, exact: true })).toBeVisible()
    }
    await dialog.screenshot({ path: testInfo.outputPath('legacy-project-accounts.png') })

    await dialog.getByRole('button', { name: 'Keep this PC’s defaults' }).click()
    await expect(dialog).toBeHidden()
    const reviewed = await appPage.evaluate(
      async (id) =>
        (await window.api.repos.list()).find((repo) => repo.id === id)?.accountSetupReviewedAt,
      repoId
    )
    expect(typeof reviewed).toBe('number')
  })

  test("shows the selected project's Claude account and its email in the footer", async ({
    appPage
  }, testInfo) => {
    await waitForSessionReady(appPage)
    await appPage.evaluate(() => {
      const state = window.__store?.getState()
      const repo = state?.repos.find((entry) => entry.id === state.activeRepoId) ?? state?.repos[0]
      if (!state || !repo || !state.settings) {
        throw new Error('no project')
      }
      const account = (id: string, email: string) => ({
        id,
        email,
        managedAuthPath: `/managed/${id}`,
        authMethod: 'subscription-oauth' as const,
        createdAt: 1,
        updatedAt: 1,
        lastAuthenticatedAt: 1
      })
      window.__store?.setState({
        settings: {
          ...state.settings,
          claudeManagedAccounts: [
            account('personal', 'me@personal.example'),
            account('work', 'me@corp.example')
          ],
          activeClaudeManagedAccountId: 'personal',
          activeClaudeManagedAccountIdsByRuntime: { host: 'personal', wsl: {} }
        },
        repos: state.repos.map((entry) =>
          entry.id === repo.id ? { ...entry, claudeAccountId: 'work' } : entry
        ),
        activeRepoId: repo.id
      })
    })

    const footerAccount = appPage.locator('[data-footer-claude-account]')
    await expect(footerAccount).toHaveText('me@corp.example', { timeout: 15_000 })
    await expect(footerAccount).toHaveAttribute('data-footer-claude-account', 'project')
    await footerAccount.locator('xpath=ancestor::button[1]').screenshot({
      path: testInfo.outputPath('footer-project-account.png')
    })

    // A project without its own account shows the active one.
    await appPage.evaluate(() => {
      const state = window.__store?.getState()
      window.__store?.setState({
        repos: (state?.repos ?? []).map((entry) => ({ ...entry, claudeAccountId: undefined }))
      })
    })
    await expect(footerAccount).toHaveText('me@personal.example')
    await expect(footerAccount).toHaveAttribute('data-footer-claude-account', 'active')
  })
})
