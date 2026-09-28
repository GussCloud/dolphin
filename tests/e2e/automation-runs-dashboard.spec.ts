/**
 * End-to-end coverage for the Automations runs surface.
 *
 * The test intentionally does not depend on seeded run history: a fresh E2E
 * profile may have no automations, but the Runs navigation and empty state must
 * still be usable.
 */

import { test, expect } from './helpers/dolphin-app'
import { waitForSessionReady } from './helpers/store'

test('opens the runs dashboard and returns to automations', async ({ dolphinPage }) => {
  await waitForSessionReady(dolphinPage)

  await dolphinPage.evaluate(() => {
    const store = window.__store
    if (!store) {
      throw new Error('window.__store is not available')
    }
    store.getState().openAutomationsPage()
  })

  const runsButton = dolphinPage.getByRole('button', { name: 'Runs' })
  await expect(runsButton).toBeVisible()
  await runsButton.click()

  await expect(
    dolphinPage.getByRole('navigation', { name: 'Automations breadcrumb' })
  ).toBeVisible()
  await expect(dolphinPage.getByText('Successful · 24h')).toBeVisible()
  await expect(dolphinPage.getByText('Failed · 24h')).toBeVisible()
  await expect(dolphinPage.getByText('Successful · 7d')).toBeVisible()
  await expect(dolphinPage.getByText('Failed · 7d')).toBeVisible()
  await expect(dolphinPage.getByRole('button', { name: 'Filters' })).toBeVisible()
  await expect(dolphinPage.getByRole('button', { name: 'Refresh runs' })).toBeVisible()
  await expect(dolphinPage.getByText('Automation', { exact: true })).toBeVisible()
  await expect(dolphinPage.getByText('Triggered', { exact: true })).toBeVisible()
  await expect(dolphinPage.getByText('Status', { exact: true })).toBeVisible()

  await dolphinPage
    .getByRole('navigation', { name: 'Automations breadcrumb' })
    .getByRole('button', { name: 'Automations' })
    .click()
  await expect(dolphinPage.getByRole('heading', { name: 'Automations' })).toBeVisible()
  await expect(runsButton).toBeVisible()
})
