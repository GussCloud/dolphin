/**
 * End-to-end coverage for the Automations runs surface.
 *
 * The test intentionally does not depend on seeded run history: a fresh E2E
 * profile may have no automations, but the Runs navigation and empty state must
 * still be usable.
 */

import { test, expect } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'

test('opens the runs dashboard and returns to automations', async ({ appPage }) => {
  await waitForSessionReady(appPage)

  await appPage.evaluate(() => {
    const store = window.__store
    if (!store) {
      throw new Error('window.__store is not available')
    }
    store.getState().openAutomationsPage()
  })

  const runsButton = appPage.getByRole('button', { name: 'Runs' })
  await expect(runsButton).toBeVisible()
  await runsButton.click()

  await expect(appPage.getByRole('navigation', { name: 'Automations breadcrumb' })).toBeVisible()
  await expect(appPage.getByText('Successful · 24h')).toBeVisible()
  await expect(appPage.getByText('Failed · 24h')).toBeVisible()
  await expect(appPage.getByText('Successful · 7d')).toBeVisible()
  await expect(appPage.getByText('Failed · 7d')).toBeVisible()
  await expect(appPage.getByRole('button', { name: 'Filters' })).toBeVisible()
  await expect(appPage.getByRole('button', { name: 'Refresh runs' })).toBeVisible()
  await expect(appPage.getByText('Automation', { exact: true })).toBeVisible()
  await expect(appPage.getByText('Triggered', { exact: true })).toBeVisible()
  await expect(appPage.getByText('Status', { exact: true })).toBeVisible()

  await appPage
    .getByRole('navigation', { name: 'Automations breadcrumb' })
    .getByRole('button', { name: 'Automations' })
    .click()
  await expect(appPage.getByRole('heading', { name: 'Automations' })).toBeVisible()
  await expect(runsButton).toBeVisible()
})
