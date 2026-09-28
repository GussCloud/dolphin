import { test, expect } from './helpers/dolphin-app'
import { getStoreState, waitForSessionReady } from './helpers/store'

test.describe('usage overview', () => {
  test.beforeEach(async ({ appPage }) => {
    await waitForSessionReady(appPage)
  })

  test('Stats & Usage opens on the combined overview with provider controls', async ({
    appPage
  }) => {
    await appPage.evaluate(() => {
      const state = window.__store!.getState()
      state.openSettingsPage()
    })

    await expect
      .poll(async () => getStoreState<string>(appPage, 'activeView'), { timeout: 5_000 })
      .toBe('settings')
    await appPage.getByRole('button', { name: 'Stats & Usage' }).click()
    await expect(appPage.getByRole('heading', { name: 'Usage Analytics' })).toBeVisible()
    const providerDropdown = appPage.getByTestId('usage-provider-select')
    await expect(providerDropdown).toHaveAttribute(
      'aria-label',
      'Usage analytics provider: Overview'
    )
    await expect(appPage.getByTestId('usage-overview-pane')).toBeVisible()
    await expect(appPage.getByRole('heading', { name: 'Usage Overview' })).toBeVisible()
    await expect(appPage.getByRole('heading', { name: 'Providers' })).toBeVisible()
    await expect(appPage.getByRole('button', { name: 'Enable Claude' })).toBeVisible()
    await expect(appPage.getByRole('button', { name: 'Enable Codex' })).toBeVisible()
    await expect(appPage.getByRole('button', { name: 'Enable OpenCode' })).toBeVisible()

    await providerDropdown.click()
    await appPage.getByRole('menuitem', { name: 'Codex', exact: true }).click()
    await expect(appPage.getByRole('heading', { name: 'Codex Usage Tracking' })).toBeVisible()
    await expect(providerDropdown).toHaveAttribute('aria-label', 'Usage analytics provider: Codex')

    await providerDropdown.click()
    await appPage.getByRole('menuitem', { name: 'OpenCode', exact: true }).click()
    await expect(appPage.getByRole('heading', { name: 'OpenCode Usage Tracking' })).toBeVisible()
    await expect(providerDropdown).toHaveAttribute(
      'aria-label',
      'Usage analytics provider: OpenCode'
    )
  })
})
