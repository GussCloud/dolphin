import { test, expect } from './helpers/dolphin-app'
import { getStoreState, waitForSessionReady } from './helpers/store'

test.describe('usage overview', () => {
  test.beforeEach(async ({ dolphinPage }) => {
    await waitForSessionReady(dolphinPage)
  })

  test('Stats & Usage opens on the combined overview with provider controls', async ({
    dolphinPage
  }) => {
    await dolphinPage.evaluate(() => {
      const state = window.__store!.getState()
      state.openSettingsPage()
    })

    await expect
      .poll(async () => getStoreState<string>(dolphinPage, 'activeView'), { timeout: 5_000 })
      .toBe('settings')
    await dolphinPage.getByRole('button', { name: 'Stats & Usage' }).click()
    await expect(dolphinPage.getByRole('heading', { name: 'Usage Analytics' })).toBeVisible()
    const providerDropdown = dolphinPage.getByTestId('usage-provider-select')
    await expect(providerDropdown).toHaveAttribute(
      'aria-label',
      'Usage analytics provider: Overview'
    )
    await expect(dolphinPage.getByTestId('usage-overview-pane')).toBeVisible()
    await expect(dolphinPage.getByRole('heading', { name: 'Usage Overview' })).toBeVisible()
    await expect(dolphinPage.getByRole('heading', { name: 'Providers' })).toBeVisible()
    await expect(dolphinPage.getByRole('button', { name: 'Enable Claude' })).toBeVisible()
    await expect(dolphinPage.getByRole('button', { name: 'Enable Codex' })).toBeVisible()
    await expect(dolphinPage.getByRole('button', { name: 'Enable OpenCode' })).toBeVisible()

    await providerDropdown.click()
    await dolphinPage.getByRole('menuitem', { name: 'Codex', exact: true }).click()
    await expect(dolphinPage.getByRole('heading', { name: 'Codex Usage Tracking' })).toBeVisible()
    await expect(providerDropdown).toHaveAttribute('aria-label', 'Usage analytics provider: Codex')

    await providerDropdown.click()
    await dolphinPage.getByRole('menuitem', { name: 'OpenCode', exact: true }).click()
    await expect(
      dolphinPage.getByRole('heading', { name: 'OpenCode Usage Tracking' })
    ).toBeVisible()
    await expect(providerDropdown).toHaveAttribute(
      'aria-label',
      'Usage analytics provider: OpenCode'
    )
  })
})
